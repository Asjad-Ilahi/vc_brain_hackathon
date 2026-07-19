import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities } from "@/db/schema";
import { scoreOpportunity } from "@/lib/services/score";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // The screen is a real gate: rejected opportunities don't get full analysis
    // unless the investor explicitly overrides.
    const body = await req.json().catch(() => ({}));
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
    if (!opp) return fail("not found", 404);
    if (opp.screenResult === "reject" && !body?.force)
      return fail(`Screened out: ${opp.screenReason ?? "non-viable"}. Pass force=true to override.`, 409);
    return ok(await scoreOpportunity(id));
  } catch (e) {
    return fail(errMessage(e));
  }
}
