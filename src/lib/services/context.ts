/** Loads and formats everything known about an opportunity for the LLM agents. */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  opportunities,
  companies,
  founders,
  opportunityFounders,
  signals,
} from "@/db/schema";

export type OpportunityContext = {
  opportunity: typeof opportunities.$inferSelect;
  company: typeof companies.$inferSelect;
  founders: (typeof founders.$inferSelect)[];
  signals: (typeof signals.$inferSelect)[];
};

export async function getOpportunityContext(opportunityId: string): Promise<OpportunityContext> {
  const [opportunity] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, opportunityId))
    .limit(1);
  if (!opportunity) throw new Error(`Opportunity ${opportunityId} not found`);

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, opportunity.companyId))
    .limit(1);

  const links = await db
    .select()
    .from(opportunityFounders)
    .where(eq(opportunityFounders.opportunityId, opportunityId));

  const founderRows: (typeof founders.$inferSelect)[] = [];
  for (const link of links) {
    const [f] = await db.select().from(founders).where(eq(founders.id, link.founderId)).limit(1);
    if (f) founderRows.push(f);
  }

  const sigs = await db
    .select()
    .from(signals)
    .where(eq(signals.opportunityId, opportunityId));

  return { opportunity, company, founders: founderRows, signals: sigs };
}

/** Human-readable context. Signals are numbered WITH their IDs so agents can cite evidence. */
export function formatContext(ctx: OpportunityContext): string {
  const { company, founders: fs, signals: sigs } = ctx;
  const founderLines = fs
    .map(
      (f) =>
        `- ${f.fullName}${f.githubLogin ? ` (gh:${f.githubLogin})` : ""} — persistent Founder Score ${f.founderScore}/100 (confidence ${f.founderScoreConfidence})${f.isColdStart ? " [COLD-START: little public track record]" : ""}${f.bio ? `\n  bio: ${f.bio}` : ""}`
    )
    .join("\n");

  const signalLines = sigs
    .map(
      (s) =>
        `[signal ${s.id}] (${s.sourceType}${s.sourceUrl ? ` ${s.sourceUrl}` : ""}) ${s.title ? s.title + " — " : ""}${(s.rawText ?? "").slice(0, 500)}`
    )
    .join("\n");

  return [
    `COMPANY: ${company.name}${company.oneLiner ? ` — ${company.oneLiner}` : ""}`,
    `Sector: ${company.sector ?? "?"} | Stage: ${company.stage ?? "?"} | Geography: ${company.geography ?? "?"}`,
    company.description ? `Description: ${company.description}` : "",
    "",
    `FOUNDERS:\n${founderLines || "(none recorded)"}`,
    "",
    `SIGNALS (evidence — cite by [signal <id>]):\n${signalLines || "(none recorded)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}
