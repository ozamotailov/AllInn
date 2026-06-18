// HTTP routes.
//   Step 1: authenticate via initData → session JWT; /me verifies a token.
//   Step 2: create rooms (auth required) and look up room info.

import type { FastifyInstance } from 'fastify';
import {
  validateConfig,
  type AuthRequest,
  type AuthResponse,
  type SessionUser,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type RoomInfo,
} from '@allinn/shared';
import { validateInitData, InitDataError, type TelegramUser } from '../auth/initData.js';
import { signSession, SessionError } from '../auth/jwt.js';
import { requireSession } from '../auth/bearer.js';
import { type Env, inviteLinkFor } from '../env.js';
import type { RoomRegistry } from '../rooms/registry.js';

function displayNameOf(u: TelegramUser): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ');
  return full || u.username || `Player ${u.id}`;
}

function issue(user: SessionUser, secret: string): AuthResponse {
  return { token: signSession({ sub: user.id, name: user.displayName }, secret), user };
}

export function registerRoutes(app: FastifyInstance, env: Env, registry: RoomRegistry): void {
  app.get('/health', async () => ({ ok: true }));

  // ── Auth (step 1) ──────────────────────────────────────────────────────────
  app.post('/auth', async (req, reply) => {
    const { initData = '' } = (req.body ?? {}) as Partial<AuthRequest>;
    try {
      const v = validateInitData(initData, env.botToken);
      const user: SessionUser = { id: String(v.user.id), displayName: displayNameOf(v.user) };
      return issue(user, env.sessionSecret);
    } catch (e) {
      if (e instanceof InitDataError) return reply.code(401).send({ error: e.message });
      throw e;
    }
  });

  // Dev-only login bypass. Always registered so a disabled call returns a clear
  // 403 instead of a confusing 404; gated by ALLOW_DEV_AUTH.
  app.post('/auth/dev', async (req, reply) => {
    if (!env.allowDevAuth) {
      return reply.code(403).send({
        error:
          'Dev auth is disabled — set ALLOW_DEV_AUTH=true in packages/server/.env and restart (local browser testing only)',
      });
    }
    // Optional ?id=&name= so dev sessions can simulate distinct users.
    const q = req.query as { id?: string; name?: string };
    const id = q.id ?? 'dev-1';
    const displayName = q.name ?? (q.id ? `Dev ${q.id}` : 'Dev User');
    return issue({ id, displayName }, env.sessionSecret);
  });

  app.get('/me', async (req, reply) => {
    try {
      const claims = requireSession(req, env.sessionSecret);
      const user: SessionUser = { id: claims.sub, displayName: claims.name };
      return user;
    } catch (e) {
      if (e instanceof SessionError) return reply.code(401).send({ error: e.message });
      throw e;
    }
  });

  // ── Rooms (step 2) ─────────────────────────────────────────────────────────
  app.post('/rooms', async (req, reply) => {
    let hostId: string;
    try {
      hostId = requireSession(req, env.sessionSecret).sub;
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { config } = (req.body ?? {}) as Partial<CreateRoomRequest>;
    if (!config) return reply.code(400).send({ error: 'Missing config' });
    const errors = validateConfig(config);
    if (errors.length) return reply.code(400).send({ error: errors.join('; ') });

    const actor = registry.create(config, hostId);
    const res: CreateRoomResponse = {
      code: actor.roomCode,
      inviteLink: inviteLinkFor(actor.roomCode, env),
      config,
    };
    return res;
  });

  app.get('/rooms/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const actor = registry.get(code);
    if (!actor) return reply.code(404).send({ error: 'Room not found' });
    const s = actor.snapshot();
    const info: RoomInfo = {
      code,
      phase: s.phase,
      config: s.config,
      seatsTaken: s.seats.filter((x) => x.status !== 'empty').length,
      maxPlayers: s.config.maxPlayers,
    };
    return info;
  });
}
