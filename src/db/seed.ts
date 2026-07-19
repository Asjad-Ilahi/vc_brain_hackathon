/**
 * Deterministic seed (no LLM). Sets up the Memory so the live demo can run
 * scoring/memo on top. Four hero founders chosen to exercise the graded features:
 *   1. STRONG        — clean signals, high Founder Score
 *   2. CONTRADICTION — deck claims that the web will contradict (Trust Score demo)
 *   3. COLD-START    — no GitHub/funding/network (the graded differentiator)
 *   4. RETURNING     — pre-existing Founder Score + history (persistence demo)
 *
 * Run:  pnpm db:push   then   pnpm seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { sql } from "drizzle-orm";
import { db } from "./client";
import {
  theses,
  founders,
  founderScoreHistory,
  companies,
  opportunities,
  opportunityFounders,
  signals,
} from "./schema";
import { canonicalizeHandle, dedupeHash } from "../lib/utils";

type SeedFounder = {
  fullName: string;
  handle: string;
  githubLogin?: string;
  linkedinUrl?: string;
  location?: string;
  bio?: string;
  isColdStart?: boolean;
  founderScore: number;
  scoreConfidence: number;
  history: { score: number; delta: number; reason: string; milestone: string }[];
};

type SeedCase = {
  founder: SeedFounder;
  company: {
    name: string;
    sector: string;
    stage: string;
    geography: string;
    oneLiner: string;
    description: string;
  };
  source: "inbound" | "outbound";
  sourceChannel: string;
  /** Hours since first signal — staggers the 24h clocks for a live-feeling demo. */
  hoursAgo: number;
  convictionScore?: number;
  convictionReason?: string;
  signals: { sourceType: string; sourceUrl?: string; title: string; rawText: string; tags: string[] }[];
};

const CASES: SeedCase[] = [
  {
    founder: {
      fullName: "Aria Kholin",
      handle: "ariakholin",
      githubLogin: "ariakholin",
      linkedinUrl: "https://linkedin.com/in/ariakholin",
      location: "San Francisco, USA",
      bio: "Ex-infrastructure engineer at Snowflake; built distributed query engines. 2nd-time founder.",
      founderScore: 71,
      scoreConfidence: 0.72,
      history: [
        { score: 60, delta: 10, reason: "Prior infra role + shipped OSS with real adoption", milestone: "sourced" },
        { score: 71, delta: 11, reason: "Strong GitHub traction on VectorForge", milestone: "github_signal" },
      ],
    },
    company: {
      name: "VectorForge",
      sector: "AI infrastructure",
      stage: "seed",
      geography: "USA",
      oneLiner: "Self-hosted vector database with sub-ms retrieval for enterprise RAG.",
      description: "Problem: enterprise RAG needs low-latency, on-prem vector search. Product: VectorForge, a Rust vector DB with row-level security.",
    },
    source: "inbound",
    sourceChannel: "application",
    hoursAgo: 21,
    signals: [
      {
        sourceType: "deck",
        title: "VectorForge pitch deck",
        rawText:
          "[product] Rust-based self-hosted vector DB. [traction] 1,200 GitHub stars, 8 design partners. [team] Founder ex-Snowflake infra. [market] Enterprise RAG infrastructure.",
        tags: ["inbound", "deck"],
      },
      {
        sourceType: "github",
        sourceUrl: "https://github.com/ariakholin/vectorforge",
        title: "ariakholin/vectorforge",
        rawText: "Rust vector database. 1,200 stars, active commits in the last week, 14 contributors.",
        tags: ["github", "traction"],
      },
    ],
  },
  {
    founder: {
      fullName: "Dev Malhotra",
      handle: "devmalhotra",
      githubLogin: "devmalhotra",
      linkedinUrl: "https://linkedin.com/in/devmalhotra",
      location: "Austin, USA",
      bio: "Founder of GrowthLoop AI. Claims ex-Stripe.",
      founderScore: 52,
      scoreConfidence: 0.4,
      history: [{ score: 52, delta: 2, reason: "Inbound application received", milestone: "sourced" }],
    },
    company: {
      name: "GrowthLoop AI",
      sector: "AI martech",
      stage: "seed",
      geography: "USA",
      oneLiner: "Autonomous growth agent that runs paid acquisition end to end.",
      description: "Problem: SMBs can't run performance marketing. Product: an AI agent that manages ad spend.",
    },
    source: "inbound",
    sourceChannel: "application",
    hoursAgo: 16,
    signals: [
      {
        sourceType: "deck",
        title: "GrowthLoop AI pitch deck",
        rawText:
          "[team] Founder was an early engineer at Stripe. [traction] 50,000 active users. [revenue] $2M ARR in 9 months. [market] $40B performance marketing.",
        tags: ["inbound", "deck", "unverified-claims"],
      },
      {
        sourceType: "github",
        sourceUrl: "https://github.com/devmalhotra",
        title: "devmalhotra (GitHub)",
        rawText: "Profile has 3 public repos, none updated in 2 years, 11 followers.",
        tags: ["github"],
      },
    ],
  },
  {
    founder: {
      fullName: "Lena Ortiz",
      handle: "lena-ortiz",
      location: "Madrid, Spain",
      bio: "First-time founder, nurse practitioner. No prior startups, no GitHub, small network.",
      isColdStart: true,
      founderScore: 50,
      scoreConfidence: 0.25,
      history: [{ score: 50, delta: 0, reason: "Cold-start: minimal public footprint", milestone: "sourced" }],
    },
    company: {
      name: "CycleSense",
      sector: "women's health",
      stage: "pre-seed",
      geography: "EU",
      oneLiner: "At-home hormone tracking that flags perimenopause years earlier.",
      description: "Problem: hormonal shifts are diagnosed late. Product: a saliva test + app for longitudinal hormone tracking.",
    },
    source: "inbound",
    sourceChannel: "application",
    hoursAgo: 8,
    signals: [
      {
        sourceType: "deck",
        title: "CycleSense one-pager",
        rawText:
          "[product] At-home saliva hormone test with an app. [team] Solo non-technical founder, 8 years as a nurse practitioner. [market] Women's hormonal health.",
        tags: ["inbound", "deck", "cold-start"],
      },
      {
        sourceType: "web",
        sourceUrl: "https://linkedin.com/in/lena-ortiz",
        title: "LinkedIn — Lena Ortiz",
        rawText: "Nurse practitioner, 8 years clinical experience in endocrinology. No company history.",
        tags: ["web", "linkedin"],
      },
    ],
  },
  {
    founder: {
      fullName: "Sam Okafor",
      handle: "samokafor",
      githubLogin: "samokafor",
      linkedinUrl: "https://linkedin.com/in/samokafor",
      location: "Berlin, Germany",
      bio: "Technical founder. Previously founded DataPipe (acquired). Now building InferEdge.",
      founderScore: 76,
      scoreConfidence: 0.8,
      history: [
        { score: 55, delta: 5, reason: "First company DataPipe — early traction", milestone: "application" },
        { score: 68, delta: 13, reason: "DataPipe acquired — proven operator", milestone: "exit" },
        { score: 76, delta: 8, reason: "New venture InferEdge sourced via GitHub", milestone: "github_signal" },
      ],
    },
    company: {
      name: "InferEdge",
      sector: "AI infrastructure",
      stage: "pre-seed",
      geography: "EU",
      oneLiner: "On-device LLM inference runtime for regulated industries.",
      description: "Problem: regulated enterprises can't send data to cloud LLMs. Product: an on-device inference runtime.",
    },
    source: "outbound",
    sourceChannel: "github",
    hoursAgo: 2,
    convictionScore: 84,
    convictionReason: "640\u2605 on GitHub \u00b7 shipping this week \u00b7 proven operator (FS 76)",
    signals: [
      {
        sourceType: "github",
        sourceUrl: "https://github.com/samokafor/inferedge",
        title: "samokafor/inferedge",
        rawText: "On-device inference runtime. 640 stars, ships weekly. Founder previously built DataPipe (acquired).",
        tags: ["outbound", "github", "returning-founder"],
      },
    ],
  },
];

