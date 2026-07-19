/** Activate — draft and send cold outreach to a sourced founder. */
import { db } from "@/db/client";
import { outreach, theses, opportunities } from "@/db/schema";
import { text as llmText, structured } from "@/lib/openai";
import { getOpportunityContext, formatContext } from "./context";
import { formatThesis } from "./thesis";
import { env } from "@/lib/env";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendMail } from "@/lib/mail";
import { tavilySearch } from "@/lib/tavily";
import { githubUserEmailFromCommits } from "@/lib/github";
import { founderDisplayName } from "@/lib/utils";

/**
 * Find the founder's contact email so the INVESTOR never has to. Tries public
 * GitHub commit emails first, then a broad web search + extraction. Returns null
 * only when no public email genuinely exists (then the UI offers their profiles).
 * Fail-soft — a lookup failure never blocks the outreach draft.
 */
async function resolveFounderEmail(name: string | null, githubLogin: string | null): Promise<string | null> {
  const bad = (e: string) => /noreply|no-reply|^(info|hello|support|contact|admin|team|sales|press)@/.test(e) || /\.(png|jpg|svg)$/.test(e);
  if (githubLogin) {
    try {
      const e = (await githubUserEmailFromCommits(githubLogin))?.trim().toLowerCase();
      if (e && e.includes("@") && !bad(e)) return e;
    } catch { /* ignore */ }
  }
  if (name && !name.startsWith("@")) {
    try {
      const { results } = await tavilySearch(`"${name}" email OR contact OR "reach me"`, { maxResults: 4 });
      if (results.length) {
        const text = results.map((r) => `[${r.title}] ${r.content}`).join("\n\n").slice(0, 4000);
        const { email } = await structured({
          schema: z.object({ email: z.string().nullable().describe("A single public contact email for this exact person, or null. Never a generic info@/noreply address.") }),
          schemaName: "FounderEmail",
          system: "Extract one public contact email for the named person from the evidence, or null if none is clearly theirs.",
          user: `Person: ${name}\n\n${text}`,
        });
        const e = (email || "").trim().toLowerCase();
        if (e && e.includes("@") && !bad(e)) return e;
      }
    } catch { /* ignore */ }
  }
  return null;
}

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
  // Only greet by a REAL name — never "Hi Unknown" or "Hi @handle". Falls back
  // to "there" when we haven't resolved a real person.
  const f0 = ctx.founders[0];
  const display = f0 ? founderDisplayName(f0.fullName, f0.githubLogin) : null;
  const founderName = display && !display.startsWith("@") ? display : "there";

  // The system finds the recipient — not the investor. Resolve + store the email
  // here so the outreach console shows it pre-filled the moment the draft is ready.
  if (!ctx.opportunity.applicantEmail) {
    const email = await resolveFounderEmail(f0?.fullName ?? display, f0?.githubLogin ?? null);
    if (email) {
      await db.update(opportunities).set({ applicantEmail: email }).where(eq(opportunities.id, opportunityId));
    }
  }

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
