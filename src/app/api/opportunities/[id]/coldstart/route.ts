import { analyzeColdStartFootprint } from "@/lib/services/coldstart";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return ok(await analyzeColdStartFootprint(id));
  } catch (e) {
    return fail(errMessage(e));
  }
}
