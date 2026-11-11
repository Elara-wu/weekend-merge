import { describe, expect, it } from "vitest";

import {
  AgentEventSchema,
  PlanRequestSchema,
  ReplanRequestSchema,
} from "./agent";

const preferences = {
  interests: ["展览", "咖啡"],
  pace: "平衡",
  walkingLimitKm: 3,
  indoorPreference: "均可",
  foodTags: ["本帮菜"],
  budgetStyle: "平衡",
  avoid: ["排队"],
  wish: "想看一个展览",
} as const;

const validSetup = {
  city: "上海",
  date: "2026-11-14",
  startTime: "13:00",
  endTime: "20:00",
  budget: 300,
  startingArea: "徐汇",
} as const;

const validItinerary = {
  id: "plan-001",
  title: "徐汇慢游",
  summary: "看展后喝咖啡",
  matchScore: 90,
  totalCost: 240,
  totalDistanceKm: 2,
  indoorRatio: 80,
  transfers: 1,
  stops: [
    {
      id: "stop-1",
      placeId: "museum-1",
      name: "美術館",
      area: "徐匯",
      startTime: "14:00",
      endTime: "16:00",
      cost: 100,
      latitude: 31.2,
      longitude: 121.4,
      tags: ["展览"],
    },
    {
      id: "stop-2",
      placeId: "cafe-1",
      name: "咖啡店",
      area: "徐匯",
      startTime: "16:30",
      endTime: "18:00",
      cost: 60,
      latitude: 31.21,
      longitude: 121.41,
      tags: ["咖啡"],
    },
    {
      id: "stop-3",
      placeId: "dinner-1",
      name: "本帮菜馆",
      area: "徐匯",
      startTime: "18:30",
      endTime: "20:00",
      cost: 80,
      latitude: 31.22,
      longitude: 121.42,
      tags: ["本帮菜"],
    },
  ],
  reasons: ["满足看展和咖啡偏好"],
} as const;

describe("AgentEventSchema", () => {
  it("rejects a completed tool event without a source", () => {
    const result = AgentEventSchema.safeParse({
      type: "tool.completed",
      tool: "get_weather",
      summary: { forecast: "15:00 后有小雨" },
      durationMs: 240,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a completion payload with a replan diff", () => {
    const result = AgentEventSchema.parse({
      type: "run.completed",
      result: {
        runId: "run-001",
        consensus: { shared: [], conflicts: [], constraints: [] },
        candidateIds: ["plan-1", "plan-2", "plan-3"],
        diff: {
          replacedStopIds: ["stop-1"],
          preservedStopIds: ["stop-2"],
          summary: "已替换一个行程点",
        },
      },
    });

    expect(result.type).toBe("run.completed");
  });
});

describe("planning request schemas", () => {
  it("parses a complete live planning request", () => {
    const result = PlanRequestSchema.parse({
      sessionId: "session-001",
      mode: "live",
      setup: validSetup,
      preferences: { a: preferences, b: preferences },
    });

    expect(result.mode).toBe("live");
  });

  it("defaults the planning request mode to live", () => {
    const result = PlanRequestSchema.parse({
      sessionId: "session-001",
      setup: validSetup,
      preferences: { a: preferences, b: preferences },
    });

    expect(result.mode).toBe("live");
  });

  it("rejects a third replan", () => {
    const result = ReplanRequestSchema.safeParse({
      sessionId: "session-001",
      plan: validItinerary,
      lockedStopIds: ["stop-3"],
      rejectedStopId: "stop-1",
      reason: "不想排队",
      replanCount: 2,
      setup: validSetup,
      preferences: { a: preferences, b: preferences },
    });

    expect(result.success).toBe(false);
  });

  it("accepts requests for the first two replans", () => {
    for (const replanCount of [0, 1]) {
      const result = ReplanRequestSchema.safeParse({
        sessionId: "session-001",
        plan: validItinerary,
        lockedStopIds: ["stop-3"],
        rejectedStopId: "stop-1",
        reason: "不想排队",
        replanCount,
        setup: validSetup,
        preferences: { a: preferences, b: preferences },
      });

      expect(result.success).toBe(true);
    }
  });
});
