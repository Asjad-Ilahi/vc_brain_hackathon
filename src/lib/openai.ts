/**
 * OpenAI wrapper — reliable structured output + vision.
 *
 * Uses OpenAI native Structured Outputs (`json_schema`, strict:true) so enums and
 * required fields are enforced at the API level (json_object mode drifts on enums).
 * The Zod schema is the source of truth: converted to a strict JSON Schema for the
 * request, and re-validated on the response. Retries cover transient issues.
 */
import OpenAI from "openai";
import { z } from "zod";
import { env } from "./env";
import { withRetry } from "./utils";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: env.openaiApiKey });
  return _client;
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

// Keywords OpenAI's strict json_schema does not accept — strip them recursively.
const STRIP = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "multipleOf",
  "default",
  "minItems",
  "maxItems",
  "uniqueItems",
]);

/** Convert a zod-derived JSON Schema into an OpenAI strict-compatible one. */
function toStrict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toStrict);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (STRIP.has(k)) continue;
      out[k] = toStrict(v);
    }
    // Every object must forbid extra keys and list all properties as required.
    if (out.type === "object" || out.properties) {
      out.additionalProperties = false;
      if (out.properties && typeof out.properties === "object") {
        out.required = Object.keys(out.properties as Record<string, unknown>);
      }
    }
    return out;
  }
  return node;
}

function strictSchema<T>(schema: z.ZodType<T>): Record<string, unknown> {
  return toStrict(z.toJSONSchema(schema)) as Record<string, unknown>;
}

/** Call the model and return a value validated against `schema`. */
export async function structured<T>(args: {
  schema: z.ZodType<T>;
  schemaName: string;
  system: string;
  user: string | ContentPart[];
  model?: string;
  temperature?: number;
}): Promise<T> {
  const { schema, schemaName, system, user, model = env.openaiModel, temperature = 0.2 } = args;
  const jsonSchema = strictSchema(schema);

  return withRetry(
    async () => {
      const completion = await client().chat.completions.create({
        model,
        temperature,
        response_format: {
          type: "json_schema",
          json_schema: { name: schemaName, strict: true, schema: jsonSchema },
        },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user as never },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw);
      return schema.parse(parsed);
    },
    { label: `openai:${schemaName}`, retries: 3 }
  );
}

/** Plain text completion (used for outreach drafts, summaries). */
export async function text(args: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}): Promise<string> {
  const { system, user, model = env.openaiModel, temperature = 0.4 } = args;
  return withRetry(
    async () => {
      const completion = await client().chat.completions.create({
        model,
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return completion.choices[0]?.message?.content?.trim() ?? "";
    },
    { label: "openai:text", retries: 3 }
  );
}
