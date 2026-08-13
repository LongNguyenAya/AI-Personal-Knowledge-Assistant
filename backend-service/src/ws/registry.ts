import type { WSContext } from "hono/ws";
import type { WebSocketLike } from "@hono/node-server";
import type { WsEvent } from "../types/ws-events";

// 1 user có thể mở nhiều tab/thiết bị cùng lúc, nên mỗi userId map tới 1 tập hợp socket chứ
// không phải 1 socket. Map in-memory là đủ cho service chạy 1 process; scale nhiều instance thì
// mới cần Redis pub/sub.
const connectionsByUser = new Map<string, Set<WSContext<WebSocketLike>>>();

export function addConnection(userId: string, ws: WSContext<WebSocketLike>) {
  let sockets = connectionsByUser.get(userId);
  if (!sockets) {
    sockets = new Set();
    connectionsByUser.set(userId, sockets);
  }
  sockets.add(ws);
}

export function removeConnection(userId: string, ws: WSContext<WebSocketLike>) {
  const sockets = connectionsByUser.get(userId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) connectionsByUser.delete(userId);
}

// Gọi bởi scheduler/reminder-scheduler.ts để đẩy event tới tất cả socket đang mở của 1 user.
export function sendToUser(userId: string, event: WsEvent) {
  const sockets = connectionsByUser.get(userId);
  if (!sockets) return;

  const payload = JSON.stringify(event);
  for (const ws of sockets) {
    if (ws.readyState !== 1 /* OPEN */) {
      sockets.delete(ws); // dọn socket đã chết nhưng lỡ chưa qua onClose
      continue;
    }
    ws.send(payload);
  }
}
