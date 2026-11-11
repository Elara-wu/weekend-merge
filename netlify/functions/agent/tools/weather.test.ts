import { describe, expect, it, vi } from "vitest";

import { AgentToolError, createWeatherTool } from "./weather";

const weatherInput = {
  latitude: 31.23, longitude: 121.47,
  start: "2026-11-14T12:00:00+08:00", end: "2026-11-14T14:00:00+08:00",
};
const response = {
  hourly: {
    time: ["2026-11-14T13:00"],
    temperature_2m: [17],
    precipitation_probability: [65],
    weather_code: [61],
  },
};

describe("createWeatherTool", () => {
  it("requests the dated Shanghai forecast and returns observed hourly values", async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json(response));
    const weather = createWeatherTool({ fetch: fetchStub, now: () => new Date("2026-11-11T00:00:00Z") });

    expect(await weather(weatherInput)).toEqual({
      source: "open-meteo",
      hourly: [{ time: "2026-11-14T13:00", temperatureC: 17, precipitationProbability: 65, weatherCode: 61 }],
    });
    const url = new URL(fetchStub.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(url.searchParams.get("hourly")).toBe("temperature_2m,precipitation_probability,weather_code");
    expect(url.searchParams.get("timezone")).toBe("Asia/Shanghai");
    expect(url.searchParams.get("start_date")).toBe("2026-11-14");
    expect(url.searchParams.get("end_date")).toBe("2026-11-14");
    expect(fetchStub.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("passes a signal created with the four-second timeout to fetch", async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const fetchStub = vi.fn().mockResolvedValue(Response.json(response));
    try {
      await createWeatherTool({ fetch: fetchStub })(weatherInput);
      expect(timeout).toHaveBeenCalledWith(4000);
      expect(fetchStub.mock.calls[0][1].signal).toBe(signal);
    } finally {
      timeout.mockRestore();
    }
  });

  it("reuses rounded-coordinate forecasts until 30 minutes have elapsed", async () => {
    let now = new Date("2026-11-11T00:00:00Z");
    const fetchStub = vi.fn().mockImplementation(async () => Response.json(response));
    const weather = createWeatherTool({ fetch: fetchStub, now: () => now });

    await weather(weatherInput);
    now = new Date("2026-11-11T00:29:59Z");
    await weather({ ...weatherInput, latitude: 31.2301, longitude: 121.4701 });
    expect(fetchStub).toHaveBeenCalledTimes(1);

    now = new Date("2026-11-11T00:30:00Z");
    await weather(weatherInput);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("filters each interval from a shared daily cached forecast", async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json({ hourly: {
      time: ["2026-11-14T10:00", "2026-11-14T13:00", "2026-11-14T16:00"],
      temperature_2m: [13, 17, 16], precipitation_probability: [10, 65, 40], weather_code: [0, 61, 3],
    } }));
    const weather = createWeatherTool({ fetch: fetchStub });

    const afternoon = await weather(weatherInput);
    const evening = await weather({ ...weatherInput, start: "2026-11-14T15:00:00+08:00", end: "2026-11-14T17:00:00+08:00" });

    expect(afternoon.hourly.map((hour) => hour.time)).toEqual(["2026-11-14T13:00"]);
    expect(evening.hourly.map((hour) => hour.time)).toEqual(["2026-11-14T16:00"]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("selects both Shanghai dates for an interval crossing midnight", async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json({ hourly: {
      time: ["2026-11-14T23:00", "2026-11-15T00:00"],
      temperature_2m: [15, 14], precipitation_probability: [20, 30], weather_code: [3, 3],
    } }));
    const weather = createWeatherTool({ fetch: fetchStub });

    const result = await weather({ ...weatherInput, start: "2026-11-14T22:30:00+08:00", end: "2026-11-15T00:30:00+08:00" });

    expect(result.hourly.map((hour) => hour.time)).toEqual(["2026-11-14T23:00", "2026-11-15T00:00"]);
    const url = new URL(fetchStub.mock.calls[0][0]);
    expect(url.searchParams.get("start_date")).toBe("2026-11-14");
    expect(url.searchParams.get("end_date")).toBe("2026-11-15");
  });

  it("reports an aborted request as retryable unavailable weather", async () => {
    const fetchStub = vi.fn().mockRejectedValue(new DOMException("timed out", "AbortError"));
    const weather = createWeatherTool({ fetch: fetchStub });

    await expect(weather(weatherInput)).rejects.toMatchObject({
      code: "WEATHER_UNAVAILABLE",
      retryable: true,
    } satisfies Partial<AgentToolError>);
  });

  it("reports a non-OK upstream response as retryable unavailable weather", async () => {
    const fetchStub = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(createWeatherTool({ fetch: fetchStub })(weatherInput))
      .rejects.toMatchObject({ code: "WEATHER_UNAVAILABLE", retryable: true });
  });

  it("rejects a forecast with no hour in the requested interval", async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json({ hourly: {
      time: ["2026-11-14T10:00"], temperature_2m: [13],
      precipitation_probability: [10], weather_code: [0],
    } }));
    await expect(createWeatherTool({ fetch: fetchStub })(weatherInput))
      .rejects.toMatchObject({ code: "WEATHER_UNAVAILABLE", retryable: true });
  });

  it("rejects malformed upstream arrays without inventing a forecast", async () => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json({ hourly: {
      time: ["2026-11-14T13:00"], temperature_2m: [], precipitation_probability: [65], weather_code: [61],
    } }));
    const weather = createWeatherTool({ fetch: fetchStub });

    await expect(weather(weatherInput)).rejects.toMatchObject({ code: "WEATHER_UNAVAILABLE", retryable: true });
  });
});
