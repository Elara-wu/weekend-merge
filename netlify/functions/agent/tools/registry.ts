import { z } from "zod";

import { ItinerarySchema, type PlanRequest } from "../../../../src/contracts/agent";
import { calculateBudget } from "./budget";
import { CalculateBudgetInputSchema, EstimateRouteInputSchema, SearchPlacesInputSchema, type Place } from "./contracts";
import { searchPlaces, shanghaiPlaces } from "./places";
import { estimateRoute } from "./route";
import { validatePlan } from "./validator";
import { WeatherInputSchema, createWeatherTool, type WeatherInput, type WeatherOutput } from "./weather";

// Catalog, setup, preferences, and original locked plans are never tool arguments.
export const ValidatePlanInputSchema = z.object({
  plan: ItinerarySchema,
  walkingDistanceKm: z.number().finite().nonnegative().optional(),
});

export const toolInputSchemas = {
  get_weather: WeatherInputSchema,
  search_places: SearchPlacesInputSchema,
  estimate_route: EstimateRouteInputSchema,
  calculate_budget: CalculateBudgetInputSchema,
  validate_plan: ValidatePlanInputSchema,
};

type ToolOutputs = {
  get_weather: WeatherOutput;
  search_places: ReturnType<typeof searchPlaces>;
  estimate_route: ReturnType<typeof estimateRoute>;
  calculate_budget: ReturnType<typeof calculateBudget>;
  validate_plan: ReturnType<typeof validatePlan>;
};
export type AgentTools = {
  [K in keyof typeof toolInputSchemas]: (input: z.input<(typeof toolInputSchemas)[K]>) => ToolOutputs[K] | Promise<ToolOutputs[K]>;
};

export function createAgentTools(config: {
  request: PlanRequest;
  places?: readonly Place[];
  weather?: (input: WeatherInput) => Promise<WeatherOutput>;
  now?: () => Date;
}): AgentTools {
  const places = config.places ?? shanghaiPlaces;
  const weather = config.weather ?? createWeatherTool({ now: config.now });
  return {
    get_weather: (input) => weather(WeatherInputSchema.parse(input)),
    search_places: (input) => searchPlaces(SearchPlacesInputSchema.parse(input), places),
    estimate_route: (input) => estimateRoute(EstimateRouteInputSchema.parse(input)),
    calculate_budget: (input) => calculateBudget(CalculateBudgetInputSchema.parse(input)),
    validate_plan: (input) => validatePlan({
      ...ValidatePlanInputSchema.parse(input), setup: config.request.setup,
      preferences: config.request.preferences, places, lockedStopIds: [],
    }),
  };
}
