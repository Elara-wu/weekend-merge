import { createDemoRun } from "@/demo/demoRun";
import { getCandidates } from "@/features/workbench/events";
import { usePlanningStore } from "./usePlanningStore";

describe("negotiation state", () => {
  beforeEach(() => usePlanningStore.getState().reset());
  const plan = getCandidates(createDemoRun({ runId: "negotiation-test" }))[0];
  it("protects locked stops, limits replacements and persists negotiation", async () => {
    const [first, second, dinner] = plan.stops;
    const state = usePlanningStore.getState();
    state.toggleLocked(dinner.id);
    expect(state.replaceDemoStop(plan, dinner.id, "不感兴趣", "")).toBe(false);
    expect(state.replaceDemoStop(plan, first.id, "", "")).toBe(false);
    expect(state.replaceDemoStop(plan, first.id, "不感兴趣", "换个小展")).toBe(
      true,
    );
    expect(usePlanningStore.getState().revisedPlans[plan.id].stops[2]).toEqual(
      dinner,
    );
    expect(
      usePlanningStore.getState().revisedPlans[plan.id].stops[0],
    ).toMatchObject({
      startTime: first.startTime,
      endTime: first.endTime,
      cost: first.cost,
    });
    expect(state.replaceDemoStop(plan, second.id, "想换一种体验", "")).toBe(
      true,
    );
    state.toggleLocked(dinner.id);
    expect(state.replaceDemoStop(plan, dinner.id, "不感兴趣", "")).toBe(false);
    state.toggleLiked(first.id);
    state.selectPlan(plan.id);
    state.selectStop(first.id);
    await usePlanningStore.persist.rehydrate();
    expect(usePlanningStore.getState()).toMatchObject({
      replanCount: 2,
      activePlanId: plan.id,
      activeStopId: first.id,
      likedStops: [first.id],
    });
  });
  it("retains lock information in the final shareable plan", () => {
    const state = usePlanningStore.getState();
    state.toggleLocked(plan.stops[2].id);
    state.finalize(plan);
    expect(usePlanningStore.getState().stage).toBe("final");
    expect(usePlanningStore.getState().finalPlan?.stops[2].locked).toBe(true);
    expect(plan.stops[2].locked).toBe(false);
  });
});
