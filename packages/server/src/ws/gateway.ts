// WebSocket gateway: authenticates a connection via the session JWT (passed as
// a query param, since browser WebSocket can't set headers), looks up the room,
// and routes messages to its TableActor.
//
// NOTE: tokens in URLs can leak via logs/proxies. For production, swap this for
// a short-lived single-use WS ticket issued over HTTPS. Fine for now.

import { WebSocketServer, type WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'node:http';
import type { ClientMessage, ServerMessage } from '@allinn/shared';
import { verifySession, type SessionClaims } from '../auth/jwt.js';
import type { RoomRegistry } from '../rooms/registry.js';

export interface GatewayDeps {
  sessionSecret: string;
  registry: RoomRegistry;
  log?: { info(obj: object, msg?: string): void };
}

export function createGateway(httpServer: Server, deps: GatewayDeps): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token') ?? '';
    const roomCode = url.searchParams.get('room') ?? '';

    let claims: SessionClaims;
    try {
      claims = verifySession(token, deps.sessionSecret);
    } catch {
      send(ws, { t: 'error', code: 'auth', message: 'Invalid session token' });
      ws.close();
      return;
    }

    const actor = deps.registry.get(roomCode);
    if (!actor) {
      send(ws, { t: 'error', code: 'no_room', message: 'Room not found' });
      ws.close();
      return;
    }

    const userId = claims.sub;
    deps.log?.info({ userId, room: roomCode }, 'ws connected');
    const conn = {
      userId,
      displayName: claims.name,
      send: (msg: ServerMessage) => send(ws, msg),
    };
    actor.attach(conn);

    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        return send(ws, { t: 'error', code: 'bad_json', message: 'Invalid JSON' });
      }
      switch (msg.t) {
        case 'sit': {
          const result = actor.sit(userId, claims.name, msg.seat);
          if (!result.ok) send(ws, { t: 'error', code: 'sit', message: result.error });
          return;
        }
        case 'leave':
          return actor.leave(userId);
        case 'action':
          return actor.handleAction(userId, msg.intent);
        case 'rebuy':
          return actor.rebuy(userId, msg.amount);
        case 'ledger':
          return actor.sendLedger();
        case 'ping':
          return send(ws, { t: 'pong' });
        default:
          // join is handled at connection.
          return send(ws, { t: 'error', code: 'unimplemented', message: `TODO: ${msg.t}` });
      }
    });

    ws.on('close', () => {
      deps.log?.info({ userId, room: roomCode }, 'ws closed');
      actor.detach(userId, conn);
    });
  });

  return wss;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}
