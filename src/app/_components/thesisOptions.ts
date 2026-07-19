/** Shared option sets for the Thesis engine + onboarding wizard. */
import type { Thesis, ThesisProfile } from "@/lib/services/thesis";

export const SECTOR_OPTIONS = [
  "AI infrastructure",
  "applied AI",
  "developer tools",
  "enterprise SaaS",
  "fintech infra",
  "bio + AI",
  "robotics",
  "climate AI",
  "consumer AI",
  "vertical SaaS",
];

export const STAGE_OPTIONS = ["pre-seed", "seed", "seed extension", "series A"];

export const GEO_OPTIONS = ["USA", "EU", "DACH", "UK", "Israel", "LATAM", "APAC", "MENA", "global remote"];

export const ARCHETYPE_OPTIONS = [
  "Technical",
  "Repeat operator",
  "Domain expert",
  "Ex-FAANG",
  "Academic → founder",
  "Solo founder",
  "Cracked 22yo",
  "Second-time",
];

/** Real, wired sourcing channels. */
export const SOURCE_OPTIONS = [
  { id: "github", label: "GitHub", trust: "high", est: "code they're building right now" },
  { id: "arxiv", label: "arXiv", trust: "high", est: "fresh research papers" },
  { id: "producthunt", label: "Product Hunt", trust: "high", est: "product launches" },
  { id: "hackernews", label: "Hacker News", trust: "med", est: "Show HN launch posts" },
  { id: "accelerators", label: "YC / Techstars", trust: "high", est: "current batches, pre demo-day" },
  { id: "hackathons", label: "Hackathons", trust: "med", est: "recent winning builds" },
  { id: "patents", label: "Patents", trust: "med", est: "new patent filings" },
  { id: "web", label: "Open web", trust: "med", est: "news & everything else" },
] as const;

export type ThesisDraft = {
  name: string;
  sectors: string[];
  stages: string[];
  geographies: string[];
  checkSizeMinUsd: number;
  checkSizeMaxUsd: number;
  ownershipTargetPct: number;
  riskScore: number;
  convictionThreshold: number;
  notes: string;
  archetypes: string[];
  traits: { technicalDepth: number; distributionInstinct: number; storytelling: number };
  enabledSources: string[];
};

export const DEFAULT_DRAFT: ThesisDraft = {
  name: "Pre-seed / seed AI (US + EU)",
  sectors: ["AI infrastructure", "developer tools", "applied AI"],
  stages: ["pre-seed", "seed"],
  geographies: ["USA", "EU"],
  checkSizeMinUsd: 100_000,
  checkSizeMaxUsd: 250_000,
  ownershipTargetPct: 7,
  riskScore: 65,
  convictionThreshold: 68,
  notes: "",
  archetypes: ["Technical", "Repeat operator"],
  traits: { technicalDepth: 82, distributionInstinct: 61, storytelling: 55 },
  enabledSources: SOURCE_OPTIONS.map((s) => s.id),
};

export function draftFromThesis(t: Thesis): ThesisDraft {
  const p = (t.profileJson ?? {}) as ThesisProfile;
  return {
    name: t.name,
    sectors: t.sectors,
    stages: t.stages,
    geographies: t.geographies,
    checkSizeMinUsd: t.checkSizeMinUsd ?? 100_000,
    checkSizeMaxUsd: t.checkSizeMaxUsd ?? 250_000,
    ownershipTargetPct: t.ownershipTargetPct ?? 7,
    riskScore: p.riskScore ?? (t.riskAppetite === "high" ? 70 : t.riskAppetite === "low" ? 30 : 50),
    convictionThreshold: t.convictionThreshold ?? 68,
    notes: t.notes ?? "",
    archetypes: p.archetypes ?? [],
    traits: {
      technicalDepth: p.founderTraits?.technicalDepth ?? 75,
      distributionInstinct: p.founderTraits?.distributionInstinct ?? 60,
      storytelling: p.founderTraits?.storytelling ?? 55,
    },
    enabledSources: p.enabledSources?.length ? p.enabledSources : SOURCE_OPTIONS.map((s) => s.id),
  };
}

/** Build the POST /api/thesis body from a draft, preserving identity fields. */
export function thesisPayload(d: ThesisDraft, existingProfile?: ThesisProfile | null) {
  const weights = deriveAxisWeights(d.riskScore, d.traits);
  return {
    name: d.name,
    sectors: d.sectors,
    stages: d.stages,
    geographies: d.geographies,
    checkSizeMinUsd: d.checkSizeMinUsd,
    checkSizeMaxUsd: d.checkSizeMaxUsd,
    ownershipTargetPct: d.ownershipTargetPct,
    riskAppetite: d.riskScore >= 60 ? "high" : d.riskScore >= 35 ? "medium" : "low",
    convictionThreshold: d.convictionThreshold,
    notes: d.notes,
    profileJson: {
      ...(existingProfile ?? {}),
      archetypes: d.archetypes,
      founderTraits: d.traits,
      enabledSources: d.enabledSources,
      riskScore: d.riskScore,
      axisWeights: weights,
    } satisfies ThesisProfile,
  };
}

/** Cosmetic-but-consistent preview: how the lens weights the three axes. */
export function deriveAxisWeights(
  riskScore: number,
  traits: { technicalDepth: number; distributionInstinct: number; storytelling: number }
): { founder: number; market: number; idea: number } {
  let founder = 0.36 + (50 - riskScore) * 0.0014 + (traits.technicalDepth - 50) * 0.001;
  let market = 0.32 + (riskScore - 50) * 0.0014 + (traits.distributionInstinct - 50) * 0.0006;
  let idea = 0.32 + (traits.storytelling - 50) * 0.0006;
  const sum = founder + market + idea;
  founder /= sum;
  market /= sum;
  idea /= sum;
  return { founder: +founder.toFixed(2), market: +market.toFixed(2), idea: +idea.toFixed(2) };
}
