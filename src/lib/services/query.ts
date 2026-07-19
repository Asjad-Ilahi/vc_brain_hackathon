/**
 * Multi-attribute reasoning — resolve a compound natural-language query in one
 * pass (e.g. "technical founder, Berlin, AI infra, no prior VC backing"), not as
 * a stack of manual filters. Parse -> structured filter -> ranked results.
 */
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { signals, founders, opportunityFounders, memos, claims } from "@/db/schema";
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

/**
 * The haystack is DEEP on purpose: the brief's example query ("technical founder,
 * Berlin, AI infra, enterprise traction, no prior VC backing, top-tier
 * accelerator") must resolve against everything Memory knows — founder bios,
 * raw signal text, screening reasons, axis rationales — not just the card title.
 */
function haystack(o: OpportunitySummary, extra: string): string {
  return [
    o.company,
    o.oneLiner,
    o.sector,
    o.stage,
    o.geography,
    o.screenReason,
    o.convictionReason,
    o.axes.founder?.rationale,
    o.axes.market?.rationale,
    o.axes.idea_vs_market?.rationale,
    ...o.founders.map((f) => f.name),
    extra,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .slice(0, 8000);
}

/** Bulk-load signal text + founder bios per opportunity (one query each). */
async function deepText(oppIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (oppIds.length === 0) return out;
  const [sigRows, links, memoRows] = await Promise.all([
    db
      .select({ opportunityId: signals.opportunityId, title: signals.title, rawText: signals.rawText })
      .from(signals)
      .where(inArray(signals.opportunityId, oppIds)),
    db
      .select({ opportunityId: opportunityFounders.opportunityId, founderId: opportunityFounders.founderId })
      .from(opportunityFounders)
      .where(inArray(opportunityFounders.opportunityId, oppIds)),
    db
      .select({ id: memos.id, opportunityId: memos.opportunityId, summary: memos.summary })
      .from(memos)
      .where(inArray(memos.opportunityId, oppIds)),
  ]);
  // Memo summaries + claim text are searchable too — the top bar promises it.
  const claimRows = memoRows.length
    ? await db
        .select({ memoId: claims.memoId, claimText: claims.claimText })
        .from(claims)
        .where(inArray(claims.memoId, memoRows.map((m) => m.id)))
    : [];
  const oppByMemo = new Map(memoRows.map((m) => [m.id, m.opportunityId]));
  const founderIds = [...new Set(links.map((l) => l.founderId))];
  const founderRows = founderIds.length
    ? await db
        .select({ id: founders.id, bio: founders.bio, location: founders.location })
        .from(founders)
        .where(inArray(founders.id, founderIds))
    : [];
  const founderById = new Map(founderRows.map((f) => [f.id, f]));

  const push = (oppId: string | null, text: string | null | undefined) => {
    if (!oppId || !text) return;
    out.set(oppId, `${out.get(oppId) ?? ""} ${text.slice(0, 600)}`);
  };
  for (const s of sigRows) {
    push(s.opportunityId, s.title);
    push(s.opportunityId, s.rawText);
  }
  for (const l of links) {
    const f = founderById.get(l.founderId);
    push(l.opportunityId, f?.bio);
    push(l.opportunityId, f?.location);
  }
  for (const m of memoRows) push(m.opportunityId, m.summary);
  for (const c of claimRows) push(oppByMemo.get(c.memoId) ?? null, c.claimText);
  return out;
}

export type RankedResult = OpportunitySummary & { matchScore: number; matchReasons: string[] };

export async function runQuery(nl: string): Promise<{ parsed: QueryParse; results: RankedResult[] }> {
  const parsed = await parseQuery(nl);
  const all = await listOpportunities();
  const deep = await deepText(all.map((o) => o.id));

  const ranked: RankedResult[] = [];
  for (const o of all) {
    const hay = haystack(o, deep.get(o.id) ?? "");
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
