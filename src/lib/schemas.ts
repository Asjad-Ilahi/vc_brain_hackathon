/**
 * Zod contracts for every LLM output. Each is validated after the call, so a
 * malformed shape triggers a retry rather than propagating bad data.
 */
import { z } from "zod";

// --- Deck / document intake -------------------------------------------------
export const ExtractedClaimSchema = z.object({
  text: z.string().describe("A single factual claim as stated in the source"),
  category: z
    .enum(["traction", "revenue", "team", "market", "product", "other"])
    .describe("What kind of claim this is"),
});

export const DeckExtractionSchema = z.object({
  companyName: z.string(),
  oneLiner: z.string().describe("One sentence describing what the company does"),
  sector: z.string().nullable(),
  stage: z.string().nullable().describe("e.g. pre-seed, seed, series A"),
  geography: z.string().nullable(),
  problem: z.string().nullable(),
  product: z.string().nullable(),
  founders: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().nullable(),
        background: z.string().nullable(),
        github: z.string().nullable(),
        linkedin: z.string().nullable(),
        twitter: z.string().nullable(),
      })
    )
    .default([]),
  claims: z.array(ExtractedClaimSchema).default([]),
});
export type DeckExtraction = z.infer<typeof DeckExtractionSchema>;

// --- Screening (fast first-pass filter) -------------------------------------
export const ScreenSchema = z.object({
  result: z.enum(["pass", "reject"]),
  reason: z.string().describe("One-line justification tied to the thesis"),
  thesisFitNotes: z.string().nullable(),
});
export type ScreenResult = z.infer<typeof ScreenSchema>;

