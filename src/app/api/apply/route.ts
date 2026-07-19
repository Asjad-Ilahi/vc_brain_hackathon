/**
 * Inbound application. Minimum bar: deck + company name.
 * Accepts multipart/form-data (deck as PDF/image file) OR JSON ({companyName, text}).
 * Flow: parse deck -> build company/founders/signals -> create opportunity -> screen.
 */
import { db } from "@/db/client";
import { opportunities, theses, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseDeck, pdfToText } from "@/lib/services/deck";
import { createOpportunity } from "@/lib/services/opportunity";
import { screenOpportunity } from "@/lib/services/screen";
import { getActiveThesis } from "@/lib/services/thesis";
import { userFromRequest } from "@/lib/auth";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    let companyName = "";
    let deckText: string | undefined;
    let imageDataUrl: string | undefined;

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      companyName = String(form.get("companyName") ?? "");
      const pasted = form.get("text");
      if (pasted) deckText = String(pasted);
      const file = form.get("deck");
      if (file && typeof file !== "string") {
        const f = file as File;
        const buf = await f.arrayBuffer();
        if (f.type.includes("pdf")) {
          deckText = `${deckText ?? ""}\n${await pdfToText(buf)}`.trim();
        } else if (f.type.startsWith("image/")) {
          const b64 = Buffer.from(buf).toString("base64");
          imageDataUrl = `data:${f.type};base64,${b64}`;
        }
      }
    } else {
      const b = await req.json();
      companyName = String(b?.companyName ?? "");
      deckText = b?.text;
    }

    if (!companyName && !deckText && !imageDataUrl)
      return fail("Provide at least a company name and a deck (file or text).", 400);

    const url = new URL(req.url);
    const ref = url.searchParams.get("ref") || undefined;

    const user = await userFromRequest(req).catch(() => null);
    let thesisId: string | null = null;

    if (user) {
      const thesis = await getActiveThesis(user.id);
      thesisId = thesis?.id ?? null;
    } else {
      // Public submission: use the first active thesis globally
      const activeThesis = await db
        .select({ id: theses.id })
        .from(theses)
        .where(eq(theses.isActive, true))
        .limit(1);
      if (activeThesis.length > 0) {
        thesisId = activeThesis[0].id;
      }
    }

    // 1) Intake -> structured spec
    const extraction = await parseDeck({ companyName, text: deckText, imageDataUrl });

    // 2) Create opportunity (Memory ingestion happens inside)
    const { opportunityId, returningFounders } = await createOpportunity({
      existingOpportunityId: ref,
      source: "inbound",
      sourceChannel: "application",
      thesisId,
      company: {
        name: extraction.companyName || companyName || "Unnamed",
        sector: extraction.sector,
        stage: extraction.stage,
        geography: extraction.geography,
        oneLiner: extraction.oneLiner,
        description: [extraction.problem, extraction.product].filter(Boolean).join(" | ") || null,
      },
      founders: extraction.founders.map((f) => ({
        fullName: f.name,
        handleSeed: f.github || f.name,
        githubLogin: f.github,
        linkedinUrl: f.linkedin,
        twitterHandle: f.twitter,
        bio: f.background,
        role: f.role,
        isColdStart: !f.github && !f.linkedin,
      })),
      signals: [
        {
          sourceType: "deck",
          title: `${extraction.companyName} pitch deck`,
          rawText: [
            extraction.oneLiner,
            extraction.problem,
            extraction.product,
            ...extraction.claims.map((c) => `[${c.category}] ${c.text}`),
          ]
            .filter(Boolean)
            .join("\n"),
          extractedJson: extraction,
          tags: ["inbound", "deck"],
        },
      ],
    });

    // 3) Fast first-pass screen
    const screen = await screenOpportunity(opportunityId);
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);

    return ok({ opportunityId, extraction, screen, returningFounders, opportunity: opp });
  } catch (e) {
    return fail(errMessage(e));
  }
}
