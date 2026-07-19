import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { db } from "./client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Starting database cleanup...");
  
  // Truncate all tables including users and invites, using CASCADE to handle references.
  const query = `
    TRUNCATE TABLE 
      users,
      invites,
      theses, 
      founders, 
      founder_score_history, 
      companies, 
      opportunities, 
      opportunity_founders, 
      signals, 
      axis_scores, 
      memos, 
      claims, 
      reasoning_steps, 
      outreach, 
      sourcing_channels, 
      sourcing_nodes 
    RESTART IDENTITY CASCADE;
  `;

  try {
    await db.execute(sql.raw(query));
    console.log("✅ Database tables successfully cleared (except users and invites).");
  } catch (err: any) {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
