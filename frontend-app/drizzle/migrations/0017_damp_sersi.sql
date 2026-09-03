CREATE TABLE "weekly_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"week_end" timestamp with time zone NOT NULL,
	"summary_text" text NOT NULL,
	"stats" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weekly_digests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "weekly_digests" ADD CONSTRAINT "weekly_digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_digests_user_week_idx" ON "weekly_digests" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE POLICY "weekly_digests_user_isolation" ON "weekly_digests" AS PERMISSIVE FOR ALL TO "app_user" USING ("weekly_digests"."user_id" = current_setting('app.current_user_id')::uuid) WITH CHECK ("weekly_digests"."user_id" = current_setting('app.current_user_id')::uuid);