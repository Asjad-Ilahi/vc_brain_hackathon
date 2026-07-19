/** Global agent-activity feed — the latest reasoning steps across all opportunities. */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reasoningSteps, opportunities, companies } from "@/db/schema";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: reasoningSteps.id,
        agent: reasoningSteps.agent,
        outputSummary: reasoningSteps.outputSummary,
        createdAt: reasoningSteps.createdAt,
        opportunityId: reasoningSteps.opportunityId,
        company: companies.name,
      })
      .from(reasoningSteps)
      .innerJoin(opportunities, eq(reasoningSteps.opportunityId, opportunities.id))
      .innerJoin(companies, eq(opportunities.companyId, companies.id))
      .orderBy(desc(reasoningSteps.createdAt))
      .limit(14);
    return ok(rows);
  } catch (e) {
    return fail(errMessage(e));
  }
}
