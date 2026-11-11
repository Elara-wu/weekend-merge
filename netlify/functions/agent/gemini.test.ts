import { GenerateContentResponse, type Content, type GenerateContentParameters } from "@google/genai";
import { describe, expect, it, vi } from "vitest";

import type { PlanRequest } from "../../../src/contracts/agent";
import { createGeminiModel } from "./gemini";
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
      { id: "first", name: "search_places", args: { limit: 4 } },
      { id: "second", name: "get_weather", args: { latitude: 31.17, longitude: 121.46 } },
    ] });
    await model.next({ request, toolResults: [
      { id: "first", name: "search_places", output: { places: [] } },
      { id: "second", name: "get_weather", output: { hourly: [] } },
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
