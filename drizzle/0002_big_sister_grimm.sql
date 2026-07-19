ALTER TABLE "opportunities" ADD COLUMN "decision_note" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "decided_by" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "theses" ADD COLUMN "conviction_threshold" integer DEFAULT 68 NOT NULL;--> statement-breakpoint
ALTER TABLE "theses" ADD COLUMN "profile_json" jsonb;