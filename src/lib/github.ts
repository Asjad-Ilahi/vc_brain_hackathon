/**
 * GitHub wrapper — outbound sourcing signal (developers building before they raise).
 * Works keyless at low volume; a GITHUB_TOKEN raises the rate limit.
 */
import { env } from "./env";
import { withRetry } from "./utils";

function headers() {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "vc-brain-hackathon",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = env.githubToken;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export type GithubUser = {
  login: string;
  name: string | null;
  html_url: string;
  bio: string | null;
  location: string | null;
  followers: number;
  public_repos: number;
  company: string | null;
  blog: string | null;
  type: "User" | "Organization";
};

export type GithubRepo = {
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  owner: { login: string; type?: "User" | "Organization" };
  pushed_at: string;
  created_at?: string;
};

async function ghGet<T>(url: string): Promise<T> {
  return withRetry(
    async () => {
      const res = await fetch(url, { headers: headers() });
      if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    },
    { label: "github:get", retries: 2 }
  );
}

/**
 * Find repos matching a thesis query. Default sort is RECENT ACTIVITY, not
 * stars — the mandate is founders BEFORE the world notices, and sorting by
 * stars returns the same celebrities on every sweep.
 */
export async function githubSearchRepos(
  query: string,
  perPage = 8,
  sort: "updated" | "stars" = "updated"
): Promise<GithubRepo[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
    query
  )}&sort=${sort}&order=desc&per_page=${perPage}`;
  const data = await ghGet<{ items: GithubRepo[] }>(url);
  return data.items ?? [];
}

export async function githubUser(login: string): Promise<GithubUser> {
  return ghGet<GithubUser>(`https://api.github.com/users/${encodeURIComponent(login)}`);
}
