ALTER TABLE "kg_entities" ADD COLUMN "name_embedding" vector(768);--> statement-breakpoint
ALTER TABLE "kg_entities" ADD COLUMN "kind_disagreement" boolean DEFAULT false NOT NULL;