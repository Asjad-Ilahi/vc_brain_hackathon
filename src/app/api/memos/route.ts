/** Memo index — every auto-drafted memo, newest first, with its decision state. */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memos, opportunities, companies } from "@/db/schema";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: memos.id,
        opportunityId: memos.opportunityId,
        company: companies.name,
        oneLiner: companies.oneLiner,
        summary: memos.summary,
        recommendation: memos.recommendation,
        decision: opportunities.decision,
        decidedAt: opportunities.decidedAt,
        deadlineAt: opportunities.deadlineAt,
        createdAt: memos.createdAt,
      })
      .from(memos)
      .innerJoin(opportunities, eq(memos.opportunityId, opportunities.id))
      .innerJoin(companies, eq(opportunities.companyId, companies.id))
      .orderBy(desc(memos.createdAt));

    // Deduplicate by opportunityId, keeping the first occurrence (newest due to desc order)
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      if (seen.has(r.opportunityId)) return false;
      seen.add(r.opportunityId);
      return true;
    });

    return ok(deduped);
  } catch (e) {
    return fail(errMessage(e));
  }
}
