/**
 * Conviction scoring — a fast, deterministic 0-100 signal-strength score computed
 * at INGESTION for every sourced founder (no LLM). This is what lets the system
 * surface founders "crossing a conviction threshold on their own", before any
 * manual assessment or application. It ranks the Radar.
 */
export type ConvictionInput = {
  githubStars?: number;
  githubFollowers?: number;
  githubPushedDaysAgo?: number;
  githubRepos?: number;
  hnPoints?: number;
  hnComments?: number;
  hasArxivPaper?: boolean;
  arxivDaysAgo?: number;
  thesisSectorMatch?: boolean;
  thesisGeoMatch?: boolean;
  founderScore?: number;
};

export type Conviction = { score: number; reason: string; level: "high" | "medium" | "low" };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const log = (n: number) => Math.log10(Math.max(0, n) + 1);

export function computeConviction(input: ConvictionInput): Conviction {
  let score = 28; // base
  const reasons: { weight: number; text: string }[] = [];

  if (input.githubStars != null && input.githubStars > 0) {
    const pts = Math.min(30, log(input.githubStars) * 9);
    score += pts;
    reasons.push({ weight: pts, text: `${input.githubStars.toLocaleString()}★ on GitHub` });
  }
  if (input.githubFollowers != null && input.githubFollowers > 0) {
    const pts = Math.min(8, log(input.githubFollowers) * 3);
    score += pts;
    if (input.githubFollowers >= 100) reasons.push({ weight: pts, text: `${input.githubFollowers} followers` });
  }
  if (input.githubPushedDaysAgo != null) {
    if (input.githubPushedDaysAgo <= 14) { score += 9; reasons.push({ weight: 9, text: "shipping this week" }); }
    else if (input.githubPushedDaysAgo <= 60) { score += 4; reasons.push({ weight: 4, text: "active recently" }); }
    else if (input.githubPushedDaysAgo > 365) { score -= 6; reasons.push({ weight: -6, text: "stale (>1y since push)" }); }
  }
  if (input.hnPoints != null && input.hnPoints > 0) {
    const pts = Math.min(16, log(input.hnPoints) * 8);
    score += pts;
    reasons.push({ weight: pts, text: `${input.hnPoints} HN points` });
  }
  if (input.hasArxivPaper) {
    const pts = input.arxivDaysAgo != null && input.arxivDaysAgo <= 120 ? 15 : 10;
    score += pts;
    reasons.push({ weight: pts, text: "recent research paper" });
  }
  if (input.thesisSectorMatch) { score += 10; reasons.push({ weight: 10, text: "matches thesis sector" }); }
  if (input.thesisGeoMatch) { score += 5; reasons.push({ weight: 5, text: "in-thesis geography" }); }
  if (input.founderScore != null) {
    const pts = (input.founderScore - 50) * 0.2;
    score += pts;
    if (input.founderScore >= 70) reasons.push({ weight: pts, text: `proven operator (FS ${input.founderScore})` });
  }

  const finalScore = clamp(score);
  const top = reasons
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((r) => r.text);
  const reason = top.length ? top.join(" · ") : "limited public signal";
  const level: Conviction["level"] = finalScore >= 68 ? "high" : finalScore >= 50 ? "medium" : "low";
  return { score: finalScore, reason, level };
}
