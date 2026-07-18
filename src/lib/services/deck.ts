/**
 * Deck / document intake — turns a pitch deck (PDF, image, or pasted text) into
 * the same structured job spec regardless of path. This is the direct attack on
 * the "sight-unseen" incomplete-intake problem.
 */
import { extractText, getDocumentProxy } from "unpdf";
import { structured, type ContentPart } from "@/lib/openai";
import { DeckExtractionSchema, type DeckExtraction } from "@/lib/schemas";

export async function pdfToText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

const SYSTEM = `You are an intake analyst for a venture fund. Extract a complete, structured
specification from a founder's pitch materials. Extract ONLY what is present — never invent
traction, revenue, team members, or metrics. If a field is absent, use null. List each concrete
factual assertion (traction, revenue, team, market, product) as a separate claim so it can be
verified later.`;

export async function parseDeck(input: {
  companyName?: string;
  text?: string;
  imageDataUrl?: string;
}): Promise<DeckExtraction> {
  const userParts: ContentPart[] = [];
  const intro = input.companyName
    ? `Company name (provided by applicant): ${input.companyName}\n\n`
    : "";
  userParts.push({
    type: "text",
    text:
      `${intro}Extract the structured spec from the following pitch materials.` +
      (input.text ? `\n\n--- DECK TEXT ---\n${input.text.slice(0, 20000)}` : ""),
  });
  if (input.imageDataUrl) {
    userParts.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  }

  return structured({
    schema: DeckExtractionSchema,
    schemaName: "DeckExtraction",
    system: SYSTEM,
    user: userParts,
  });
}
