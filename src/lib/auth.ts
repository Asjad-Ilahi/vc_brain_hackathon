/**
 * Password hashing (node runtime only — used by the auth API routes).
 * scrypt via node:crypto: strong KDF, zero external dependencies.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { tokenFromCookieHeader, verifySessionToken } from "./session";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export type Role = "admin" | "investor" | "analyst" | "viewer";
export type SafeUser = { id: string; email: string; name: string; role: Role };

/** Resolve the signed-in user from a request's cookies (API routes). */
export async function userFromRequest(req: Request): Promise<SafeUser | null> {
  const uid = await verifySessionToken(tokenFromCookieHeader(req.headers.get("cookie")));
  if (!uid) return null;
  const [u] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  return u ? { id: u.id, email: u.email, name: u.name, role: (u.role as Role) ?? "investor" } : null;
}

/**
 * Role gate for API routes. Returns the user when signed in AND their role is in
 * `allowed`; otherwise a discriminated failure with the right HTTP status
 * (401 = not signed in, 403 = signed in but lacks the role). RBAC is an operator
 * enhancement layered on the brief's single-investor model — see users.role.
 */
export async function requireRole(
  req: Request,
  allowed: Role[]
): Promise<{ ok: true; user: SafeUser } | { ok: false; status: 401 | 403 }> {
  const user = await userFromRequest(req);
  if (!user) return { ok: false, status: 401 };
  if (!allowed.includes(user.role)) return { ok: false, status: 403 };
  return { ok: true, user };
}
