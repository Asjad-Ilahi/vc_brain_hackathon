/**
 * Outbound sourcing — surface founders BEFORE they raise, across the channels
 * the brief names: GitHub (dev signal) · Hacker News (launches) · arXiv (papers)
 * · patents · hackathons · accelerator cohorts · ProductHunt · open web.
 *
 * Every candidate gets a deterministic conviction score at ingestion; re-scans
 * ENRICH existing opportunities (dedupe) instead of duplicating them; and
 * candidates crossing the thesis conviction threshold trigger assessment on
 * their own (auto-screen) — no human click required to start the funnel.
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
import { getActiveThesis, formatThesis, getThesisProfile, type Thesis } from "./thesis";
import { computeConviction, matchesThesisTerms } from "./conviction";
import { screenOpportunity } from "./screen";
import { listOpportunities } from "./list";

export const ALL_CHANNELS = [
  "github",
  "hackernews",
  "arxiv",
  "producthunt",
  "hackathons",
  "patents",
  "accelerators",
  "web",
] as const;
export type Channel = (typeof ALL_CHANNELS)[number];

function daysAgo(iso: string | number | null | undefined): number | undefined {
  if (iso == null) return undefined;
  const t = typeof iso === "number" ? iso * 1000 : Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return Math.floor((Date.now() - t) / 86_400_000);
}

// Token-overlap matching — real titles rarely contain the sector phrase verbatim.
const matches = matchesThesisTerms;

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

/** Rotate through the thesis sectors so successive sweeps explore, not repeat. */
function pickSector(t: Thesis | null, fallback: string): string {
  const list = t?.sectors?.length ? t.sectors : [fallback];
  return list[Math.floor(Math.random() * list.length)] ?? fallback;
}

// ---------------------------------------------------------------- GitHub -----
/**
 * Discovery band, not a fame contest: young repos (≤ ~18 months) with EARLY
 * traction (30–2500★), individually owned, sorted by recent activity. A repo
 * with 100k★ or an org owner (DeepSeek, Microsoft) is not a founder we can
 * back — it's a company that already won.
 */
function githubQueryFromThesis(t: Thesis | null): string {
  const sector = pickSector(t, "AI infrastructure");
  const cutoff = new Date(Date.now() - 550 * 86_400_000).toISOString().slice(0, 10);
  return `"${sector}" stars:30..2500 created:>${cutoff} fork:false pushed:>2025-01-01`;
}

