import { describe, expect, it } from "vitest";

import { AgentEventSchema } from "./agent";

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
});
