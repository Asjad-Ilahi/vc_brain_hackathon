import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { userFromRequest } from "@/lib/auth";
import { getActiveThesis } from "@/lib/services/thesis";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await userFromRequest(req);
    if (!user) return fail("Unauthorized", 401);

    const thesis = await getActiveThesis(user.id);
    if (!thesis) {
      return ok({ ready: 0, working: 0, queued: 0, decided: 0, screenedOut: 0 });
    }

    // Recover claims from dead workers (function timeout, closed tab, deploy) for this thesis.
    await db.execute(sql`
      UPDATE opportunities SET status = 'sourced', claimed_at = NULL
      WHERE status = 'in_diligence' AND claimed_at < now() - interval '6 minutes'
        AND thesis_id = ${thesis.id}`);

    const r = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE status = 'awaiting_decision' AND decision IS NULL) AS ready,
        count(*) FILTER (WHERE status = 'in_diligence') AS working,
        count(*) FILTER (
          WHERE status IN ('sourced','screened') AND decision IS NULL
            AND (screen_result IS NULL OR screen_result = 'pass')
        ) AS queued,
        count(*) FILTER (WHERE decision IS NOT NULL) AS decided,
        count(*) FILTER (WHERE screen_result = 'reject' AND decision IS NULL AND status != 'archived') AS screened_out
      FROM opportunities
      WHERE status != 'archived' AND thesis_id = ${thesis.id}`);

    const row = r.rows[0] as Record<string, string>;
    return ok({
      ready: Number(row.ready),
      working: Number(row.working),
      queued: Number(row.queued),
      decided: Number(row.decided),
      screenedOut: Number(row.screened_out),
    });
  } catch (e) {
    return fail(errMessage(e));
  }
}
