// The event type pushed over WebSocket, a union on "type" so the client can switch/case safely.
export type WsEvent =
  | { type: "reminder_due"; reminderId: string; title: string; dueAt: string; taskTitles: string[] }
  | { type: "task_created"; taskId: string; title: string }
  | { type: "document_status"; documentId: string; status: "processing" | "processed" | "failed" };
