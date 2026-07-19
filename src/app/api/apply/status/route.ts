/**
 * Public founder status lookup. Keyed by the opaque `publicRef` handed to the
 * applicant on submit (a capability token — knowing the ref is the only auth).
 * Returns a SANITIZED view: no internal axis scores, memos, or conviction —
 * only what the brief promises a founder within 24h (progress + human decision
 * + feedback). No session required (whitelisted in proxy.ts).
 */
import { db } from "@/db/client";
import { opportunities, companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ref = (new URL(req.url).searchParams.get("ref") ?? "").trim();
    if (!ref) return fail("Missing application reference.", 400);

    const rows = await db
      .select({
        company: companies.name,
        submittedAt: opportunities.createdAt,
        deadlineAt: opportunities.deadlineAt,
        status: opportunities.status,
        screenResult: opportunities.screenResult,
        decision: opportunities.decision,
        decisionNote: opportunities.decisionNote,
      })
      .from(opportunities)
      .innerJoin(companies, eq(opportunities.companyId, companies.id))
      .where(eq(opportunities.publicRef, ref))
      .limit(1);

    if (rows.length === 0)
      return fail("We couldn't find an application with that reference.", 404);
    const r = rows[0];

    // Only the HUMAN decision is surfaced as an outcome — an automated screen
    // reject never tells a founder "no" on its own (one human in the loop).
    return ok({
      company: r.company,
      submittedAt: r.submittedAt,
      deadlineAt: r.deadlineAt,
      screened: r.screenResult != null,
      decision: r.decision, // 'invest' | 'watch' | 'pass' | null
      feedback: r.decisionNote ?? null,
    });
  } catch (e) {
    return fail(errMessage(e));
  }
}
