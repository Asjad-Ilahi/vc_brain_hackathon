import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { theses } from "@/db/schema";

export type Thesis = typeof theses.$inferSelect;

/** Onboarding profile stored on the thesis: who decides, the fund, the founder lens. */
export type ThesisProfile = {
  gpName?: string;
  gpRole?: string;
  gpEmail?: string;
  decisionAuthority?: "sole_gp" | "ic_required" | "advisory";
  fundName?: string;
  fundSize?: string;
  archetypes?: string[];
  founderTraits?: { technicalDepth?: number; distributionInstinct?: number; storytelling?: number };
  enabledSources?: string[];
  riskScore?: number; // 0 = contrarian … 100 = consensus
  axisWeights?: { founder: number; market: number; idea: number };
  onboardedAt?: string;
};

/**
 * The active fund thesis. Single-fund by design (the brief describes "a single
 * investor" running one workspace) — there is exactly ONE active thesis for the
 * whole system. The `userId` parameter is retained for call-site compatibility
 * but intentionally ignored; every caller sees the same global thesis. This is
 * what kills the "second account → empty pipeline" bug (RF-5 / G5).
 */
export async function getActiveThesis(_userId?: string): Promise<Thesis | null> {
  const rows = await db
    .select()
    .from(theses)
    .where(eq(theses.isActive, true))
    .orderBy(desc(theses.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getThesisProfile(userId?: string): Promise<ThesisProfile | null> {
  const t = await getActiveThesis(userId);
  return (t?.profileJson as ThesisProfile | null) ?? null;
}

/** Compact, human-readable thesis for LLM prompts — the fund-specific lens. */
export function formatThesis(t: Thesis | null): string {
  if (!t) return "No thesis configured — evaluate on general early-stage merit.";
  const profile = (t.profileJson as ThesisProfile | null) ?? null;
  const parts: string[] = [];
  if (t.sectors.length) parts.push(`Sectors: ${t.sectors.join(", ")}`);
  if (t.stages.length) parts.push(`Stages: ${t.stages.join(", ")}`);
  if (t.geographies.length) parts.push(`Geographies: ${t.geographies.join(", ")}`);
  if (t.checkSizeMinUsd || t.checkSizeMaxUsd)
    parts.push(
      `Check size: $${(t.checkSizeMinUsd ?? 0).toLocaleString()}–$${(
        t.checkSizeMaxUsd ?? 0
      ).toLocaleString()}`
    );
  if (t.ownershipTargetPct) parts.push(`Ownership target: ${t.ownershipTargetPct}%`);
  if (t.riskAppetite) parts.push(`Risk appetite: ${t.riskAppetite}`);
  if (profile?.archetypes?.length)
    parts.push(`Founder archetypes the fund backs: ${profile.archetypes.join(", ")}`);
  if (profile?.founderTraits) {
    const tr = profile.founderTraits;
    const traitBits = [
      tr.technicalDepth != null ? `technical depth ${tr.technicalDepth}/100` : null,
      tr.distributionInstinct != null ? `distribution instinct ${tr.distributionInstinct}/100` : null,
      tr.storytelling != null ? `storytelling ${tr.storytelling}/100` : null,
    ].filter(Boolean);
    if (traitBits.length) parts.push(`Founder-trait weighting: ${traitBits.join(", ")}`);
  }
  if (t.notes) parts.push(`NON-NEGOTIABLES (hard constraints — screen these strictly): ${t.notes}`);
  return `Fund thesis "${t.name}":\n${parts.join("\n")}`;
}
