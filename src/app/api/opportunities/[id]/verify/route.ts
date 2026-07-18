/** External claim verification (Tavily + validator). Separate from memo to stay under timeout. */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memos } from "@/db/schema";
import { verifyMemoClaims } from "@/lib/services/memo";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [memo] = await db
      .select()
      .from(memos)
      .where(eq(memos.opportunityId, id))
      .orderBy(desc(memos.createdAt))
      .limit(1);
    if (!memo) return fail("No memo to verify — build the memo first.", 400);
    return ok(await verifyMemoClaims(id, memo.id));
  } catch (e) {
    return fail(errMessage(e));
  }
}
