import { createDemoRun } from "../../src/demo/demoRun";

type PlanRequest = {
  sessionId?: string;
};

export async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { error: { code: "METHOD_NOT_ALLOWED", message: "Use POST to start a plan." } },
      { status: 405, headers: { Allow: "POST" } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as PlanRequest;
  const runId = body.sessionId?.trim() || "demo-run";
  const ndjson = createDemoRun({ runId })
    .map((event) => JSON.stringify(event))
    .join("\n");

  return new Response(`${ndjson}\n`, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  });
}

export default handler;
