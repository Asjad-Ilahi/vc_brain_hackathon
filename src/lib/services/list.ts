/** Read models for the dashboard list, opportunity detail, and NL query ranking. */
import { and, desc, eq, inArray } from "drizzle-orm";
import { founderDisplayName, cleanPlaceholderField } from "@/lib/utils";
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
  outreach,
} from "@/db/schema";

export type AxisData = {
  score: number;
  trend: string;
  confidence: number;
  rationale: string;
  rating?: string | null;
  prevScore?: number | null; // previous assessment — axis history is never discarded
};

export type AxisTriple = {
  founder?: AxisData;
  market?: AxisData;
  idea_vs_market?: AxisData;
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
  screenReason: string | null;
  decision: string | null;
  decisionNote: string | null;
  decidedBy: string | null;
  convictionScore: number | null;
  convictionReason: string | null;
  // `name` is always display-safe (a real name, "@handle", or the company as a
  // last resort — never "Unknown"/"Inventor of…"). `nameResolved` is false when
  // we could not identify a person, so the UI can lead with the company instead
  // of a placeholder. `isHandle` marks a username-only identity.
  founders: { id: string; name: string; nameResolved: boolean; isHandle: boolean; founderScore: number; isColdStart: boolean }[];
  axes: AxisTriple;
  flags: number; // contradicted claims surfaced by the validator
  recommendation: string | null; // memo's recommendation (decision stays human)
  timeToDecisionMs: number | null;
  firstSignalAt: string;
  deadlineAt: string | null; // the 24h clock
  decidedAt: string | null;
  applicantEmail?: string | null;
  deckUrl?: string | null;
};

/** Latest row per axis wins; the previous one becomes prevScore (history kept, never discarded). */
function axisTriple(rows: (typeof axisScores.$inferSelect)[]): AxisTriple {
  const byAxis = new Map<string, (typeof axisScores.$inferSelect)[]>();
  for (const r of rows) {
    const arr = byAxis.get(r.axis) ?? [];
    arr.push(r);
    byAxis.set(r.axis, arr);
  }
  const out: AxisTriple = {};
  for (const [axis, arr] of byAxis) {
    arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const latest = arr[arr.length - 1];
    const prev = arr.length > 1 ? arr[arr.length - 2] : null;
    const base: AxisData = {
      score: latest.score,
      trend: latest.trend,
      confidence: latest.confidence,
      rationale: latest.rationale,
      prevScore: prev ? prev.score : null,
    };
    if (axis === "founder") out.founder = base;
    else if (axis === "market") out.market = { ...base, rating: latest.rating };
    else if (axis === "idea_vs_market") out.idea_vs_market = base;
  }
  return out;
}

