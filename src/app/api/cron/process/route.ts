import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, companies, opportunityFounders, founders, signals, theses } from "@/db/schema";
import { screenOpportunity } from "@/lib/services/screen";
import { scoreOpportunity } from "@/lib/services/score";
import { buildMemo, verifyMemoClaims } from "@/lib/services/memo";
import { analyzeColdStartFootprint } from "@/lib/services/coldstart";
import { runDeepFounderBackgroundCheck } from "@/lib/services/sourcing";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max execution time

export async function GET(req: Request) {
  // Optional security check
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // If headers are missing, check URL search params as fallback for easy manual testing
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (key !== cronSecret) {
      console.warn("[cron] Unauthorized cron trigger attempt");
      return fail("Unauthorized", 401);
    }
  }

  // Find the active thesis to scope candidates
  const [thesis] = await db
    .select()
    .from(theses)
    .where(eq(theses.isActive, true))
    .orderBy(sql`created_at DESC`)
    .limit(1);

  if (!thesis) {
    return ok({ processed: null, message: "No active thesis configured" });
  }

  // Claim the next hot candidate atomically
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

  const id = (claimed.rows[0] as { id: string } | undefined)?.id;
  if (!id) {
    return ok({ processed: null, message: "No candidates in pipeline queue" });
  }

  console.log(`[cron] Processing opportunity ${id} on autopilot`);

  try {
    // 1. Screen (skip if already passed at intake)
    const [pre] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
    let screenResult = pre?.screenResult ?? null;
    if (!screenResult) {
      const r = await screenOpportunity(id);
      screenResult = r.result;
    }
    
    if (screenResult === "reject") {
      await db.update(opportunities).set({ status: "screened" }).where(eq(opportunities.id, id));
      return ok({ processed: id, outcome: "screened_out" });
    }

    // 2. Deep background checks for founders
    const links = await db.select().from(opportunityFounders).where(eq(opportunityFounders.opportunityId, id));
    let isCold = false;
    for (const l of links) {
      const [f] = await db.select().from(founders).where(eq(founders.id, l.founderId)).limit(1);
      if (f) {
        if (f.isColdStart) isCold = true;
        try {
          await runDeepFounderBackgroundCheck(id, l.founderId);
        } catch (err) {
          console.error(`[cron] Background check failed for founder ${l.founderId}:`, err);
        }
      }
    }

    // 3. Cold start public footprint analysis
    if (isCold) {
      const existing = await db
        .select({ id: signals.id })
        .from(signals)
        .where(sql`${signals.opportunityId} = ${id} AND ${signals.sourceType} = 'social'`)
        .limit(1);
      if (existing.length === 0) {
        try {
          await analyzeColdStartFootprint(id);
        } catch (err) {
          console.error(`[cron] Footprint check failed for coldstart:`, err);
        }
      }
    }

    // 4. 3-Axis Scoring
    await scoreOpportunity(id);

    // 5. Build investment memo
    const { memo } = await buildMemo(id);

    // 6. External claim verification
    await verifyMemoClaims(id, memo.id);

    console.log(`[cron] Successfully processed opportunity ${id} to ready_for_decision`);
    return ok({ processed: id, outcome: "ready_for_decision" });
  } catch (e) {
    // Release claim on failure so it can be retried
    await db.update(opportunities).set({ status: "sourced" }).where(eq(opportunities.id, id));
    console.error(`[cron] Diligence failed for ${id}:`, e);
    return fail(`Cron processing failed: ${errMessage(e)}`);
  }
}
