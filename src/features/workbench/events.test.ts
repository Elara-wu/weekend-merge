import { createDemoRun } from "@/demo/demoRun";
import { getCandidates, getRunStatus } from "./events";
describe("workbench event projection", () => {
  it("deduplicates replayed proposals while applying a newer payload", () => {
    const events = createDemoRun({ runId: "test" });
    const proposed = events.find((e) => e.type === "plan.proposed")!;
    if (proposed.type !== "plan.proposed") throw Error("fixture");
    const replay = [
      ...events,
      proposed,
      { ...proposed, plan: { ...proposed.plan, title: "更新后的提案" } },
    ];
    expect(getCandidates(replay)).toHaveLength(3);
    expect(getCandidates(replay)[0].title).toBe("更新后的提案");
  });
  it("distinguishes queued, partial, failed and completed states", () => {
    const events = createDemoRun({ runId: "test" });
    expect(getRunStatus([]).state).toBe("queued");
    expect(getRunStatus(events.slice(0, -1)).state).toBe("partial");
    expect(
      getRunStatus([
        ...events,
        { type: "run.failed", code: "TIMEOUT", message: "请求超时" },
      ]).state,
    ).toBe("failed");
    expect(getRunStatus(events).state).toBe("completed");
  });
});
