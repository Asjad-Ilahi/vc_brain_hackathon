/**
 * Autopilot — processes ONE deal end-to-end so the investor sees finished
 * results, not buttons. Atomically claims the strongest unprocessed candidate
 * (safe for parallel workers: two concurrent calls get two different deals),
 * then runs the full agent chain: screen → background check (new founders) →
 * 3-axis scoring → memo → external verification. Everything is real work on
 * real data; a screened-out deal is also a finished result.
 */
import { eq, sql, and } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, opportunityFounders, founders, signals, companies } from "@/db/schema";
import { screenOpportunity } from "@/lib/services/screen";
import { scoreOpportunity } from "@/lib/services/score";
import { buildMemo, verifyMemoClaims } from "@/lib/services/memo";
import { analyzeColdStartFootprint } from "@/lib/services/coldstart";
import { runDeepFounderBackgroundCheck, sourceAll } from "@/lib/services/sourcing";
import { getActiveThesis } from "@/lib/services/thesis";
import { userFromRequest } from "@/lib/auth";
import { ok, fail, errMessage } from "@/lib/api";

let lastSweepAt = 0;

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return fail("Unauthorized", 401);

  const thesis = await getActiveThesis(user.id);
  if (!thesis) return ok({ processed: null, queueEmpty: true });

  // Atomic claim — parallel workers never grab the same deal. The outer
  // status re-check matters: under READ COMMITTED, a second concurrent UPDATE
  // re-evaluates its WHERE against the locked row and matches nothing.
  const claimed = await db.execute(sql`
    UPDATE opportunities SET status = 'in_diligence', claimed_at = now()
    WHERE id = (
      SELECT id FROM opportunities
      WHERE status IN ('sourced', 'screened')
        AND thesis_id = ${thesis.id}
        AND decision IS NULL
        AND (screen_result IS NULL OR screen_result = 'pass')
      ORDER BY conviction_score DESC NULLS LAST, created_at DESC
      LIMIT 1
    )
    AND status IN ('sourced', 'screened')
    RETURNING id`);
  let id = (claimed.rows[0] as { id: string } | undefined)?.id;
  if (!id) {
    const nowTime = Date.now();
    if (nowTime - lastSweepAt > 60_000) {
      lastSweepAt = nowTime;
      try {
        await sourceAll(user.id);
        const claimedRetry = await db.execute(sql`
          UPDATE opportunities SET status = 'in_diligence', claimed_at = now()
          WHERE id = (
            SELECT id FROM opportunities
            WHERE status IN ('sourced', 'screened')
              AND thesis_id = ${thesis.id}
              AND decision IS NULL
              AND (screen_result IS NULL OR screen_result = 'pass')
            ORDER BY conviction_score DESC NULLS LAST, created_at DESC
            LIMIT 1
          )
          AND status IN ('sourced', 'screened')
          RETURNING id`);
        id = (claimedRetry.rows[0] as { id: string } | undefined)?.id;
      } catch (err) {
        console.error("Autopilot autonomous sourcing failed:", err);
      }
    }
    if (!id) return ok({ processed: null, queueEmpty: true });
  }

  try {
    // 1 · Screen (skip if already passed at intake)
    const [pre] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
    let screenResult = pre?.screenResult ?? null;
    if (!screenResult) {
      const r = await screenOpportunity(id);
      screenResult = r.result;
    }
    if (screenResult === "reject") {
      // A rejection IS a finished result — surface it, don't bury it.
      await db.update(opportunities).set({ status: "screened" }).where(eq(opportunities.id, id));
      
      const [comp] = await db.select().from(companies).where(eq(companies.id, pre.companyId)).limit(1);
      const links = await db.select().from(opportunityFounders).where(eq(opportunityFounders.opportunityId, id));
      const founderNames: string[] = [];
      for (const l of links) {
        const [f] = await db.select().from(founders).where(eq(founders.id, l.founderId)).limit(1);
        if (f) founderNames.push(f.fullName);
      }
      return ok({
        processed: id,
        company: comp?.name || "Unknown Company",
        founder: founderNames.join(", ") || "Unknown Founder",
        outcome: "screened_out",
      });
    }

    // 2 · Background check (deep search for all founders)
    const links = await db.select().from(opportunityFounders).where(eq(opportunityFounders.opportunityId, id));
    let isCold = false;
    const founderNames: string[] = [];
    for (const l of links) {
      const [f] = await db.select().from(founders).where(eq(founders.id, l.founderId)).limit(1);
      if (f) {
        founderNames.push(f.fullName);
        if (f.isColdStart) isCold = true;
      }
      try {
        await runDeepFounderBackgroundCheck(id, l.founderId);
      } catch (err) {
        console.error(`Deep background check failed for founder ${l.founderId}:`, err);
      }
    }
    
    // Cold start analysis
    if (isCold) {
      const existing = await db
        .select({ id: signals.id })
        .from(signals)
        .where(sql`${signals.opportunityId} = ${id} AND ${signals.sourceType} = 'social'`)
        .limit(1);
      if (existing.length === 0) {
        try {
          await analyzeColdStartFootprint(id);
        } catch {
          /* background check is best-effort — scoring proceeds without it */
        }
      }
    }

    // 3 · 3-axis scoring  4 · Memo  5 · External verification
    await scoreOpportunity(id);
    const { memo } = await buildMemo(id);
    await verifyMemoClaims(id, memo.id);

    const [comp] = await db.select().from(companies).where(eq(companies.id, pre.companyId)).limit(1);
    return ok({
      processed: id,
      company: comp?.name || "Unknown Company",
      founder: founderNames.join(", ") || "Unknown Founder",
      outcome: "ready_for_decision",
    });
  } catch (e) {
    // Release the claim so the deal can be retried or handled manually.
    await db.update(opportunities).set({ status: "sourced" }).where(eq(opportunities.id, id));
    return fail(`Autopilot failed on ${id}: ${errMessage(e)}`);
  }
}
