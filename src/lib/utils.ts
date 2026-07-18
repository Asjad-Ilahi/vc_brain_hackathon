import { createHash } from "node:crypto";

/** Stable dedupe hash for a signal — same source + same normalized content = same hash. */
export function dedupeHash(sourceType: string, content: string): string {
  const normalized = content.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(`${sourceType}::${normalized}`).digest("hex").slice(0, 32);
}

/** Normalize a person's name/handle into a canonical dedupe/merge key. */
export function canonicalizeHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/https?:\/\/(www\.)?github\.com\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Simple exponential-backoff retry for flaky network / rate-limited calls. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; label?: string } = {}
): Promise<T> {
  const { retries = 3, baseMs = 500, label = "op" } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const wait = baseMs * Math.pow(2, attempt) + Math.random() * 200;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error(`${label} failed after ${retries + 1} attempts: ${String(lastErr)}`);
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
