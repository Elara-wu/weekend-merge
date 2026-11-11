import { GenerateContentResponse, type Content, type GenerateContentParameters } from "@google/genai";
import { describe, expect, it, vi } from "vitest";

import type { PlanRequest } from "../../../src/contracts/agent";
import { createGeminiModel } from "./gemini";
import { runPlanningAgent } from "./orchestrator";
import { createAgentTools } from "./tools/registry";

const request: PlanRequest = {
  sessionId: "gemini-test", mode: "live",
  setup: { city: "上海", date: "2026-11-14", startTime: "11:00", endTime: "18:00", budget: 300, startingArea: "徐汇滨江" },
  preferences: {
    a: { interests: ["展览"], pace: "轻松", walkingLimitKm: 3, indoorPreference: "均可", foodTags: [], budgetStyle: "平衡", avoid: [], wish: "private wish" },
    b: { interests: ["咖啡"], pace: "平衡", walkingLimitKm: 5, indoorPreference: "均可", foodTags: [], budgetStyle: "平衡", avoid: [], wish: "" },
  },
};
function response(content: Content) {
  const result = new GenerateContentResponse();
  result.candidates = [{ content, index: 0, finishReason: undefined }];
  return result;
}

describe("Gemini server adapter", () => {
  it("declares only whitelisted tools, preserves parallel call IDs and signatures, then requests structured final JSON", async () => {
    const content: Content = { role: "model", parts: [
      { functionCall: { id: "first", name: "search_places", args: { limit: 4 } }, thoughtSignature: "opaque-signature" },
      { functionCall: { id: "second", name: "get_weather", args: { latitude: 31.17, longitude: 121.46 } } },
    ] };
    const inputs: GenerateContentParameters[] = [];
    const client = { generateContent: async (input: GenerateContentParameters) => {
      inputs.push(input);
      return response(inputs.length === 1 ? content : { role: "model", parts: [{ text: '{"type":"final","consensus":{"shared":[],"conflicts":[],"constraints":[]},"plans":[]}' }] });
    } };
    const model = createGeminiModel({ apiKey: "test-only", model: "configured-model", client });
    expect(await model.next({ request, toolResults: [] })).toEqual({ type: "tool_calls", calls: [
      { id: "internal-1-1", wireId: "first", name: "search_places", args: { limit: 4 } },
      { id: "internal-1-2", wireId: "second", name: "get_weather", args: { latitude: 31.17, longitude: 121.46 } },
    ] });
    await model.next({ request, toolResults: [
      { id: "internal-1-1", wireId: "first", name: "search_places", output: { places: [] } },
      { id: "internal-1-2", wireId: "second", name: "get_weather", output: { hourly: [] } },
    ] });
    expect(inputs).toHaveLength(2);
    const declarations = inputs[0].config?.tools?.flatMap((tool) => "functionDeclarations" in tool ? tool.functionDeclarations ?? [] : []) ?? [];
    expect(declarations.map((tool) => tool.name)).toEqual(["get_weather", "search_places", "estimate_route", "calculate_budget", "validate_plan"]);
    expect(JSON.stringify(declarations.find((tool) => tool.name === "validate_plan"))).not.toMatch(/places|originalPlan|preferences/);
    expect(inputs[1].contents).toEqual([
      expect.objectContaining({ role: "user" }), content,
      { role: "user", parts: [
        { functionResponse: { id: "first", name: "search_places", response: { output: { places: [] } } } },
        { functionResponse: { id: "second", name: "get_weather", response: { output: { hourly: [] } } } },
      ] },
    ]);
    expect(inputs[1].config).toMatchObject({ responseMimeType: "application/json", responseJsonSchema: { properties: { plans: { minItems: 3, maxItems: 3 } } } });
    expect(inputs[1].config?.tools).toBeUndefined();
    expect(inputs.every((input) => input.config?.httpOptions?.retryOptions?.attempts === 1)).toBe(true);
    expect(inputs.every((input) => input.config?.automaticContinuation === false)).toBe(true);
  });

  it("does not send synthetic IDs for parallel calls without wire IDs", async () => {
    const inputs: GenerateContentParameters[] = [];
    const model = createGeminiModel({ apiKey: "test-only", model: "configured-model", client: {
      generateContent: async (input) => {
        inputs.push(input);
        return response(inputs.length === 1
          ? { role: "model", parts: [
            { functionCall: { name: "search_places", args: { limit: 3 } } },
            { functionCall: { name: "search_places", args: { limit: 4 } } },
          ] }
          : { role: "model", parts: [{ text: '{"type":"final","consensus":{"shared":[],"conflicts":[],"constraints":[]},"plans":[]}' }] });
      },
    } });
    expect(await model.next({ request, toolResults: [] })).toEqual({ type: "tool_calls", calls: [
      { id: "internal-1-1", name: "search_places", args: { limit: 3 } },
      { id: "internal-1-2", name: "search_places", args: { limit: 4 } },
    ] });
    await model.next({ request, toolResults: [
      { id: "internal-1-1", name: "search_places", output: { places: [] } },
      { id: "internal-1-2", name: "search_places", output: { places: [] } },
    ] });
    const reply = (inputs[1].contents as Content[])[2];
    expect(reply.parts?.map((part) => part.functionResponse)).toEqual([
      { name: "search_places", response: { output: { places: [] } } },
      { name: "search_places", response: { output: { places: [] } } },
    ]);
  });

  it("keeps mixed wire and ID-less parallel calls distinct through orchestration", async () => {
    const inputs: GenerateContentParameters[] = [];
    const model = createGeminiModel({ apiKey: "test-only", model: "configured-model", client: {
      generateContent: async (input) => {
        inputs.push(input);
        return response(inputs.length === 1
          ? { role: "model", parts: [
            { functionCall: { id: "call-2", name: "search_places", args: { limit: 1 } } },
            { functionCall: { name: "search_places", args: { limit: 2 } } },
          ] }
          : { role: "model", parts: [{ text: '{"type":"final","plans":[]}' }] });
      },
    } });
    const events = await runPlanningAgent(request, { model, now: () => new Date("2026-11-11T00:00:00Z") });
    expect(inputs).toHaveLength(2);
    expect(events.filter((event) => event.type === "tool.completed" && event.tool === "search_places")).toHaveLength(2);
    expect(events.some((event) => event.type === "tool.failed" && event.code === "DUPLICATE_TOOL_CALL_ID")).toBe(false);
    const reply = (inputs[1].contents as Content[])[2];
    expect(reply.parts?.map((part) => ({
      id: part.functionResponse?.id,
      count: (part.functionResponse?.response?.output as { places: unknown[] }).places.length,
    }))).toEqual([{ id: "call-2", count: 1 }, { id: undefined, count: 2 }]);
  });

  it("keeps duplicate supplied wire IDs as received while internal IDs stay distinct", async () => {
    const inputs: GenerateContentParameters[] = [];
    const model = createGeminiModel({ apiKey: "test-only", model: "configured-model", client: {
      generateContent: async (input) => {
        inputs.push(input);
        return response(inputs.length === 1
          ? { role: "model", parts: [
            { functionCall: { id: "same-wire", name: "search_places", args: { limit: 1 } } },
            { functionCall: { id: "same-wire", name: "search_places", args: { limit: 2 } } },
          ] }
          : { role: "model", parts: [{ text: '{"type":"final","plans":[]}' }] });
      },
    } });
    const turn = await model.next({ request, toolResults: [] });
    expect(turn).toEqual({ type: "tool_calls", calls: [
      { id: "internal-1-1", wireId: "same-wire", name: "search_places", args: { limit: 1 } },
      { id: "internal-1-2", wireId: "same-wire", name: "search_places", args: { limit: 2 } },
    ] });
    await model.next({ request, toolResults: [
      { id: "internal-1-1", wireId: "same-wire", name: "search_places", output: { result: 1 } },
      { id: "internal-1-2", wireId: "same-wire", name: "search_places", output: { result: 2 } },
    ] });
    const reply = (inputs[1].contents as Content[])[2];
    expect(reply.parts?.map((part) => part.functionResponse)).toEqual([
      { id: "same-wire", name: "search_places", response: { output: { result: 1 } } },
      { id: "same-wire", name: "search_places", response: { output: { result: 2 } } },
    ]);
  });

  it("uses one HTTP request for a continuation response from the real SDK", async () => {
    const requests: string[] = [];
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      requests.push(String(url));
      const complete = requests.length > 1;
      return new Response(JSON.stringify({ candidates: [{
        content: { role: "model", parts: [{ text: '{"type":"final","plans":[]}' }] },
        finishReason: complete ? "STOP" : "CONTINUATION",
        ...(!complete ? { continuationToken: "opaque-token" } : {}),
      }] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const model = createGeminiModel({ apiKey: "test-only", model: "configured-model" });
      await model.next({ request, toolResults: [] });
      expect(requests).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reads an immediate JSON final without exposing thought text", async () => {
    const model = createGeminiModel({ apiKey: "test-only", model: "configured-model", client: {
      generateContent: async () => response({ role: "model", parts: [{ thought: true, text: "hidden reasoning" }, { text: '{"type":"final","plans":[]}' }] }),
    } });
    expect(await model.next({ request, toolResults: [] })).toEqual({ type: "final", plans: [] });
  });

  it("maps SDK failures to a sanitized MODEL_UNAVAILABLE error without logging", async () => {
    const errorLog = vi.spyOn(console, "error");
    const model = createGeminiModel({ apiKey: "test-only", model: "configured-model", client: {
      generateContent: async () => { throw new Error("private wish secret-key"); },
    } });
    await expect(model.next({ request, toolResults: [] })).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE", message: "MODEL_UNAVAILABLE" });
    expect(errorLog).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("creates the real official client without network until next is called", () => {
    expect(createGeminiModel({ apiKey: "test-only", model: "configured-model" }).next).toBeTypeOf("function");
  });

  it("parses registry inputs even when called outside the orchestrator", () => {
    const tools = createAgentTools({ request });
    expect(() => tools.estimate_route({ stops: [] })).toThrow();
    expect(() => tools.validate_plan({ plan: {} as never })).toThrow();
    expect(tools.search_places({ limit: 1 })).toMatchObject({ places: [expect.objectContaining({ placeId: expect.any(String) })] });
  });
});
