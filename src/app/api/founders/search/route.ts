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
      return ok({
        created: [],
        message: `No founders found matching "${query}". Try a full name, a GitHub login, or a more specific project or keyword.`,
      });
    }

    // Verify ONLY the top match inline — running the full chain for every hit
    // blew past the serverless time budget, so the request never returned (the
    // "no response" bug). The rest get the fast first-pass screen; autopilot or
    // on-demand diligence completes them.
    const [primary, ...rest] = createdIds;
    try {
      const screen = await screenOpportunity(primary);
      if (screen.result === "pass") {
        await scoreOpportunity(primary);
        const { memo } = await buildMemo(primary);
        await verifyMemoClaims(primary, memo.id);
      }
    } catch (err) {
      console.error(`Assessment failed on manual search founder ${primary}:`, err);
    }
    for (const id of rest) {
      try {
        await screenOpportunity(id);
      } catch (err) {
        console.error(`Screen failed on manual search founder ${id}:`, err);
      }
    }

    return ok({ created: createdIds });
  } catch (e) {
    return fail(errMessage(e));
  }
}