async function main() {
  console.log("Clearing existing data…");
  await db.execute(
    sql.raw(
      "TRUNCATE TABLE theses, founders, founder_score_history, companies, opportunities, opportunity_founders, signals, axis_scores, memos, claims, reasoning_steps, outreach, sourcing_channels RESTART IDENTITY CASCADE"
    )
  );

  console.log("Seeding thesis…");
  const [thesis] = await db
    .insert(theses)
    .values({
      name: "Pre-seed / seed AI infra (US + EU)",
      sectors: ["AI infrastructure", "developer tools", "applied AI"],
      stages: ["pre-seed", "seed"],
      geographies: ["USA", "EU"],
      checkSizeMinUsd: 100000,
      checkSizeMaxUsd: 250000,
      ownershipTargetPct: 8,
      riskAppetite: "high",
      convictionThreshold: 68,
      notes: "Technical founders shipping in the open. Cold-start friendly.",
      isActive: true,
    })
    .returning();

  for (const c of CASES) {
    console.log(`Seeding ${c.company.name} (${c.founder.fullName})…`);
    const canonicalHandle = canonicalizeHandle(c.founder.githubLogin || c.founder.handle);

    const [founder] = await db
      .insert(founders)
      .values({
        canonicalHandle,
        fullName: c.founder.fullName,
        githubLogin: c.founder.githubLogin ?? null,
        linkedinUrl: c.founder.linkedinUrl ?? null,
        location: c.founder.location ?? null,
        bio: c.founder.bio ?? null,
        isColdStart: c.founder.isColdStart ?? false,
        founderScore: c.founder.founderScore,
        founderScoreConfidence: c.founder.scoreConfidence,
      })
      .returning();

    for (const h of c.founder.history) {
      await db.insert(founderScoreHistory).values({
        founderId: founder.id,
        score: h.score,
        delta: h.delta,
        confidence: c.founder.scoreConfidence,
        reason: h.reason,
        milestone: h.milestone,
      });
    }

    const [company] = await db
      .insert(companies)
      .values({
        name: c.company.name,
        sector: c.company.sector,
        stage: c.company.stage,
        geography: c.company.geography,
        oneLiner: c.company.oneLiner,
        description: c.company.description,
      })
      .returning();

    const [opp] = await db
      .insert(opportunities)
      .values({
        companyId: company.id,
        thesisId: thesis.id,
        source: c.source,
        sourceChannel: c.sourceChannel,
        status: "sourced",
        convictionScore: c.convictionScore ?? null,
        convictionReason: c.convictionReason ?? null,
        firstSignalAt: new Date(Date.now() - c.hoursAgo * 3600_000),
        deadlineAt: new Date(Date.now() + (24 - c.hoursAgo) * 3600_000),
      })
      .returning();

    await db.insert(opportunityFounders).values({ opportunityId: opp.id, founderId: founder.id, role: "founder" });

    for (const s of c.signals) {
      await db.insert(signals).values({
        opportunityId: opp.id,
        founderId: founder.id,
        companyId: company.id,
        sourceType: s.sourceType,
        sourceUrl: s.sourceUrl ?? null,
        title: s.title,
        rawText: s.rawText,
        tags: s.tags,
        dedupeHash: dedupeHash(s.sourceType, `${s.title}\n${s.rawText}`),
      });
    }
  }

  console.log("✅ Seed complete: 1 thesis, 4 opportunities, 4 founders.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
