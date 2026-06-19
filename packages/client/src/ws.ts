import type { ClientMessage, ServerMessage } from '@allinn/shared';
import { API_URL } from './config.js';

export interface RoomSocket {
  send(msg: ClientMessage): void;
  close(): void;
}

/** Open a WebSocket to a room. Auth + room are passed as query params. */
export function connectRoom(
  roomCode: string,
  token: string,
  onMessage: (msg: ServerMessage) => void,
  onClose?: () => void,
): RoomSocket {
  // Same-origin by default (API_URL empty) → derive ws(s):// from the page origin.
  const httpBase = API_URL || window.location.origin;
  const base = httpBase.replace(/^http/, 'ws');
  const ws = new WebSocket(
    `${base}/ws?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`,
  );

  ws.onmessage = (ev: MessageEvent) => {
    try {
      onMessage(JSON.parse(ev.data as string) as ServerMessage);
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onclose = () => onClose?.();

  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => ws.close(),
  };
}
