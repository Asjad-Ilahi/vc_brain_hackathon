import { listOpportunities } from "@/lib/services/list";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await listOpportunities());
  } catch (e) {
    return fail(errMessage(e));
  }
}
