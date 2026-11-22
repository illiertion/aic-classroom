import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "../../shared/protocol";

export type SocketStatus = "connecting" | "open" | "closed";

interface Options {
  classroomId: string;
  role: "teacher" | "student";
  token?: string;
  enabled?: boolean;
  onMessage: (message: ServerMessage) => void;
  onOpen?: () => void;
}

export interface ClassroomSocket {
  status: SocketStatus;
  send: (message: ClientMessage) => void;
  reconnects: number;
}

/**
 * Classroom socket with exponential backoff reconnection and a small outbox.
 * Authorization is a teacher cookie (same-origin) or a temporary participant
 * token; the Worker validates both and forwards to the classroom Durable Object.
 */
export function useClassroomSocket({
  classroomId,
  token,
  enabled = true,
  onMessage,
  onOpen,
}: Options): ClassroomSocket {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [reconnects, setReconnects] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const outboxRef = useRef<string[]>([]);
  const handlerRef = useRef(onMessage);
  const openRef = useRef(onOpen);
  handlerRef.current = onMessage;
  openRef.current = onOpen;

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    const payload = JSON.stringify(message);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
      return;
    }
    if (outboxRef.current.length < 60) outboxRef.current.push(payload);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let attempts = 0;
    let retryTimer: number | null = null;
    let heartbeat: number | null = null;
    let closedByUs = false;

    const open = () => {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      const socket = new WebSocket(
        `${protocol}://${window.location.host}/api/v1/realtime/${encodeURIComponent(classroomId)}${query}`,
      );
      socketRef.current = socket;
      setStatus("connecting");

      socket.onopen = () => {
        if (disposed) return;
        if (attempts > 0) setReconnects((value) => value + 1);
        attempts = 0;
        setStatus("open");
        for (const payload of outboxRef.current.splice(0)) socket.send(payload);
        openRef.current?.();
        heartbeat = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" } satisfies ClientMessage));
          }
        }, 20_000);
      };

      socket.onmessage = (event) => {
        try {
          handlerRef.current(JSON.parse(String(event.data)) as ServerMessage);
        } catch {
          /* ignore malformed frames */
        }
      };

      socket.onerror = () => {
        /* onclose schedules the retry */
      };

      socket.onclose = (event) => {
        if (heartbeat) window.clearInterval(heartbeat);
        heartbeat = null;
        if (disposed || closedByUs) return;
        setStatus("closed");
        if (event.code === 4001) return; // class ended
        attempts += 1;
        const delay = Math.min(10_000, 700 * 2 ** Math.min(attempts, 5)) + Math.random() * 300;
        retryTimer = window.setTimeout(open, delay);
      };
    };

    open();

    return () => {
      disposed = true;
      closedByUs = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (heartbeat) window.clearInterval(heartbeat);
      if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
        socketRef.current.close(1000, "leaving");
      }
      socketRef.current = null;
    };
  }, [classroomId, token, enabled]);

  return { status, send, reconnects };
}
