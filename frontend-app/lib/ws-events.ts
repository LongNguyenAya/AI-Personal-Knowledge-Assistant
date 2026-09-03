// Khớp thủ công với backend-service/src/types/ws-events.ts, 2 phía không dùng chung package nên phải tự đồng bộ tay.
export type WsEvent =
  | { type: "reminder_due"; reminderId: string; title: string; dueAt: string; taskTitles: string[] }
  | { type: "task_created"; taskId: string; title: string }
  | { type: "document_status"; documentId: string; status: "processing" | "processed" | "failed" };
