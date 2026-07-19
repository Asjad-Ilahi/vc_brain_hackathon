import { userFromRequest } from "@/lib/auth";
import { deepSearchFounder } from "@/lib/services/sourcing";
import { ok, fail, errMessage } from "@/lib/api";
import { screenOpportunity } from "@/lib/services/screen";
import { scoreOpportunity } from "@/lib/services/score";
import { buildMemo, verifyMemoClaims } from "@/lib/services/memo";

export const runtime = "nodejs";
export const maxDuration = 90; // search and deep checking takes time

export async function POST(req: Request) {
  try {
    const user = await userFromRequest(req);
    if (!user) return fail("Unauthorized", 401);

    const b = await req.json().catch(() => ({}));
    const query = String(b?.query ?? "").trim();
    if (!query) return fail("Query is required", 400);

    const createdIds = await deepSearchFounder(user.id, query);
    if (createdIds.length === 0) {
      return ok({ created: [], message: "No new founders found matching the query." });
    }

    // Run full deep assessment on each found candidate immediately
    for (const id of createdIds) {
      try {
        const screen = await screenOpportunity(id);
        if (screen.result === "pass") {
          await scoreOpportunity(id);
          const { memo } = await buildMemo(id);
          await verifyMemoClaims(id, memo.id);
        }
      } catch (err) {
        console.error(`Autopilot assessment failed on manual search founder ${id}:`, err);
      }
    }

    return ok({ created: createdIds });
  } catch (e) {
    return fail(errMessage(e));
  }
}
