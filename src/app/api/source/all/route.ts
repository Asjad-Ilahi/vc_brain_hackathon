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

// Vercel cron hits GET hourly (vercel.json) — "continuously scan", not
// button-triggered. Same sweep + conviction-threshold auto-screen.
export async function GET() {
  try {
    return ok(await sourceAll());
  } catch (e) {
    return fail(errMessage(e));
  }
}
