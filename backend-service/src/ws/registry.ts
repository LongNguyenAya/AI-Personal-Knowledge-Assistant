import type { WSContext } from "hono/ws";
import type { WebSocketLike } from "@hono/node-server";
import type { WsEvent } from "../types/ws-events";

// 1 user can open multiple tabs, each userId maps to a set of sockets, an in-memory Map is enough for 1 process.
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

// Called by scheduler/reminder-scheduler.ts to push an event to every open socket of 1 user.
export function sendToUser(userId: string, event: WsEvent) {
  const sockets = connectionsByUser.get(userId);
  if (!sockets) return;

  const payload = JSON.stringify(event);
  for (const ws of sockets) {
    if (ws.readyState !== 1 /* OPEN */) {
      sockets.delete(ws); // clean up a dead socket that hasn't gone through onClose yet
      continue;
    }
    ws.send(payload);
  }
}
