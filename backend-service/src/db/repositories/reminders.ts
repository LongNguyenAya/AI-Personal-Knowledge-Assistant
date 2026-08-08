import { reminders, reminderSourceEnum } from "@ai-assistant/db/src/schema";
import { withUserContext } from "../context";

type ReminderSource = (typeof reminderSourceEnum.enumValues)[number];

export async function createReminder(
  userId: string,
  data: { title: string; content?: string; dueAt: Date; source: ReminderSource }
) {
  const [created] = await withUserContext(userId, (tx) =>
    tx.insert(reminders).values({ userId, ...data }).returning()
  );
  return created;
}
