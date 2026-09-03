// Kiểu event đẩy qua WebSocket, union trên "type" để client switch/case an toàn.
export type WsEvent =
  | { type: "reminder_due"; reminderId: string; title: string; dueAt: string; taskTitles: string[] }
  | { type: "task_created"; taskId: string; title: string }
  | { type: "document_status"; documentId: string; status: "processing" | "processed" | "failed" };
