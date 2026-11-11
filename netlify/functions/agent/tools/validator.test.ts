import { describe, expect, it } from "vitest";

import type { Itinerary, PersonPreferences, PlanSetup } from "../../../../src/contracts/agent";
import { shanghaiPlaces } from "./places";
import { validatePlan } from "./validator";

const setup: PlanSetup = {
  city: "上海", date: "2026-11-14", startTime: "11:00", endTime: "18:00", budget: 300,
  startingArea: "徐汇滨江",
};
const person: PersonPreferences = {
  interests: ["展览"], pace: "平衡", walkingLimitKm: 3, indoorPreference: "均可",
  foodTags: [], budgetStyle: "平衡", avoid: [], wish: "",
};
const preferences = { a: person, b: person };
const place = shanghaiPlaces.find((item) => item.placeId === "west-bund-museum")!;
const plan: Itinerary = {
  id: "plan-1", title: "Museum visit", summary: "Visit a museum", matchScore: 90,
  totalCost: 100, totalDistanceKm: 1, indoorRatio: 100, transfers: 0,
  reasons: ["Exhibition"],
  stops: [{
    id: "stop-1", placeId: place.placeId, name: place.name, area: place.area,
    startTime: "13:00", endTime: "14:00", cost: 100,
    latitude: place.latitude, longitude: place.longitude, tags: place.tags, locked: false,
  }],
};

function check(overrides: {
  plan?: Itinerary;
  setup?: PlanSetup;
  preferences?: { a: PersonPreferences; b: PersonPreferences };
  places?: typeof shanghaiPlaces;
  walkingDistanceKm?: number;
  lockedStopIds?: string[];
  originalPlan?: Itinerary;
} = {}) {
  return validatePlan({ plan, setup, preferences, places: shanghaiPlaces, lockedStopIds: [], ...overrides });
}

describe("validatePlan", () => {
  it("accepts a plan within all hard constraints", () => {
    expect(check()).toEqual({ valid: true, violations: [], warnings: [] });
  });

  it("rejects budget overflow using stop costs even if the claimed total is lower", () => {
    const result = check({
      setup: { ...setup, budget: 200 },
      plan: { ...plan, totalCost: 100, stops: [{ ...plan.stops[0], cost: 250 }] },
    });
    expect(result.violations.map((item) => item.code)).toContain("BUDGET_EXCEEDED");
  });

  it("rejects a stop outside the planned time range", () => {
    const result = check({ plan: { ...plan, stops: [{ ...plan.stops[0], endTime: "18:30" }] } });
    expect(result.violations.map((item) => item.code)).toContain("OUTSIDE_TIME_RANGE");
  });

  it("reports an impossible setup date as a time-range violation even when schema validation is bypassed", () => {
    const result = check({ setup: { ...setup, date: "2026-11-31" } });
    expect(result.valid).toBe(false);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "OUTSIDE_TIME_RANGE", affectedStopIds: ["stop-1"],
    }));
  });

  it("rejects a closed venue and admission after the cutoff", () => {
    const afterAdmission = check({ plan: { ...plan, stops: [{ ...plan.stops[0], startTime: "17:15", endTime: "17:45" }] } });
    const monday = check({ setup: { ...setup, date: "2026-11-16" } });
    expect(afterAdmission.violations.map((item) => item.code)).toContain("PLACE_CLOSED");
    expect(monday.violations.map((item) => item.code)).toContain("PLACE_CLOSED");
  });

  it("rejects distance above either person's walking limit", () => {
    const result = check({
      plan: { ...plan, totalDistanceKm: 9 },
      walkingDistanceKm: 4,
      preferences: { a: person, b: { ...person, walkingLimitKm: 5 } },
    });
    expect(result.violations.map((item) => item.code)).toContain("WALKING_LIMIT_EXCEEDED");
  });

  it("uses walking distance rather than a longer mixed-mode route", () => {
    expect(check({ plan: { ...plan, totalDistanceKm: 9 }, walkingDistanceKm: 2 }).valid).toBe(true);
  });

  it("rejects avoided place tags for either person", () => {
    const result = check({ preferences: { a: person, b: { ...person, avoid: ["展览"] } } });
    expect(result.violations.map((item) => item.code)).toContain("AVOID_TAG_MATCHED");
  });

  it("rejects repeated place IDs", () => {
    const result = check({ plan: { ...plan, stops: [plan.stops[0], { ...plan.stops[0], id: "stop-2" }] } });
    expect(result.violations.map((item) => item.code)).toContain("DUPLICATE_PLACE");
  });

  it("rejects removal of a locked stop matched by ID", () => {
    const removed = check({ plan: { ...plan, stops: [{ ...plan.stops[0], id: "stop-2" }] }, lockedStopIds: ["stop-1"], originalPlan: plan });
    expect(removed.violations).toContainEqual(expect.objectContaining({ code: "LOCKED_STOP_CHANGED", affectedStopIds: ["stop-1"] }));
  });

  it.each([
    { placeId: "shanghai-book-city" },
    { startTime: "13:30" },
    { endTime: "14:30" },
    { cost: 101 },
  ])("rejects a locked stop changed by %j", (change) => {
    const changed = check({ plan: { ...plan, stops: [{ ...plan.stops[0], ...change }] }, lockedStopIds: ["stop-1"], originalPlan: plan });
    expect(changed.violations).toContainEqual(expect.objectContaining({ code: "LOCKED_STOP_CHANGED", affectedStopIds: ["stop-1"] }));
  });

  it("warns when source verification predates the trip by more than 90 days", () => {
    const result = check({ setup: { ...setup, date: "2027-02-10" } });
    expect(result.valid).toBe(true);
    expect(result.warnings.map((item) => item.code)).toContain("STALE_PLACE_DATA");
  });
});
