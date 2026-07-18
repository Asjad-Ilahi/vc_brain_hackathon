import { runQuery } from "@/lib/services/query";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b?.q) return fail("q is required", 400);
    return ok(await runQuery(String(b.q)));
  } catch (e) {
    return fail(errMessage(e));
  }
}
