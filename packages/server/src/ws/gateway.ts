// WebSocket gateway: authenticates a connection from initData, then routes its
// messages to the right TableActor. Holds the in-memory registry of tables.
//
// STATUS: skeleton. Wire up across build-order steps 1–3 (ARCHITECTURE.md §11).

import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';
import { type ClientMessage, type ServerMessage, DEFAULT_CONFIG } from '@poker/shared';
import { validateInitData } from '../auth/initData.js';
import { TableActor } from '../table/actor.js';

export interface GatewayDeps {
  botToken: string;
}

export function createGateway(httpServer: Server, deps: GatewayDeps): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const tables = new Map<string, TableActor>();

  wss.on('connection', (ws: WebSocket) => {
    // First frame must carry initData for auth. After validation we'd issue a
    // session JWT (TODO) so subsequent frames skip re-validation.
    let authedUserId: string | null = null;

    ws.on('message', (raw) => {
      let msg: (ClientMessage & { initData?: string }) | undefined;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(ws, { t: 'error', code: 'bad_json', message: 'Invalid JSON' });
      }
      if (!msg) return;

      if (!authedUserId) {
        // Expect { t: 'join', roomCode, initData } as the opening frame.
        try {
          const v = validateInitData(msg.initData ?? '', deps.botToken);
          authedUserId = String(v.user.id);
          // TODO(step 2): use v.startParam as the room code for deep-link joins.
        } catch (e) {
          return send(ws, { t: 'error', code: 'auth', message: (e as Error).message });
        }
      }

      // TODO(step 3): look up / create the TableActor and dispatch msg.t.
      switch (msg.t) {
        case 'ping':
          return send(ws, { t: 'pong' });
        default:
          return send(ws, { t: 'error', code: 'unimplemented', message: `TODO: ${msg.t}` });
      }
    });
  });

  // Silence "unused" until steps 2–3 wire these in.
  void tables;
  void DEFAULT_CONFIG;
  void TableActor;

  return wss;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}
