/**
 * ODIN — Memory schema (the data backbone).
 *
 * Design rules enforced here (from the challenge brief):
 *  - Founder Score lives on the founder (person), persists across applications,
 *    and NEVER resets. `founderScoreHistory` captures the trend over time.
 *  - The 3 screening axes are stored as SEPARATE rows — never averaged.
 *  - Trust Score is PER-CLAIM, with evidence refs + external verification.
 *  - Every extracted fact is a timestamped, source-tagged, deduped `signal`.
 *  - `reasoningSteps` gives agentic traceability (extraction → score → memo).
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Users — the investors operating this workspace. Passwords are scrypt-hashed;
// sessions are HMAC-signed HTTP-only cookies (see lib/session.ts).
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  // Access role. The brief is single-investor (no RBAC language), so this is a
  // deliberate operator-facing enhancement: 'admin' provisions users + does
  // everything; 'investor' configures thesis + deploys capital; 'analyst' runs
  // diligence/drafts but cannot deploy; 'viewer' is read-only (the public demo).
  role: text("role").notNull().default("investor"), // 'admin'|'investor'|'analyst'|'viewer'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Invites — how a new operator gets an account (there is NO public signup).
// The admin creates a single-use invite for an email+role; accepting it at
// /invite/[token] sets the password and provisions the user with that role.
// ---------------------------------------------------------------------------
export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull().default("investor"),
  token: text("token").notNull().unique(),
  invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Thesis Engine (configurable, not hardcoded)
// ---------------------------------------------------------------------------
export const theses = pgTable("theses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sectors: text("sectors").array().notNull().default([]),
  stages: text("stages").array().notNull().default([]),
  geographies: text("geographies").array().notNull().default([]),
  checkSizeMinUsd: integer("check_size_min_usd"),
  checkSizeMaxUsd: integer("check_size_max_usd"),
  ownershipTargetPct: real("ownership_target_pct"),
  riskAppetite: text("risk_appetite"), // 'low' | 'medium' | 'high'
  notes: text("notes"), // non-negotiables, plain English — flows into every agent prompt
  // Conviction threshold: signals crossing this score trigger assessment on their own.
  convictionThreshold: integer("conviction_threshold").notNull().default(68),
  // Onboarding profile: GP identity, fund, founder lens, enabled signal sources.
  profileJson: jsonb("profile_json"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Founder (person-level identity). Founder Score persists here across startups.
// ---------------------------------------------------------------------------
export const founders = pgTable("founders", {
  id: uuid("id").defaultRandom().primaryKey(),
  // canonicalHandle = the dedupe/merge key (e.g. github login or normalized name)
  canonicalHandle: text("canonical_handle").notNull().unique(),
  fullName: text("full_name").notNull(),
  githubLogin: text("github_login"),
  linkedinUrl: text("linkedin_url"),
  twitterHandle: text("twitter_handle"),
  location: text("location"),
  bio: text("bio"),
  // Founder Score: 0-100, persists, never resets.
  founderScore: integer("founder_score").notNull().default(50),
  founderScoreConfidence: real("founder_score_confidence").notNull().default(0.3),
  isColdStart: boolean("is_cold_start").notNull().default(false),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Founder Score trend over time — appended on every milestone/application.
export const founderScoreHistory = pgTable("founder_score_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  founderId: uuid("founder_id").notNull().references(() => founders.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  delta: integer("delta").notNull().default(0),
  confidence: real("confidence").notNull().default(0.3),
  reason: text("reason").notNull(),
  milestone: text("milestone"), // e.g. 'application', 'github_signal', 'launch'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Company + Opportunity (a specific evaluation instance)
// ---------------------------------------------------------------------------
export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  domain: text("domain"),
  sector: text("sector"),
  stage: text("stage"),
  geography: text("geography"),
  oneLiner: text("one_liner"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const opportunities = pgTable("opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  thesisId: uuid("thesis_id").references(() => theses.id),
  source: text("source").notNull(), // 'inbound' | 'outbound'
  sourceChannel: text("source_channel"), // 'application' | 'github' | 'hackernews' | 'arxiv' | 'web'
  // Public tracking ref for inbound applicants — the handle a founder returns to
  // (see /apply/status). Opaque + unguessable; the ONLY thing a logged-out
  // founder needs to check their 24h outcome.
  publicRef: text("public_ref").unique(),
  // Contact email captured on the public apply form — where the 24h decision goes.
  applicantEmail: text("applicant_email"),
  deckUrl: text("deck_url"),
  status: text("status").notNull().default("sourced"), // sourced|screening|screened|scored|decided
  // Conviction: auto-computed at ingestion so the system can surface founders
  // crossing a threshold on their own (before any manual assessment).
  convictionScore: integer("conviction_score"), // 0-100
  convictionReason: text("conviction_reason"),
  screenResult: text("screen_result"), // 'pass' | 'reject' | null
  screenReason: text("screen_reason"),
  // Decision is HUMAN-made (the memo only recommends). decidedBy records that.
  decision: text("decision"), // 'invest' | 'pass' | 'watch'
  decisionNote: text("decision_note"),
  decidedBy: text("decided_by"), // 'human' — the system never deploys on its own
  // Instrumentation: time-from-first-signal-to-decision (Investment Utility 30%).
  firstSignalAt: timestamp("first_signal_at", { withTimezone: true }).defaultNow().notNull(),
  // The 24h clock: decide before this. Extendable (+24h) by the investor.
  deadlineAt: timestamp("deadline_at", { withTimezone: true }),
  // Autopilot claim marker — stale claims (worker died) auto-recover.
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Company <-> Founder (a company may have multiple founders)
export const opportunityFounders = pgTable("opportunity_founders", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  founderId: uuid("founder_id").notNull().references(() => founders.id, { onDelete: "cascade" }),
  role: text("role"),
});

// ---------------------------------------------------------------------------
// Signals — the Memory. Every extracted fact, timestamped + source-tagged + deduped.
// ---------------------------------------------------------------------------
export const signals = pgTable("signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
  founderId: uuid("founder_id").references(() => founders.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // deck|github|producthunt|hackernews|arxiv|web|interview
  sourceUrl: text("source_url"),
  title: text("title"),
  rawText: text("raw_text"),
  extractedJson: jsonb("extracted_json"),
  tags: text("tags").array().notNull().default([]),
  // dedupeHash = hash(sourceType + normalized content) — prevents duplicate ingestion.
  dedupeHash: text("dedupe_hash").notNull().unique(),
  observedAt: timestamp("observed_at", { withTimezone: true }), // when the event happened
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// 3-axis screening — SEPARATE rows, each with an independent trend. Never averaged.
// ---------------------------------------------------------------------------
export const axisScores = pgTable("axis_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  axis: text("axis").notNull(), // 'founder' | 'market' | 'idea_vs_market'
  score: integer("score").notNull(), // 0-100
  rating: text("rating"), // market axis: 'bullish' | 'neutral' | 'bear'
  trend: text("trend").notNull().default("stable"), // 'improving' | 'stable' | 'declining'
  confidence: real("confidence").notNull().default(0.5),
  rationale: text("rationale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Investment memo + per-claim Trust Score
// ---------------------------------------------------------------------------
export const memos = pgTable("memos", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  // sectionsJson: { companySnapshot, investmentHypotheses, swot, problemProduct, tractionKpis, gaps[] }
  sectionsJson: jsonb("sections_json").notNull(),
  recommendation: text("recommendation"), // 'invest' | 'pass' | 'watch'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const claims = pgTable("claims", {
  id: uuid("id").defaultRandom().primaryKey(),
  memoId: uuid("memo_id").notNull().references(() => memos.id, { onDelete: "cascade" }),
  section: text("section").notNull(),
  claimText: text("claim_text").notNull(),
  evidenceSignalIds: text("evidence_signal_ids").array().notNull().default([]),
  confidence: real("confidence").notNull().default(0.5),
  trustLevel: text("trust_level").notNull().default("unverified"), // high|medium|low|unverified
  externalVerification: text("external_verification").notNull().default("na"), // corroborated|contradicted|not_found|na
  contradictionNote: text("contradiction_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Agentic traceability — step-level chain-of-thought log (stretch, high-leverage)
// ---------------------------------------------------------------------------
export const reasoningSteps = pgTable("reasoning_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  agent: text("agent").notNull(), // 'screener' | 'scorer' | 'validator' | 'memo'
  inputSummary: text("input_summary"),
  outputSummary: text("output_summary"),
  citedSignalIds: text("cited_signal_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Outbound activation — draft outreach (NEVER auto-sent)
// ---------------------------------------------------------------------------
export const outreach = pgTable("outreach", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("email"),
  draftMessage: text("draft_message").notNull(),
  status: text("status").notNull().default("drafted"), // 'drafted' — sending is out of scope
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Sourcing & network intelligence (stretch) — which channels yield quality
// ---------------------------------------------------------------------------
export const sourcingChannels = pgTable("sourcing_channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  opportunitiesFound: integer("opportunities_found").notNull().default(0),
  convertedCount: integer("converted_count").notNull().default(0),
  qualityScore: real("quality_score").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sourcingNodes = pgTable("sourcing_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
  institutionName: text("institution_name").notNull(),
  programName: text("program_name").notNull(),
  referrerName: text("referrer_name"),
  qualityRating: integer("quality_rating").notNull().default(50),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
