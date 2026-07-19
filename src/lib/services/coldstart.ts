/**
 * Cold-start footprint predictor — the explicit method for pre-track-record
 * founders (Area of Research 3: "how much can public footprints predict founder
 * success?"). A founder with no GitHub, no funding, and no network often still
 * has a public footprint: technical replies, community threads, consistent
 * domain discourse. We sweep it, score it honestly, and store it as a Memory
 * signal so the Founder axis reasons from evidence instead of absence.
 *
 * Method (documented for the brief's "document your approach" ask):
 *   1. Three Tavily sweeps: identity+domain, social platforms, community depth.
 *   2. Structured extraction into three 0-100 sub-scores (discourse quality,
 *      community depth, domain consistency) + concrete indicators + explicit
 *      gaps ("no LinkedIn tied to the handle") + honest confidence.
 *   3. Stored as a `social` signal on the opportunity → flows into the scorer
 *      context automatically; the verdict never fabricates and defaults to
 *      insufficient_data when the footprint is thin.
 */
import { db } from "@/db/client";
import { reasoningSteps } from "@/db/schema";
import { tavilySearch } from "@/lib/tavily";
import { structured } from "@/lib/openai";
import { ColdStartPredictorSchema, type ColdStartPredictor } from "@/lib/schemas";
import { getOpportunityContext } from "./context";
import { recordSignal } from "./ingest";

const SYSTEM = `You assess a PRE-TRACK-RECORD founder from their public footprint ONLY.
Rules:
- Do NOT penalize the absence of GitHub, funding history, or employer pedigree — that absence is
  exactly why this method exists. Assess the QUALITY of what does exist.
- Score three sub-signals 0-100: discourse quality (technical depth of what they write),
  community depth (real engagement in relevant technical communities), domain consistency
  (sustained focus on this domain over time).
- List concrete indicators you actually observed in the evidence. List gaps plainly.
- If the evidence is thin or ambiguous, verdict = insufficient_data with LOW confidence.
  Never invent activity that is not in the evidence.`;

export async function analyzeColdStartFootprint(opportunityId: string): Promise<{
  predictor: ColdStartPredictor;
  cached: boolean;
}> {
  const ctx = await getOpportunityContext(opportunityId);
  const founder = ctx.founders.find((f) => f.isColdStart) ?? ctx.founders[0];
  if (!founder) throw new Error("No founder linked to this opportunity");

  // Idempotent: one footprint sweep per opportunity (re-runs return the stored one).
  const existing = ctx.signals.find((s) => s.sourceType === "social" && s.extractedJson);
  if (existing) {
    return { predictor: existing.extractedJson as ColdStartPredictor, cached: true };
  }

  const name = founder.fullName;
  const handle = founder.twitterHandle || founder.githubLogin || founder.canonicalHandle;
  const sector = ctx.company.sector ?? ctx.company.oneLiner ?? "";

  const queries = [
    `"${name}" ${sector} founder OR building OR project`,
    `"${name}" OR "${handle}" site:x.com OR site:twitter.com OR site:news.ycombinator.com`,
    `"${name}" ${sector} discord OR community OR forum OR talk OR interview`,
  ];
  const settled = await Promise.allSettled(queries.map((q) => tavilySearch(q, { maxResults: 5 })));
  const results = settled.flatMap((s) => (s.status === "fulfilled" ? s.value.results : []));
  const evidence = results
    .slice(0, 12)
    .map((r, i) => `[${i + 1}] ${r.title} — ${r.content.slice(0, 250)} (${r.url})`)
    .join("\n");

  const predictor = await structured({
    schema: ColdStartPredictorSchema,
    schemaName: "ColdStartPredictor",
    system: SYSTEM,
    user: `Founder: ${name} (handle: ${handle})\nVenture context: ${ctx.company.name} — ${ctx.company.oneLiner ?? ""} (${sector})\n\nPublic-footprint evidence from ${queries.length} sweeps:\n${evidence || "(no results found)"}\n\nAssess the footprint.`,
  });

  const rawText =
    `COLD-START FOOTPRINT PREDICTOR for ${name}: ` +
    `discourse quality ${predictor.discourseQuality}/100 · community depth ${predictor.communityDepth}/100 · ` +
    `domain consistency ${predictor.domainConsistency}/100 (confidence ${predictor.confidence.toFixed(2)}, verdict: ${predictor.verdict}). ` +
    `Indicators: ${predictor.indicators.join("; ") || "none observed"}. ` +
    `Gaps: ${predictor.gaps.join("; ") || "none noted"}. ${predictor.summary}`;

  await recordSignal({
    opportunityId,
    founderId: founder.id,
    companyId: ctx.company.id,
    sourceType: "social",
    title: `Public footprint — ${name}`,
    rawText,
    extractedJson: predictor,
    tags: ["cold-start", "footprint", "social"],
  });

  await db.insert(reasoningSteps).values({
    opportunityId,
    stepOrder: 1,
    agent: "footprint",
    inputSummary: `${queries.length} public-footprint sweeps for ${name} (${results.length} results)`,
    outputSummary: `discourse ${predictor.discourseQuality} · community ${predictor.communityDepth} · consistency ${predictor.domainConsistency} → ${predictor.verdict}`,
    citedSignalIds: [],
  });

  return { predictor, cached: false };
}
