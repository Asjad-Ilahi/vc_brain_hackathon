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
    return ok(rows);
  } catch (e) {
    return fail(errMessage(e));
  }
}
