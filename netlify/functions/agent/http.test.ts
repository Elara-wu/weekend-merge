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
  it("supports the run.failed terminal without appending a completion", async () => {
    const response = ndjson([failed]);
    expect(await response.text()).toBe(`${JSON.stringify(failed)}\n`);
  });
});
