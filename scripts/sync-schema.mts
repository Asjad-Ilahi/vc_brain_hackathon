/**
 * Idempotent, ADDITIVE schema sync — brings any database up to date with the
 * columns/tables added in migrations 0005/0006 (+ deck_url, which predates them).
 *
 * WHY THIS EXISTS: the dev and prod DBs were bootstrapped with `drizzle-kit push`,
 * so they have NO migration journal — `drizzle-kit migrate` would try to replay
 * 0000 (CREATE TABLE users …) against tables that already exist and fail. This
 * script only runs `... IF NOT EXISTS` / guarded DDL, so it is safe to run any
 * number of times against a DB in any state, and touches no existing data.
 *
 * USAGE (local):  npm run db:sync
 * USAGE (prod):   pull the prod DATABASE_URL into your env, then run db:sync, e.g.
 *   npx vercel env pull .env.prod.local --environment=production
 *   DATABASE_URL="$(grep '^DATABASE_URL=' .env.prod.local | cut -d= -f2- | tr -d '"')" npm run db:sync
 *   rm .env.prod.local
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const sql = neon(url);
const run = (s: string) => sql.query(s);

const hasCol = async (table: string, col: string) =>
  (await run(`SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${col}'`)).length > 0;
const hasTable = async (name: string) =>
  (await run(`SELECT to_regclass('public.${name}') t`))[0].t != null;

async function report(label: string) {
  console.log(`\n=== ${label} ===`);
  for (const c of ["public_ref", "applicant_email", "deck_url"]) console.log(`opportunities.${c}:`, await hasCol("opportunities", c));
  console.log("users.role:", await hasCol("users", "role"));
  console.log("theses.user_id:", await hasCol("theses", "user_id"));
  console.log("invites table:", await hasTable("invites"));
  console.log("sourcing_nodes table:", await hasTable("sourcing_nodes"));
}

async function main() {
  await report("BEFORE");
  console.log("\n=== applying idempotent additive DDL ===");

  // --- 0005: sourcing_nodes + opportunity/thesis columns ---
  await run(`CREATE TABLE IF NOT EXISTS "sourcing_nodes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "opportunity_id" uuid,
    "institution_name" text NOT NULL,
    "program_name" text NOT NULL,
    "referrer_name" text,
    "quality_rating" integer DEFAULT 50 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL)`);
  await run(`ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "public_ref" text`);
  await run(`ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "applicant_email" text`);
  await run(`ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "deck_url" text`);
  await run(`ALTER TABLE "theses" ADD COLUMN IF NOT EXISTS "user_id" uuid`);
  await run(`DO $$ BEGIN ALTER TABLE "sourcing_nodes" ADD CONSTRAINT "sourcing_nodes_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await run(`DO $$ BEGIN ALTER TABLE "theses" ADD CONSTRAINT "theses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await run(`DO $$ BEGIN ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_public_ref_unique" UNIQUE("public_ref"); EXCEPTION WHEN duplicate_object THEN null; END $$`);

  // --- 0006: invites + users.role ---
  await run(`CREATE TABLE IF NOT EXISTS "invites" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL,
    "role" text DEFAULT 'investor' NOT NULL,
    "token" text NOT NULL,
    "invited_by_user_id" uuid,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "invites_token_unique" UNIQUE("token"))`);
  await run(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'investor' NOT NULL`);
  await run(`DO $$ BEGIN ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$`);

  await report("AFTER");
  const n = (await run(`SELECT count(*)::int n FROM opportunities WHERE public_ref = 'nonexistent'`))[0].n;
  console.log("\n✓ status lookup query succeeds now (rows for bogus ref:", n, ")");
  console.log("✓ schema sync complete.");
}

main().catch((e) => {
  console.error("sync failed:", e);
  process.exit(1);
});
