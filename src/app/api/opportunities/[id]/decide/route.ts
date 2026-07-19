/**
 * The HUMAN decision. The memo recommends; this route is the investor clicking
 * Deploy / Watch / Pass. Sets decidedAt (the time-to-decision clock stops here)
 * and feeds the outcome back into Memory + channel intelligence.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, opportunityFounders, sourcingChannels, reasoningSteps, memos, sourcingNodes } from "@/db/schema";
import { bumpFounderScore } from "@/lib/services/ingest";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";

const VALID = new Set(["invest", "watch", "pass"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const decision = String(body?.decision ?? "");
    const note = body?.note ? String(body.note) : null;
    if (!VALID.has(decision)) return fail("decision must be invest | watch | pass", 400);

    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
    if (!opp) return fail("not found", 404);
    if (opp.decision) return fail(`already decided: ${opp.decision}`, 409);
    const memoRows = await db.select({ id: memos.id }).from(memos).where(eq(memos.opportunityId, id)).limit(1);
    if (memoRows.length === 0 && decision === "invest")
      return fail("No memo yet — run diligence before deploying capital.", 409);

    const decidedAt = new Date();
    await db
      .update(opportunities)
      .set({ status: "decided", decision, decisionNote: note, decidedBy: "human", decidedAt })
      .where(eq(opportunities.id, id));

    // Feed the outcome back into Memory: a funded deal moves the persistent
    // Founder Score (stretch 3: "feed that outcome back into the model").
    const links = await db.select().from(opportunityFounders).where(eq(opportunityFounders.opportunityId, id));
    if (decision === "invest") {
      for (const l of links) {
        await bumpFounderScore(l.founderId, 6, "Funded — $100K deployed", "deal", 0.9);
      }
    }
    // Channel intelligence learns which channels convert into funded deals.
    if (decision === "invest" && opp.sourceChannel) {
      await db
        .update(sourcingChannels)
        .set({ convertedCount: sql`${sourcingChannels.convertedCount} + 1`, updatedAt: new Date() })
        .where(eq(sourcingChannels.name, opp.sourceChannel));
      
      // Update quality rating of all sourcing nodes sharing this institution or program
      try {
        const [node] = await db.select().from(sourcingNodes).where(eq(sourcingNodes.opportunityId, id)).limit(1);
        if (node) {
          await db
            .update(sourcingNodes)
            .set({ qualityRating: sql`LEAST(100, ${sourcingNodes.qualityRating} + 15)`, updatedAt: new Date() })
            .where(eq(sourcingNodes.institutionName, node.institutionName));

          await db
            .update(sourcingNodes)
            .set({ qualityRating: sql`LEAST(100, ${sourcingNodes.qualityRating} + 10)`, updatedAt: new Date() })
            .where(eq(sourcingNodes.programName, node.programName));
        }
      } catch (err) {
        console.error("Failed to update sourcing node quality scores on invest:", err);
      }
    }

    const ttdMs = decidedAt.getTime() - new Date(opp.firstSignalAt).getTime();
    await db.insert(reasoningSteps).values({
      opportunityId: id,
      stepOrder: 5,
      agent: "investor",
      inputSummary: "memo + evidence + trust scores",
      outputSummary: `human decision: ${decision}${note ? ` — "${note}"` : ""} (${Math.round(ttdMs / 60000)}m after first signal)`,
      citedSignalIds: [],
    });

    return ok({ decision, decidedAt: decidedAt.toISOString(), timeToDecisionMs: ttdMs });
  } catch (e) {
    return fail(errMessage(e));
  }
}
