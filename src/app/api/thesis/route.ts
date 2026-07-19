import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { theses, opportunities } from "@/db/schema";
import { getActiveThesis } from "@/lib/services/thesis";
import { userFromRequest } from "@/lib/auth";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await userFromRequest(req);
    if (!user) return fail("Unauthorized", 401);
    const active = await getActiveThesis(user.id);
    const all = await db
      .select()
      .from(theses)
      .where(eq(theses.userId, user.id))
      .orderBy(desc(theses.createdAt));
    return ok({ active, all });
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function POST(req: Request) {
  try {
    const user = await userFromRequest(req);
    if (!user) return fail("Unauthorized", 401);
    const b = await req.json();
    if (!b?.name) return fail("name is required", 400);

    // deactivate user's current active thesis
    await db.update(theses).set({ isActive: false }).where(and(eq(theses.isActive, true), eq(theses.userId, user.id)));

    const [row] = await db
      .insert(theses)
      .values({
        userId: user.id,
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
            eq(opportunities.thesisId, row.id),
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
