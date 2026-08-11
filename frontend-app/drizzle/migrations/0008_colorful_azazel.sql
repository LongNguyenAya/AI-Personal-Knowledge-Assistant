DROP INDEX "reminders_user_id_idx";--> statement-breakpoint
DROP INDEX "tasks_user_id_idx";--> statement-breakpoint
CREATE INDEX "tasks_reminder_id_idx" ON "tasks" USING btree ("reminder_id");--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "deleted_at";--> statement-breakpoint
ALTER TABLE "reminders" DROP COLUMN "deleted_at";