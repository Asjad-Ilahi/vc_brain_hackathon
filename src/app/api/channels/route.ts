import { getChannelIntelligence } from "@/lib/services/channels";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getChannelIntelligence());
  } catch (e) {
    return fail(errMessage(e));
  }
}
