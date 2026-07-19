/**
 * User administration (admin only). List operators and change their access role.
 * RBAC is an operator enhancement on the brief's single-investor model.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = new Set(["admin", "investor", "analyst", "viewer"]);

export async function GET(req: Request) {
  try {
    const auth = await requireRole(req, ["admin"]);
    if (!auth.ok) return fail(auth.status === 401 ? "Not signed in." : "Admins only.", auth.status);
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    return ok({ users: rows });
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireRole(req, ["admin"]);
    if (!auth.ok) return fail(auth.status === 401 ? "Not signed in." : "Admins only.", auth.status);
    const b = await req.json().catch(() => ({}));
    const userId = String(b?.userId ?? "");
    const role = String(b?.role ?? "");
    if (!userId || !ROLES.has(role)) return fail("userId and a valid role are required.", 400);
    // Don't let an admin demote themselves — avoids locking the last admin out.
    if (userId === auth.user.id && role !== "admin")
      return fail("You can't change your own admin role.", 400);
    const [updated] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId))
      .returning({ id: users.id, role: users.role });
    if (!updated) return fail("User not found.", 404);
    return ok({ user: updated });
  } catch (e) {
    return fail(errMessage(e));
  }
}
