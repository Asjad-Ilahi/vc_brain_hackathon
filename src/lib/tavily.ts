/**
 * Tavily wrapper — real web search for outbound sourcing AND external claim
 * verification (the "verify externally where possible" half of Trust Score).
 */
import { env } from "./env";
import { withRetry } from "./utils";

export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score: number;
};

export async function tavilySearch(
  query: string,
  opts: { maxResults?: number; depth?: "basic" | "advanced"; includeAnswer?: boolean } = {}
): Promise<{ answer: string | null; results: TavilyResult[] }> {
  const { maxResults = 5, depth = "basic", includeAnswer = true } = opts;
  return withRetry(
    async () => {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: env.tavilyApiKey,
          query,
          search_depth: depth,
          max_results: maxResults,
          include_answer: includeAnswer,
        }),
      });
      if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as {
        answer?: string;
        results?: TavilyResult[];
      };
      return { answer: data.answer ?? null, results: data.results ?? [] };
    },
    { label: "tavily:search", retries: 2 }
  );
}

export type VerificationStatus = "corroborated" | "contradicted" | "not_found";

/** Search the web for evidence that supports or contradicts a claim. */
export async function tavilyVerifyClaim(
  claim: string,
  context: string
): Promise<{ status: VerificationStatus; evidence: TavilyResult[]; answer: string | null }> {
  const query = `${context} — verify: ${claim}`;
  const { answer, results } = await tavilySearch(query, {
    maxResults: 2,
    depth: "basic",
    includeAnswer: true,
  });
  // The caller (validator agent) interprets corroborate/contradict via the LLM;
  // here we just surface evidence. Default to not_found when nothing returns.
  const status: VerificationStatus = results.length === 0 ? "not_found" : "corroborated";
  return { status, evidence: results, answer };
}
