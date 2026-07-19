import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { db } from "./client";
import * as schema from "./schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Checking database tables...");
  
  const tables = [
    { name: "users", table: schema.users },
    { name: "invites", table: schema.invites },
    { name: "theses", table: schema.theses },
    { name: "founders", table: schema.founders },
    { name: "founderScoreHistory", table: schema.founderScoreHistory },
    { name: "companies", table: schema.companies },
    { name: "opportunities", table: schema.opportunities },
    { name: "opportunityFounders", table: schema.opportunityFounders },
    { name: "signals", table: schema.signals },
    { name: "axisScores", table: schema.axisScores },
    { name: "memos", table: schema.memos },
    { name: "claims", table: schema.claims },
    { name: "reasoningSteps", table: schema.reasoningSteps },
    { name: "outreach", table: schema.outreach },
    { name: "sourcingChannels", table: schema.sourcingChannels },
    { name: "sourcingNodes", table: schema.sourcingNodes },
  ];

  for (const t of tables) {
    try {
      const res = await db.select({ count: sql<number>`count(*)` }).from(t.table);
      console.log(`- Table "${t.name}": ${res[0]?.count ?? 0} rows`);
    } catch (err: any) {
      console.error(`- Table "${t.name}": Error reading: ${err.message}`);
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Check failed:", e);
  process.exit(1);
});
