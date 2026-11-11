import { createDemoRun } from "../../src/demo/demoRun";
import { PlanRequestSchema } from "../../src/contracts/agent";
import { createGeminiModel } from "./agent/gemini";
import { jsonError, ndjson, parseJsonRequest } from "./agent/http";
import type { AgentModel } from "./agent/model";
import { runPlanningAgent } from "./agent/orchestrator";
import { createAgentTools } from "./agent/tools/registry";

export function createPlanHandler(dependencies: {
  env?: { GEMINI_API_KEY?: string; GEMINI_MODEL?: string };
  createModel?: (config: { apiKey: string; model: string }) => AgentModel;
} = {}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return jsonError(405, "METHOD_NOT_ALLOWED", "Use POST to start a plan.");
    const parsed = await parseJsonRequest(request, PlanRequestSchema);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;
    try {
      if (body.mode === "demo") {
        return ndjson(createDemoRun({ runId: body.sessionId, at: `${body.setup.date}T00:00:00.000Z` }));
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
      return ndjson(await runPlanningAgent(body, { model, tools }));
    } catch {
      return jsonError(500, "PLANNING_FAILED", "Planning could not be completed.", undefined, true);
    }
  };
}

export const handler = createPlanHandler();
export default handler;
