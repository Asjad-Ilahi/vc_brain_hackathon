/**
 * Outbound sourcing — surface founders BEFORE they formally raise.
 *  - GitHub: developers shipping in-thesis (structured dev signal).
 *  - Web (Tavily): launches, HN, Product Hunt, papers matching the thesis.
 * Both converge into the SAME opportunity pipeline as inbound applications.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { sourcingChannels } from "@/db/schema";
import { githubSearchRepos, githubUser } from "@/lib/github";
import { tavilySearch } from "@/lib/tavily";
import { structured } from "@/lib/openai";
import { OutboundCandidateSchema } from "@/lib/schemas";
import { z } from "zod";
import { createOpportunity } from "./opportunity";
import { getActiveThesis, formatThesis, type Thesis } from "./thesis";

function githubQueryFromThesis(t: Thesis | null): string {
  // Focused query: the primary sector as a phrase + recency/quality filters.
  // (Concatenating every sector + notes yields an unsearchable string → 0 results.)
  const sector = t?.sectors?.[0] || "AI infrastructure";
  return `"${sector}" stars:>50 pushed:>2025-01-01`;
}

async function bumpChannel(name: string, found: number) {
  await db
    .insert(sourcingChannels)
    .values({ name, opportunitiesFound: found })
    .onConflictDoUpdate({
      target: sourcingChannels.name,
      set: {
        opportunitiesFound: sql`${sourcingChannels.opportunitiesFound} + ${found}`,
        updatedAt: new Date(),
      },
    });
}

export async function sourceFromGithub(limit = 5): Promise<string[]> {
  const thesis = await getActiveThesis();
  const repos = await githubSearchRepos(githubQueryFromThesis(thesis), Math.max(limit * 2, 8));
  const created: string[] = [];

  for (const repo of repos.slice(0, limit)) {
    let user;
    try {
      user = await githubUser(repo.owner.login);
    } catch {
      continue;
    }
    const { opportunityId } = await createOpportunity({
      source: "outbound",
      sourceChannel: "github",
      thesisId: thesis?.id ?? null,
      company: {
        name: repo.full_name.split("/")[1] ?? repo.full_name,
        domain: user.blog || null,
        sector: thesis?.sectors?.[0] ?? repo.language,
        stage: "pre-seed",
        geography: user.location,
        oneLiner: repo.description,
        description: `Open-source project ${repo.full_name} (${repo.stargazers_count}★, ${repo.language ?? "?"}).`,
      },
      founders: [
        {
          fullName: user.name || user.login,
          handleSeed: user.login,
          githubLogin: user.login,
          location: user.location,
          bio: user.bio,
          role: "maintainer",
          isColdStart: user.followers < 50,
        },
      ],
      signals: [
        {
          sourceType: "github",
          sourceUrl: repo.html_url,
          title: repo.full_name,
          rawText: `${repo.description ?? ""} — ${repo.stargazers_count} stars, language ${repo.language ?? "?"}, last push ${repo.pushed_at}. Owner ${user.login}: ${user.bio ?? ""} (${user.followers} followers, ${user.public_repos} public repos).`,
          tags: ["outbound", "github", repo.language ?? "code"].filter(Boolean) as string[],
          observedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
        },
      ],
    });
    created.push(opportunityId);
  }

  await bumpChannel("github", created.length);
  return created;
}

const WEB_EXTRACT_SYSTEM = `You extract likely early-stage founders/companies from web search
results that match a fund thesis. Only include real, specific companies with a discernible founder
signal. Return an empty list if nothing qualifies. Never invent details not present in the results.`;

export async function sourceFromWeb(customQuery?: string, limit = 4): Promise<string[]> {
  const thesis = await getActiveThesis();
  const query =
    customQuery ||
    `new ${thesis?.sectors?.[0] ?? "AI"} startups founders launches ${thesis?.geographies?.[0] ?? ""} 2025 Product Hunt Hacker News`;
  const { results, answer } = await tavilySearch(query, { maxResults: 8, depth: "advanced" });

  const evidence =
    (answer ? `Summary: ${answer}\n` : "") +
    results.map((r, i) => `[${i + 1}] ${r.title} — ${r.content.slice(0, 300)} (${r.url})`).join("\n");

  const { candidates } = await structured({
    schema: z.object({ candidates: z.array(OutboundCandidateSchema).default([]) }),
    schemaName: "OutboundCandidates",
    system: WEB_EXTRACT_SYSTEM,
    user: `${formatThesis(thesis)}\n\nWeb results:\n${evidence}\n\nExtract up to ${limit} in-thesis candidates.`,
  });

  const created: string[] = [];
  for (const c of candidates.slice(0, limit)) {
    const match = results.find((r) => c.companyName && r.title.toLowerCase().includes(c.companyName.toLowerCase().slice(0, 6)));
    const { opportunityId } = await createOpportunity({
      source: "outbound",
      sourceChannel: "web",
      thesisId: thesis?.id ?? null,
      company: {
        name: c.companyName,
        sector: c.sector,
        stage: "seed",
        geography: c.geography,
        oneLiner: c.oneLiner,
        description: c.whyRelevant,
      },
      founders: [
        { fullName: c.founderName, handleSeed: c.founderHandle, role: "founder", isColdStart: true },
      ],
      signals: [
        {
          sourceType: "web",
          sourceUrl: match?.url ?? null,
          title: c.companyName,
          rawText: `${c.oneLiner}. Why relevant: ${c.whyRelevant}. ${match ? `Source: ${match.content.slice(0, 300)}` : ""}`,
          tags: ["outbound", "web"],
        },
      ],
    });
    created.push(opportunityId);
  }

  await bumpChannel("web", created.length);
  return created;
}
