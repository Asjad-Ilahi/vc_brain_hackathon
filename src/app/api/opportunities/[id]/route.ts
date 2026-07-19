import { getOpportunityDetail } from "@/lib/services/list";
import { userFromRequest } from "@/lib/auth";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await userFromRequest(req);
    if (!user) return fail("Unauthorized", 401);
    const { id } = await params;
    return ok(await getOpportunityDetail(id, user.id));
  } catch (e) {
    return fail(errMessage(e), 404);
  }
}
