import { screenOpportunity } from "@/lib/services/screen";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return ok(await screenOpportunity(id));
  } catch (e) {
    return fail(errMessage(e));
  }
}
