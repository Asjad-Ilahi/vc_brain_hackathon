import {
  sourceFromGithub,
  sourceFromArxiv,
  sourceFromHackerNews,
  sourceFromWeb,
  sourceFromProductHunt,
  sourceFromHackathons,
  sourceFromPatents,
  sourceFromAccelerators,
} from "@/lib/services/sourcing";
import { userFromRequest } from "@/lib/auth";
import { ok, fail, errMessage } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const user = await userFromRequest(req);
    if (!user) return fail("Unauthorized", 401);

    const { kind } = await params;
    const b = await req.json().catch(() => ({}));
    const limit = Math.min(Number(b?.limit) || 4, 8);

    let created: string[] = [];
    if (kind === "github") {
      created = await sourceFromGithub(user.id, limit);
    } else if (kind === "arxiv") {
      created = await sourceFromArxiv(user.id, limit);
    } else if (kind === "hackernews") {
      created = await sourceFromHackerNews(user.id, limit);
    } else if (kind === "web") {
      created = await sourceFromWeb(user.id, undefined, limit);
    } else if (kind === "producthunt") {
      created = await sourceFromProductHunt(user.id, limit);
    } else if (kind === "hackathons") {
      created = await sourceFromHackathons(user.id, limit);
    } else if (kind === "patents") {
      created = await sourceFromPatents(user.id, limit);
    } else if (kind === "accelerators") {
      created = await sourceFromAccelerators(user.id, limit);
    } else {
      return fail(`Unknown sourcing channel: ${kind}`, 400);
    }

    return ok({ created });
  } catch (e) {
    return fail(errMessage(e));
  }
}
