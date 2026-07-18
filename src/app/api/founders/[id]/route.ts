import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { founders } from "@/db/schema";
import { getFounderScoreHistory } from "@/lib/services/ingest";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [founder] = await db.select().from(founders).where(eq(founders.id, id)).limit(1);
    if (!founder) return fail("not found", 404);
    const history = await getFounderScoreHistory(id);
    return ok({ founder, history });
  } catch (e) {
    return fail(errMessage(e));
  }
}