export async function sourceFromGithub(limit = 5): Promise<string[]> {
  const thesis = await getActiveThesis();
  const repos = await githubSearchRepos(githubQueryFromThesis(thesis), Math.max(limit * 3, 12));
  const created: string[] = [];

  for (const repo of repos) {
    if (created.length >= limit) break;
    // Org-owned repos are companies, not discoverable founders.
    if (repo.owner.type === "Organization") continue;
    let user;
    try {
      user = await githubUser(repo.owner.login);
    } catch {
      continue;
    }
    if (user.type === "Organization") continue;
    // Off-thesis repos are never shown — match against the whole description.
    if (!matches(`${repo.full_name} ${repo.description ?? ""} ${repo.language ?? ""}`, thesis?.sectors)) continue;
    const conviction = computeConviction({
      githubStars: repo.stargazers_count,
      githubFollowers: user.followers,
      githubPushedDaysAgo: daysAgo(repo.pushed_at),
      githubRepos: user.public_repos,
      thesisSectorMatch: matches(repo.description, thesis?.sectors),
      thesisGeoMatch: matches(user.location, thesis?.geographies),
    });
    const { opportunityId, deduped } = await createOpportunity({
      source: "outbound",
      sourceChannel: "github",
      thesisId: thesis?.id ?? null,
      convictionScore: conviction.score,
      convictionReason: conviction.reason,
      company: {
        name: repo.full_name.split("/")[1] ?? repo.full_name,
        domain: user.blog || null,
        sector: thesis?.sectors?.[0] ?? repo.language,
        // No stage asserted — funding stage is unknown until evidenced.
        stage: null,
        geography: user.location,
        oneLiner: repo.description,
        description: `Open-source project ${repo.full_name} (${repo.stargazers_count}★, ${repo.language ?? "?"}) — pre-company signal, no known raise.`,
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
    if (!deduped) created.push(opportunityId);
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
  const q = encodeURIComponent(pickSector(thesis, "AI"));
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
  for (const hit of (data.hits ?? []).filter((h) => h.title && h.author)) {
    if (created.length >= limit) break;
    if (!matches(hit.title, thesis?.sectors)) continue; // off-thesis: never shown
    const conviction = computeConviction({
      hnPoints: hit.points ?? 0,
      hnComments: hit.num_comments ?? 0,
      thesisSectorMatch: matches(hit.title, thesis?.sectors),
    });
    const company = companyFromHNTitle(hit.title);
    const { opportunityId, deduped } = await createOpportunity({
      source: "outbound",
      sourceChannel: "hackernews",
      thesisId: thesis?.id ?? null,
      convictionScore: conviction.score,
      convictionReason: conviction.reason,
      company: {
        name: company,
        sector: thesis?.sectors?.[0] ?? null,
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
    if (!deduped) created.push(opportunityId);
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
  const q = encodeURIComponent(pickSector(thesis, "machine learning systems"));
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
    if (!matches(`${title} ${summary ?? ""}`, thesis?.sectors)) continue; // off-thesis: never shown
    const conviction = computeConviction({
      hasArxivPaper: true,
      arxivDaysAgo: daysAgo(published),
      thesisSectorMatch: matches(`${title} ${summary}`, thesis?.sectors),
    });
    const { opportunityId, deduped } = await createOpportunity({
      source: "outbound",
      sourceChannel: "arxiv",
      thesisId: thesis?.id ?? null,
      convictionScore: conviction.score,
      convictionReason: conviction.reason,
      company: {
        name: `${author.split(" ").slice(-1)[0]} et al. (research)`,
        sector: thesis?.sectors?.[0] ?? null,
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
    if (!deduped) created.push(opportunityId);
  }
  await bumpChannel("arxiv", created.length);
  return created;
}

// ------------------------------------------- Web-extract channel family -------
// One shared path: Tavily search with a channel-specific query, LLM extracts
// real candidates, each lands in the same funnel with a conviction score.
const WEB_EXTRACT_SYSTEM = `You extract UNDISCOVERED early-stage founders/companies from web
search results for a venture fund that invests BEFORE anyone else notices. Hard rules:
- EXCLUDE established companies: anything already famous, institutionally funded, or scaled
  (Cohere, OpenAI, Anthropic, Mistral, Perplexity, Hugging Face, Databricks and the like). If you
  recognize the name, or are unsure whether it is established, set isEstablished=true.
- Set thesisFit=true ONLY when the candidate clearly fits the fund's sectors/stages/geographies.
- Set stage ONLY if the results explicitly state it — never infer or guess a funding stage.
- Only include real, specific companies/projects with a discernible founder signal (creator,
  inventor, maintainer). Return an empty list if nothing qualifies. Never invent details.`;

/** Belt-and-braces: never surface household names, whatever the extractor says. */
const ESTABLISHED_DENYLIST = [
  "cohere", "openai", "anthropic", "mistral", "perplexity", "deepseek", "hugging face",
  "huggingface", "databricks", "scale ai", "stability ai", "runway", "midjourney",
  "together ai", "groq", "xai", "microsoft", "google", "meta", "nvidia", "amazon", "apple",
  "ibm", "salesforce", "adobe", "bytedance", "tencent", "baidu", "alibaba",
];
function isDenylisted(name: string): boolean {
  const n = name.toLowerCase();
  return ESTABLISHED_DENYLIST.some((d) => n === d || n.includes(d));
}

type WebChannelSpec = {
  channel: Channel;
  sourceType: string;
  query: (t: Thesis | null) => string;
  candidateHint: string;
  extraTags: string[];
  signalPrefix: string;
};

const WEB_CHANNELS: Record<string, WebChannelSpec> = {
  web: {
    channel: "web",
    sourceType: "web",
    query: (t) =>
      `new ${pickSector(t, "AI")} startups founders launches ${t?.geographies?.[0] ?? ""} 2026`,
    candidateHint: "General web scan — prefer companies that have not announced a funding round.",
    extraTags: [],
    signalPrefix: "Web signal",
  },
  producthunt: {
    channel: "producthunt",
    sourceType: "producthunt",
    query: (t) => `site:producthunt.com ${pickSector(t, "AI")} launch maker 2026`,
    candidateHint: "These are Product Hunt launches — the maker who shipped the product is the founder signal.",
    extraTags: ["launch"],
    signalPrefix: "Product Hunt launch",
  },
  hackathons: {
    channel: "hackathons",
    sourceType: "hackathon",
    query: (t) => `devpost hackathon winner ${pickSector(t, "AI")} project 2025 2026`,
    candidateHint:
      "These are hackathon results — winners/builders of standout projects are pre-track-record founder signals (exactly the cold-start case the fund wants early).",
    extraTags: ["hackathon", "cold-start"],
    signalPrefix: "Hackathon win",
  },
  patents: {
    channel: "patents",
    sourceType: "patent",
    query: (t) => `site:patents.google.com ${pickSector(t, "machine learning")} 2025 filed`,
    candidateHint: "These are patent filings — the inventor is the founder signal; the filing is the technical moat evidence.",
    extraTags: ["patent", "ip"],
    signalPrefix: "Patent filing",
  },
  accelerators: {
    channel: "accelerators",
    sourceType: "accelerator",
    query: (t) =>
      `"Y Combinator" OR "Techstars" 2026 batch ${pickSector(t, "AI")} startup founders announced`,
    candidateHint: "These are accelerator cohort mentions — companies in a current batch, before their demo-day raise.",
    extraTags: ["accelerator", "cohort"],
    signalPrefix: "Accelerator cohort",
  },
};

async function sourceViaWebExtract(spec: WebChannelSpec, limit: number, customQuery?: string): Promise<string[]> {
  const thesis = await getActiveThesis();
  const query = customQuery || spec.query(thesis);
  const { results, answer } = await tavilySearch(query, { maxResults: 8, depth: "advanced" });

  const evidence =
    (answer ? `Summary: ${answer}\n` : "") +
    results.map((r, i) => `[${i + 1}] ${r.title} — ${r.content.slice(0, 300)} (${r.url})`).join("\n");

  const { candidates } = await structured({
    schema: z.object({ candidates: z.array(OutboundCandidateSchema).default([]) }),
    schemaName: "OutboundCandidates",
    system: WEB_EXTRACT_SYSTEM,
    user: `${formatThesis(thesis)}\n\n${spec.candidateHint}\n\nWeb results:\n${evidence}\n\nExtract up to ${limit} in-thesis candidates.`,
  });

  const created: string[] = [];
  for (const c of candidates) {
    if (created.length >= limit) break;
    // Gates: no established companies, no off-thesis candidates — if it
    // doesn't match what the investor looks for, it is never shown.
    if (c.isEstablished || isDenylisted(c.companyName)) continue;
    if (!c.thesisFit) continue;
    const match = results.find(
      (r) => c.companyName && r.title.toLowerCase().includes(c.companyName.toLowerCase().slice(0, 6))
    );
    const conviction = computeConviction({
      // Channel-specific evidence — every antenna carries its own weight.
      hasPatentFiling: spec.channel === "patents",
      inAcceleratorCohort: spec.channel === "accelerators",
      hackathonWin: spec.channel === "hackathons",
      productHuntLaunch: spec.channel === "producthunt",
      llmAssertedFit: true, // the extractor only returns candidates it can justify
      thesisSectorMatch: matches(`${c.sector} ${c.oneLiner} ${c.whyRelevant}`, thesis?.sectors),
      thesisGeoMatch: matches(c.geography, thesis?.geographies),
    });
    const { opportunityId, deduped } = await createOpportunity({
      source: "outbound",
      sourceChannel: spec.channel,
      thesisId: thesis?.id ?? null,
      convictionScore: conviction.score,
      convictionReason: conviction.reason,
      company: {
        name: c.companyName,
        sector: c.sector,
        // Stage only when the source explicitly said it — never simulated.
        stage: c.stage ?? null,
        geography: c.geography,
        oneLiner: c.oneLiner,
        description: c.whyRelevant,
      },
      founders: [
        { fullName: c.founderName, handleSeed: c.founderHandle, role: "founder", isColdStart: true },
      ],
      signals: [
        {
          sourceType: spec.sourceType,
          sourceUrl: match?.url ?? null,
          title: c.companyName,
          rawText: `${spec.signalPrefix}: ${c.oneLiner}. Why relevant: ${c.whyRelevant}. ${match ? `Source: ${match.content.slice(0, 300)}` : ""}`,
          tags: ["outbound", spec.channel, ...spec.extraTags],
        },
      ],
    });
    if (!deduped) created.push(opportunityId);
  }
  await bumpChannel(spec.channel, created.length);
  return created;
}

export const sourceFromWeb = (customQuery?: string, limit = 4) =>
  sourceViaWebExtract(WEB_CHANNELS.web, limit, customQuery);
export const sourceFromProductHunt = (limit = 3) => sourceViaWebExtract(WEB_CHANNELS.producthunt, limit);
export const sourceFromHackathons = (limit = 3) => sourceViaWebExtract(WEB_CHANNELS.hackathons, limit);
export const sourceFromPatents = (limit = 2) => sourceViaWebExtract(WEB_CHANNELS.patents, limit);
export const sourceFromAccelerators = (limit = 3) => sourceViaWebExtract(WEB_CHANNELS.accelerators, limit);

// ------------------------------------------------- Threshold auto-trigger -----
/**
 * Pillar 2: assessment is "triggered by an inbound application, or by signals
 * crossing a conviction threshold ON THEIR OWN". After a sweep, high-conviction
 * unscreened candidates enter the funnel without a human click.
 */
export async function autoScreenHighConviction(max = 3): Promise<string[]> {
  const thesis = await getActiveThesis();
  const threshold = thesis?.convictionThreshold ?? 68;
  const all = await listOpportunities();
  const hot = all
    .filter(
      (o) =>
        o.source === "outbound" &&
        !o.screenResult &&
        !o.decision &&
        (o.convictionScore ?? 0) >= threshold
    )
    .sort((a, b) => (b.convictionScore ?? 0) - (a.convictionScore ?? 0))
    .slice(0, max);

  const screened: string[] = [];
  await Promise.allSettled(
    hot.map(async (o) => {
      await screenOpportunity(o.id);
      screened.push(o.id);
    })
  );
  return screened;
}

// --------------------------------------------------------- Multi-modal sweep --
/** Full radar sweep across the thesis-enabled channels + threshold auto-screen. */
export async function sourceAll(): Promise<Record<string, number>> {
  const profile = await getThesisProfile();
  const enabled = new Set<string>(
    profile?.enabledSources?.length ? profile.enabledSources : [...ALL_CHANNELS]
  );

  const runners: [string, () => Promise<string[]>][] = [
    ["github", () => sourceFromGithub(4)],
    ["hackernews", () => sourceFromHackerNews(3)],
    ["arxiv", () => sourceFromArxiv(3)],
    ["producthunt", () => sourceFromProductHunt(3)],
    ["hackathons", () => sourceFromHackathons(3)],
    ["patents", () => sourceFromPatents(2)],
    ["accelerators", () => sourceFromAccelerators(3)],
    ["web", () => sourceFromWeb(undefined, 3)],
  ];

  const active = runners.filter(([name]) => enabled.has(name));
  const settled = await Promise.allSettled(active.map(([, fn]) => fn()));

  const counts: Record<string, number> = {};
  active.forEach(([name], i) => {
    const r = settled[i];
    counts[name] = r.status === "fulfilled" ? r.value.length : 0;
  });

  // Signals crossing the conviction threshold trigger assessment on their own.
  const screened = await autoScreenHighConviction(3);
  counts.autoScreened = screened.length;
  return counts;
}
