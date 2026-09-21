CREATE TYPE "public"."kg_entity_kind" AS ENUM('person', 'organization', 'project', 'concept');--> statement-breakpoint
CREATE TABLE "kg_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"entity_kind" "kg_entity_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kg_entities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "kg_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"source_chunk_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kg_relations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "kg_entities" ADD CONSTRAINT "kg_entities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_relations" ADD CONSTRAINT "kg_relations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_relations" ADD CONSTRAINT "kg_relations_source_entity_id_kg_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."kg_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_relations" ADD CONSTRAINT "kg_relations_target_entity_id_kg_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."kg_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kg_relations" ADD CONSTRAINT "kg_relations_source_chunk_id_chunks_id_fk" FOREIGN KEY ("source_chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kg_entities_user_id_idx" ON "kg_entities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "kg_relations_user_id_idx" ON "kg_relations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "kg_relations_source_entity_idx" ON "kg_relations" USING btree ("source_entity_id");--> statement-breakpoint
CREATE INDEX "kg_relations_target_entity_idx" ON "kg_relations" USING btree ("target_entity_id");--> statement-breakpoint
CREATE POLICY "kg_entities_user_isolation" ON "kg_entities" AS PERMISSIVE FOR ALL TO "app_user" USING ("kg_entities"."user_id" = current_setting('app.current_user_id')::uuid) WITH CHECK ("kg_entities"."user_id" = current_setting('app.current_user_id')::uuid);--> statement-breakpoint
CREATE POLICY "kg_relations_user_isolation" ON "kg_relations" AS PERMISSIVE FOR ALL TO "app_user" USING ("kg_relations"."user_id" = current_setting('app.current_user_id')::uuid) WITH CHECK ("kg_relations"."user_id" = current_setting('app.current_user_id')::uuid);