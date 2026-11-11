import type { PersonPreferences, PlanSetup } from "@/contracts/agent";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PlanningStage =
  | "setup"
  | "person-a"
  | "handoff"
  | "person-b"
  | "consensus"
  | "workbench";

type PlanningStore = {
  stage: PlanningStage;
  setup?: PlanSetup;
  preferences: {
    a?: PersonPreferences;
    b?: PersonPreferences;
  };
  saveSetup: (setup: PlanSetup) => void;
  savePreferences: (person: "a" | "b", preferences: PersonPreferences) => void;
  handoffToB: () => void;
  revealConsensus: () => void;
  openWorkbench: () => void;
  reset: () => void;
};

const initialState = {
  stage: "setup" as const,
  setup: undefined,
  preferences: {},
};

export const usePlanningStore = create<PlanningStore>()(
  persist(
    (set) => ({
      ...initialState,
      saveSetup: (setup) => set({ setup, stage: "person-a" }),
      savePreferences: (person, preferences) =>
        set((state) => ({
          preferences: { ...state.preferences, [person]: preferences },
          stage: person === "a" ? "handoff" : "consensus",
        })),
      handoffToB: () => set({ stage: "person-b" }),
      revealConsensus: () => set({ stage: "consensus" }),
      openWorkbench: () => set({ stage: "workbench" }),
      reset: () => set(initialState),
    }),
    {
      name: "weekend-merge-session",
      partialize: ({ stage, setup, preferences }) => ({ stage, setup, preferences }),
    },
  ),
);
