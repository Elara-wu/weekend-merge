import { z } from "zod";

import { ConsensusSummarySchema, ItinerarySchema, type PlanRequest, type ToolName } from "../../../src/contracts/agent";

export const ModelFinalSchema = z.object({
  type: z.literal("final"),
  consensus: ConsensusSummarySchema,
  plans: z.array(ItinerarySchema).length(3),
});

export type ModelToolCall = { id: string; wireId?: string; name: string; args: unknown };
export type ModelTurn =
  | ({ type: "tool_call" } & ModelToolCall)
  | { type: "tool_calls"; calls: ModelToolCall[] }
  | z.infer<typeof ModelFinalSchema>;

export type ModelInput = {
  request: PlanRequest;
  toolResults: Array<{ id: string; wireId?: string; name: ToolName; output: unknown }>;
  validationFeedback?: string[];
};

export interface AgentModel {
  next(input: ModelInput): Promise<ModelTurn>;
}

export class AgentModelError extends Error {
  readonly code = "MODEL_UNAVAILABLE";
  constructor() {
    super("MODEL_UNAVAILABLE");
    this.name = "AgentModelError";
  }
}
