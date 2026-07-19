/** Extend the 24h decision clock by another 24h (investor action, logged). */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, reasoningSteps } from "@/db/schema";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
    if (!opp) return fail("not found", 404);
    if (opp.decision) return fail("already decided — nothing to extend", 409);

    const base = opp.deadlineAt ? new Date(opp.deadlineAt) : new Date(new Date(opp.firstSignalAt).getTime() + 24 * 3600_000);
    const from = base.getTime() < Date.now() ? new Date() : base;
    const deadlineAt = new Date(from.getTime() + 24 * 3600_000);

    await db.update(opportunities).set({ deadlineAt }).where(eq(opportunities.id, id));
    await db.insert(reasoningSteps).values({
      opportunityId: id,
      stepOrder: 5,
      agent: "investor",
      inputSummary: "clock extension requested",
      outputSummary: `deadline extended 24h → ${deadlineAt.toISOString()}`,
      citedSignalIds: [],
    });
    return ok({ deadlineAt: deadlineAt.toISOString() });
  } catch (e) {
    return fail(errMessage(e));
  }
}
