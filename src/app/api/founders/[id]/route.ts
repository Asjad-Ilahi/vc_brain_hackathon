/** The living profile: founder + score trajectory + every venture + every signal. */
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { founders, opportunityFounders, opportunities, companies, signals } from "@/db/schema";
import { getFounderScoreHistory } from "@/lib/services/ingest";
import { ok, fail, errMessage } from "@/lib/api";

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

    return ok({ founder, history, ventures, signals: sigs });
  } catch (e) {
    return fail(errMessage(e));
  }
}
