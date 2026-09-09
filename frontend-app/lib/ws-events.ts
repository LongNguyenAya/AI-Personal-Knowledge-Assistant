// Kept manually in sync with backend-service/src/types/ws-events.ts, the 2 sides don't share a package so this has to be synced by hand.
export type WsEvent =
  | { type: "reminder_due"; reminderId: string; title: string; dueAt: string; taskTitles: string[] }
  | { type: "task_created"; taskId: string; title: string }
  | { type: "document_status"; documentId: string; status: "processing" | "processed" | "failed" };
