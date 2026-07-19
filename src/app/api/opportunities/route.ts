import { listOpportunities } from "@/lib/services/list";
import { userFromRequest } from "@/lib/auth";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await userFromRequest(req);
    if (!user) return fail("Unauthorized", 401);
    return ok(await listOpportunities(user.id));
  } catch (e) {
    return fail(errMessage(e));
  }
}
