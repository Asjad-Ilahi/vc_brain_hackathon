import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { theses } from "@/db/schema";
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
        isActive: true,
      })
      .returning();
    return ok(row);
  } catch (e) {
    return fail(errMessage(e));
  }
}
