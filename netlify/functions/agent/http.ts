import { z } from "zod";
import { AgentEventSchema, type AgentEvent } from "../../../src/contracts/agent";

export function jsonError(status: number, code: string, message: string, field?: string, retryable = false): Response {
  return Response.json({ error: { code, message, ...(field ? { field } : {}), retryable } }, {
    status, headers: { "Cache-Control": "no-store", ...(status === 405 ? { Allow: "POST" } : {}) },
  });
}

export async function parseJsonRequest<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<{ data: z.output<S> } | { response: Response }> {
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (reader) {
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 32 * 1024) {
            void reader.cancel().catch(() => {});
            return { response: jsonError(413, "REQUEST_TOO_LARGE", "Request body exceeds 32 KiB.") };
          }
          chunks.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder().decode(buffer));
  }
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

export function encodeAgentEvent(original: unknown): { event: AgentEvent; line: string } {
  // Inspect original descriptors before schema normalization can read or erase them.
  assertJsonSafe(original);
  const event = AgentEventSchema.parse(original);
  assertJsonSafe(event);
  const line = JSON.stringify(event);
  AgentEventSchema.parse(JSON.parse(line));
  return { event, line };
}

const headers = { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" };
const isTerminal = (event: AgentEvent) => event.type === "run.completed" || event.type === "run.failed";

export function ndjson(events: readonly unknown[]): Response {
  const validated = events.map(encodeAgentEvent);
  const terminals = validated.filter(({ event }) => isTerminal(event));
  if (terminals.length !== 1 || validated.at(-1) !== terminals[0]) {
    throw new Error("Agent events must end in exactly one terminal event");
  }
  return new Response(`${validated.map(({ line }) => line).join("\n")}\n`, { headers });
}

export function ndjsonStream(produce: (emit: (event: unknown) => void) => Promise<unknown> | void): Response {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let terminal = false;
      const encoder = new TextEncoder();
      const emit = (original: unknown) => {
        if (cancelled || terminal) throw new Error("Agent stream is closed");
        const { event, line } = encodeAgentEvent(original);
        controller.enqueue(encoder.encode(`${line}\n`));
        if (isTerminal(event)) { terminal = true; controller.close(); }
      };
      // The producer runs independently of returning the Response; its first events enqueue immediately.
      void Promise.resolve().then(() => produce(emit)).then(() => {
        if (!terminal && !cancelled) throw new Error("Agent stream lacks terminal event");
      }).catch(() => {
        if (!terminal && !cancelled) emit({ type: "run.failed", code: "PLANNING_FAILED", message: "Planning could not be completed." });
      });
    },
    cancel() { cancelled = true; },
  });
  return new Response(stream, { headers });
}