export async function listOpportunities(_userId?: string): Promise<OpportunitySummary[]> {
  // Single-fund: every opportunity belongs to the one workspace, so there is no
  // per-user scoping (the `userId` param is retained for call-site compatibility
  // but ignored). Archived = hypotheses from a previous thesis lens; kept in
  // Memory (founder profiles still show them) but out of the working views.
  let opps = await db.select().from(opportunities).orderBy(desc(opportunities.createdAt));
  opps = opps.filter((o) => o.status !== "archived");

  if (opps.length === 0) return [];
  const oppIds = opps.map((o) => o.id);
  const companyIds = [...new Set(opps.map((o) => o.companyId))];

  const [comps, axes, links, memoRows] = await Promise.all([
    db.select().from(companies).where(inArray(companies.id, companyIds)),
    db.select().from(axisScores).where(inArray(axisScores.opportunityId, oppIds)),
    db.select().from(opportunityFounders).where(inArray(opportunityFounders.opportunityId, oppIds)),
    db
      .select({ id: memos.id, opportunityId: memos.opportunityId, recommendation: memos.recommendation, createdAt: memos.createdAt })
      .from(memos)
      .where(inArray(memos.opportunityId, oppIds)),
  ]);
  const memoIds = memoRows.map((m) => m.id);
  const contradicted = memoIds.length
    ? await db
        .select({ memoId: claims.memoId })
        .from(claims)
        .where(and(inArray(claims.memoId, memoIds), eq(claims.externalVerification, "contradicted")))
    : [];
  const memoByOpp = new Map<string, { id: string; recommendation: string | null }>();
  for (const m of [...memoRows].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
    memoByOpp.set(m.opportunityId, { id: m.id, recommendation: m.recommendation });
  }
  const flagsByOpp = new Map<string, number>();
  {
    const oppByMemo = new Map(memoRows.map((m) => [m.id, m.opportunityId]));
    for (const c of contradicted) {
      const oppId = oppByMemo.get(c.memoId);
      if (oppId) flagsByOpp.set(oppId, (flagsByOpp.get(oppId) ?? 0) + 1);
    }
  }
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
      .map((f) => {
        const display = founderDisplayName(f!.fullName, f!.githubLogin);
        return {
          id: f!.id,
          // Never surface junk: real name → "@handle" → the company name as a
          // last resort (so the card still renders something real).
          name: display ?? (c?.name ?? f!.fullName),
          nameResolved: display != null,
          isHandle: display != null && display.startsWith("@"),
          founderScore: f!.founderScore,
          isColdStart: f!.isColdStart,
        };
      });
    const ttd =
      o.decidedAt && o.firstSignalAt
        ? new Date(o.decidedAt).getTime() - new Date(o.firstSignalAt).getTime()
        : null;
    return {
      id: o.id,
      company: c?.name ?? "Unknown",
      oneLiner: c?.oneLiner ?? null,
      sector: cleanPlaceholderField(c?.sector),
      stage: cleanPlaceholderField(c?.stage),
      geography: cleanPlaceholderField(c?.geography),
      source: o.source,
      sourceChannel: o.sourceChannel,
      status: o.status,
      screenResult: o.screenResult,
      screenReason: o.screenReason,
      decision: o.decision,
      decisionNote: o.decisionNote,
      decidedBy: o.decidedBy,
      convictionScore: o.convictionScore ?? null,
      convictionReason: o.convictionReason ?? null,
      founders: fList,
      axes: axisTriple(axesByOpp.get(o.id) ?? []),
      flags: flagsByOpp.get(o.id) ?? 0,
      recommendation: memoByOpp.get(o.id)?.recommendation ?? null,
      timeToDecisionMs: ttd,
      firstSignalAt: new Date(o.firstSignalAt).toISOString(),
      deadlineAt: o.deadlineAt ? new Date(o.deadlineAt).toISOString() : null,
      decidedAt: o.decidedAt ? new Date(o.decidedAt).toISOString() : null,
      applicantEmail: o.applicantEmail,
      deckUrl: o.deckUrl,
    };
  });
}

export async function getOpportunityDetail(id: string, userId?: string) {
  const summaries = await listOpportunities(userId);
  const summary = summaries.find((s) => s.id === id);
  if (!summary) throw new Error("not found");

  const [sigs, memoRows, steps, outreachRows] = await Promise.all([
    db.select().from(signals).where(eq(signals.opportunityId, id)),
    db.select().from(memos).where(eq(memos.opportunityId, id)).orderBy(desc(memos.createdAt)).limit(1),
    db.select().from(reasoningSteps).where(eq(reasoningSteps.opportunityId, id)).orderBy(reasoningSteps.stepOrder),
    db.select().from(outreach).where(eq(outreach.opportunityId, id)).orderBy(desc(outreach.createdAt)).limit(1),
  ]);
  const memo = memoRows[0] ?? null;
  const claimRows = memo ? await db.select().from(claims).where(eq(claims.memoId, memo.id)) : [];

  return {
    summary,
    signals: sigs,
    memo,
    claims: claimRows,
    reasoningSteps: steps,
    outreach: outreachRows[0] ?? null,
  };
}
