import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { theses } from "@/db/schema";
import { userFromRequest } from "@/lib/auth";
import { ok } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return ok({ user: null, onboarded: false });

  const activeThesis = await db
    .select({ id: theses.id })
    .from(theses)
    .where(and(eq(theses.isActive, true), eq(theses.userId, user.id)))
    .limit(1);

  return ok({ user, onboarded: activeThesis.length > 0 });
}
