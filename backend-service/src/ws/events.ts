// Kiểu event đẩy qua WebSocket. reminder_due do scheduler emit khi reminder tới hạn; task_created
// khai báo sẵn cho sau này, hiện chưa ai emit. Union trên "type" để client switch/case an toàn.
export type WsEvent =
  | { type: "reminder_due"; reminderId: string; title: string; dueAt: string; taskTitles: string[] }
  | { type: "task_created"; taskId: string; title: string };
