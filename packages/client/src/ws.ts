import type { ClientMessage, ServerMessage } from '@allinn/shared';
import { API_URL } from './config.js';

export interface RoomSocket {
  send(msg: ClientMessage): void;
  close(): void;
}

const PING_MS = 3000; // keep the link warm so proxies/tunnels don't drop it
const DEAD_MS = 7000; // no traffic at all for this long → treat the link as dead

/** Open a WebSocket to a room (auth + room as query params) with an app-level
 *  heartbeat. If the connection silently dies (no close event fires — common
 *  behind tunnels), the watchdog forces a close so the caller can reconnect. */
export function connectRoom(
  roomCode: string,
  token: string,
  onMessage: (msg: ServerMessage) => void,
  onClose?: (code: number, reason: string) => void,
): RoomSocket {
  const httpBase = API_URL || window.location.origin;
  const base = httpBase.replace(/^http/, 'ws');
  const ws = new WebSocket(
    `${base}/ws?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(token)}`,
  );

  let lastSeen = Date.now();
  let done = false;
  const bump = () => {
    lastSeen = Date.now();
  };

  const finish = (code: number, reason: string) => {
    if (done) return;
    done = true;
    clearInterval(heartbeat);
    onClose?.(code, reason);
  };

  ws.onopen = bump;
  ws.onmessage = (ev: MessageEvent) => {
    bump();
    try {
      onMessage(JSON.parse(ev.data as string) as ServerMessage);
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onclose = (ev: CloseEvent) => finish(ev.code, ev.reason);

  const heartbeat = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ t: 'ping' }));
    } catch {
      /* ignore */
    }
    if (Date.now() - lastSeen > DEAD_MS) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      finish(4000, 'heartbeat-timeout'); // synthetic — onclose may never fire on a dead link
    }
  }, PING_MS);

  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => {
      done = true;
      clearInterval(heartbeat);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    },
  };
}
