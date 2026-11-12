import { z } from "zod";

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const CACHE_TTL_MS = 30 * 60 * 1000;

export const WeatherInputSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
}).refine(({ start, end }) => Date.parse(start) < Date.parse(end), "Weather interval must be positive");

const HourlyResponseSchema = z.object({
  hourly: z.object({
    time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)).min(1),
    temperature_2m: z.array(z.number().finite()),
    precipitation_probability: z.array(z.number().finite().min(0).max(100)),
    weather_code: z.array(z.number().int().nonnegative()),
  }),
}).refine(({ hourly }) =>
  hourly.time.length === hourly.temperature_2m.length &&
  hourly.time.length === hourly.precipitation_probability.length &&
  hourly.time.length === hourly.weather_code.length,
"Weather arrays must have matching lengths");

export type WeatherInput = z.input<typeof WeatherInputSchema>;
export type WeatherOutput = {
  source: "open-meteo";
  hourly: Array<{
    time: string;
    temperatureC: number;
    precipitationProbability: number;
    weatherCode: number;
  }>;
};

export class AgentToolError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean) {
    super(code);
    this.name = "AgentToolError";
  }
}

function localDate(iso: string): string {
  return new Date(Date.parse(iso) + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

export function createWeatherTool(dependencies: {
  fetch?: typeof fetch;
  now?: () => Date;
  maxEntries?: number;
} = {}): (input: WeatherInput) => Promise<WeatherOutput> {
  const cache = new Map<string, { expiresAt: number; hourly: Promise<WeatherOutput["hourly"]> }>();
  const maxEntries = Math.max(1, Math.min(500, dependencies.maxEntries ?? 500));
  const fetchWeather = dependencies.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const now = dependencies.now ?? (() => new Date());

  return async (input) => {
    const query = WeatherInputSchema.parse(input);
    const startDate = localDate(query.start);
    const endDate = localDate(query.end);
    const key = `${query.latitude.toFixed(3)},${query.longitude.toFixed(3)},${startDate},${endDate}`;
    const nowMs = now().getTime();
    let entry = cache.get(key);

    for (const [cacheKey, cached] of cache) if (cached.expiresAt <= nowMs) cache.delete(cacheKey);
    if (!entry || entry.expiresAt <= nowMs) {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(query.latitude));
      url.searchParams.set("longitude", String(query.longitude));
      url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code");
      url.searchParams.set("timezone", "Asia/Shanghai");
      url.searchParams.set("start_date", startDate);
      url.searchParams.set("end_date", endDate);

      const hourly = (async () => {
        try {
          const response = await fetchWeather(url.toString(), { signal: AbortSignal.timeout(4000) });
          if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
          const { hourly } = HourlyResponseSchema.parse(await response.json());
          return hourly.time.map((time, index) => ({
            time,
            temperatureC: hourly.temperature_2m[index],
            precipitationProbability: hourly.precipitation_probability[index],
            weatherCode: hourly.weather_code[index],
          }));
        } catch {
          throw new AgentToolError("WEATHER_UNAVAILABLE", true);
        }
      })();
      entry = { expiresAt: nowMs + CACHE_TTL_MS, hourly };
      if (cache.size >= maxEntries) cache.delete(cache.keys().next().value!);
      cache.set(key, entry);
      const inserted = entry;
      void hourly.catch(() => { if (cache.get(key) === inserted) cache.delete(key); });
    }

    const startMs = Date.parse(query.start);
    const endMs = Date.parse(query.end);
    const hourly = (await entry.hourly).filter(({ time }) => {
      const hourMs = Date.parse(`${time}+08:00`);
      return hourMs >= startMs && hourMs < endMs;
    });
    if (hourly.length === 0) throw new AgentToolError("WEATHER_UNAVAILABLE", true);
    return { source: "open-meteo", hourly };
  };
}
