/**
 * Multi-attribute reasoning — resolve a compound natural-language query in one
 * pass (e.g. "technical founder, Berlin, AI infra, no prior VC backing"), not as
 * a stack of manual filters. Parse -> structured filter -> ranked results.
 */
import { structured } from "@/lib/openai";
import { QueryParseSchema, type QueryParse } from "@/lib/schemas";
import { listOpportunities, type OpportunitySummary } from "./list";

const SYSTEM = `Convert a venture investor's natural-language query into structured filters.
Interpret intent: "technical founder" -> keyword; "no prior VC backing" -> mustNot ["vc backed",
"raised"]; "top-tier accelerator" -> mustHave; a city/country -> geographies; a domain -> sectors.
Be liberal with keywords; use mustNot only for explicit exclusions.`;

export async function parseQuery(nl: string): Promise<QueryParse> {
  return structured({
    schema: QueryParseSchema,
    schemaName: "QueryParse",
    system: SYSTEM,
    user: `Query: "${nl}"`,
  });
}

function haystack(o: OpportunitySummary): string {
  return [
    o.company,
    o.oneLiner,
    o.sector,
    o.stage,
    o.geography,
    ...o.founders.map((f) => f.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export type RankedResult = OpportunitySummary & { matchScore: number; matchReasons: string[] };

export async function runQuery(nl: string): Promise<{ parsed: QueryParse; results: RankedResult[] }> {
  const parsed = await parseQuery(nl);
  const all = await listOpportunities();

  const ranked: RankedResult[] = [];
  for (const o of all) {
    const hay = haystack(o);
    const reasons: string[] = [];
    let score = 0;

    // hard exclusion
    if (parsed.mustNot.some((m) => m && hay.includes(m.toLowerCase()))) continue;

    for (const s of parsed.sectors) if (o.sector && o.sector.toLowerCase().includes(s.toLowerCase())) { score += 3; reasons.push(`sector:${s}`); }
    for (const g of parsed.geographies) if (o.geography && o.geography.toLowerCase().includes(g.toLowerCase())) { score += 3; reasons.push(`geo:${g}`); }
    for (const st of parsed.stages) if (o.stage && o.stage.toLowerCase().includes(st.toLowerCase())) { score += 2; reasons.push(`stage:${st}`); }
    for (const k of parsed.keywords) if (k && hay.includes(k.toLowerCase())) { score += 1; reasons.push(`kw:${k}`); }
    for (const m of parsed.mustHave) {
      if (m && hay.includes(m.toLowerCase())) { score += 2; reasons.push(`has:${m}`); }
      else if (m) { score -= 2; } // penalize missing must-haves but don't hard-exclude
    }
    if (parsed.minFounderScore != null) {
      const best = Math.max(0, ...o.founders.map((f) => f.founderScore));
      if (best >= parsed.minFounderScore) { score += 2; reasons.push(`founderScore>=${parsed.minFounderScore}`); }
      else continue;
    }

    if (score > 0) ranked.push({ ...o, matchScore: score, matchReasons: reasons });
  }

  ranked.sort((a, b) => b.matchScore - a.matchScore);
  return { parsed, results: ranked };
}
