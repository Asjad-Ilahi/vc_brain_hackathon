/**
 * Sourcing & Network Intelligence — which channels actually produce quality, and
 * which are underexplored. Computed from outcomes so it learns: when a sourced
 * founder scores well, that channel's quality rises automatically.
 */
import { listOpportunities } from "./list";

const KNOWN_CHANNELS = [
  "github",
  "hackernews",
  "arxiv",
  "web",
  "producthunt",
  "hackathons",
  "patents",
  "accelerators",
  "twitter", // social discourse — the cold-start footprint channel
];

export type ChannelStat = {
  name: string;
  found: number;
  scored: number;
  avgConviction: number;
  converted: number; // screened-pass or invest
  quality: number; // 0-100 blended
};

export async function getChannelIntelligence(): Promise<{
  channels: ChannelStat[];
  suggestions: { channel: string; why: string }[];
}> {
  const opps = await listOpportunities();
  const outbound = opps.filter((o) => o.source === "outbound");

  const acc = new Map<
    string,
    { found: number; scored: number; convictionSum: number; convictionN: number; converted: number }
  >();
  for (const o of outbound) {
    const ch = o.sourceChannel ?? "other";
    const g = acc.get(ch) ?? { found: 0, scored: 0, convictionSum: 0, convictionN: 0, converted: 0 };
    g.found++;
    if (o.convictionScore != null) {
      g.convictionSum += o.convictionScore;
      g.convictionN++;
    }
    if (o.axes.founder) g.scored++;
    if (o.screenResult === "pass" || o.decision === "invest" || (o.axes.founder?.score ?? 0) >= 65) g.converted++;
    acc.set(ch, g);
  }

  const channels: ChannelStat[] = [...acc.entries()]
    .map(([name, g]) => {
      const avgConviction = g.convictionN ? Math.round(g.convictionSum / g.convictionN) : 0;
      const conversion = g.found ? g.converted / g.found : 0;
      const quality = Math.round(avgConviction * 0.6 + conversion * 100 * 0.4);
      return { name, found: g.found, scored: g.scored, avgConviction, converted: g.converted, quality };
    })
    .sort((a, b) => b.quality - a.quality);

  const used = new Set(channels.map((c) => c.name));
  const suggestions = KNOWN_CHANNELS.filter((k) => !used.has(k)).map((channel) => ({
    channel,
    why: "not yet explored — likely untapped supply",
  }));

  return { channels, suggestions };
}
