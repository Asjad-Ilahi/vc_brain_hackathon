/**
 * First-run bootstrap. There is NO public signup — the very first operator is
 * created here, and ONLY while the workspace has zero users. Once anyone exists,
 * setup is permanently closed and further accounts come from admin invites.
 * The founding user is provisioned as `admin` (can invite + do everything).
 */
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { createSessionToken, sessionCookieAttrs } from "@/lib/session";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function usersExist(): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length > 0;
}

export async function GET() {
  try {
    return ok({ needsSetup: !(await usersExist()) });
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function POST(req: Request) {
  try {
    if (await usersExist()) return fail("Setup is already complete — sign in instead.", 409);

    const b = await req.json().catch(() => ({}));
    const name = String(b?.name ?? "").trim();
    const email = String(b?.email ?? "").trim().toLowerCase();
    const password = String(b?.password ?? "");
    if (name.length < 2) return fail("Add your full name.", 400);
    if (!EMAIL_RE.test(email)) return fail("That email doesn't look valid.", 400);
    if (password.length < 8) return fail("Password must be at least 8 characters.", 400);

    // Re-check just before inserting to narrow the (tiny) first-run race window.
    if (await usersExist()) return fail("Setup is already complete — sign in instead.", 409);

    const [user] = await db
      .insert(users)
      .values({ email, name, passwordHash: hashPassword(password), role: "admin" })
      .returning();

    const token = await createSessionToken(user.id);
    const res = ok({ user: { id: user.id, email: user.email, name: user.name, role: "admin" } });
    res.headers.set("Set-Cookie", sessionCookieAttrs(token));
    return res;
  } catch (e) {
    return fail(errMessage(e));
  }
}
