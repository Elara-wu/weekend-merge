import type { AgentEvent, Itinerary } from "@/contracts/agent";

/** Deduplicate replayed proposals; keep the latest candidate payload for each ID. */
export function getCandidates(events: AgentEvent[]): Itinerary[] {
  const map = new Map<string, Itinerary>();
  for (const event of events)
    if (event.type === "plan.proposed") map.set(event.plan.id, event.plan);
  return [...map.values()];
}
export function getRunStatus(events: AgentEvent[]) {
  const terminal = [...events]
    .reverse()
    .find((e) => e.type === "run.failed" || e.type === "run.completed");
  if (terminal?.type === "run.failed")
    return { state: "failed" as const, message: terminal.message };
  const degraded = events.find((e) => e.type === "run.degraded");
  if (degraded?.type === "run.degraded")
    return { state: "degraded" as const, message: degraded.reason };
  if (terminal?.type === "run.completed")
    return { state: "completed" as const, message: "这一轮，规划完成" };
  if (getCandidates(events).length)
    return { state: "partial" as const, message: "已有方案，正在继续规划" };
  return {
    state: events.length ? ("running" as const) : ("queued" as const),
    message: events.length ? "正在为你们寻找交集" : "已提交，等待规划",
  };
}
