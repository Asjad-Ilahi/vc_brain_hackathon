import { sourceFromProductHunt } from "@/lib/services/sourcing";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const ids = await sourceFromProductHunt(Math.min(Number(b?.limit) || 3, 6));
    return ok({ created: ids });
  } catch (e) {
    return fail(errMessage(e));
  }
}
