import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { axisScores } from "@/db/schema";
import { buildMemo } from "@/lib/services/memo";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // A memo without a 3-axis assessment is a story, not a decision document.
    const body = await req.json().catch(() => ({}));
    const axes = await db
      .select({ id: axisScores.id })
      .from(axisScores)
      .where(eq(axisScores.opportunityId, id))
      .limit(1);
    if (axes.length === 0 && !body?.force)
      return fail("Run the 3-axis assessment before drafting a memo.", 409);
    return ok(await buildMemo(id));
  } catch (e) {
    return fail(errMessage(e));
  }
}
