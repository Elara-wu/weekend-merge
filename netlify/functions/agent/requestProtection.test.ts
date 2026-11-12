import { describe, expect, it } from "vitest";
import { createPlanningLimiter, planningClientKey, validateRequestDate } from "./requestProtection";

describe("warm-instance planning guard", () => {
  it("allows five requests, isolates keys and resets exactly at ten minutes", () => {
    const limiter = createPlanningLimiter();
    for (let index = 0; index < 5; index++) expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 599999)).toBe(false);
    expect(limiter.allow("b", 599999)).toBe(true);
    expect(limiter.allow("a", 600000)).toBe(true);
  });
  it("evicts the oldest key at 5000 entries", () => {
    const limiter = createPlanningLimiter();
    for (let index = 0; index < 5; index++) limiter.allow("oldest", 0);
    for (let index = 0; index < 5000; index++) expect(limiter.allow(`key-${index}`, 1)).toBe(true);
    expect(limiter.allow("oldest", 2)).toBe(true);
  });
  it("prefers the Netlify IP and otherwise uses the first forwarded IP or unknown", () => {
    const request = (headers: HeadersInit) => new Request("http://localhost", { headers });
    expect(planningClientKey(request({ "x-nf-client-connection-ip": "192.0.2.1", "x-forwarded-for": "192.0.2.2, 192.0.2.3" }), "s"))
      .toBe('["192.0.2.1","s"]');
    expect(planningClientKey(request({ "x-forwarded-for": "192.0.2.2, 192.0.2.3" }), "s"))
      .toBe('["192.0.2.2","s"]');
    expect(planningClientKey(request({}), "s")).toBe('["unknown","s"]');
  });
  it("uses Shanghai today and includes the 180th day", () => {
    const now = new Date("2026-11-13T16:00:00Z");
    expect(validateRequestDate("2026-11-14", now)).toBeUndefined();
    expect(validateRequestDate("2027-05-13", now)).toBeUndefined();
    expect(validateRequestDate("2026-11-13", now)?.status).toBe(400);
    expect(validateRequestDate("2027-05-14", now)?.status).toBe(400);
  });
});
