import { sourceFromArxiv } from "@/lib/services/sourcing";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    return ok({ created: await sourceFromArxiv(Math.min(Number(b?.limit) || 3, 6)) });
  } catch (e) {
    return fail(errMessage(e));
  }
}
