ALTER TABLE "reminders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "reminders" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."reminder_status";--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('pending', 'sent');--> statement-breakpoint
ALTER TABLE "reminders" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."reminder_status";--> statement-breakpoint
ALTER TABLE "reminders" ALTER COLUMN "status" SET DATA TYPE "public"."reminder_status" USING "status"::"public"."reminder_status";