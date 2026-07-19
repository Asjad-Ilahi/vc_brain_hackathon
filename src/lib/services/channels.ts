import { db } from "@/db/client";
import { companies, founders, opportunityFounders, opportunities, sourcingNodes } from "@/db/schema";
import { eq } from "drizzle-orm";
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

export type GraphNode = {
  id: string;
  institutionName: string;
  programName: string;
  qualityRating: number;
  companyName: string;
  founderName: string;
  opportunityId: string;
};

export async function getChannelIntelligence(): Promise<{
  channels: ChannelStat[];
  suggestions: { channel: string; why: string }[];
  graphNodes: GraphNode[];
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

  // Dynamic Sourcing Suggestions based on sourcing nodes quality rating
  const suggestions: { channel: string; why: string }[] = [];
  try {
    const nodes = await db.select().from(sourcingNodes);
    const instStats = new Map<string, { sum: number; count: number }>();
    for (const n of nodes) {
      const key = n.institutionName;
      const curr = instStats.get(key) ?? { sum: 0, count: 0 };
      curr.sum += n.qualityRating;
      curr.count++;
      instStats.set(key, curr);
    }

    for (const [name, stats] of instStats.entries()) {
      const avgRating = Math.round(stats.sum / stats.count);
      if (avgRating >= 60 && stats.count < 3) {
        suggestions.push({
          channel: name,
          why: `High-yield source (average quality ${avgRating}%) but underexplored with only ${stats.count} candidate(s).`,
        });
      }
    }
  } catch (err) {
    console.error("Failed to fetch sourcing node suggestions:", err);
  }

  // Fallbacks aligning with key channels/brief goals if suggestions are empty
  if (suggestions.length === 0) {
    suggestions.push(
      {
        channel: "MIT CNC Hackathon",
        why: "Strong source of developer projects in the North American/European thesis.",
      },
      {
        channel: "GitHub",
        why: "High-value developer signals representing code shipped before fundraising.",
      },
      {
        channel: "Y Combinator",
        why: "Cohort directory scrape representing high conversion quality.",
      }
    );
  }

  let graphNodes: GraphNode[] = [];
  try {
    graphNodes = await db
      .select({
        id: sourcingNodes.id,
        institutionName: sourcingNodes.institutionName,
        programName: sourcingNodes.programName,
        qualityRating: sourcingNodes.qualityRating,
        companyName: companies.name,
        founderName: founders.fullName,
        opportunityId: opportunities.id,
      })
      .from(sourcingNodes)
      .innerJoin(opportunities, eq(sourcingNodes.opportunityId, opportunities.id))
      .innerJoin(companies, eq(opportunities.companyId, companies.id))
      .innerJoin(opportunityFounders, eq(opportunities.id, opportunityFounders.opportunityId))
      .innerJoin(founders, eq(opportunityFounders.founderId, founders.id)) as unknown as GraphNode[];
  } catch (err) {
    console.error("Failed to query sourcing graph nodes:", err);
  }

  return { channels, suggestions, graphNodes };
}
