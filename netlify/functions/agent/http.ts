import { z } from "zod";
import { AgentEventSchema } from "../../../src/contracts/agent";

export function jsonError(status: number, code: string, message: string, field?: string, retryable = false): Response {
  return Response.json({ error: { code, message, ...(field ? { field } : {}), retryable } }, {
    status, headers: { "Cache-Control": "no-store", ...(status === 405 ? { Allow: "POST" } : {}) },
  });
}

export async function parseJsonRequest<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<{ data: z.output<S> } | { response: Response }> {
  let body: unknown;
  try { body = await request.json(); }
  catch { return { response: jsonError(400, "INVALID_REQUEST", "Request body must be valid JSON.") }; }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { response: jsonError(400, "INVALID_REQUEST", "Request does not match the required fields.", parsed.error.issues[0]?.path.join(".")) };
  }
  return { data: parsed.data };
}

export function ndjson(events: readonly unknown[]): Response {
  const validated = events.map((event) => AgentEventSchema.parse(event));
  const terminals = validated.filter((event) => event.type === "run.completed" || event.type === "run.failed");
  if (terminals.length !== 1 || validated.at(-1) !== terminals[0]) {
    throw new Error("Agent events must end in exactly one terminal event");
  }
  return new Response(`${validated.map((event) => JSON.stringify(event)).join("\n")}\n`, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
