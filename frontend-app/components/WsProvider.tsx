"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { WsEvent } from "@/lib/ws-events";

type Listener = (event: WsEvent) => void;
type WsContextValue = { connected: boolean; subscribe: (fn: Listener) => () => void };

const WsContext = createContext<WsContextValue | null>(null);

const MIN_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

// 1 kết nối WS duy nhất cho cả app, tự thử kết nối lại khi đứt và lùi dần thời gian chờ để không spam server.
export function WsProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef(new Set<Listener>());

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = MIN_RECONNECT_DELAY_MS;
    let stopped = false;

    async function connect() {
      if (stopped) return;
      try {
        const res = await fetch("/api/ws-token");
        if (!res.ok) throw new Error("Không lấy được token WS");
        const { token } = await res.json();
        if (stopped) return;

        const backendWsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:4000";
        socket = new WebSocket(`${backendWsUrl}/ws?token=${token}`);

        socket.onopen = () => {
          reconnectDelay = MIN_RECONNECT_DELAY_MS;
          setConnected(true);
        };
        socket.onmessage = (event) => {
          let data: WsEvent;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }
          for (const fn of listenersRef.current) fn(data);
        };
        socket.onclose = () => {
          setConnected(false);
          if (stopped) return;
          reconnectTimer = setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
        };
        socket.onerror = () => socket?.close();
      } catch {
        if (stopped) return;
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      }
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  function subscribe(fn: Listener) {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }

  return <WsContext.Provider value={{ connected, subscribe }}>{children}</WsContext.Provider>;
}

// Luôn gọi handler mới nhất qua ref, tránh bắt component gọi phải tự bọc useCallback để không đăng ký lại mỗi lần render.
export function useWsEvent(handler: Listener) {
  const ctx = useContext(WsContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe((event) => handlerRef.current(event));
  }, [ctx]);
}

export function useWsConnected(): boolean {
  return useContext(WsContext)?.connected ?? false;
}
