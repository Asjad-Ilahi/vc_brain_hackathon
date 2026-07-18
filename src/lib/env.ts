/**
 * Server-only env access. Never import this in a client component.
 * Values are read lazily so a missing optional key never breaks the build —
 * it only throws at the point of use (with a clear message).
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get openaiApiKey() {
    return required("OPENAI_API_KEY");
  },
  get tavilyApiKey() {
    return required("TAVILY_API_KEY");
  },
  get githubToken() {
    return optional("GITHUB_TOKEN"); // optional: raises rate limits when present
  },
  get elevenLabsApiKey() {
    return optional("ELEVENLABS_API_KEY"); // optional: audio memo only
  },
  /** Model used for extraction, scoring, memo, query parsing. */
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o",
};
