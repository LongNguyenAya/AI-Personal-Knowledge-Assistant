CREATE TYPE "public"."knowledge_status" AS ENUM('pending', 'approved', 'rejected', 'revoked');--> statement-breakpoint
CREATE TABLE "knowledge_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(768),
	"status" "knowledge_status" DEFAULT 'pending' NOT NULL,
	"proposed_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_files" ADD CONSTRAINT "knowledge_files_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_files" ADD CONSTRAINT "knowledge_files_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_files_status_idx" ON "knowledge_files" USING btree ("status");