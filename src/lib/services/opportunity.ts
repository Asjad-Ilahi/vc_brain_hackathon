/** Shared creation path for an opportunity — used by BOTH inbound apply and outbound sourcing. */
import { and, desc, eq, ilike, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, opportunities, signals } from "@/db/schema";
import { upsertFounder, linkFounderToOpportunity, recordSignal } from "./ingest";

/**
 * Cross-channel corroboration: a founder independently visible in 2+ channels
 * (GitHub + arXiv, launch + patent…) is a stronger hypothesis than any single
 * signal. One weak signal stays below the conviction threshold; converging
 * signals cross it — that's the point of a multi-antenna radar.
 */
async function applyCorroborationBoost(opportunityId: string, founderId: string | null) {
  if (!founderId) return;
  const rows = await db
    .select({ sourceType: signals.sourceType })
    .from(signals)
    .where(and(eq(signals.founderId, founderId), isNotNull(signals.sourceType)));
  const distinct = new Set(rows.map((r) => r.sourceType)).size;
  if (distinct < 2) return;
  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  if (!opp || opp.convictionScore == null || opp.decision) return;
  const boost = Math.min(16, (distinct - 1) * 12);
  const already = (opp.convictionReason ?? "").includes("seen in");
  if (already) return;
  await db
    .update(opportunities)
    .set({
      convictionScore: Math.min(100, opp.convictionScore + boost),
      convictionReason: `seen in ${distinct} different places · ${opp.convictionReason ?? ""}`.slice(0, 300),
    })
    .where(eq(opportunities.id, opportunityId));
}

export type NewFounder = {
  fullName: string;
  handleSeed?: string;
  githubLogin?: string | null;
  linkedinUrl?: string | null;
  twitterHandle?: string | null;
  location?: string | null;
  bio?: string | null;
  role?: string | null;
  isColdStart?: boolean;
};

export type NewSignal = {
  sourceType: string;
  sourceUrl?: string | null;
  title?: string | null;
  rawText: string;
  extractedJson?: unknown;
  tags?: string[];
  observedAt?: Date | null;
};

export type CreateOpportunityResult = {
  opportunityId: string;
  companyId: string;
  founderIds: string[];
  returningFounders: number;
  /** True when an outbound re-scan matched an existing open opportunity — we
   *  enriched it with fresh signals instead of creating a duplicate. */
  deduped: boolean;
};

async function attachFoundersAndSignals(
  opportunityId: string,
  companyId: string,
  founders: NewFounder[],
  signals: NewSignal[]
): Promise<{ founderIds: string[]; returningFounders: number }> {
  const founderIds: string[] = [];
  let returningFounders = 0;
  for (const f of founders) {
    const { founder, isReturning } = await upsertFounder({
      handleSeed: f.handleSeed ?? f.fullName,
      fullName: f.fullName,
      githubLogin: f.githubLogin ?? null,
      linkedinUrl: f.linkedinUrl ?? null,
      twitterHandle: f.twitterHandle ?? null,
      location: f.location ?? null,
      bio: f.bio ?? null,
      isColdStart: f.isColdStart ?? false,
    });
    if (isReturning) returningFounders++;
    await linkFounderToOpportunity(opportunityId, founder.id, f.role ?? null);
    founderIds.push(founder.id);
  }
  const primaryFounderId = founderIds[0] ?? null;
  for (const s of signals) {
    await recordSignal({ opportunityId, companyId, founderId: primaryFounderId, ...s });
  }
  return { founderIds, returningFounders };
}

export async function createOpportunity(input: {
  source: "inbound" | "outbound";
  sourceChannel: string;
  thesisId?: string | null;
  convictionScore?: number | null;
  convictionReason?: string | null;
  company: {
    name: string;
    domain?: string | null;
    sector?: string | null;
    stage?: string | null;
    geography?: string | null;
    oneLiner?: string | null;
    description?: string | null;
  };
  founders: NewFounder[];
  signals: NewSignal[];
}): Promise<CreateOpportunityResult> {
  // OUTBOUND DEDUPE: re-scanning the same founder must ENRICH the existing
  // opportunity (new timestamped signal = the trend over time), not duplicate it.
  // Inbound is exempt on purpose — a re-application is a new evaluation instance
  // (the persistent Founder Score is what carries over).
  if (input.source === "outbound") {
    const existing = await db
      .select({ opp: opportunities, company: companies })
      .from(opportunities)
      .innerJoin(companies, eq(opportunities.companyId, companies.id))
      .where(
        and(
          eq(opportunities.sourceChannel, input.sourceChannel),
          ilike(companies.name, input.company.name)
        )
      )
      .orderBy(desc(opportunities.createdAt))
      .limit(1);

    if (existing.length > 0) {
      const { opp, company } = existing[0];
      const { founderIds, returningFounders } = await attachFoundersAndSignals(
        opp.id,
        company.id,
        input.founders,
        input.signals
      );
      // Refresh conviction with the newest read (signals strengthen or fade).
      if (input.convictionScore != null && opp.decision == null) {
        await db
          .update(opportunities)
          .set({
            convictionScore: input.convictionScore,
            convictionReason: input.convictionReason ?? null,
          })
          .where(eq(opportunities.id, opp.id));
      }
      await applyCorroborationBoost(opp.id, founderIds[0] ?? null);
      return {
        opportunityId: opp.id,
        companyId: company.id,
        founderIds,
        returningFounders,
        deduped: true,
      };
    }
  }

  const [company] = await db
    .insert(companies)
    .values({
      name: input.company.name,
      domain: input.company.domain ?? null,
      sector: input.company.sector ?? null,
      stage: input.company.stage ?? null,
      geography: input.company.geography ?? null,
      oneLiner: input.company.oneLiner ?? null,
      description: input.company.description ?? null,
    })
    .returning();

  const now = new Date();
  const [opp] = await db
    .insert(opportunities)
    .values({
      companyId: company.id,
      thesisId: input.thesisId ?? null,
      source: input.source,
      sourceChannel: input.sourceChannel,
      status: "sourced",
      convictionScore: input.convictionScore ?? null,
      convictionReason: input.convictionReason ?? null,
      // The 24h clock starts at first signal.
      deadlineAt: new Date(now.getTime() + 24 * 3600_000),
    })
    .returning();

  const { founderIds, returningFounders } = await attachFoundersAndSignals(
    opp.id,
    company.id,
    input.founders,
    input.signals
  );

  if (input.source === "outbound") await applyCorroborationBoost(opp.id, founderIds[0] ?? null);

  return { opportunityId: opp.id, companyId: company.id, founderIds, returningFounders, deduped: false };
}
