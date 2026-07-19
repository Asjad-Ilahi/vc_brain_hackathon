/**
 * 3-axis screening — Founder / Market / Idea-vs-Market, scored INDEPENDENTLY.
 * Never averaged. Each axis carries its own score, trend, confidence, rationale.
 * Also moves the persistent Founder Score and handles the cold-start case.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, axisScores, reasoningSteps, founders } from "@/db/schema";
import { structured } from "@/lib/openai";
import { ThreeAxisSchema, type ThreeAxis } from "@/lib/schemas";
import { getOpportunityContext, formatContext } from "./context";
import { getActiveThesis, formatThesis } from "./thesis";
import { bumpFounderScore } from "./ingest";

const SYSTEM = `You are the assessment engine for a venture fund. Score an opportunity on THREE
INDEPENDENT axes. Critical rules:
- Score each axis on its OWN merits. Do NOT let one axis influence another. Do NOT compute an
  overall average — the three scores are meant to be read separately, including their disagreement.
- FOUNDER: who they are, traits, track record. Use the persistent Founder Score as ONE input, not
  a substitute for your own judgement.
- MARKET: sizing, competitors, SWOT — rate bullish / neutral / bear.
- IDEA vs MARKET: does the idea survive scrutiny as-is, or is the team strong enough to pivot?
- COLD START: if a founder has little/no public track record (no GitHub/funding/network), DO NOT
  default them to a low score. Reason from whatever public footprint exists, mark isColdStart=true,
  and keep confidence low and honest.
- Every rationale must cite evidence from the signals. Never invent traction or metrics.`;

export async function scoreOpportunity(opportunityId: string): Promise<ThreeAxis> {
  const ctx = await getOpportunityContext(opportunityId);
  const thesis = await getActiveThesis();

  const result = await structured({
    schema: ThreeAxisSchema,
    schemaName: "ThreeAxis",
    system: SYSTEM,
    user: `${formatThesis(thesis)}\n\n${formatContext(ctx)}\n\nScore this opportunity on all three axes independently.`,
  });

  // Memory keeps every assessment — prior axis rows are NEVER deleted ("nothing
  // discarded"). Readers take the latest per axis; older rows are the trend.
  // When history exists, trend is COMPUTED against the previous score rather
  // than trusting a point-in-time LLM label.
  const prior = await db.select().from(axisScores).where(eq(axisScores.opportunityId, opportunityId));
  const lastOf = (axis: string) =>
    prior
      .filter((r) => r.axis === axis)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
  const trendOf = (axis: string, score: number, llmTrend: string) => {
    const p = lastOf(axis);
    if (!p) return llmTrend;
    return score > p.score + 2 ? "improving" : score < p.score - 2 ? "declining" : "stable";
  };

  await db.insert(axisScores).values([
    {
      opportunityId,
      axis: "founder",
      score: result.founder.score,
      trend: trendOf("founder", result.founder.score, result.founder.trend),
      confidence: result.founder.confidence,
      rationale: result.founder.rationale,
    },
    {
      opportunityId,
      axis: "market",
      score: result.market.score,
      rating: result.market.rating,
      trend: trendOf("market", result.market.score, result.market.trend),
      confidence: result.market.confidence,
      rationale: result.market.rationale,
    },
    {
      opportunityId,
      axis: "idea_vs_market",
      score: result.ideaVsMarket.score,
      trend: trendOf("idea_vs_market", result.ideaVsMarket.score, result.ideaVsMarket.trend),
      confidence: result.ideaVsMarket.confidence,
      rationale: result.ideaVsMarket.rationale,
    },
  ]);

  // Move the persistent Founder Score for every founder on this opportunity —
  // only on the FIRST assessment of this opportunity (re-scores refine the axis
  // picture; they don't repeatedly pump the person's score).
  for (const f of prior.length > 0 ? [] : ctx.founders) {
    await bumpFounderScore(
      f.id,
      result.founderScoreDelta,
      result.founderScoreReason,
      "screening",
      result.founder.confidence
    );
    if (result.isColdStart && !f.isColdStart) {
      await db.update(founders).set({ isColdStart: true }).where(eq(founders.id, f.id));
    }
  }

  await db.update(opportunities).set({ status: "scored" }).where(eq(opportunities.id, opportunityId));

  await db.insert(reasoningSteps).values({
    opportunityId,
    stepOrder: 2,
    agent: "scorer",
    inputSummary: "thesis + signals + persistent Founder Score",
    outputSummary: `founder ${result.founder.score} / market ${result.market.score} (${result.market.rating}) / idea-vs-market ${result.ideaVsMarket.score}${result.isColdStart ? " [cold-start]" : ""}`,
    citedSignalIds: ctx.signals.map((s) => s.id),
  });

  return result;
}
