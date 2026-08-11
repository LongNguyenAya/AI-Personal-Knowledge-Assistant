import { Hono } from "hono";
import { upgradeWebSocket } from "@hono/node-server";
import type { AppEnv } from "../types";
import { wsAuthMiddleware } from "../middleware/ws-auth";
import { addConnection, removeConnection } from "../ws/registry";

const app = new Hono<AppEnv>();

app.get(
  "/ws",
  wsAuthMiddleware,
  upgradeWebSocket((c) => {
    const userId = c.get("userId");
    return {
      onOpen(_event, ws) {
        addConnection(userId, ws);
        console.log(`[ws] user ${userId} connected`);
      },
      onClose(_event, ws) {
        removeConnection(userId, ws);
        console.log(`[ws] user ${userId} disconnected`);
      },
      onError(event) {
        console.error("[ws] error:", event);
      },
    };
  })
);

export default app;
