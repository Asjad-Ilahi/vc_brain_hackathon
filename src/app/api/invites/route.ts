/**
 * Invites (admin only). The admin creates a single-use invite for an email+role;
 * the invitee accepts at /invite/[token] to provision their account. This is how
 * every operator after the first (the /setup admin) gets in — no public signup.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invites, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { ok, fail, errMessage } from "@/lib/api";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = new Set(["admin", "investor", "analyst", "viewer"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ["admin"]);
    if (!auth.ok) return fail(auth.status === 401 ? "Not signed in." : "Admins only.", auth.status);
    const rows = await db.select().from(invites).orderBy(desc(invites.createdAt));
    return ok({
      invites: rows.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        used: !!i.usedAt,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
        link: `${env.appUrl}/invite/${i.token}`,
      })),
    });
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(req, ["admin"]);
    if (!auth.ok) return fail(auth.status === 401 ? "Not signed in." : "Admins only.", auth.status);
    const b = await req.json().catch(() => ({}));
    const email = String(b?.email ?? "").trim().toLowerCase();
    const role = String(b?.role ?? "investor");
    if (!EMAIL_RE.test(email)) return fail("A valid email is required.", 400);
    if (!ROLES.has(role)) return fail("Invalid role.", 400);

    const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length) return fail("That email already has an account.", 409);

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const [row] = await db
      .insert(invites)
      .values({ email, role, token, invitedByUserId: auth.user.id, expiresAt })
      .returning();
    return ok({
      invite: {
        id: row.id,
        email: row.email,
        role: row.role,
        expiresAt: row.expiresAt,
        link: `${env.appUrl}/invite/${token}`,
      },
    });
  } catch (e) {
    return fail(errMessage(e));
  }
}
