/** Fast first-pass screen — removes clearly non-viable / off-thesis ideas before full analysis. */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { opportunities, reasoningSteps, theses } from "@/db/schema";
import { structured } from "@/lib/openai";
import { ScreenSchema, type ScreenResult } from "@/lib/schemas";
import { getOpportunityContext, formatContext } from "./context";
import { getActiveThesis, formatThesis } from "./thesis";

const SYSTEM = `You are the screening gate for a venture fund. Decide FAST whether an opportunity
is worth full diligence given the fund thesis. Reject only clear non-fits (wrong sector/stage/geo,
incoherent idea, no discernible team). When in doubt, pass — screening is a coarse filter, not the
decision. Be explicit about thesis fit.`;

export async function screenOpportunity(opportunityId: string): Promise<ScreenResult> {
  const ctx = await getOpportunityContext(opportunityId);
  const thesis = ctx.opportunity.thesisId
    ? await db
        .select()
        .from(theses)
        .where(eq(theses.id, ctx.opportunity.thesisId))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  const result = await structured({
    schema: ScreenSchema,
    schemaName: "ScreenResult",
    system: SYSTEM,
    user: `${formatThesis(thesis)}\n\n${formatContext(ctx)}\n\nScreen this opportunity.`,
    model: "gpt-4o-mini",
  });

  await db
    .update(opportunities)
    .set({
      status: "screened",
      screenResult: result.result,
      screenReason: result.reason,
    })
    .where(eq(opportunities.id, opportunityId));

  await db.insert(reasoningSteps).values({
    opportunityId,
    stepOrder: 1,
    agent: "screener",
    inputSummary: "thesis + intake signals",
    outputSummary: `${result.result}: ${result.reason}`,
    citedSignalIds: ctx.signals.map((s) => s.id),
  });

  return result;
}
