import { describe, expect, it, vi } from "vitest";
import demoRequest from "../../tests/fixtures/plan-request.demo.json";
import { AgentEventSchema, ReplanRequestSchema, type AgentEvent, type ReplanRequest } from "../../src/contracts/agent";
import { shanghaiPlaces } from "./agent/tools/places";
import { handler } from "./replan";

const url = "http://localhost/.netlify/functions/replan";
const post = (body: unknown) => new Request(url, { method: "POST", body: JSON.stringify(body) });
function request(): ReplanRequest {
  const stops = ["shanghai-book-city", "jic-books-pujiang", "manner-xuhui-riverside", "north-bund-aviation-center"].map((id, index) => {
    const place = shanghaiPlaces.find((entry) => entry.placeId === id)!;
    return { id: `stop-${index}`, placeId: id, name: place.name, area: place.area,
      latitude: place.latitude, longitude: place.longitude, tags: place.tags, cost: place.priceRange.max * 2,
      startTime: `${11 + index * 2}:00`, endTime: `${11 + index * 2}:45`, locked: index === 0 || index === 3 };
  });
  return ReplanRequestSchema.parse({
    sessionId: "replan-test", setup: { ...demoRequest.setup, startTime: "10:00", endTime: "20:00", budget: 2000 },
    preferences: {
      a: { ...demoRequest.preferences.a, interests: ["展览", "逛店"], avoid: [], walkingLimitKm: 8 },
      b: { ...demoRequest.preferences.b, interests: ["展览"], avoid: [], walkingLimitKm: 8 },
    },
    plan: { id: "original", title: "原方案", summary: "四站行程", matchScore: 80, totalCost: 110, totalDistanceKm: 10,
      indoorRatio: 75, transfers: 2, stops, reasons: ["共同兴趣"] },
    lockedStopIds: ["stop-0", "stop-3"], rejectedStopId: "stop-1", reason: "换一个展览", replanCount: 0,
  });
}
async function parseEvents(response: Response): Promise<AgentEvent[]> {
  return (await response.text()).trim().split("\n").map((line) => AgentEventSchema.parse(JSON.parse(line)));
}

