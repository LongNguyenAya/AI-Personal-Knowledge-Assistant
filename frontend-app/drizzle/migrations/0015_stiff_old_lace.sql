CREATE TYPE "public"."correction_status" AS ENUM('active', 'inactive', 'dismissed', 'expired');--> statement-breakpoint
CREATE TABLE "user_correction_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"entity_type" text,
	"field_name" text NOT NULL,
	"wrong_value" text,
	"corrected_value" text,
	"context_signature" text NOT NULL,
	"context_json" jsonb,
	"confidence" integer DEFAULT 0 NOT NULL,
	"status" "correction_status" DEFAULT 'active' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_correction_memories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_correction_memories" ADD CONSTRAINT "user_correction_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_correction_memories_user_status_idx" ON "user_correction_memories" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_correction_memories_user_source_idx" ON "user_correction_memories" USING btree ("user_id","source_type");--> statement-breakpoint
CREATE INDEX "user_correction_memories_user_field_idx" ON "user_correction_memories" USING btree ("user_id","field_name");--> statement-breakpoint
CREATE INDEX "user_correction_memories_user_context_idx" ON "user_correction_memories" USING btree ("user_id","context_signature");--> statement-breakpoint
CREATE POLICY "user_correction_memories_user_isolation" ON "user_correction_memories" AS PERMISSIVE FOR ALL TO "app_user" USING ("user_correction_memories"."user_id" = current_setting('app.current_user_id')::uuid) WITH CHECK ("user_correction_memories"."user_id" = current_setting('app.current_user_id')::uuid);