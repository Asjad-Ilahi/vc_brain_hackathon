/**
 * Outbound sourcing — surface founders BEFORE they raise, across multiple modes:
 *   GitHub (dev signal) · Hacker News (launches/Show HN) · arXiv (research) · Web (Tavily).
 * Every candidate gets a deterministic conviction score at ingestion, and all
 * converge into the SAME opportunity pipeline as inbound applications.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { sourcingChannels } from "@/db/schema";
import { githubSearchRepos, githubUser } from "@/lib/github";
import { tavilySearch } from "@/lib/tavily";
import { structured } from "@/lib/openai";
import { OutboundCandidateSchema } from "@/lib/schemas";
import { z } from "zod";
import { withRetry } from "@/lib/utils";
import { createOpportunity } from "./opportunity";
import { getActiveThesis, formatThesis, type Thesis } from "./thesis";
import { computeConviction } from "./conviction";

function daysAgo(iso: string | number | null | undefined): number | undefined {
  if (iso == null) return undefined;
  const t = typeof iso === "number" ? iso * 1000 : Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function matches(text: string | null | undefined, list: string[] | undefined): boolean {
  if (!text || !list?.length) return false;
  const t = text.toLowerCase();
  return list.some((s) => s && t.includes(s.toLowerCase()));
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

// ---------------------------------------------------------------- GitHub -----
function githubQueryFromThesis(t: Thesis | null): string {
  const sector = t?.sectors?.[0] || "AI infrastructure";
  return `"${sector}" stars:>50 pushed:>2025-01-01`;
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
    const conviction = computeConviction({
      githubStars: repo.stargazers_count,
      githubFollowers: user.followers,
      githubPushedDaysAgo: daysAgo(repo.pushed_at),
      githubRepos: user.public_repos,
      thesisSectorMatch: matches(repo.description, thesis?.sectors),
      thesisGeoMatch: matches(user.location, thesis?.geographies),
    });
    const { opportunityId } = await createOpportunity({
      source: "outbound",
      sourceChannel: "github",
      thesisId: thesis?.id ?? null,
      convictionScore: conviction.score,
      convictionReason: conviction.reason,
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
          rawText: `${repo.description ?? ""} — ${repo.stargazers_count} stars, ${repo.language ?? "?"}, last push ${repo.pushed_at}. Owner ${user.login}: ${user.bio ?? ""} (${user.followers} followers).`,
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

// ------------------------------------------------------------ Hacker News -----
type HNHit = {
  title: string;
  url: string | null;
  author: string;
  points: number | null;
  num_comments: number | null;
  objectID: string;
  created_at_i: number | null;
};

function companyFromHNTitle(title: string): string {
  const stripped = title.replace(/^(show|launch)\s+hn:?\s*/i, "").trim();
  const m = stripped.match(/^([^–\-—:|(]{2,60})(?:\s*[–\-—:|(]|$)/);
  const name = m ? m[1].trim() : stripped;
  return (name.length >= 2 && !/^\d+$/.test(name) ? name : stripped).slice(0, 60);
}

export async function sourceFromHackerNews(limit = 4): Promise<string[]> {
  const thesis = await getActiveThesis();
  const q = encodeURIComponent(thesis?.sectors?.[0] || "AI");
  // Show HN only = actual product launches by a founder (not general articles).
  const url = `https://hn.algolia.com/api/v1/search?query=${q}&tags=show_hn&hitsPerPage=${Math.max(limit * 3, 12)}`;
  const data = await withRetry(
    async () => {
      const res = await fetch(url, { headers: { "User-Agent": "vc-brain" } });
      if (!res.ok) throw new Error(`HN ${res.status}`);
      return (await res.json()) as { hits: HNHit[] };
    },
    { label: "hn:search", retries: 2 }
  );

  const created: string[] = [];
  for (const hit of (data.hits ?? []).filter((h) => h.title && h.author).slice(0, limit)) {
    const conviction = computeConviction({
      hnPoints: hit.points ?? 0,
      hnComments: hit.num_comments ?? 0,
      thesisSectorMatch: matches(hit.title, thesis?.sectors),
    });
    const company = companyFromHNTitle(hit.title);
    const { opportunityId } = await createOpportunity({
      source: "outbound",
      sourceChannel: "hackernews",
      thesisId: thesis?.id ?? null,
      convictionScore: conviction.score,
      convictionReason: conviction.reason,
      company: {
        name: company,
        sector: thesis?.sectors?.[0] ?? null,
        stage: "pre-seed",
        oneLiner: hit.title,
        description: `Surfaced on Hacker News (${hit.points ?? 0} points, ${hit.num_comments ?? 0} comments).`,
      },
      founders: [{ fullName: hit.author, handleSeed: hit.author, role: "founder", isColdStart: true }],
      signals: [
        {
          sourceType: "hackernews",
          sourceUrl: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          title: hit.title,
          rawText: `HN post "${hit.title}" by ${hit.author} — ${hit.points ?? 0} points, ${hit.num_comments ?? 0} comments.`,
          tags: ["outbound", "hackernews"],
          observedAt: hit.created_at_i ? new Date(hit.created_at_i * 1000) : null,
        },
      ],
    });
    created.push(opportunityId);
  }
  await bumpChannel("hackernews", created.length);
  return created;
}

// ------------------------------------------------------------------ arXiv -----
function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

export async function sourceFromArxiv(limit = 3): Promise<string[]> {
  const thesis = await getActiveThesis();
  const q = encodeURIComponent(thesis?.sectors?.[0] || "machine learning systems");
  const url = `http://export.arxiv.org/api/query?search_query=all:${q}&sortBy=submittedDate&sortOrder=descending&max_results=${limit + 2}`;
  const xml = await withRetry(
    async () => {
      const res = await fetch(url, { headers: { "User-Agent": "vc-brain" } });
      if (!res.ok) throw new Error(`arXiv ${res.status}`);
      return await res.text();
    },
    { label: "arxiv:search", retries: 2 }
  );

  const entries = xml.split("<entry>").slice(1).map((e) => e.split("</entry>")[0]);
  const created: string[] = [];
  for (const e of entries.slice(0, limit)) {
    const title = tag(e, "title");
    const author = tag(e, "name");
    const id = tag(e, "id");
    const summary = tag(e, "summary");
    const published = tag(e, "published");
    if (!title || !author) continue;
    const conviction = computeConviction({
      hasArxivPaper: true,
      arxivDaysAgo: daysAgo(published),
      thesisSectorMatch: matches(`${title} ${summary}`, thesis?.sectors),
    });
    const { opportunityId } = await createOpportunity({
      source: "outbound",
      sourceChannel: "arxiv",
      thesisId: thesis?.id ?? null,
      convictionScore: conviction.score,
      convictionReason: conviction.reason,
      company: {
        name: `${author.split(" ").slice(-1)[0]} et al. (research)`,
        sector: thesis?.sectors?.[0] ?? null,
        stage: "pre-idea",
        oneLiner: title,
        description: (summary ?? "").slice(0, 300),
      },
      founders: [{ fullName: author, handleSeed: author, role: "researcher", isColdStart: true }],
      signals: [
        {
          sourceType: "arxiv",
          sourceUrl: id,
          title,
          rawText: `arXiv paper "${title}" by ${author}. ${(summary ?? "").slice(0, 400)}`,
          tags: ["outbound", "arxiv", "research"],
          observedAt: published ? new Date(published) : null,
        },
      ],
    });
    created.push(opportunityId);
  }
  await bumpChannel("arxiv", created.length);
  return created;
}

// -------------------------------------------------------------------- Web -----
const WEB_EXTRACT_SYSTEM = `You extract likely early-stage founders/companies from web search
results that match a fund thesis. Only include real, specific companies with a discernible founder
signal. Return an empty list if nothing qualifies. Never invent details not present in the results.`;

export async function sourceFromWeb(customQuery?: string, limit = 4): Promise<string[]> {
  const thesis = await getActiveThesis();
  const query =
    customQuery ||
    `new ${thesis?.sectors?.[0] ?? "AI"} startups founders launches ${thesis?.geographies?.[0] ?? ""} 2025`;
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
    const conviction = computeConviction({
      thesisSectorMatch: matches(c.sector, thesis?.sectors),
      thesisGeoMatch: matches(c.geography, thesis?.geographies),
    });
    const { opportunityId } = await createOpportunity({
      source: "outbound",
      sourceChannel: "web",
      thesisId: thesis?.id ?? null,
      convictionScore: conviction.score,
      convictionReason: conviction.reason,
      company: {
        name: c.companyName,
        sector: c.sector,
        stage: "seed",
        geography: c.geography,
        oneLiner: c.oneLiner,
        description: c.whyRelevant,
      },
      founders: [{ fullName: c.founderName, handleSeed: c.founderHandle, role: "founder", isColdStart: true }],
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

// --------------------------------------------------------- Multi-modal sweep --
export async function sourceAll(): Promise<Record<string, number>> {
  const [gh, hn, ax, web] = await Promise.allSettled([
    sourceFromGithub(4),
    sourceFromHackerNews(4),
    sourceFromArxiv(3),
    sourceFromWeb(undefined, 3),
  ]);
  const count = (r: PromiseSettledResult<string[]>) => (r.status === "fulfilled" ? r.value.length : 0);
  return { github: count(gh), hackernews: count(hn), arxiv: count(ax), web: count(web) };
}
