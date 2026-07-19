import { db } from "./src/db/client";
import { opportunities } from "./src/db/schema";
async function run() {
  const opps = await db.select().from(opportunities);
  console.log(opps.map(o => ({ id: o.id, status: o.status, decision: o.decision, source: o.source, score: o.convictionScore })));
  process.exit(0);
}
run();
