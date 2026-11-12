import { describe, expect, it } from "vitest";
import { createDemoRun } from "../demo/demoRun";
import request from "../../tests/fixtures/plan-request.demo.json";
import { AgentEventSchema, PersonPreferencesSchema, PlanRequestSchema, PlanSetupSchema, ReplanRequestSchema } from "./agent";

describe("final public request boundaries", () => {
  it.each([
    { startTime: "20:00", endTime: "13:00" },
    { startTime: "13:00", endTime: "15:59" },
    { startTime: "08:00", endTime: "20:01" },
    { date: "2026-11-16" },
    { startingArea: "徐汇".repeat(1000) },
    { startingArea: "toString" },
  ])("rejects invalid static setup %j", (patch) => {
    expect(PlanSetupSchema.safeParse({ ...request.setup, ...patch }).success).toBe(false);
  });
  it("accepts both duration boundaries and a historical weekend without reading the clock", () => {
    for (const [startTime, endTime] of [["21:00", "24:00"], ["08:00", "20:00"]]) {
      expect(PlanSetupSchema.safeParse({ ...request.setup, date: "2020-01-04", startTime, endTime }).success).toBe(true);
    }
    expect(PlanRequestSchema.safeParse(request).success).toBe(true);
  });
  it.each([
    { interests: ["toString"] }, { interests: ["咖啡".repeat(100)] },
    { interests: Array(6).fill("咖啡") }, { foodTags: Array(11).fill("咖啡") },
    { avoid: Array(11).fill("拥挤") }, { foodTags: ["a".repeat(31)] },
    { avoid: ["a".repeat(31)] }, { wish: "a".repeat(81) },
  ])("rejects oversized or unsupported preferences %j", (patch) => {
    expect(PersonPreferencesSchema.safeParse({ ...request.preferences.a, ...patch }).success).toBe(false);
  });
  it("retains allowlisted constraint codes on serialized failed events", () => {
    const event = { type: "run.failed", code: "NO_VALID_PLAN", message: "No plan", constraintCodes: ["BUDGET_EXCEEDED", "OUTSIDE_TIME_RANGE", "AVOID_TAG_MATCHED"] };
    expect(JSON.parse(JSON.stringify(AgentEventSchema.parse(event)))).toEqual(event);
    expect(AgentEventSchema.safeParse({ ...event, constraintCodes: ["private error"] }).success).toBe(false);
  });
  it("validates the optional structured replan reason", () => {
    const event = createDemoRun({ runId: "replan-contract", at: "2026-11-14T00:00:00.000Z" }).find((item) => item.type === "plan.proposed")!;
    const body = { ...request, plan: event.plan, lockedStopIds: [], rejectedStopId: event.plan.stops[0].id,
      reason: "opaque explanation", reasonCode: "TOO_CROWDED", replanCount: 0 };
    expect(ReplanRequestSchema.parse(body).reasonCode).toBe("TOO_CROWDED");
    expect(ReplanRequestSchema.safeParse({ ...body, reasonCode: "arbitrary instruction" }).success).toBe(false);
  });
});
