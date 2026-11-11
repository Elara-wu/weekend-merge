import { AgentEventSchema } from "../../src/contracts/agent";
import { handler } from "./plan";

describe("plan function", () => {
  it("returns the demo run as schema-valid NDJSON", async () => {
    const response = await handler(
      new Request("http://localhost/.netlify/functions/plan", {
        method: "POST",
        body: JSON.stringify({ sessionId: "frontend-demo" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");

    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => AgentEventSchema.parse(JSON.parse(line)));

    expect(events[0]).toMatchObject({ type: "run.started", runId: "frontend-demo" });
    expect(events.at(-1)?.type).toBe("run.completed");
  });
});
