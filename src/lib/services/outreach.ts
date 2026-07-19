/** Activate — draft (never send) cold outreach to a sourced founder. */
import { db } from "@/db/client";
import { outreach, theses } from "@/db/schema";
import { text as llmText } from "@/lib/openai";
import { getOpportunityContext, formatContext } from "./context";
import { getActiveThesis, formatThesis } from "./thesis";
import { eq } from "drizzle-orm";

export async function draftOutreach(opportunityId: string) {
  const ctx = await getOpportunityContext(opportunityId);
  const thesis = ctx.opportunity.thesisId
    ? await db
        .select()
        .from(theses)
        .where(eq(theses.id, ctx.opportunity.thesisId))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;
  const founderName = ctx.founders[0]?.fullName ?? "there";

  const draft = await llmText({
    system: `You draft short, specific, non-cringe cold outreach from a VC to a founder we sourced
(they have NOT applied). Goal: trigger a real application/conversation — not to invest. Reference a
concrete, real signal from the context (their repo/launch). 90 words max. No fabricated praise.`,
    user: `${formatThesis(thesis)}\n\n${formatContext(ctx)}\n\nWrite the outreach to ${founderName}.`,
  });

  const applyLink = `\n\nApply directly here: http://localhost:3000/apply?ref=${opportunityId}`;
  const finalDraft = draft + applyLink;

  const [row] = await db
    .insert(outreach)
    .values({ opportunityId, channel: "email", draftMessage: finalDraft, status: "drafted" })
    .returning();
  return row;
}