// --- 3-axis screening (independent; never averaged) -------------------------
const AxisSchema = z.object({
  score: z.number().min(0).max(100),
  trend: z.enum(["improving", "stable", "declining"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().describe("Evidence-based reasoning for this axis only"),
});

export const ThreeAxisSchema = z.object({
  founder: AxisSchema.describe("Who they are, traits, track record"),
  market: AxisSchema.extend({
    rating: z.enum(["bullish", "neutral", "bear"]),
  }).describe("Sizing, competitors, SWOT — rated bullish/neutral/bear"),
  ideaVsMarket: AxisSchema.describe(
    "Does the idea survive scrutiny as-is, or is the team strong enough to pivot?"
  ),
  founderScoreDelta: z
    .number()
    .min(-25)
    .max(25)
    .describe("How much this opportunity should move the persistent Founder Score"),
  founderScoreReason: z.string(),
  isColdStart: z
    .boolean()
    .describe("True if the founder has little/no public track record (no GitHub/funding/network)"),
});
export type ThreeAxis = z.infer<typeof ThreeAxisSchema>;

// --- Investment memo + per-claim Trust Score --------------------------------
export const MemoClaimSchema = z.object({
  section: z.string(),
  claimText: z.string(),
  evidenceSignalIds: z
    .array(z.string())
    .default([])
    .describe("IDs of the provided signals that support this claim; [] if none"),
  confidence: z.number().min(0).max(1),
  needsExternalCheck: z
    .boolean()
    .describe("True if this claim should be verified against external web evidence"),
});

export const MemoSchema = z.object({
  summary: z.string().describe("One-paragraph in-a-nutshell"),
  recommendation: z.enum(["invest", "pass", "watch"]),
  sections: z.object({
    companySnapshot: z.string(),
    investmentHypotheses: z.array(z.string()),
    swot: z.object({
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      opportunities: z.array(z.string()),
      risks: z.array(z.string()),
    }),
    problemProduct: z.string(),
    tractionKpis: z.string(),
  }),
  gaps: z
    .array(z.string())
    .default([])
    .describe("Explicitly flagged missing data, e.g. 'Cap table: not disclosed'"),
  claims: z.array(MemoClaimSchema).default([]),
});
export type Memo = z.infer<typeof MemoSchema>;

// --- External verification judgment (validator agent) -----------------------
export const VerificationJudgmentSchema = z.object({
  verdict: z.enum(["corroborated", "contradicted", "not_found"]),
  trustLevel: z.enum(["high", "medium", "low", "unverified"]),
  note: z.string().describe("What the web evidence showed, in one line"),
});
export type VerificationJudgment = z.infer<typeof VerificationJudgmentSchema>;

// --- Natural-language multi-attribute query ---------------------------------
export const QueryParseSchema = z.object({
  sectors: z.array(z.string()).default([]),
  stages: z.array(z.string()).default([]),
  geographies: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  mustHave: z.array(z.string()).default([]),
  mustNot: z.array(z.string()).default([]),
  minFounderScore: z.number().nullable(),
});
export type QueryParse = z.infer<typeof QueryParseSchema>;

// --- Cold-start footprint predictor (Area of Research 3) ---------------------
// A pre-track-record founder often still has a public footprint. This scores
// that footprint honestly instead of defaulting the founder to zero.
export const ColdStartPredictorSchema = z.object({
  discourseQuality: z
    .number()
    .min(0)
    .max(100)
    .describe("Technical depth/quality of the person's public discourse (posts, replies, comments)"),
  communityDepth: z
    .number()
    .min(0)
    .max(100)
    .describe("Depth of engagement in relevant technical communities (forums, Discords, OSS threads)"),
  domainConsistency: z
    .number()
    .min(0)
    .max(100)
    .describe("How consistently they have focused on this domain over time"),
  indicators: z
    .array(z.string())
    .describe("Concrete observed indicators, e.g. 'substantive replies to well-known ML researchers'"),
  gaps: z
    .array(z.string())
    .describe("What could NOT be found, stated plainly, e.g. 'no LinkedIn tied to the handle yet'"),
  summary: z.string().describe("2-3 sentence honest read of the public footprint"),
  confidence: z.number().min(0).max(1).describe("Honest confidence given how sparse the evidence is"),
  verdict: z.enum(["promising", "insufficient_data", "weak"]),
});
export type ColdStartPredictor = z.infer<typeof ColdStartPredictorSchema>;

// --- Outbound candidate normalization ---------------------------------------
export const OutboundCandidateSchema = z.object({
  companyName: z.string(),
  oneLiner: z.string(),
  sector: z.string().nullable(),
  stage: z
    .string()
    .nullable()
    .describe(
      "Funding stage ONLY if explicitly stated in the results (e.g. 'raising pre-seed'). Never guess — null if unknown."
    ),
  geography: z.string().nullable(),
  founderName: z
    .string()
    .nullable()
    .describe(
      "The founder's/creator's REAL full name — ONLY if it is explicitly present in the evidence. Return null if you only see a username/handle, a patent number, or an org. NEVER fabricate a name and NEVER emit placeholders like 'Unknown', 'Inventor of <id>', or '<Company> Creator'."
    ),
  founderHandle: z
    .string()
    .nullable()
    .describe("Their github login / X handle / username if present in the evidence, else null. Never invent one."),
  founderEmail: z
    .string()
    .nullable()
    .describe("The founder's contact email if it literally appears in the evidence, else null. Never guess or construct one."),
  linkedinUrl: z
    .string()
    .nullable()
    .describe("Full https://linkedin.com/in/... profile URL if present in the evidence, else null."),
  twitterHandle: z
    .string()
    .nullable()
    .describe("Their X/Twitter handle (without @) if present in the evidence, else null."),
  website: z
    .string()
    .nullable()
    .describe("Personal or company website URL if present in the evidence, else null."),
  whyRelevant: z.string().describe("Why this matches the thesis"),
  thesisFit: z
    .boolean()
    .describe("True ONLY if this clearly fits the fund's sectors/stages/geographies"),
  isEstablished: z
    .boolean()
    .describe(
      "True if this is a well-known, already-funded or scaled company (e.g. Cohere, OpenAI, Mistral, any household name). When unsure, true."
    ),
});
export type OutboundCandidate = z.infer<typeof OutboundCandidateSchema>;
