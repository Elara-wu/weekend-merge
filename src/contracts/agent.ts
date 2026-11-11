import { z } from "zod";

export const AgentStateSchema = z.enum([
  "VALIDATE",
  "ANALYZE",
  "GATHER",
  "PROPOSE",
  "VERIFY",
  "NEGOTIATE",
  "REPLAN",
  "FINALIZE",
]);

export const PlanSetupSchema = z.object({
  city: z.literal("上海"),
  date: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  budget: z.number().min(100).max(2000),
  startingArea: z.string().min(1),
});

export const PersonPreferencesSchema = z.object({
  interests: z.array(z.string()).min(1).max(5),
  pace: z.enum(["轻松", "平衡", "充实"]),
  walkingLimitKm: z.union([
    z.literal(1),
    z.literal(3),
    z.literal(5),
    z.literal(8),
  ]),
  indoorPreference: z.enum(["室内优先", "均可", "户外优先"]),
  foodTags: z.array(z.string()),
  budgetStyle: z.enum(["省钱", "平衡", "体验优先"]),
  avoid: z.array(z.string()),
  wish: z.string().max(80),
});

export const ConsensusSummarySchema = z.object({
  shared: z.array(z.string()),
  conflicts: z.array(z.string()),
  constraints: z.array(z.string()),
});

export const ItineraryStopSchema = z.object({
  id: z.string().min(1),
  placeId: z.string().min(1),
  name: z.string().min(1),
  area: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  cost: z.number().nonnegative(),
  latitude: z.number(),
  longitude: z.number(),
  tags: z.array(z.string()),
  locked: z.boolean().default(false),
});

export const ItinerarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  matchScore: z.number().min(0).max(100),
  totalCost: z.number().nonnegative(),
  totalDistanceKm: z.number().nonnegative(),
  indoorRatio: z.number().min(0).max(100),
  transfers: z.number().int().nonnegative(),
  stops: z.array(ItineraryStopSchema).min(1),
  reasons: z.array(z.string()).min(1),
});

const RunStartedEventSchema = z.object({
  type: z.literal("run.started"),
  runId: z.string().min(1),
  at: z.string().datetime(),
});

const StepStartedEventSchema = z.object({
  type: z.literal("step.started"),
  step: AgentStateSchema,
  at: z.string().datetime(),
});

const ToolCompletedEventSchema = z.object({
  type: z.literal("tool.completed"),
  tool: z.enum([
    "get_weather",
    "search_places",
    "estimate_route",
    "calculate_budget",
    "validate_plan",
  ]),
  summary: z.record(z.unknown()),
  durationMs: z.number().int().nonnegative(),
  source: z.string().min(1),
});

const ToolFailedEventSchema = z.object({
  type: z.literal("tool.failed"),
  tool: z.string().min(1),
  code: z.string().min(1),
  retryable: z.boolean(),
});

const PlanProposedEventSchema = z.object({
  type: z.literal("plan.proposed"),
  plan: ItinerarySchema,
});

const RunDegradedEventSchema = z.object({
  type: z.literal("run.degraded"),
  reason: z.string().min(1),
  fallback: z.string().min(1),
});

const RunCompletedEventSchema = z.object({
  type: z.literal("run.completed"),
  result: z.object({
    runId: z.string().min(1),
    consensus: ConsensusSummarySchema,
    candidateIds: z.array(z.string()).length(3),
  }),
});

const RunFailedEventSchema = z.object({
  type: z.literal("run.failed"),
  code: z.string().min(1),
  message: z.string().min(1),
});

export const AgentEventSchema = z.discriminatedUnion("type", [
  RunStartedEventSchema,
  StepStartedEventSchema,
  ToolCompletedEventSchema,
  ToolFailedEventSchema,
  PlanProposedEventSchema,
  RunDegradedEventSchema,
  RunCompletedEventSchema,
  RunFailedEventSchema,
]);

export type AgentState = z.infer<typeof AgentStateSchema>;
export type PlanSetup = z.infer<typeof PlanSetupSchema>;
export type PersonPreferences = z.infer<typeof PersonPreferencesSchema>;
export type ConsensusSummary = z.infer<typeof ConsensusSummarySchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
