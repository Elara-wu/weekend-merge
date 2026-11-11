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

function assertJsonSafe(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) return;
    throw new Error("Agent events require finite, safely represented numbers");
  }
  if (typeof value !== "object") throw new Error("Agent events require JSON values");
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error("Agent events require plain JSON objects");
  }
  if (ancestors.has(value)) throw new Error("Agent events cannot contain cycles");
  ancestors.add(value);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) {
      throw new Error("Agent events require plain JSON arrays");
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, index);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new Error("Agent events require dense JSON arrays");
      assertJsonSafe(descriptor.value, ancestors);
    }
  } else {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new Error("Agent events require string object keys");
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw new Error("Agent events require plain JSON properties");
      assertJsonSafe(descriptor.value, ancestors);
    }
  }
  ancestors.delete(value);
}

export function ndjson(events: readonly unknown[]): Response {
  const validated = events.map((event) => {
    // Inspect original descriptors first: schema parsing may read accessors or omit hidden hooks.
    assertJsonSafe(event);
    const parsed = AgentEventSchema.parse(event);
    assertJsonSafe(parsed);
    return parsed;
  });
  const terminals = validated.filter((event) => event.type === "run.completed" || event.type === "run.failed");
  if (terminals.length !== 1 || validated.at(-1) !== terminals[0]) {
    throw new Error("Agent events must end in exactly one terminal event");
  }
  const lines = validated.map((event) => {
    const line = JSON.stringify(event);
    // Validate the exact wire representation too: serialization can transform unknown values.
    AgentEventSchema.parse(JSON.parse(line));
    return line;
  });
  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
