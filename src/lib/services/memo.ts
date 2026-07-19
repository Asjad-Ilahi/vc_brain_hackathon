/**
 * Investment memo + per-claim Trust Score.
 *  - Memo has the 5 required sections; missing data is FLAGGED, never fabricated.
 *  - Each claim traces to evidence signals with a confidence.
 *  - The validator then verifies flagged claims against the web (Tavily) and
 *    records corroboration / contradiction — the external half of Trust Score.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memos, claims, opportunities, reasoningSteps, theses, axisScores } from "@/db/schema";
import { structured } from "@/lib/openai";
import { MemoSchema, VerificationJudgmentSchema } from "@/lib/schemas";
import { getOpportunityContext, formatContext } from "./context";
import { formatThesis } from "./thesis";
import { tavilyVerifyClaim } from "@/lib/tavily";
import { z } from "zod";

const MAX_VERIFY = 4; // cap external checks per memo to stay within serverless time

const MEMO_SYSTEM = `You are an investment analyst writing a decision-ready memo. Rules:
- Cover these required sections: Company snapshot, Investment hypotheses, SWOT, Problem & product,
  Traction & KPIs. Be as brief as clarity allows — padding counts against you.
- Every claim (traction, revenue, team, market size) must trace to the provided signals via their
  [signal <id>]. If a fact is missing, add it to "gaps" explicitly (e.g. "Cap table: not disclosed").
  NEVER fabricate numbers to fill a gap.
- Mark needsExternalCheck=true for claims that can and should be verified against public web
  evidence (e.g. "founder was ex-Stripe", "10k users", "raised $2M").
- Give each claim an honest confidence in [0,1] based on evidence strength.`;

export async function buildMemo(opportunityId: string) {
  const ctx = await getOpportunityContext(opportunityId);
  const thesis = ctx.opportunity.thesisId
    ? await db
        .select()
        .from(theses)
        .where(eq(theses.id, ctx.opportunity.thesisId))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  const memo = await structured({
    schema: MemoSchema,
    schemaName: "Memo",
    system: MEMO_SYSTEM,
    user: `${formatThesis(thesis)}\n\n${formatContext(ctx)}\n\nWrite the investment memo.`,
  });

  const validSignalIds = new Set(ctx.signals.map((s) => s.id));

  const [memoRow] = await db
    .insert(memos)
    .values({
      opportunityId,
      summary: memo.summary,
      sectionsJson: { ...memo.sections, gaps: memo.gaps },
      recommendation: memo.recommendation,
    })
    .returning();

  const claimRows = memo.claims.length
    ? await db
        .insert(claims)
        .values(
          memo.claims.map((c) => ({
            memoId: memoRow.id,
            section: c.section,
            claimText: c.claimText,
            // keep only evidence refs that point at real signals (no hallucinated ids)
            evidenceSignalIds: c.evidenceSignalIds.filter((id) => validSignalIds.has(id)),
            confidence: c.confidence,
            trustLevel: c.needsExternalCheck ? "unverified" : c.confidence >= 0.7 ? "medium" : "low",
            externalVerification: "na" as const,
          }))
        )
        .returning()
    : [];

  // The memo only RECOMMENDS. The decision (and decidedAt) belongs to the human —
  // "one human in the loop for oversight". See /api/opportunities/[id]/decide.
  await db
    .update(opportunities)
    .set({ status: "awaiting_decision" })
    .where(eq(opportunities.id, opportunityId));

  await db.insert(reasoningSteps).values({
    opportunityId,
    stepOrder: 3,
    agent: "memo",
    inputSummary: "3-axis scores + signals",
    outputSummary: `recommendation: ${memo.recommendation}; ${memo.claims.length} claims, ${memo.gaps.length} gaps flagged`,
    citedSignalIds: ctx.signals.map((s) => s.id),
  });

  return { memo: memoRow, claims: claimRows };
}

const JUDGE_SYSTEM = `You are a validator. Given a claim, web search evidence, and general market benchmarks for the company's sector and stage, judge whether the evidence corroborates or contradicts the claim.
- Benchmark checks: cross-reference metrics (revenue, ARR, valuation, funding size) against comparable ranges in the benchmarks. If the claim is highly anomalous, unrealistic, or an outlier (e.g. claiming $5M ARR at pre-seed or a $100M valuation for a seed round without exceptional traction), flag it as contradicted with a clear explanation.
- If evidence is absent or irrelevant, return not_found.
- Assign trustLevel honestly: high only with clear corroboration, contradicted claims are low. Do not assume the claim is true.`;

const AUDIT_SYSTEM = `You are a strict validator auditing scoring rationales against raw evidence signals.
Your goal is to detect hallucinations: factual claims made in the scoring rationales that do NOT trace back to any raw signals.
Compare the scoring rationales against the raw signals. If a rationale makes a claim (e.g. "founder worked at Snowflake", "raised $5M", "has 20 design partners") that is not explicitly supported by the text in the raw signals, flag it as a hallucination. Do not flag claims that are general reasoning, syntheses, or logical inferences, only factual claims that have no basis in the raw signals.`;

const AuditResultSchema = z.object({
  hallucinations: z.array(
    z.object({
      axis: z.string(),
      hallucinatedClaim: z.string(),
      explanation: z.string(),
    })
  ).default([]),
});

/** Verify flagged claims against the web and record the Trust Score outcome. */
export async function verifyMemoClaims(opportunityId: string, memoId: string) {
  const ctx = await getOpportunityContext(opportunityId);
  const companyContext = `${ctx.company.name} (${ctx.company.sector ?? ""})`;
  const rows = await db.select().from(claims).where(eq(claims.memoId, memoId));
  const toCheck = rows.filter((c) => c.trustLevel === "unverified").slice(0, MAX_VERIFY);
  const skipped = rows.filter((c) => c.trustLevel === "unverified").length - toCheck.length;

  // Anomalous Metric Validator: fetch general market benchmarks
  let benchmarkInfo = "";
  try {
    const sector = ctx.company.sector ?? "AI infrastructure";
    const stage = ctx.company.stage ?? "seed";
    const query = `average valuation funding size ARR benchmarks for ${stage} stage ${sector} startups`;
    const { evidence } = await tavilyVerifyClaim(query, `${stage} ${sector} benchmarks`);
    benchmarkInfo = evidence.map((e) => `${e.title}: ${e.content.slice(0, 350)}`).join("\n");
  } catch (err) {
    console.error("Benchmark check failed:", err);
  }

  let contradictions = 0;
  for (const c of toCheck) {
    const { evidence, answer } = await tavilyVerifyClaim(c.claimText, companyContext);
    const evidenceText =
      (answer ? `Answer: ${answer}\n` : "") +
      evidence.map((e, i) => `[${i + 1}] ${e.title}: ${e.content.slice(0, 300)} (${e.url})`).join("\n");

    const judgment = await structured({
      schema: VerificationJudgmentSchema,
      schemaName: "VerificationJudgment",
      system: JUDGE_SYSTEM,
      user: `Company: ${companyContext}
Claim: "${c.claimText}"

Web evidence for this specific claim:
${evidenceText || "(no results)"}

General Market Benchmarks for ${ctx.company.stage ?? "seed"} ${ctx.company.sector ?? "AI infrastructure"}:
${benchmarkInfo || "(no results)"}`,
    });

    if (judgment.verdict === "contradicted") contradictions++;

    await db
      .update(claims)
      .set({
        trustLevel: judgment.trustLevel,
        externalVerification: judgment.verdict,
        contradictionNote: judgment.verdict === "contradicted" ? judgment.note : null,
      })
      .where(eq(claims.id, c.id));
  }

  // Scoring Hallucination Audit: compare axis scores against raw signals
  try {
    const scores = await db.select().from(axisScores).where(eq(axisScores.opportunityId, opportunityId));
    if (scores.length > 0) {
      const signalsText = ctx.signals.map((s) => `[signal:${s.id}] Title: ${s.title}\nText: ${s.rawText}`).join("\n\n");
      const rationalesText = scores.map((s) => `Axis: ${s.axis}\nScore: ${s.score}\nRationale: ${s.rationale}`).join("\n\n");

      const audit = await structured({
        schema: AuditResultSchema,
        schemaName: "AuditResult",
        system: AUDIT_SYSTEM,
        user: `RAW SIGNALS EVIDENCE:\n${signalsText}\n\nSCORING RATIONALES TO AUDIT:\n${rationalesText}`,
      });

      if (audit.hallucinations && audit.hallucinations.length > 0) {
        for (const h of audit.hallucinations) {
          await db.insert(claims).values({
            memoId,
            section: "validation_audit",
            claimText: `Hallucination in ${h.axis} rationale: ${h.hallucinatedClaim}`,
            evidenceSignalIds: [],
            confidence: 0.1,
            trustLevel: "low",
            externalVerification: "contradicted",
            contradictionNote: `Auditor flag: ${h.explanation}`,
          });
          contradictions++;
        }
      }
    }
  } catch (err) {
    console.error("Scoring rationale audit failed:", err);
  }

  await db.insert(reasoningSteps).values({
    opportunityId,
    stepOrder: 4,
    agent: "validator",
    inputSummary: `${toCheck.length} claims checked against web${skipped > 0 ? ` (${skipped} skipped: over per-memo cap of ${MAX_VERIFY})` : ""}`,
    outputSummary: `${contradictions} contradiction(s) flagged`,
    citedSignalIds: [],
  });

  return { checked: toCheck.length, skipped, contradictions };
}
