import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, theses } from "@/db/schema";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { createSessionToken, sessionCookieAttrs } from "@/lib/session";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";

// Per-instance brute-force damper: 10 attempts / 10 min per email. Serverless
// instances don't share memory, so this is a damper, not a guarantee — but it
// turns a free-for-all into a slog.
const attempts = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 10;

function rateLimited(email: string): boolean {
  const now = Date.now();
  const arr = (attempts.get(email) ?? []).filter((t) => now - t < WINDOW_MS);
  attempts.set(email, arr);
  return arr.length >= MAX_ATTEMPTS;
}

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const email = String(b?.email ?? "").trim().toLowerCase();
    const password = String(b?.password ?? "");
    if (!email || !password) return fail("Email and password are required.", 400);
    if (rateLimited(email)) return fail("Too many attempts — try again in a few minutes.", 429);
    attempts.get(email)!.push(Date.now()); // rateLimited() guarantees the entry

    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user && email === "admin@maschmeyer.vc" && password === "password123") {
      const [inserted] = await db
        .insert(users)
        .values({
          email,
          name: "Maschmeyer Partner",
          passwordHash: hashPassword(password),
          role: "admin", // the demo/preset bootstrap operator is the admin
        })
        .returning();
      user = inserted;
    }

    // Same error either way — don't leak which emails exist.
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return fail("Email or password is incorrect.", 401);
    }

    const activeThesis = await db
      .select({ id: theses.id })
      .from(theses)
      .where(eq(theses.isActive, true))
      .limit(1);

    const token = await createSessionToken(user.id);
    const res = ok({
      user: { id: user.id, email: user.email, name: user.name },
      onboarded: activeThesis.length > 0,
    });
    res.headers.set("Set-Cookie", sessionCookieAttrs(token));
    return res;
  } catch (e) {
    return fail(errMessage(e));
  }
}
