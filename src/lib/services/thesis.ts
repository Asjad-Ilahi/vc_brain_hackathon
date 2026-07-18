import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { theses } from "@/db/schema";

export type Thesis = typeof theses.$inferSelect;

/** The active fund thesis. Falls back to a default if none configured yet. */
export async function getActiveThesis(): Promise<Thesis | null> {
  const rows = await db
    .select()
    .from(theses)
    .where(eq(theses.isActive, true))
    .orderBy(desc(theses.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Compact, human-readable thesis for LLM prompts. */
export function formatThesis(t: Thesis | null): string {
  if (!t) return "No thesis configured — evaluate on general early-stage merit.";
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
  if (t.notes) parts.push(`Notes: ${t.notes}`);
  return `Fund thesis "${t.name}":\n${parts.join("\n")}`;
}
