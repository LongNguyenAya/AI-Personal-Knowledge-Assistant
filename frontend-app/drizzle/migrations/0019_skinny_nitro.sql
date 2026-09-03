ALTER TABLE "documents" ADD COLUMN "flagged_suspicious" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "flag_reason" text;