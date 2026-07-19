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

// ---------------------------------------------------------------------------
// Identity hygiene — the outbound radar surfaces people from raw sources
// (GitHub logins, HN usernames, patent inventor ids, LLM extractions). Showing
// a fabricated or placeholder name ("Unknown", "Inventor of US12…", "X Creator")
// defeats the whole point of the product: reducing the investor's research. These
// helpers keep junk OUT — a name is either a real human name, or we say so plainly.
// ---------------------------------------------------------------------------

const NAME_PLACEHOLDERS = new Set([
  "unknown", "unnamed", "unnamed founder", "n/a", "na", "none", "null", "nil",
  "anonymous", "tbd", "unspecified", "not provided", "not specified", "not available",
  "founder", "co-founder", "cofounder", "creator", "maker", "inventor", "author",
  "team", "ceo", "owner", "maintainer", "developer", "the founder", "unidentified",
]);

/**
 * A real human name, or null. Nulls out placeholders ("Unknown", "Not provided"),
 * role words ("Founder"), and the fabrication patterns the sourcing LLM/fallbacks
 * used to emit: "Inventor of <patent-id>", "<Company> Creator", bare patent ids.
 */
export function cleanPersonName(raw?: string | null): string | null {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return null;
  const low = s.toLowerCase();
  if (NAME_PLACEHOLDERS.has(low)) return null;
  if (/^(inventor|creator|maker|author|team|owner)\s+of\b/i.test(s)) return null; // "Inventor of US12…"
  if (/\b(creator|team|project)$/i.test(low)) return null;                         // "X Creator", "X Project"
  if (/^(us|cn|ep|wo|jp|kr)[- ]?\d/i.test(s)) return null;                         // patent numbers
  if (/^[a-z]{2}\d{5,}[a-z0-9]*$/i.test(s)) return null;                           // e.g. US12423525B2
  if (/^\d+$/.test(s)) return null;                                                // pure numbers
  return s;
}

/** A single token with no spaces = a username/handle, not a person's real name. */
export function looksLikeHandle(name: string): boolean {
  const s = (name ?? "").trim();
  return s.length > 0 && !s.includes(" ") && /^[@]?[a-z0-9][a-z0-9._-]{0,38}$/i.test(s);
}

/**
 * A usable handle, or null. Rejects placeholder handles ("unknown",
 * "not-provided", "n-a") that leaked in as usernames — those must never render
 * as "@unknown". Normalizes separators so "not-provided" is caught like "not provided".
 */
function cleanHandleToken(raw?: string | null): string | null {
  const s = (raw ?? "").trim().replace(/^@/, "");
  if (!s || !looksLikeHandle(s)) return null;
  const normalized = s.toLowerCase().replace(/[-_.]+/g, " ").trim();
  if (NAME_PLACEHOLDERS.has(normalized)) return null;
  if (cleanPersonName(normalized) === null) return null; // e.g. "inventor-of-..."
  return s;
}

/** Nulls out placeholder values in free-text fields (geography, stage, sector). */
export function cleanPlaceholderField(raw?: string | null): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (["n/a", "na", "none", "null", "unknown", "not provided", "not specified", "not available", "unspecified", "tbd", "uncategorized"].includes(low)) {
    return null;
  }
  return s;
}

/**
 * The name to SHOW for a sourced founder — never junk. A real name wins; else a
 * known handle is shown as "@handle" (honest: it's an account, not a verified
 * identity); else null, so the caller can lead with the company/project instead.
 */
export function founderDisplayName(rawName?: string | null, handle?: string | null): string | null {
  const real = cleanPersonName(rawName);
  if (real && !looksLikeHandle(real)) return real;
  const h = cleanHandleToken(handle) ?? cleanHandleToken(real);
  if (h) return `@${h}`;
  return null;
}
