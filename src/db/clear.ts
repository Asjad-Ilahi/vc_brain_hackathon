import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { sql } from "drizzle-orm";
import { db } from "./client";

async function main() {
  console.log("Clearing all database entries (including users)...");
  await db.execute(
    sql.raw(
      "TRUNCATE TABLE users, invites, theses, founders, founder_score_history, companies, opportunities, opportunity_founders, signals, axis_scores, memos, claims, reasoning_steps, outreach, sourcing_channels, sourcing_nodes RESTART IDENTITY CASCADE"
    )
  );
  console.log("✅ All data successfully cleared.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Failed to clear database:", e);
  process.exit(1);
});
