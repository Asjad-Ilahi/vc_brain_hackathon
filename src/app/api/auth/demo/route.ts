/**
 * One-click demo. Issues a session for a fixed READ-ONLY viewer account so the
 * landing "See Demo" opens the populated workspace with no sign-up. The viewer
 * role is blocked from the consequential write actions (deploy capital, change
 * thesis, manage users) by requireRole — see plan RF-6 / G6.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { createSessionToken, sessionCookieAttrs } from "@/lib/session";
import { ok, fail, errMessage } from "@/lib/api";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_EMAIL = "demo@vcbrain.app";

export async function POST() {
  try {
    let [demo] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
    if (!demo) {
      // Random, discarded password — the demo is only ever entered via this
      // endpoint, never a login form.
      [demo] = await db
        .insert(users)
        .values({
          email: DEMO_EMAIL,
          name: "Demo Viewer",
          passwordHash: hashPassword(randomBytes(24).toString("hex")),
          role: "viewer",
        })
        .returning();
    } else if (demo.role !== "viewer") {
      // Keep the shared demo account read-only no matter what.
      await db.update(users).set({ role: "viewer" }).where(eq(users.id, demo.id));
    }

    const token = await createSessionToken(demo.id);
    const res = ok({ user: { id: demo.id, email: demo.email, name: demo.name, role: "viewer" } });
    res.headers.set("Set-Cookie", sessionCookieAttrs(token));
    return res;
  } catch (e) {
    return fail(errMessage(e));
  }
}
