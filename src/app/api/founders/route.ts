/**
 * Memory · the founder database. Every founder ever surfaced, with the
 * persistent score that follows them across ventures, their pipeline status,
 * and signal recency.
 */
import { desc, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  founders,
  founderScoreHistory,
  opportunityFounders,
  opportunities,
  companies,
  signals,
} from "@/db/schema";
import { ok, fail, errMessage } from "@/lib/api";
import { founderDisplayName } from "@/lib/utils";

export const runtime = "nodejs";

export type FounderCard = {
  id: string;
  name: string;
  handle: string;
  location: string | null;
  bio: string | null;
  score: number;
  confidence: number;
  isColdStart: boolean;
  status: "deployed" | "in_pipeline" | "tracking" | "passed";
  sectors: string[];
  sources: string[];
  lastSignalAt: string | null;
  lastDelta: number;
  firstSeenAt: string;
  latestOpportunityId: string | null;
};

export async function GET() {
  try {
    const fs = await db.select().from(founders).orderBy(desc(founders.founderScore));
    if (fs.length === 0) return ok([] as FounderCard[]);
    const founderIds = fs.map((f) => f.id);

    const [links, sigRows, histRows] = await Promise.all([
      db.select().from(opportunityFounders).where(inArray(opportunityFounders.founderId, founderIds)),
      db
        .select({ founderId: signals.founderId, ingestedAt: signals.ingestedAt, sourceType: signals.sourceType })
        .from(signals)
        .where(isNotNull(signals.founderId)),
      db
        .select()
        .from(founderScoreHistory)
        .where(inArray(founderScoreHistory.founderId, founderIds))
        .orderBy(desc(founderScoreHistory.createdAt)),
    ]);

    const oppIds = [...new Set(links.map((l) => l.opportunityId))];
    const opps = oppIds.length
      ? await db.select().from(opportunities).where(inArray(opportunities.id, oppIds))
      : [];
    const companyIds = [...new Set(opps.map((o) => o.companyId))];
    const comps = companyIds.length
      ? await db.select().from(companies).where(inArray(companies.id, companyIds))
      : [];
    const compById = new Map(comps.map((c) => [c.id, c]));
    const oppById = new Map(opps.map((o) => [o.id, o]));

    const linksByFounder = new Map<string, string[]>();
    for (const l of links) {
      const arr = linksByFounder.get(l.founderId) ?? [];
      arr.push(l.opportunityId);
      linksByFounder.set(l.founderId, arr);
    }
    const lastSignalByFounder = new Map<string, { at: Date; sources: Set<string> }>();
    for (const s of sigRows) {
      if (!s.founderId) continue;
      const cur = lastSignalByFounder.get(s.founderId) ?? { at: new Date(0), sources: new Set<string>() };
      if (new Date(s.ingestedAt) > cur.at) cur.at = new Date(s.ingestedAt);
      cur.sources.add(s.sourceType);
      lastSignalByFounder.set(s.founderId, cur);
    }
    const lastDeltaByFounder = new Map<string, number>();
    for (const h of histRows) {
      if (!lastDeltaByFounder.has(h.founderId)) lastDeltaByFounder.set(h.founderId, h.delta);
    }

    const cards: FounderCard[] = fs.map((f) => {
      const myOpps = (linksByFounder.get(f.id) ?? [])
        .map((id) => oppById.get(id))
        .filter(Boolean) as (typeof opportunities.$inferSelect)[];
      const status: FounderCard["status"] = myOpps.some((o) => o.decision === "invest")
        ? "deployed"
        : myOpps.some((o) => !o.decision)
          ? "in_pipeline"
          : myOpps.some((o) => o.decision === "watch")
            ? "tracking"
            : myOpps.some((o) => o.decision === "pass")
              ? "passed"
              : "tracking";
      const sectors = [
        ...new Set(myOpps.map((o) => compById.get(o.companyId)?.sector).filter(Boolean) as string[]),
      ];
      const latest = [...myOpps].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      const sig = lastSignalByFounder.get(f.id);
      return {
        id: f.id,
        // Same identity hygiene as the radar: a real name, an "@handle", or an
        // honest "Unidentified founder" — never "Unknown"/"Inventor of…".
        name: founderDisplayName(f.fullName, f.githubLogin) ?? "Unidentified founder",
        handle: f.canonicalHandle,
        location: f.location,
        bio: f.bio,
        score: f.founderScore,
        confidence: f.founderScoreConfidence,
        isColdStart: f.isColdStart,
        status,
        sectors,
        sources: sig ? [...sig.sources] : [],
        lastSignalAt: sig ? sig.at.toISOString() : null,
        lastDelta: lastDeltaByFounder.get(f.id) ?? 0,
        firstSeenAt: new Date(f.firstSeenAt).toISOString(),
        latestOpportunityId: latest?.id ?? null,
      };
    });

    return ok(cards);
  } catch (e) {
    return fail(errMessage(e));
  }
}