describe("local replan function", () => {
  it("accepts POST only", async () => {
    const response = await handler(new Request(url));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(await response.json()).toMatchObject({ error: { code: "METHOD_NOT_ALLOWED", retryable: false } });
  });

  it.each(["{", "null", "[]", JSON.stringify({ sessionId: "incomplete" })])("rejects malformed requests: %s", async (body) => {
    const response = await handler(new Request(url, { method: "POST", body }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST", retryable: false } });
  });

  it("rejects a third replan", async () => {
    const response = await handler(post({ ...request(), replanCount: 2 }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST", field: "replanCount" } });
  });

  it.each(["listed", "flagged"])("rejects the rejected stop when it is locked (%s)", async (lock) => {
    const input = request();
    if (lock === "listed") input.lockedStopIds.push("stop-1");
    else input.plan.stops[1].locked = true;
    const response = await handler(post(input));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "LOCKED_STOP_CONFLICT", retryable: false } });
  });

  it.each(["missing-rejected", "missing-locked", "duplicate-stop"])("rejects inconsistent stop identities: %s", async (invalid) => {
    const input = request();
    if (invalid === "missing-rejected") input.rejectedStopId = "absent";
    else if (invalid === "missing-locked") input.lockedStopIds.push("absent");
    else input.plan.stops[2].id = input.plan.stops[1].id;
    const response = await handler(post(input));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
  });

  it("replaces one curated stop, preserves locks byte-for-byte and emits a single verified result with diff", async () => {
    const input = request();
    const response = await handler(post(input));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const events = await parseEvents(response);
    const proposed = events.filter((event) => event.type === "plan.proposed");
    expect(proposed).toHaveLength(1);
    const plan = proposed[0].plan;
    const replacement = plan.stops[1];
    expect(shanghaiPlaces.some((place) => place.placeId === replacement.placeId)).toBe(true);
    expect(input.plan.stops.map((stop) => stop.placeId)).not.toContain(replacement.placeId);
    expect(replacement.id).not.toBe("stop-1");
    for (const index of [0, 3]) expect(JSON.stringify(plan.stops[index])).toBe(JSON.stringify(input.plan.stops[index]));
    expect({ ...plan.stops[2], startTime: input.plan.stops[2].startTime, endTime: input.plan.stops[2].endTime }).toEqual(input.plan.stops[2]);
    expect(events[0].type).toBe("run.started");
    expect(events.filter((event) => event.type === "step.started").map((event) => event.step)).toEqual(["REPLAN", "VERIFY"]);
    expect(events.filter((event) => event.type === "tool.completed").map((event) => event.tool)).toEqual(["estimate_route", "calculate_budget", "validate_plan"]);
    expect(events.filter((event) => ["run.completed", "run.failed"].includes(event.type))).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: "run.completed", result: {
      candidateIds: [plan.id], diff: { replacedStopIds: ["stop-1"], preservedStopIds: ["stop-0", "stop-2", "stop-3"] },
    } });
  });

  it("keeps immediately adjacent locked stops unchanged and is deterministic without network", async () => {
    const input = request();
    input.lockedStopIds = ["stop-0", "stop-2", "stop-3"];
    input.plan.stops[2].locked = true;
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Network is prohibited"); });
    try {
      const first = await parseEvents(await handler(post(input)));
      const second = await parseEvents(await handler(post({ ...input, replanCount: 1 })));
      const firstPlan = first.find((event) => event.type === "plan.proposed")!;
      const secondPlan = second.find((event) => event.type === "plan.proposed")!;
      expect(firstPlan.plan.stops).toEqual(secondPlan.plan.stops);
      for (const index of [0, 2, 3]) expect(firstPlan.plan.stops[index]).toEqual(input.plan.stops[index]);
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });

  it("moves affected timing to fit travel while preserving an unlocked stop outside the affected indices", async () => {
    const input = request();
    input.lockedStopIds = ["stop-0"];
    input.plan.stops[3].locked = false;
    input.plan.stops[1].startTime = "11:45";
    input.plan.stops[1].endTime = "12:30";
    input.plan.stops[2].startTime = "12:30";
    input.plan.stops[2].endTime = "13:15";
    const response = await handler(post(input));
    expect(response.status).toBe(200);
    const proposed = (await parseEvents(response)).find((event) => event.type === "plan.proposed")!;
    expect(proposed.plan.stops[1].startTime).not.toBe("11:45");
    expect(proposed.plan.stops[2].startTime).not.toBe("12:30");
    expect(proposed.plan.stops[0]).toEqual(input.plan.stops[0]);
    expect(proposed.plan.stops[3]).toEqual(input.plan.stops[3]);
  });

  it("ranks suitable exhibition alternatives using shared preference aliases and canonical two-person costs", async () => {
    const input = request();
    input.preferences.a.interests = ["展览"];
    input.preferences.b.interests = ["展览"];
    input.preferences.a.indoorPreference = "室内优先";
    input.preferences.b.indoorPreference = "室内优先";
    const response = await handler(post(input));
    const proposed = (await parseEvents(response)).find((event) => event.type === "plan.proposed")!;
    expect(proposed.plan.stops[1].tags).toContain("展览");
    const venue = shanghaiPlaces.find((place) => place.placeId === proposed.plan.stops[1].placeId)!;
    expect(proposed.plan.stops[1].cost).toBe(venue.priceRange.max * 2);
    // Fixed stops cost 100; each recomputed transit allowance covers two people, then 10% buffer.
    expect(proposed.plan.totalCost).toBe(Math.round((100 + venue.priceRange.max * 2 + proposed.plan.transfers * 8) * 110) / 100);
    expect(proposed.plan.totalDistanceKm).toBeGreaterThan(0);
    expect(proposed.plan.indoorRatio).toBe(75);
  });

  it("replaces a single-stop itinerary without inventing a route leg", async () => {
    const input = request();
    input.plan.stops = [input.plan.stops[1]];
    input.lockedStopIds = [];
    const response = await handler(post(input));
    expect(response.status).toBe(200);
    const proposed = (await parseEvents(response)).find((event) => event.type === "plan.proposed")!;
    expect(proposed.plan.stops).toHaveLength(1);
    expect(proposed.plan.totalDistanceKm).toBe(0);
    expect(proposed.plan.transfers).toBe(0);
  });

  it("assigns a fresh replacement identity even when a preserved stop uses the generated name", async () => {
    const input = request();
    input.plan.stops[0].id = "stop-1-replacement-west-bund-museum";
    input.plan.stops[2].id = "stop-1-replacement-long-museum-west-bund";
    input.plan.stops[3].id = "stop-1-replacement-shanghai-museum-east";
    input.lockedStopIds = [input.plan.stops[0].id, input.plan.stops[3].id];
    const response = await handler(post(input));
    expect(response.status).toBe(200);
    const proposed = (await parseEvents(response)).find((event) => event.type === "plan.proposed")!;
    expect(new Set(proposed.plan.stops.map((stop) => stop.id)).size).toBe(4);
    expect(input.plan.stops.map((stop) => stop.id)).not.toContain(proposed.plan.stops[1].id);
  });

  it.each([0, 3])("replaces an endpoint stop without moving stops outside its local window: %s", async (index) => {
    const input = request();
    input.rejectedStopId = input.plan.stops[index].id;
    input.plan.stops[index].locked = false;
    input.lockedStopIds = input.lockedStopIds.filter((id) => id !== input.rejectedStopId);
    const response = await handler(post(input));
    expect(response.status).toBe(200);
    const proposed = (await parseEvents(response)).find((event) => event.type === "plan.proposed")!;
    expect(proposed.plan.stops[index].placeId).not.toBe(input.plan.stops[index].placeId);
    for (let other = 0; other < 4; other += 1) {
      if (Math.abs(other - index) > 1) expect(proposed.plan.stops[other]).toEqual(input.plan.stops[other]);
    }
  });

  it.each(["all-avoided", "no-time", "budget"])("returns structured 422 when no local replacement validates: %s", async (failure) => {
    const input = request();
    if (failure === "all-avoided") input.preferences.a.avoid = [...new Set(shanghaiPlaces.flatMap((place) => place.tags))];
    else if (failure === "no-time") {
      input.plan.stops[0].endTime = "13:44";
      input.plan.stops[2].startTime = "13:45";
      input.lockedStopIds.push("stop-2");
    } else input.setup.budget = 100;
    const response = await handler(post(input));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "NO_VALID_REPLAN", retryable: false } });
  });
});
