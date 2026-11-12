import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/plan-request.demo.json";
import { AgentEventSchema } from "../../src/contracts/agent";
import { createPlanHandler } from "./plan";

const now = () => new Date("2026-11-12T16:30:00Z"); // Shanghai Nov 13
const post = (body: unknown, headers?: HeadersInit) => new Request("http://localhost/plan", { method: "POST", body: JSON.stringify(body), headers });

describe("plan public protection and streaming", () => {
  it("rejects actual UTF-8 bodies above 32 KiB before JSON parsing", async () => {
    const handler = createPlanHandler({ env: {}, now });
    const request = new Request("http://localhost/plan", { method: "POST", body: "中".repeat(10923), headers: { "content-length": "1" } });
    const response = await handler(request);
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "REQUEST_TOO_LARGE" } });
  });
  it.each(["2026-11-08", "2027-05-15"])("rejects a weekend outside the Shanghai moving window %s", async (date) => {
    const response = await createPlanHandler({ env: {}, now })(post({ ...fixture, setup: { ...fixture.setup, date } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST", field: "setup.date" } });
  });
  it("blocks the sixth shared warm-instance request before model construction or weather", async () => {
    let constructions = 0;
    let turns = 0;
    const options = { now, env: { GEMINI_API_KEY: "fake", GEMINI_MODEL: "fake" }, createModel: () => {
      constructions++;
      return { next: async () => { turns++; throw new Error("offline"); } };
    } };
    const first = createPlanHandler(options);
    const second = createPlanHandler(options);
    const body = { ...fixture, mode: "live", sessionId: "rate-limit-regression" };
    for (let index = 0; index < 5; index++) {
      const response = await first(post(body, { "x-nf-client-connection-ip": "192.0.2.1" }));
      expect(response.status).toBe(200);
      await response.text();
    }
    const response = await second(post(body, { "x-nf-client-connection-ip": "192.0.2.1" }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED", retryable: true } });
    expect(constructions).toBe(5);
    expect(turns).toBe(5);
    expect((await first(post({ ...body, mode: "demo" }))).status).toBe(200);
  });
  it("returns early progress while the model promise is still unresolved", async () => {
    let resolve!: (value: unknown) => void;
    const deferred = new Promise<unknown>((done) => { resolve = done; });
    const pending = createPlanHandler({ now, env: { GEMINI_API_KEY: "fake", GEMINI_MODEL: "fake" },
      createModel: () => ({ next: async () => deferred }),
    })(post({ ...fixture, mode: "live", sessionId: "deferred-model" }));
    const response = await Promise.race([pending, new Promise<null>((done) => setTimeout(() => done(null), 100))]);
    if (!response) { resolve({}); await pending; }
    expect(response).not.toBeNull();
    if (!response) return;
    const reader = response.body!.getReader();
    const early = await reader.read();
    const decoder = new TextDecoder();
    let text = decoder.decode(early.value);
    expect(JSON.parse(text.trim()).type).toBe("run.started");
    for (let index = 0; index < 3; index++) {
      const progress = await reader.read();
      text += decoder.decode(progress.value);
    }
    expect(text).toContain('"step":"GATHER"');
    resolve({});
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value);
    }
    const events = text.trim().split("\n").map((line) => AgentEventSchema.parse(JSON.parse(line)));
    expect(events.some((event) => event.type === "step.started")).toBe(true);
    expect(events.filter((event) => ["run.failed", "run.completed"].includes(event.type))).toHaveLength(1);
    expect(events.at(-1)?.type).toBe("run.completed");
  });
});

it.each([
  ["budget", "BUDGET_EXCEEDED"], ["time", "OUTSIDE_TIME_RANGE"], ["avoidance", "AVOID_TAG_MATCHED"],
])("preserves observed %s no-plan codes over NDJSON", async (kind, code) => {
  const preferences = structuredClone(fixture.preferences);
  const setup = { ...fixture.setup };
  if (kind === "budget") { setup.budget = 100; preferences.a.avoid = ["公园", "江景", "书店"]; }
  if (kind === "time") { setup.startTime = "21:00"; setup.endTime = "24:00"; preferences.a.avoid = ["咖啡", "公园", "江景", "书店", "晚餐"]; }
  if (kind === "avoidance") preferences.a.avoid = ["展览", "书店", "咖啡", "晚餐", "公园", "江景"];
  const response = await createPlanHandler({ env: {}, now })(post({ ...fixture, mode: "live", sessionId: `constraint-${kind}`, setup, preferences }));
  expect(response.status).toBe(200);
  const events = (await response.text()).trim().split("\n").map((line) => AgentEventSchema.parse(JSON.parse(line)));
  expect(events.at(-1)).toMatchObject({ type: "run.failed", code: "NO_VALID_PLAN", constraintCodes: expect.arrayContaining([code]) });
});

it("validates static fields before consulting the injected limiter or constructing the model", async () => {
  let attempts = 0;
  const response = await createPlanHandler({ now, limiter: { allow() { attempts++; return false; } },
    env: { GEMINI_API_KEY: "fake", GEMINI_MODEL: "fake" }, createModel() { throw new Error("must not construct"); },
  })(post({ ...fixture, mode: "live", setup: { ...fixture.setup, endTime: "12:00" } }));
  expect(response.status).toBe(400);
  expect(attempts).toBe(0);
});
