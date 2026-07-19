/**
 * Accept an invite (PUBLIC — the invitee has no account yet).
 *   GET  ?token=…  → validate + return {email, role} so the page can show context.
 *   POST {token, name, password} → provision the user with the invite's role,
 *         consume the invite, and sign them in.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invites, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { createSessionToken, sessionCookieAttrs } from "@/lib/session";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InviteLookup =
  | { ok: false; error: string; status: 404 | 409 | 410 }
  | { ok: true; invite: typeof invites.$inferSelect };

async function loadValidInvite(token: string): Promise<InviteLookup> {
  const [inv] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  if (!inv) return { ok: false, error: "This invite link is invalid.", status: 404 };
  if (inv.usedAt) return { ok: false, error: "This invite has already been used.", status: 409 };
  if (new Date(inv.expiresAt).getTime() < Date.now())
    return { ok: false, error: "This invite has expired — ask an admin for a new one.", status: 410 };
  return { ok: true, invite: inv };
}

export async function GET(req: Request) {
  try {
    const token = (new URL(req.url).searchParams.get("token") ?? "").trim();
    if (!token) return fail("Missing invite token.", 400);
    const r = await loadValidInvite(token);
    if (!r.ok) return fail(r.error, r.status);
    return ok({ email: r.invite.email, role: r.invite.role });
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const token = String(b?.token ?? "").trim();
    const name = String(b?.name ?? "").trim();
    const password = String(b?.password ?? "");
    if (!token) return fail("Missing invite token.", 400);
    if (name.length < 2) return fail("Add your full name.", 400);
    if (password.length < 8) return fail("Password must be at least 8 characters.", 400);

    const r = await loadValidInvite(token);
    if (!r.ok) return fail(r.error, r.status);
    const inv = r.invite;

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, inv.email)).limit(1);
    if (existing.length) return fail("An account with this email already exists — sign in instead.", 409);

    const [user] = await db
      .insert(users)
      .values({ email: inv.email, name, passwordHash: hashPassword(password), role: inv.role })
      .returning();
    await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, inv.id));

    const sessionToken = await createSessionToken(user.id);
    const res = ok({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    res.headers.set("Set-Cookie", sessionCookieAttrs(sessionToken));
    return res;
  } catch (e) {
    return fail(errMessage(e));
  }
}
