import { sourceFromWeb } from "@/lib/services/sourcing";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    const ids = await sourceFromWeb(b?.query, Math.min(Number(b?.limit) || 4, 6));
    return ok({ created: ids });
  } catch (e) {
    return fail(errMessage(e));
  }
}
