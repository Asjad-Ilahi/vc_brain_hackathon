import { getOpportunityDetail } from "@/lib/services/list";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return ok(await getOpportunityDetail(id));
  } catch (e) {
    return fail(errMessage(e), 404);
  }
}
