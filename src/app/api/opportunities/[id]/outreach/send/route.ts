import { sendOutreach } from "@/lib/services/outreach";
import { userFromRequest } from "@/lib/auth";
import { ok, fail, errMessage } from "@/lib/api";
import { db } from "@/db/client";
import { outreach } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await userFromRequest(req);
    if (!user) return fail("Unauthorized", 401);

    const { id: opportunityId } = await params;
    const body = await req.json();
    const { email, message } = body;

    if (!email) return fail("Recipient email is required", 400);
    if (!message) return fail("Outreach message body is required", 400);

    // Find the latest drafted outreach for this opportunity
    const [draft] = await db
      .select()
      .from(outreach)
      .where(eq(outreach.opportunityId, opportunityId))
      .orderBy(outreach.createdAt)
      .limit(1);

    if (!draft) {
      return fail("No outreach draft found on file. Draft one first.", 404);
    }

    const result = await sendOutreach(draft.id, email, message);
    return ok(result);
  } catch (e) {
    return fail(errMessage(e));
  }
}
