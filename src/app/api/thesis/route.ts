import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { theses, opportunities } from "@/db/schema";
import { getActiveThesis } from "@/lib/services/thesis";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const active = await getActiveThesis();
    const all = await db.select().from(theses).orderBy(desc(theses.createdAt));
    return ok({ active, all });
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b?.name) return fail("name is required", 400);
    // one active thesis at a time
    await db.update(theses).set({ isActive: false }).where(eq(theses.isActive, true));
    const [row] = await db
      .insert(theses)
      .values({
        name: b.name,
        sectors: b.sectors ?? [],
        stages: b.stages ?? [],
        geographies: b.geographies ?? [],
        checkSizeMinUsd: b.checkSizeMinUsd ?? null,
        checkSizeMaxUsd: b.checkSizeMaxUsd ?? null,
        ownershipTargetPct: b.ownershipTargetPct ?? null,
        riskAppetite: b.riskAppetite ?? null,
        notes: b.notes ?? null,
        convictionThreshold: Number(b.convictionThreshold) || 68,
        profileJson: b.profileJson ?? null,
        isActive: true,
      })
      .returning();

    // Radar hypotheses are LENS-RELATIVE: unassessed outbound candidates sourced
    // under the previous thesis are archived (status only — signals, founders and
    // scores stay in Memory; nothing is discarded). Screened/decided work keeps.
    let archived = 0;
    if (b.archiveStale) {
      const res = await db
        .update(opportunities)
        .set({ status: "archived" })
        .where(
          and(
            eq(opportunities.source, "outbound"),
            isNull(opportunities.screenResult),
            isNull(opportunities.decision)
          )
        )
        .returning({ id: opportunities.id });
      archived = res.length;
    }
    return ok({ ...row, archivedStaleHypotheses: archived });
  } catch (e) {
    return fail(errMessage(e));
  }
}
