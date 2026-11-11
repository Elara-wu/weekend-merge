import { describe, expect, it } from "vitest";
import { ndjson } from "./http";

const failed = { type: "run.failed", code: "NO_VALID_PLAN", message: "No plan" };
describe("NDJSON boundary", () => {
  it.each([[], [failed, failed], [failed, { type: "step.started", step: "VERIFY", at: "2026-11-11T00:00:00.000Z" }]])(
    "rejects streams missing a single final terminal event: %j", (events) => {
      expect(() => ndjson(events)).toThrow();
    },
  );
  it("rejects malformed public events before serialization", () => {
    expect(() => ndjson([{ type: "tool.completed", tool: "validate_plan", durationMs: 0, summary: {} }, failed])).toThrow();
  });
  it("rejects unsupported serialization hooks in an unknown summary value", () => {
    expect(() => ndjson([{ type: "tool.completed", tool: "validate_plan", durationMs: 0, source: "local",
      summary: { toJSON: () => null },
    }, failed])).toThrow();
  });
  it("rejects a getter on the summary object before schema parsing can invoke it", () => {
    let reads = 0;
    const summary = Object.defineProperty({}, "value", { enumerable: true, get: () => { reads += 1; return 1; } });
    expect(() => ndjson([{ type: "tool.completed", tool: "validate_plan", durationMs: 0, source: "local", summary }, failed])).toThrow();
    expect(reads).toBe(0);
  });
  it("rejects an event summary accessor without invoking it", () => {
    let reads = 0;
    const event = Object.defineProperty({ type: "tool.completed", tool: "validate_plan", durationMs: 0, source: "local" },
      "summary", { enumerable: true, get: () => { reads += 1; return {}; } });
    expect(() => ndjson([event, failed])).toThrow();
    expect(reads).toBe(0);
  });
  it("rejects hidden toJSON on the summary object before schema parsing can erase it", () => {
    let calls = 0;
    const summary = Object.defineProperty({ valid: true }, "toJSON", { enumerable: false, value: () => { calls += 1; return null; } });
    expect(() => ndjson([{ type: "tool.completed", tool: "validate_plan", durationMs: 0, source: "local", summary }, failed])).toThrow();
    expect(calls).toBe(0);
  });
  it.each([
    { nested: { value: Infinity } },
    { nested: [{ value: -Infinity }] },
    { nested: [0, Number.NaN] },
    { nested: { value: Number.MAX_SAFE_INTEGER + 1 } },
    { nested: { value: -(Number.MAX_SAFE_INTEGER + 1) } },
    { nested: [undefined] },
    { nested: 1n },
    { nested: Symbol("unsupported") },
  ])("rejects non-JSON-safe values in nested summary objects and arrays (%#)", (summary) => {
    expect(() => ndjson([{ type: "tool.completed", tool: "validate_plan", durationMs: 0, source: "local", summary }, failed])).toThrow();
  });
  it("rejects a cyclic summary safely", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => ndjson([{ type: "tool.completed", tool: "validate_plan", durationMs: 0, source: "local", summary: { cycle } }, failed])).toThrow();
  });
  it("rejects an array serialization hook that would silently rewrite a nested summary", () => {
    const nested = Object.assign([1], { toJSON: () => null });
    expect(() => ndjson([{ type: "tool.completed", tool: "validate_plan", durationMs: 0, source: "local", summary: { nested } }, failed])).toThrow();
  });
  it("preserves finite decimal summaries and repeated noncyclic references", async () => {
    const coordinate = { temperatureC: -0.25, distanceKm: 1.2345 };
    const summary = { nested: [coordinate, coordinate, null, true] };
    const response = ndjson([{ type: "tool.completed", tool: "validate_plan", durationMs: 0, source: "local", summary }, failed]);
    const first = JSON.parse((await response.text()).split("\n")[0]);
    expect(first.summary).toEqual(summary);
  });
  it("supports the run.failed terminal without appending a completion", async () => {
    const response = ndjson([failed]);
    expect(await response.text()).toBe(`${JSON.stringify(failed)}\n`);
  });
});
