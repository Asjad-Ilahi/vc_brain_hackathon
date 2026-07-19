/** Activate — draft and send cold outreach to a sourced founder. */
import { db } from "@/db/client";
import { outreach, theses, opportunities } from "@/db/schema";
import { text as llmText } from "@/lib/openai";
import { getOpportunityContext, formatContext } from "./context";
import { formatThesis } from "./thesis";
import { env } from "@/lib/env";
import { eq } from "drizzle-orm";
import { sendMail } from "@/lib/mail";

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

  const applyLink = `\n\nApply directly here: ${env.appUrl}/apply?ref=${opportunityId}`;
  const finalDraft = draft + applyLink;

  const [row] = await db
    .insert(outreach)
    .values({ opportunityId, channel: "email", draftMessage: finalDraft, status: "drafted" })
    .returning();
  return row;
}

export async function sendOutreach(outreachId: string, recipientEmail: string, customMessage: string) {
  const [row] = await db.select().from(outreach).where(eq(outreach.id, outreachId)).limit(1);
  if (!row) throw new Error("Outreach draft not found");

  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, row.opportunityId)).limit(1);
  if (!opp) throw new Error("Opportunity not found");

  // Send email using SMTP
  const { sent } = await sendMail(
    recipientEmail,
    `VC Opportunity Inquiry`,
    customMessage
  );

  // Update outreach status
  await db
    .update(outreach)
    .set({
      draftMessage: customMessage,
      status: sent ? "sent" : "failed",
      sentAt: new Date(),
    })
    .where(eq(outreach.id, outreachId));

  // Update opportunity status to show transition to Activated
  await db
    .update(opportunities)
    .set({
      status: "activated",
      applicantEmail: recipientEmail, // save the contact email on the opportunity
    })
    .where(eq(opportunities.id, row.opportunityId));

  return { ...row, status: sent ? "sent" : "failed", sentAt: new Date() };
}
