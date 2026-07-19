import { sourceAll } from "@/lib/services/sourcing";
import { userFromRequest } from "@/lib/auth";
import { db } from "@/db/client";
import { theses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: Request) {
  try {
    const user = await userFromRequest(req);
    if (!user) return fail("Unauthorized", 401);
    return ok(await sourceAll(user.id));
  } catch (e) {
    return fail(errMessage(e));
  }
}

// Vercel cron hits GET hourly (vercel.json) — "continuously scan", not
// button-triggered. Same sweep + conviction-threshold auto-screen for all onboarded Gps.
export async function GET() {
  try {
    const activeTheses = await db.select().from(theses).where(eq(theses.isActive, true));
    const results: Record<string, any> = {};
    for (const t of activeTheses) {
      if (t.userId) {
        try {
          results[t.userId] = await sourceAll(t.userId);
        } catch (err) {
          console.error(`Cron sweep failed for user ${t.userId}:`, err);
        }
      }
    }
    return ok({ swept: results });
  } catch (e) {
    return fail(errMessage(e));
  }
}
