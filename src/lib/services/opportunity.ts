/** Shared creation path for an opportunity — used by BOTH inbound apply and outbound sourcing. */
import { and, desc, eq, ilike, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { companies, opportunities, signals, sourcingNodes } from "@/db/schema";
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

function extractSourcingNodeDetails(
  channel: string,
  signals: NewSignal[]
): { institution: string; program: string; referrer: string } {
  let institution = "Open Web";
  let program = "Web Search";
  let referrer = "Radar Scan";

  const firstSig = signals[0];
  const textToScan = `${firstSig?.title ?? ""} ${firstSig?.rawText ?? ""} ${firstSig?.sourceUrl ?? ""}`.toLowerCase();

  switch (channel) {
    case "github":
      institution = "GitHub";
      program = "OSS Repository";
      referrer = "Developer Scan";
      break;
    case "arxiv":
      institution = "arXiv";
      program = "Academic Paper";
      referrer = "Research Sweep";
      break;
    case "hackernews":
      institution = "Hacker News";
      program = textToScan.includes("show hn") ? "Show HN" : "HN Post";
      referrer = "Community Feed";
      break;
    case "producthunt":
      institution = "Product Hunt";
      program = "Product Launch";
      referrer = "PH Daily";
      break;
    case "hackathons":
      institution = "Devpost";
      if (textToScan.includes("mit")) {
        institution = "MIT CNC Hackathon";
      } else if (textToScan.includes("hack-nation")) {
        institution = "Hack-Nation";
      } else if (textToScan.includes("global ai")) {
        institution = "Global AI Hackathon";
      }
      program = "Hackathon Win";
      referrer = "Hackathon Crawler";
      break;
    case "patents":
      institution = "US Patent Office";
      program = "Patent Filing";
      referrer = "IP Registry Scrape";
      break;
    case "accelerators":
      if (textToScan.includes("combinator") || textToScan.includes("yc")) {
        institution = "Y Combinator";
      } else if (textToScan.includes("techstars")) {
        institution = "Techstars";
      } else {
        institution = "Accelerator Cohort";
      }
      program = "Cohort Batch";
      referrer = "Accelerator Scrape";
      break;
    case "application":
      institution = "Direct Pitch";
      program = "Inbound Portal";
      referrer = "Self-Applied";
      break;
    default:
      if (channel === "web") {
        institution = "Open Web";
        program = "General Web Search";
        referrer = "Web Crawler";
      }
  }

  return { institution, program, referrer };
}

export async function createOpportunity(input: {
  existingOpportunityId?: string | null;
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
  // If this is a conversion from an existing outbound opportunity
  if (input.existingOpportunityId) {
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, input.existingOpportunityId)).limit(1);
    if (opp) {
      const [company] = await db.select().from(companies).where(eq(companies.id, opp.companyId)).limit(1);
      if (company) {
        await db
          .update(companies)
          .set({
            sector: input.company.sector ?? company.sector,
            stage: input.company.stage ?? company.stage,
            geography: input.company.geography ?? company.geography,
            oneLiner: input.company.oneLiner ?? company.oneLiner,
            description: input.company.description ?? company.description,
          })
          .where(eq(companies.id, company.id));

        await db
          .update(opportunities)
          .set({
            status: "applied",
            source: "inbound",
            sourceChannel: "application",
          })
          .where(eq(opportunities.id, opp.id));

        const { founderIds, returningFounders } = await attachFoundersAndSignals(
          opp.id,
          company.id,
          input.founders,
          input.signals
        );

        return { opportunityId: opp.id, companyId: company.id, founderIds, returningFounders, deduped: false };
      }
    }
  }

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

  // Real Entity Extraction for Sourcing Graph
  try {
    const details = extractSourcingNodeDetails(input.sourceChannel, input.signals);
    await db.insert(sourcingNodes).values({
      opportunityId: opp.id,
      institutionName: details.institution,
      programName: details.program,
      referrerName: details.referrer,
      qualityRating: 50, // default rating
    });
  } catch (err) {
    console.error("Failed to insert sourcing node:", err);
  }

  const { founderIds, returningFounders } = await attachFoundersAndSignals(
    opp.id,
    company.id,
    input.founders,
    input.signals
  );

  if (input.source === "outbound") await applyCorroborationBoost(opp.id, founderIds[0] ?? null);

  return { opportunityId: opp.id, companyId: company.id, founderIds, returningFounders, deduped: false };
}
