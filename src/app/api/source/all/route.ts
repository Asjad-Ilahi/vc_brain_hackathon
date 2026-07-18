import { sourceAll } from "@/lib/services/sourcing";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    return ok(await sourceAll());
  } catch (e) {
    return fail(errMessage(e));
  }
}
