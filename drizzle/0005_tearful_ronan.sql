-- Idempotent by design: sourcing_nodes and theses.user_id already exist on the
-- local dev DB (created out-of-band via `drizzle-kit push`) but were never in a
-- migration. A fresh/prod DB has neither. IF NOT EXISTS + guarded constraint
-- blocks let this apply cleanly against BOTH states. See plan NC-1.
CREATE TABLE IF NOT EXISTS "sourcing_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid,
	"institution_name" text NOT NULL,
	"program_name" text NOT NULL,
	"referrer_name" text,
	"quality_rating" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "public_ref" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "applicant_email" text;--> statement-breakpoint
ALTER TABLE "theses" ADD COLUMN IF NOT EXISTS "user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "sourcing_nodes" ADD CONSTRAINT "sourcing_nodes_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "theses" ADD CONSTRAINT "theses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_public_ref_unique" UNIQUE("public_ref");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
