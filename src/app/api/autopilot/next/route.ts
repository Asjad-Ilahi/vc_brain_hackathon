/**
 * Autopilot — processes ONE deal end-to-end so the investor sees finished
 * results, not buttons. Atomically claims the strongest unprocessed candidate
 * (safe for parallel workers: two concurrent calls get two different deals),
 * then runs the full agent chain: screen → background check (new founders) →
 * 3-axis scoring → memo → external verification. Everything is real work on
 * real data; a screened-out deal is also a finished result.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, opportunityFounders, founders, signals } from "@/db/schema";
import { screenOpportunity } from "@/lib/services/screen";
import { scoreOpportunity } from "@/lib/services/score";
import { buildMemo, verifyMemoClaims } from "@/lib/services/memo";
import { analyzeColdStartFootprint } from "@/lib/services/coldstart";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  // Atomic claim — parallel workers never grab the same deal. The outer
  // status re-check matters: under READ COMMITTED, a second concurrent UPDATE
  // re-evaluates its WHERE against the locked row and matches nothing.
  const claimed = await db.execute(sql`
    UPDATE opportunities SET status = 'in_diligence', claimed_at = now()
    WHERE id = (
      SELECT id FROM opportunities
      WHERE status IN ('sourced', 'screened')
        AND decision IS NULL
        AND (screen_result IS NULL OR screen_result = 'pass')
      ORDER BY conviction_score DESC NULLS LAST, created_at DESC
      LIMIT 1
    )
    AND status IN ('sourced', 'screened')
    RETURNING id`);
  const id = (claimed.rows[0] as { id: string } | undefined)?.id;
  if (!id) return ok({ processed: null, queueEmpty: true });

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
      return ok({ processed: id, outcome: "screened_out" });
    }

    // 2 · Background check for founders with no track record yet
    const links = await db.select().from(opportunityFounders).where(eq(opportunityFounders.opportunityId, id));
    let isCold = false;
    for (const l of links) {
      const [f] = await db.select().from(founders).where(eq(founders.id, l.founderId)).limit(1);
      if (f?.isColdStart) isCold = true;
    }
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

    return ok({ processed: id, outcome: "ready_for_decision" });
  } catch (e) {
    // Release the claim so the deal can be retried or handled manually.
    await db.update(opportunities).set({ status: "sourced" }).where(eq(opportunities.id, id));
    return fail(`Autopilot failed on ${id}: ${errMessage(e)}`);
  }
}
