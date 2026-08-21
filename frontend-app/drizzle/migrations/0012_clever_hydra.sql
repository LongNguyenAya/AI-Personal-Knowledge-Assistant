CREATE TYPE "public"."admin_metric" AS ENUM('signups', 'ai_queries');--> statement-breakpoint
CREATE TYPE "public"."admin_view" AS ENUM('week', 'month', 'year');--> statement-breakpoint
CREATE TABLE "admin_chart_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric" "admin_metric" NOT NULL,
	"view" "admin_view" NOT NULL,
	"analysis_text" text NOT NULL,
	"generated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_chart_analyses" ADD CONSTRAINT "admin_chart_analyses_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_chart_analyses_metric_view_created_idx" ON "admin_chart_analyses" USING btree ("metric","view","created_at");