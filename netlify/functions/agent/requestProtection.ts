import { jsonError } from "./http";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_KEYS = 5000;
export type PlanningLimiter = { allow: (key: string, nowMs: number) => boolean };

// Warm-instance protection only. Separate Functions instances do not share this state.
export function createPlanningLimiter(): PlanningLimiter {
  const entries = new Map<string, { started: number; count: number }>();
  return { allow(key, nowMs) {
    for (const [entryKey, entry] of entries) {
      if (nowMs - entry.started >= WINDOW_MS) entries.delete(entryKey);
    }
    const entry = entries.get(key);
    if (entry) {
      if (entry.count >= 5) return false;
      entry.count++;
      return true;
    }
    if (entries.size >= MAX_KEYS) entries.delete(entries.keys().next().value!);
    entries.set(key, { started: nowMs, count: 1 });
    return true;
  } };
}

export const productionPlanningLimiter = createPlanningLimiter();

export function planningClientKey(request: Request, sessionId: string): string {
  const ip = request.headers.get("x-nf-client-connection-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return JSON.stringify([ip.slice(0, 256), sessionId]);
}

export function validateRequestDate(date: string, now: Date): Response | undefined {
  const today = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  if (days < 0 || days > 180) return jsonError(400, "INVALID_REQUEST", "Date must be within the next 180 days in Shanghai.", "setup.date");
}
