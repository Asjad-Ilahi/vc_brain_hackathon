import { sourceFromHackerNews } from "@/lib/services/sourcing";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    return ok({ created: await sourceFromHackerNews(Math.min(Number(b?.limit) || 4, 8)) });
  } catch (e) {
    return fail(errMessage(e));
  }
}
