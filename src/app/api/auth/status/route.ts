/**
 * Public workspace status — lets the signup wizard know whether a calibrated
 * workspace already exists, so a second account JOINS it instead of silently
 * overwriting the first investor's thesis. Discloses only the workspace label.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { theses } from "@/db/schema";
import type { ThesisProfile } from "@/lib/services/thesis";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({ name: theses.name, profileJson: theses.profileJson })
      .from(theses)
      .where(eq(theses.isActive, true))
      .limit(1);
    if (rows.length === 0) return ok({ hasWorkspace: false });
    const p = (rows[0].profileJson ?? {}) as ThesisProfile;
    return ok({
      hasWorkspace: true,
      workspaceName: p.fundName || rows[0].name,
      calibratedBy: p.gpName ?? null,
    });
  } catch (e) {
    return fail(errMessage(e));
  }
}
