import { createDemoRun } from "../../src/demo/demoRun";
import { PlanRequestSchema } from "../../src/contracts/agent";
import { createGeminiModel } from "./agent/gemini";
import { jsonError, ndjsonStream, parseJsonRequest } from "./agent/http";
import { planningClientKey, productionPlanningLimiter, validateRequestDate, type PlanningLimiter } from "./agent/requestProtection";
import type { AgentModel } from "./agent/model";
import { runPlanningAgent } from "./agent/orchestrator";
import { createAgentTools } from "./agent/tools/registry";

export function createPlanHandler(dependencies: {
  now?: () => Date;
  limiter?: PlanningLimiter;
  env?: { GEMINI_API_KEY?: string; GEMINI_MODEL?: string };
  createModel?: (config: { apiKey: string; model: string }) => AgentModel;
} = {}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "Use POST to start a plan.");
    const parsed = await parseJsonRequest(request, PlanRequestSchema);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;
    const now = dependencies.now ?? (() => new Date());
    const dateError = validateRequestDate(body.setup.date, now());
    if (dateError) return dateError;
    if (body.mode === "live" && !(dependencies.limiter ?? productionPlanningLimiter).allow(planningClientKey(request, body.sessionId), now().getTime())) {
      return jsonError(429, "RATE_LIMITED", "Too many planning requests. Please try again later.", undefined, true);
    }
    try {
      if (body.mode === "demo") {
        return ndjsonStream((emit) => { for (const event of createDemoRun({ runId: body.sessionId, at: `${body.setup.date}T00:00:00.000Z` })) emit(event); });
      }
      const env = dependencies.env ?? process.env;
      const apiKey = env.GEMINI_API_KEY?.trim();
      const modelName = env.GEMINI_MODEL?.trim();
      let model: AgentModel | undefined;
      if (apiKey && modelName) {
        try { model = (dependencies.createModel ?? createGeminiModel)({ apiKey, model: modelName }); }
        catch { /* The orchestrator explicitly reports the missing model and uses rule plans. */ }
      }
      const tools = createAgentTools({ request: body });
      return ndjsonStream((onEvent) => runPlanningAgent(body, { model, tools, now, onEvent }));
    } catch {
      return jsonError(500, "PLANNING_FAILED", "Planning could not be completed.", undefined, true);
    }
  };
}

export default createPlanHandler();
