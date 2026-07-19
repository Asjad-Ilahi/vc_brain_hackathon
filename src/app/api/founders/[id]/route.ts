/** The living profile: founder + score trajectory + every venture + every signal. */
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { founders, opportunityFounders, opportunities, companies, signals } from "@/db/schema";
import { getFounderScoreHistory } from "@/lib/services/ingest";
import { ok, fail, errMessage } from "@/lib/api";
import { githubUser, githubUserEmailFromCommits } from "@/lib/github";
import { tavilySearch } from "@/lib/tavily";
import { structured } from "@/lib/openai";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [founder] = await db.select().from(founders).where(eq(founders.id, id)).limit(1);
    if (!founder) return fail("not found", 404);
    const history = await getFounderScoreHistory(id);

    const links = await db.select().from(opportunityFounders).where(eq(opportunityFounders.founderId, id));
    const oppIds = links.map((l) => l.opportunityId);
    const opps = oppIds.length
      ? await db.select().from(opportunities).where(inArray(opportunities.id, oppIds))
      : [];

    let email: string | null = opps.find((o) => o.applicantEmail)?.applicantEmail ?? null;

    if (!email && oppIds.length > 0) {
      const ghHandle = founder.githubLogin || (founder.canonicalHandle.match(/^[a-zA-Z0-9-]{1,39}$/) ? founder.canonicalHandle : null);
      if (ghHandle) {
        try {
          const user = await githubUser(ghHandle);
          const foundEmail = user.email || (await githubUserEmailFromCommits(ghHandle));
          if (foundEmail) {
            email = foundEmail;
            await db
              .update(opportunities)
              .set({ applicantEmail: foundEmail })
              .where(eq(opportunities.id, oppIds[0]));
          }
        } catch (e) {
          console.error("Failed to find email via GitHub:", e);
        }
      }

      if (!email) {
        try {
          const { results } = await tavilySearch(`"${founder.fullName}" contact OR email OR "reach me" OR "@"`, { maxResults: 3 });
          if (results.length > 0) {
            const textSnippets = results.map(r => `[Page: ${r.title}] Content: ${r.content}`).join("\n\n");
            const extracted = await structured({
              schema: z.object({ email: z.string().nullable().describe("A valid email address for this person, or null if none is present") }),
              schemaName: "EmailExtraction",
              system: "You extract a single contact email for the specified person from the web search results. If none is found, return null.",
              user: `Person name: ${founder.fullName}\n\nSearch Results:\n${textSnippets}`,
            });
            if (extracted.email) {
              email = extracted.email.trim();
              await db
                .update(opportunities)
                .set({ applicantEmail: email })
                .where(eq(opportunities.id, oppIds[0]));
            }
          }
        } catch (e) {
          console.error("Failed to find email via Tavily:", e);
        }
      }
    }

    const comps = opps.length
      ? await db.select().from(companies).where(inArray(companies.id, opps.map((o) => o.companyId)))
      : [];
    const compById = new Map(comps.map((c) => [c.id, c]));
    const ventures = opps
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((o) => ({
        opportunityId: o.id,
        company: compById.get(o.companyId)?.name ?? "Unknown",
        oneLiner: compById.get(o.companyId)?.oneLiner ?? null,
        sector: compById.get(o.companyId)?.sector ?? null,
        source: o.source,
        sourceChannel: o.sourceChannel,
        status: o.status,
        decision: o.decision,
        convictionScore: o.convictionScore,
        createdAt: new Date(o.createdAt).toISOString(),
      }));

    const sigs = await db
      .select({
        id: signals.id,
        sourceType: signals.sourceType,
        sourceUrl: signals.sourceUrl,
        title: signals.title,
        rawText: signals.rawText,
        ingestedAt: signals.ingestedAt,
      })
      .from(signals)
      .where(eq(signals.founderId, id))
      .orderBy(desc(signals.ingestedAt))
      .limit(20);

    return ok({ founder: { ...founder, email }, history, ventures, signals: sigs });
  } catch (e) {
    return fail(errMessage(e));
  }
}
