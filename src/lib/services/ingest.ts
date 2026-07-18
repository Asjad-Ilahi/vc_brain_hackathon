/**
 * Memory ingestion — the data foundation.
 *  - Founders are upserted by canonical handle so the Founder Score PERSISTS
 *    across applications and never resets.
 *  - Signals are deduped by hash, timestamped, and tagged by source.
 *  - Every score change is appended to founder_score_history (the trend).
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  founders,
  founderScoreHistory,
  signals,
  opportunityFounders,
} from "@/db/schema";
import { canonicalizeHandle, clampScore, dedupeHash } from "@/lib/utils";

export async function upsertFounder(input: {
  handleSeed: string;
  fullName: string;
  githubLogin?: string | null;
  linkedinUrl?: string | null;
  twitterHandle?: string | null;
  location?: string | null;
  bio?: string | null;
  isColdStart?: boolean;
}) {
  const canonicalHandle = canonicalizeHandle(input.githubLogin || input.handleSeed || input.fullName);

  const existing = await db
    .select()
    .from(founders)
    .where(eq(founders.canonicalHandle, canonicalHandle))
    .limit(1);

  if (existing.length > 0) {
    // Enrich missing fields but NEVER reset the persistent Founder Score.
    const f = existing[0];
    await db
      .update(founders)
      .set({
        fullName: f.fullName || input.fullName,
        githubLogin: f.githubLogin ?? input.githubLogin ?? null,
        linkedinUrl: f.linkedinUrl ?? input.linkedinUrl ?? null,
        twitterHandle: f.twitterHandle ?? input.twitterHandle ?? null,
        location: f.location ?? input.location ?? null,
        bio: f.bio ?? input.bio ?? null,
        updatedAt: new Date(),
      })
      .where(eq(founders.id, f.id));
    return { founder: f, isReturning: true };
  }

  const [created] = await db
    .insert(founders)
    .values({
      canonicalHandle,
      fullName: input.fullName,
      githubLogin: input.githubLogin ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      twitterHandle: input.twitterHandle ?? null,
      location: input.location ?? null,
      bio: input.bio ?? null,
      isColdStart: input.isColdStart ?? false,
      founderScore: 50,
      founderScoreConfidence: 0.3,
    })
    .returning();
  return { founder: created, isReturning: false };
}

export async function linkFounderToOpportunity(
  opportunityId: string,
  founderId: string,
  role?: string | null
) {
  const existing = await db
    .select()
    .from(opportunityFounders)
    .where(
      and(
        eq(opportunityFounders.opportunityId, opportunityId),
        eq(opportunityFounders.founderId, founderId)
      )
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(opportunityFounders).values({ opportunityId, founderId, role: role ?? null });
  }
}

/** Insert a signal unless an identical one already exists (dedupe by hash). */
export async function recordSignal(input: {
  opportunityId?: string | null;
  founderId?: string | null;
  companyId?: string | null;
  sourceType: string;
  sourceUrl?: string | null;
  title?: string | null;
  rawText: string;
  extractedJson?: unknown;
  tags?: string[];
  observedAt?: Date | null;
}) {
  const hash = dedupeHash(input.sourceType, `${input.title ?? ""}\n${input.rawText}`);
  const [row] = await db
    .insert(signals)
    .values({
      opportunityId: input.opportunityId ?? null,
      founderId: input.founderId ?? null,
      companyId: input.companyId ?? null,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      title: input.title ?? null,
      rawText: input.rawText,
      extractedJson: input.extractedJson ?? null,
      tags: input.tags ?? [],
      dedupeHash: hash,
      observedAt: input.observedAt ?? null,
    })
    .onConflictDoNothing({ target: signals.dedupeHash })
    .returning();

  if (row) return { signal: row, deduped: false };
  // Already existed — fetch and return it.
  const [existing] = await db.select().from(signals).where(eq(signals.dedupeHash, hash)).limit(1);
  return { signal: existing, deduped: true };
}

/** Move the persistent Founder Score and append to its history (the trend). */
export async function bumpFounderScore(
  founderId: string,
  delta: number,
  reason: string,
  milestone: string,
  confidence?: number
) {
  const [f] = await db.select().from(founders).where(eq(founders.id, founderId)).limit(1);
  if (!f) return;
  const newScore = clampScore(f.founderScore + delta);
  const newConf = confidence ?? Math.min(0.95, f.founderScoreConfidence + 0.1);
  await db
    .update(founders)
    .set({ founderScore: newScore, founderScoreConfidence: newConf, updatedAt: new Date() })
    .where(eq(founders.id, founderId));
  await db.insert(founderScoreHistory).values({
    founderId,
    score: newScore,
    delta,
    confidence: newConf,
    reason,
    milestone,
  });
}

export async function getFounderScoreHistory(founderId: string) {
  return db
    .select()
    .from(founderScoreHistory)
    .where(eq(founderScoreHistory.founderId, founderId))
    .orderBy(desc(founderScoreHistory.createdAt));
}
