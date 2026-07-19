import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { createSessionToken, sessionCookieAttrs } from "@/lib/session";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const name = String(b?.name ?? "").trim();
    const email = String(b?.email ?? "").trim().toLowerCase();
    const password = String(b?.password ?? "");

    if (name.length < 2) return fail("Add your full name.", 400);
    if (!EMAIL_RE.test(email)) return fail("That email doesn't look valid.", 400);
    if (password.length < 8) return fail("Password must be at least 8 characters.", 400);

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) return fail("An account with this email already exists — sign in instead.", 409);

    const [user] = await db
      .insert(users)
      .values({ email, name, passwordHash: hashPassword(password) })
      .returning();

    const token = await createSessionToken(user.id);
    const res = ok({ user: { id: user.id, email: user.email, name: user.name } });
    res.headers.set("Set-Cookie", sessionCookieAttrs(token));
    return res;
  } catch (e) {
    return fail(errMessage(e));
  }
}
