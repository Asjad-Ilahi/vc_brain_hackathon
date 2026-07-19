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
import { sql, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sourcingChannels, founders, opportunities, opportunityFounders } from "@/db/schema";
import { githubSearchRepos, githubUser, githubUserEmailFromCommits, type GithubRepo } from "@/lib/github";
import { tavilySearch, type TavilyResult } from "@/lib/tavily";
import { structured } from "@/lib/openai";
import { OutboundCandidateSchema } from "@/lib/schemas";
import { z } from "zod";
import { withRetry, cleanPersonName, looksLikeHandle, cleanPlaceholderField } from "@/lib/utils";
import { createOpportunity, type NewFounder } from "./opportunity";
import { getActiveThesis, formatThesis, getThesisProfile, type Thesis } from "./thesis";
import { computeConviction, matchesThesisTerms } from "./conviction";
import { screenOpportunity } from "./screen";
import { listOpportunities } from "./list";
import { recordSignal } from "./ingest";
import { analyzeColdStartFootprint } from "./coldstart";

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

export async function sourceFromGithub(userId: string, limit = 5): Promise<string[]> {
  const thesis = await getActiveThesis(userId);
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
          // Real name if GitHub has one; else the login, rendered as "@login" by
          // the display layer (a real, linkable handle — never a fake full name).
          fullName: cleanPersonName(user.name) ?? user.login,
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
    const email = user.email || (await githubUserEmailFromCommits(user.login));
    if (email) {
      await db
        .update(opportunities)
        .set({ applicantEmail: email })
        .where(eq(opportunities.id, opportunityId));
    }
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

export async function sourceFromHackerNews(userId: string, limit = 4): Promise<string[]> {
  const thesis = await getActiveThesis(userId);
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

export async function sourceFromArxiv(userId: string, limit = 3): Promise<string[]> {
  const thesis = await getActiveThesis(userId);
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
        name: `${author.split(" ").slice(-1)[0] || author} et al.`,
        sector: thesis?.sectors?.[0] ?? "machine learning",
        oneLiner: title,
        description: `Research paper: ${title}. Abstract: ${summary}`,
      },
      founders: [{ fullName: author, handleSeed: author.toLowerCase().replace(/\s+/g, ""), role: "author", isColdStart: true }],
      signals: [
        {
          sourceType: "arxiv",
          sourceUrl: id || undefined,
          title,
          rawText: `Paper "${title}" by ${author} published ${published}. Abstract: ${summary}`,
          tags: ["outbound", "arxiv"],
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

/**
 * Resolve a founder's REAL name — the enrichment that saves the investor a
 * manual lookup. Returns a real human name or null. It NEVER fabricates: if the
 * evidence only yields a handle or nothing, the caller decides how to present
 * the person (as "@handle" or by leading with the company). This is the opposite
 * of the old behaviour, which invented "<Company> Creator" placeholders.
 */
async function resolveFounderName(companyName: string, initialName?: string | null): Promise<string | null> {
  const initial = cleanPersonName(initialName);
  if (initial && !looksLikeHandle(initial)) return initial; // already a real name

  try {
    const query = `"${companyName}" founder OR CEO OR creator OR owner OR author OR build`;
    const { results } = await tavilySearch(query, { maxResults: 3 });
    if (results.length > 0) {
      const snippets = results.map((r) => r.content).join("\n\n");
      const answer = await structured({
        schema: z.object({
          fullName: z
            .string()
            .nullable()
            .describe("The founder/creator's real full name (e.g. 'John Doe'), or null if not explicitly stated. Never guess."),
        }),
        schemaName: "FounderNameExtraction",
        system: `Identify the REAL full name of the main founder or creator of "${companyName}". Only return a name explicitly present in the search results. If none is stated, return null. Never fabricate.`,
        user: `Search results:\n${snippets}`,
      });
      const resolved = cleanPersonName(answer.fullName);
      if (resolved && !looksLikeHandle(resolved)) return resolved;
    }
  } catch (err) {
    console.error(`Failed to resolve founder name for ${companyName}:`, err);
  }

  return null; // unresolved — honest, not fabricated
}

/**
 * Build the founders[] for an outbound candidate. Attaches a founder ONLY when we
 * have a real identity to show — a real name, or a usable handle. When we have
 * neither (common for patents/hackathons), we attach nothing and the card leads
 * with the company/project, which is always a real, useful entity.
 */
function buildOutboundFounder(
  realName: string | null,
  handle: string | null,
  extra: { githubLogin?: string | null; linkedinUrl?: string | null; role?: string; bio?: string | null } = {}
): NewFounder[] {
  const cleanHandle = (handle || "").trim().replace(/^@/, "") || null;
  if (realName) {
    return [{ fullName: realName, handleSeed: cleanHandle ?? realName, isColdStart: true, ...extra }];
  }
  if (cleanHandle) {
    // Handle-only identity — store the handle as the name; the display layer
    // renders it as "@handle" so it never masquerades as a verified person.
    return [{ fullName: cleanHandle, handleSeed: cleanHandle, isColdStart: true, ...extra }];
  }
  return [];
}

async function sourceViaWebExtract(userId: string, spec: WebChannelSpec, limit: number, customQuery?: string): Promise<string[]> {
  const thesis = await getActiveThesis(userId);
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
    
    const resolvedName = await resolveFounderName(c.companyName, c.founderName);
    const foundersArr = buildOutboundFounder(resolvedName, c.founderHandle, { role: "founder" });

    const { opportunityId, deduped } = await createOpportunity({
      source: "outbound",
      sourceChannel: spec.channel,
      thesisId: thesis?.id ?? null,
      convictionScore: conviction.score,
      convictionReason: conviction.reason,
      company: {
        name: c.companyName,
        sector: cleanPlaceholderField(c.sector),
        // Stage only when the source explicitly said it — never simulated.
        stage: cleanPlaceholderField(c.stage),
        geography: cleanPlaceholderField(c.geography),
        oneLiner: c.oneLiner,
        description: c.whyRelevant,
      },
      founders: foundersArr,
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

export const sourceFromWeb = (userId: string, customQuery?: string, limit = 4) =>
  sourceViaWebExtract(userId, WEB_CHANNELS.web, limit, customQuery);
export const sourceFromProductHunt = (userId: string, limit = 3) => sourceViaWebExtract(userId, WEB_CHANNELS.producthunt, limit);
export const sourceFromHackathons = (userId: string, limit = 3) => sourceViaWebExtract(userId, WEB_CHANNELS.hackathons, limit);
export const sourceFromPatents = (userId: string, limit = 2) => sourceViaWebExtract(userId, WEB_CHANNELS.patents, limit);
export const sourceFromAccelerators = (userId: string, limit = 3) => sourceViaWebExtract(userId, WEB_CHANNELS.accelerators, limit);

// ------------------------------------------------- Threshold auto-trigger -----
/**
 * Pillar 2: assessment is "triggered by an inbound application, or by signals
 * crossing a conviction threshold ON THEIR OWN". After a sweep, high-conviction
 * unscreened candidates enter the funnel without a human click.
 */
export async function autoScreenHighConviction(userId: string, max = 3): Promise<string[]> {
  const thesis = await getActiveThesis(userId);
  if (!thesis) return [];
  const threshold = thesis.convictionThreshold ?? 68;
  const all = await listOpportunities(userId);
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
  for (const o of hot) {
    try {
      await screenOpportunity(o.id);
      
      // Auto-trigger background check and cold-start footprint prediction immediately
      const links = await db.select().from(opportunityFounders).where(eq(opportunityFounders.opportunityId, o.id));
      let isCold = false;
      for (const l of links) {
        const [f] = await db.select().from(founders).where(eq(founders.id, l.founderId)).limit(1);
        if (f) {
          if (f.isColdStart) isCold = true;
          try {
            await runDeepFounderBackgroundCheck(o.id, f.id);
          } catch (e) {
            console.error("Background check failed in autoScreen:", e);
          }
        }
      }
      if (isCold) {
        try {
          await analyzeColdStartFootprint(o.id);
        } catch (e) {
          console.error("Coldstart footprint check failed in autoScreen:", e);
        }
      }
      screened.push(o.id);
    } catch (err) {
      console.error(`Auto-screen failed for opportunity ${o.id}:`, err);
    }
  }
  return screened;
}

// --------------------------------------------------------- Multi-modal sweep --
/** Full radar sweep across the thesis-enabled channels + threshold auto-screen. */
export async function sourceAll(userId: string): Promise<Record<string, number>> {
  const profile = await getThesisProfile(userId);
  const enabled = new Set<string>(
    profile?.enabledSources?.length ? profile.enabledSources : [...ALL_CHANNELS]
  );

  const runners: [string, () => Promise<string[]>][] = [
    ["github", () => sourceFromGithub(userId, 4)],
    ["hackernews", () => sourceFromHackerNews(userId, 3)],
    ["arxiv", () => sourceFromArxiv(userId, 3)],
    ["producthunt", () => sourceFromProductHunt(userId, 3)],
    ["hackathons", () => sourceFromHackathons(userId, 3)],
    ["patents", () => sourceFromPatents(userId, 2)],
    ["accelerators", () => sourceFromAccelerators(userId, 3)],
    ["web", () => sourceFromWeb(userId, undefined, 3)],
  ];

  const active = runners.filter(([name]) => enabled.has(name));
  const settled = await Promise.allSettled(active.map(([, fn]) => fn()));

  const counts: Record<string, number> = {};
  active.forEach(([name], i) => {
    const r = settled[i];
    counts[name] = r.status === "fulfilled" ? r.value.length : 0;
  });

  // Signals crossing the conviction threshold trigger assessment on their own.
  const screened = await autoScreenHighConviction(userId, 3);
  counts.autoScreened = screened.length;
  return counts;
}

// -------------------------------------------------- Deep Background Audit -----
export async function runDeepFounderBackgroundCheck(opportunityId: string, founderId: string): Promise<void> {
  const [f] = await db.select().from(founders).where(eq(founders.id, founderId)).limit(1);
  if (!f) return;
  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  if (!opp) return;

  const name = f.fullName;
  
  // 1) Search Tavily (web & linkedin)
  try {
    const { results } = await tavilySearch(`"${name}" linkedin OR twitter OR resume OR portfolio OR startup`, { maxResults: 5 });
    if (results.length > 0) {
      const rawText = results.map(r => `[Web] ${r.title} (${r.url}): ${r.content.slice(0, 300)}`).join("\n\n");
      await recordSignal({
        opportunityId,
        founderId,
        companyId: opp.companyId,
        sourceType: "web",
        title: `Web background — ${name}`,
        rawText,
        tags: ["outbound", "deep-check", "social"],
      });
      
      // Extract linkedin profile if found
      const li = results.find(r => r.url.includes("linkedin.com/in/"));
      if (li && !f.linkedinUrl) {
        await db.update(founders).set({ linkedinUrl: li.url }).where(eq(founders.id, founderId));
      }
    }
  } catch (e) {
    console.error("Tavily search failed in deep background check:", e);
  }

  // 2) Search GitHub
  const ghLogin = f.githubLogin || f.canonicalHandle;
  if (ghLogin) {
    try {
      const user = await githubUser(ghLogin);
      if (user && user.type !== "Organization") {
        if (!f.githubLogin) {
          await db.update(founders).set({ githubLogin: user.login }).where(eq(founders.id, founderId));
        }
        const email = user.email || (await githubUserEmailFromCommits(user.login));
        if (email && !opp.applicantEmail) {
          await db.update(opportunities).set({ applicantEmail: email }).where(eq(opportunities.id, opportunityId));
        }
        const repos = await githubSearchRepos(`user:${user.login}`, 5, "stars");
        const rawText = `GitHub User: ${user.name || user.login} (${user.followers} followers, ${user.public_repos} repos). Bio: ${user.bio ?? ""}\n\n` +
          repos.map(r => `Repo: ${r.full_name} (${r.stargazers_count}★): ${r.description ?? ""}`).join("\n");
          
        await recordSignal({
          opportunityId,
          founderId,
          companyId: opp.companyId,
          sourceType: "github",
          title: `GitHub background — ${user.login}`,
          rawText,
          tags: ["outbound", "deep-check", "github"],
          observedAt: new Date(),
        });
      }
    } catch (e) {
      console.error("GitHub check failed in deep background check:", e);
    }
  }

  // 3) Search arXiv
  try {
    const arxivUrl = `http://export.arxiv.org/api/query?search_query=au:${encodeURIComponent(name)}&max_results=3`;
    const xml = await fetch(arxivUrl).then(r => r.text());
    const entries = xml.split("<entry>").slice(1).map((e) => e.split("</entry>")[0]);
    const arxivTexts: string[] = [];
    for (const e of entries) {
      const title = tag(e, "title");
      const author = tag(e, "name");
      const summary = tag(e, "summary");
      const published = tag(e, "published");
      if (title && author) {
        arxivTexts.push(`Paper: "${title}" by ${author} published ${published}. Abstract: ${summary}`);
      }
    }
    if (arxivTexts.length > 0) {
      await recordSignal({
        opportunityId,
        founderId,
        companyId: opp.companyId,
        sourceType: "arxiv",
        title: `arXiv publications — ${name}`,
        rawText: arxivTexts.join("\n\n"),
        tags: ["outbound", "deep-check", "arxiv"],
      });
    }
  } catch (e) {
    console.error("arXiv check failed in deep background check:", e);
  }

  // 4) Try to find contact email via Tavily Search + LLM extraction if we still don't have one
  const [currentOpp] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  if (currentOpp && !currentOpp.applicantEmail) {
    try {
      const { results } = await tavilySearch(`"${name}" contact OR email OR "reach me" OR "@"`, { maxResults: 3 });
      if (results.length > 0) {
        const textSnippets = results.map(r => `[Page: ${r.title}] Content: ${r.content}`).join("\n\n");
        const extracted = await structured({
          schema: z.object({ email: z.string().nullable().describe("A valid email address for this person, or null if none is present") }),
          schemaName: "EmailExtraction",
          system: "You extract a single contact email for the specified person from the web search results. If none is found, return null. Avoid generic noreply or info@ domains unless specific to them.",
          user: `Person name: ${name}\n\nSearch Results:\n${textSnippets}`,
        });
        if (extracted.email) {
          await db.update(opportunities).set({ applicantEmail: extracted.email.trim() }).where(eq(opportunities.id, opportunityId));
        }
      }
    } catch (e) {
      console.error("Tavily email extraction failed:", e);
    }
  }
}

// ----------------------------------------------------- Deep Manual Search -----
export async function deepSearchFounder(userId: string, query: string): Promise<string[]> {
  const thesis = await getActiveThesis(userId);
  
  // 1. Multi-query deep search to cover all facets (founders, company profiles, social links)
  console.log(`Starting deep manual radar search for: "${query}"`);
  
  const [resFounders, resCompany, resSocial] = await Promise.allSettled([
    tavilySearch(`"${query}" founder OR co-founder OR team OR executive OR CEO OR owner`, { maxResults: 8, depth: "advanced" }),
    tavilySearch(`"${query}" startup OR company OR tech OR launch OR product OR funding`, { maxResults: 8, depth: "advanced" }),
    tavilySearch(`"${query}" site:linkedin.com/in/ OR site:github.com/ OR site:twitter.com/`, { maxResults: 8, depth: "advanced" }),
  ]);

  const webResultsMap = new Map<string, TavilyResult>();
  let primaryAnswer: string | null = null;

  [resFounders, resCompany, resSocial].forEach((res) => {
    if (res.status === "fulfilled" && res.value) {
      if (res.value.answer && !primaryAnswer) {
        primaryAnswer = res.value.answer;
      }
      res.value.results.forEach((r) => {
        webResultsMap.set(r.url, r);
      });
    }
  });

  const mergedWebResults = Array.from(webResultsMap.values());
  
  // 2. Search GitHub for repositories matching the query
  let ghResults: GithubRepo[] = [];
  try {
    const repos = await githubSearchRepos(query, 6);
    ghResults = repos;
  } catch (e) {
    console.error("GH search failed in manual search:", e);
  }

  // 3. Search arXiv for papers matching query
  const arxivResults: string[] = [];
  try {
    const arxivUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=3`;
    const xml = await fetch(arxivUrl).then(r => r.text());
    const entries = xml.split("<entry>").slice(1).map((e) => e.split("</entry>")[0]);
    for (const e of entries) {
      const title = tag(e, "title");
      const author = tag(e, "name");
      const summary = tag(e, "summary");
      if (title && author) {
        arxivResults.push(`Paper title: ${title} by ${author}. Abstract: ${summary}`);
      }
    }
  } catch (e) {
    console.error("arxiv query failed in manual search:", e);
  }
  
  const evidence = [
    primaryAnswer ? `Web Summary: ${primaryAnswer}` : "",
    ...mergedWebResults.map((r, i) => `[Web Results ${i+1}] Title: ${r.title} — Url: ${r.url} — Content: ${r.content}`),
    ...ghResults.map((r, i) => `[GitHub Repo ${i+1}] Name: ${r.full_name} — Url: ${r.html_url} — Stars: ${r.stargazers_count} — Description: ${r.description}`),
    ...arxivResults.map((p, i) => `[arXiv Paper ${i+1}] ${p}`)
  ].filter(Boolean).join("\n\n");
  
  const systemPrompt = `You are the lead intelligence analyst for an early-stage venture capital fund.
Your task is to parse unstructured web search, GitHub, and arXiv results to extract the founder profile, company/project, sectors, stage, location, one-liner, and credentials.
You MUST identify the founder name (usually matching or related to the search query "${query}"), their project or company name, and their key claims.
Determine if the project matches the VC's investment thesis.`;

  const { candidates } = await structured({
    schema: z.object({ candidates: z.array(OutboundCandidateSchema).default([]) }),
    schemaName: "OutboundCandidates",
    system: systemPrompt,
    user: `${formatThesis(thesis)}\n\nQuery: ${query}\n\nEvidence gathered:\n${evidence}\n\nExtract the founder(s) and company/project details from the evidence.`,
  });

  const created: { id: string; score: number }[] = [];
  for (const c of candidates) {
    const companyName = (c.companyName || "").trim();
    if (companyName && (c.isEstablished || isDenylisted(companyName))) continue;

    const resolvedName = await resolveFounderName(companyName || query, c.founderName);
    const foundersArr = buildOutboundFounder(resolvedName, c.founderHandle, {
      role: "founder",
      linkedinUrl: mergedWebResults.find((r) => r.url.includes("linkedin.com/in/"))?.url ?? null,
    });

    // A real result needs a real entity: either a company/project name, or an
    // identified founder. Without either we'd be inventing data — skip it, so a
    // vague query returns "nothing found" instead of a fabricated card.
    const displayCompany = companyName || (resolvedName ? `${resolvedName}'s project` : "");
    if (!displayCompany || (!companyName && foundersArr.length === 0)) continue;

    const match = mergedWebResults.find(
      (r) =>
        (companyName && r.title.toLowerCase().includes(companyName.toLowerCase().slice(0, 6))) ||
        (resolvedName && r.content.toLowerCase().includes(resolvedName.toLowerCase()))
    );

    const conviction = computeConviction({
      llmAssertedFit: true,
      thesisSectorMatch: matches(`${c.sector} ${c.oneLiner} ${c.whyRelevant}`, thesis?.sectors),
      thesisGeoMatch: matches(c.geography, thesis?.geographies),
    });

    const { opportunityId, deduped } = await createOpportunity({
      source: "outbound",
      sourceChannel: "web",
      thesisId: thesis?.id ?? null,
      convictionScore: conviction.score,
      convictionReason: conviction.reason,
      company: {
        name: displayCompany,
        sector: cleanPlaceholderField(c.sector),
        stage: cleanPlaceholderField(c.stage),
        geography: cleanPlaceholderField(c.geography),
        oneLiner: c.oneLiner,
        description: c.whyRelevant,
      },
      founders: foundersArr,
      signals: [
        {
          sourceType: "web",
          sourceUrl: match?.url ?? null,
          title: displayCompany,
          rawText: `Manual Search for "${query}": ${c.oneLiner}. Why relevant: ${c.whyRelevant}. \n\nEvidence Summary:\n${evidence.slice(0, 1000)}`,
          tags: ["outbound", "manual-search"],
        },
      ],
    });
    if (!deduped) created.push({ id: opportunityId, score: conviction.score });
  }
  // Best match first — the search page redirects to created[0], so it must be the
  // strongest candidate, not whatever the LLM happened to list first.
  created.sort((a, b) => b.score - a.score);
  return created.map((c) => c.id);
}
