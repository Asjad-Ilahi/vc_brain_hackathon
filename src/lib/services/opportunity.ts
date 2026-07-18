/** Shared creation path for an opportunity — used by BOTH inbound apply and outbound sourcing. */
import { db } from "@/db/client";
import { companies, opportunities } from "@/db/schema";
import { upsertFounder, linkFounderToOpportunity, recordSignal } from "./ingest";

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
}): Promise<{ opportunityId: string; companyId: string; founderIds: string[]; returningFounders: number }> {
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
    })
    .returning();

  const founderIds: string[] = [];
  let returningFounders = 0;
  for (const f of input.founders) {
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
    await linkFounderToOpportunity(opp.id, founder.id, f.role ?? null);
    founderIds.push(founder.id);
  }

  const primaryFounderId = founderIds[0] ?? null;
  for (const s of input.signals) {
    await recordSignal({
      opportunityId: opp.id,
      companyId: company.id,
      founderId: primaryFounderId,
      ...s,
    });
  }

  return { opportunityId: opp.id, companyId: company.id, founderIds, returningFounders };
}
