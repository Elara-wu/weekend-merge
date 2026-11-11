import { AgentEventSchema } from "@/contracts/agent";
import { createDemoRun } from "./demoRun";

describe("createDemoRun", () => {
  it("emits a complete validated planning run for the workbench", () => {
    const events = createDemoRun({
      runId: "demo-run-001",
      at: "2026-11-11T04:00:00.000Z",
    });

    expect(events[0]).toMatchObject({
      type: "run.started",
      runId: "demo-run-001",
    });
    expect(events.filter((event) => event.type === "tool.completed")).toHaveLength(4);
    expect(events.filter((event) => event.type === "plan.proposed")).toHaveLength(3);
    expect(events.at(-1)).toEqual({
      type: "run.completed",
      result: {
        runId: "demo-run-001",
        consensus: {
          shared: ["展览", "咖啡", "慢节奏"],
          conflicts: ["城市散步 vs 少走路", "夜景 vs 不想晚归"],
          constraints: ["总预算 300 元", "步行不超过 3 公里", "避开长时间排队"],
        },
        candidateIds: ["art-rain", "coffee-night", "old-town"],
      },
    });

    for (const event of events) {
      expect(AgentEventSchema.safeParse(event).success).toBe(true);
    }
  });
});
