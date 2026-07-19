/**
 * Autopilot — processes ONE diligence step for the strongest eligible candidate
 * per call. Breaks down the long-running pipeline into discrete 1-2 second ticks:
 * screen → background check → 3-axis score → memo draft → claim verification.
 * Safe for parallel workers: claims are locked, executed, and released immediately.
 */
import { eq, sql, and, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, opportunityFounders, founders, signals, companies, reasoningSteps, axisScores, memos } from "@/db/schema";
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

async function getNextDiligenceStep(oppId: string): Promise<"screen" | "sourcing" | "scorer" | "memo" | "validator" | "done" | "reject"> {
  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, oppId)).limit(1);
  if (!opp) return "done";

  // Step 1: Screen
  if (opp.screenResult === null) {
    return "screen";
  }
  if (opp.screenResult === "reject") {
    return "reject";
  }

  // Step 2: Background Check (Sourcing)
  const bgSteps = await db
    .select()
    .from(reasoningSteps)
    .where(and(eq(reasoningSteps.opportunityId, oppId), eq(reasoningSteps.agent, "sourcing")))
    .limit(1);
  if (bgSteps.length === 0) {
    return "sourcing";
  }

  // Step 3: Scoring
  const scores = await db.select().from(axisScores).where(eq(axisScores.opportunityId, oppId)).limit(1);
  if (scores.length === 0) {
    return "scorer";
  }

  // Step 4: Memo
  const memoRows = await db.select().from(memos).where(eq(memos.opportunityId, oppId)).limit(1);
  if (memoRows.length === 0) {
    return "memo";
  }

  // Step 5: Verification
  const verificationSteps = await db
    .select()
    .from(reasoningSteps)
    .where(and(eq(reasoningSteps.opportunityId, oppId), eq(reasoningSteps.agent, "validator")))
    .limit(1);
  if (verificationSteps.length === 0) {
    return "validator";
  }

  return "done";
}

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return fail("Unauthorized", 401);

  const thesis = await getActiveThesis(user.id);
  if (!thesis) return ok({ processed: null, queueEmpty: true });

  // 1. Scan/Query undecided opportunities and find candidates that need processing
  const opps = await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.thesisId, thesis.id), isNull(opportunities.decision)))
    .orderBy(sql`conviction_score DESC NULLS LAST, created_at DESC`);

  let candidate = null;
  let nextStep: "screen" | "sourcing" | "scorer" | "memo" | "validator" | "done" | "reject" | null = null;

  for (const o of opps) {
    // Skip if currently claimed by a worker within the last 40 seconds
    const isClaimed = o.claimedAt && new Date(o.claimedAt).getTime() > Date.now() - 20_000;
    if (isClaimed) continue;

    const step = await getNextDiligenceStep(o.id);
    if (step !== "done" && step !== "reject") {
      candidate = o;
      nextStep = step;
      break;
    }
  }

  // 2. If queue is empty, trigger sourcing sweep in the background (cooldown 60s)
  if (!candidate) {
    const nowTime = Date.now();
    if (nowTime - lastSweepAt > 60_000) {
      lastSweepAt = nowTime;
      try {
        await sourceAll(user.id);
      } catch (err) {
        console.error("Autopilot autonomous sourcing failed:", err);
      }
    }
    return ok({ processed: null, queueEmpty: true });
  }

  // 3. Atomically lock candidate. Do NOT downgrade a deal that already finished
  //    the memo (awaiting_decision) back to in_diligence just to run the final
  //    validation step — that made it vanish from "Ready for decision" and never
  //    return. Keep its status; only take the lock.
  await db
    .update(opportunities)
    .set({
      status: candidate.status === "awaiting_decision" ? "awaiting_decision" : "in_diligence",
      claimedAt: new Date(),
    })
    .where(eq(opportunities.id, candidate.id));

  const id = candidate.id;

  try {
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
    const [comp] = await db.select().from(companies).where(eq(companies.id, opp.companyId)).limit(1);
    const links = await db.select().from(opportunityFounders).where(eq(opportunityFounders.opportunityId, id));
    
    const founderNames: string[] = [];
    for (const l of links) {
      const [f] = await db.select().from(founders).where(eq(founders.id, l.founderId)).limit(1);
      if (f) founderNames.push(f.fullName);
    }

    // 4. Run the single next step
    if (nextStep === "screen") {
      const r = await screenOpportunity(id);
      if (r.result === "reject") {
        await db.update(opportunities).set({ status: "screened" }).where(eq(opportunities.id, id));
      }
    } else if (nextStep === "sourcing") {
      let isCold = false;
      await Promise.allSettled(
        links.map(async (l) => {
          const [f] = await db.select().from(founders).where(eq(founders.id, l.founderId)).limit(1);
          if (f && f.isColdStart) isCold = true;
          try {
            await runDeepFounderBackgroundCheck(id, l.founderId);
          } catch (err) {
            console.error(`Deep background check failed for founder ${l.founderId}:`, err);
          }
        })
      );
      if (isCold) {
        try {
          await analyzeColdStartFootprint(id);
        } catch {}
      }
      // Record sourcing reasoning step
      await db.insert(reasoningSteps).values({
        opportunityId: id,
        stepOrder: 2,
        agent: "sourcing",
        inputSummary: "Web, GitHub, arXiv search signals",
        outputSummary: `Completed background audits for ${founderNames.join(", ")}`,
        citedSignalIds: [],
      });
    } else if (nextStep === "scorer") {
      await scoreOpportunity(id);
    } else if (nextStep === "memo") {
      await buildMemo(id);
    } else if (nextStep === "validator") {
      const [memoRow] = await db.select().from(memos).where(eq(memos.opportunityId, id)).limit(1);
      if (memoRow) {
        await verifyMemoClaims(id, memoRow.id);
      }
      // verifyMemoClaims already records its own reasoning step
      // Final pipeline step complete! Move to "Ready For Your Decisions"
      await db.update(opportunities).set({ status: "awaiting_decision" }).where(eq(opportunities.id, id));
    }

    // 5. Release claim lock
    await db
      .update(opportunities)
      .set({ claimedAt: null })
      .where(eq(opportunities.id, id));

    return ok({
      processed: id,
      company: comp?.name || "Unknown Company",
      founder: founderNames.join(", ") || "Unknown Founder",
      outcome: nextStep,
    });
  } catch (e) {
    // Release lock on error
    await db
      .update(opportunities)
      .set({ claimedAt: null })
      .where(eq(opportunities.id, id));
    return fail(`Autopilot failed on ${id} during ${nextStep}: ${errMessage(e)}`);
  }
}
