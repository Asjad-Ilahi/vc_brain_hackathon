/**
 * Public self-service signup is DISABLED. The brief describes a single investor
 * running one workspace — accounts are provisioned, not self-served:
 *   - the very first operator is created once at /setup (first-run bootstrap),
 *   - everyone after that is added by an admin via an invite (/admin/users).
 * This endpoint stays only to return a clear, stable 403 for anything still
 * pointing at it. See plan G4 / NC-2.
 */
import { fail } from "@/lib/api";

export const runtime = "nodejs";

export async function POST() {
  return fail("Public sign-up is disabled — accounts are provisioned by invite. Ask an admin to invite you.", 403);
}
