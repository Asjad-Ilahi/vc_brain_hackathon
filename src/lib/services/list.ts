/** Read models for the dashboard list, opportunity detail, and NL query ranking. */
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  opportunities,
  companies,
  founders,
  opportunityFounders,
  axisScores,
  memos,
  claims,
  reasoningSteps,
  signals,
} from "@/db/schema";

export type AxisTriple = {
  founder?: { score: number; trend: string; confidence: number; rationale: string };
  market?: { score: number; trend: string; confidence: number; rationale: string; rating?: string | null };
  idea_vs_market?: { score: number; trend: string; confidence: number; rationale: string };
};

export type OpportunitySummary = {
  id: string;
  company: string;
  oneLiner: string | null;
  sector: string | null;
  stage: string | null;
  geography: string | null;
  source: string;
  sourceChannel: string | null;
  status: string;
  screenResult: string | null;
  decision: string | null;
  founders: { id: string; name: string; founderScore: number; isColdStart: boolean }[];
  axes: AxisTriple;
  timeToDecisionMs: number | null;
  firstSignalAt: string;
  decidedAt: string | null;
};

function axisTriple(rows: (typeof axisScores.$inferSelect)[]): AxisTriple {
  const out: AxisTriple = {};
  for (const r of rows) {
    const base = { score: r.score, trend: r.trend, confidence: r.confidence, rationale: r.rationale };
    if (r.axis === "founder") out.founder = base;
    else if (r.axis === "market") out.market = { ...base, rating: r.rating };
    else if (r.axis === "idea_vs_market") out.idea_vs_market = base;
  }
  return out;
}

export async function listOpportunities(): Promise<OpportunitySummary[]> {
  const opps = await db.select().from(opportunities).orderBy(desc(opportunities.createdAt));
  if (opps.length === 0) return [];
  const oppIds = opps.map((o) => o.id);
  const companyIds = [...new Set(opps.map((o) => o.companyId))];

  const [comps, axes, links] = await Promise.all([
    db.select().from(companies).where(inArray(companies.id, companyIds)),
    db.select().from(axisScores).where(inArray(axisScores.opportunityId, oppIds)),
    db.select().from(opportunityFounders).where(inArray(opportunityFounders.opportunityId, oppIds)),
  ]);
  const founderIds = [...new Set(links.map((l) => l.founderId))];
  const fs = founderIds.length
    ? await db.select().from(founders).where(inArray(founders.id, founderIds))
    : [];

  const compById = new Map(comps.map((c) => [c.id, c]));
  const founderById = new Map(fs.map((f) => [f.id, f]));
  const axesByOpp = new Map<string, (typeof axisScores.$inferSelect)[]>();
  for (const a of axes) {
    const arr = axesByOpp.get(a.opportunityId) ?? [];
    arr.push(a);
    axesByOpp.set(a.opportunityId, arr);
  }
  const foundersByOpp = new Map<string, string[]>();
  for (const l of links) {
    const arr = foundersByOpp.get(l.opportunityId) ?? [];
    arr.push(l.founderId);
    foundersByOpp.set(l.opportunityId, arr);
  }

  return opps.map((o) => {
    const c = compById.get(o.companyId);
    const fList = (foundersByOpp.get(o.id) ?? [])
      .map((id) => founderById.get(id))
      .filter(Boolean)
      .map((f) => ({
        id: f!.id,
        name: f!.fullName,
        founderScore: f!.founderScore,
        isColdStart: f!.isColdStart,
      }));
    const ttd =
      o.decidedAt && o.firstSignalAt
        ? new Date(o.decidedAt).getTime() - new Date(o.firstSignalAt).getTime()
        : null;
    return {
      id: o.id,
      company: c?.name ?? "Unknown",
      oneLiner: c?.oneLiner ?? null,
      sector: c?.sector ?? null,
      stage: c?.stage ?? null,
      geography: c?.geography ?? null,
      source: o.source,
      sourceChannel: o.sourceChannel,
      status: o.status,
      screenResult: o.screenResult,
      decision: o.decision,
      founders: fList,
      axes: axisTriple(axesByOpp.get(o.id) ?? []),
      timeToDecisionMs: ttd,
      firstSignalAt: new Date(o.firstSignalAt).toISOString(),
      decidedAt: o.decidedAt ? new Date(o.decidedAt).toISOString() : null,
    };
  });
}

export async function getOpportunityDetail(id: string) {
  const summaries = await listOpportunities();
  const summary = summaries.find((s) => s.id === id);
  if (!summary) throw new Error("not found");

  const [sigs, memoRows, steps] = await Promise.all([
    db.select().from(signals).where(eq(signals.opportunityId, id)),
    db.select().from(memos).where(eq(memos.opportunityId, id)).orderBy(desc(memos.createdAt)).limit(1),
    db.select().from(reasoningSteps).where(eq(reasoningSteps.opportunityId, id)).orderBy(reasoningSteps.stepOrder),
  ]);
  const memo = memoRows[0] ?? null;
  const claimRows = memo ? await db.select().from(claims).where(eq(claims.memoId, memo.id)) : [];

  return { summary, signals: sigs, memo, claims: claimRows, reasoningSteps: steps };
}
