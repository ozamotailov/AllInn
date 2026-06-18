// HTTP routes. Step 1 (ARCHITECTURE.md §11): authenticate via initData and
// issue a session JWT; expose /me to prove the token verifies.

import type { FastifyInstance } from 'fastify';
import type { AuthRequest, AuthResponse, SessionUser } from '@allinn/shared';
import { validateInitData, InitDataError, type TelegramUser } from '../auth/initData.js';
import { signSession, verifySession, SessionError } from '../auth/jwt.js';
import type { Env } from '../env.js';

function displayNameOf(u: TelegramUser): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ');
  return full || u.username || `Player ${u.id}`;
}

function issue(user: SessionUser, secret: string): AuthResponse {
  return { token: signSession({ sub: user.id, name: user.displayName }, secret), user };
}

export function registerRoutes(app: FastifyInstance, env: Env): void {
  app.get('/health', async () => ({ ok: true }));

  // Telegram login: validate initData → session JWT.
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

  // Dev-only bypass so the client can run in a plain browser during development.
  if (env.allowDevAuth) {
    app.post('/auth/dev', async () =>
      issue({ id: 'dev-1', displayName: 'Dev User' }, env.sessionSecret),
    );
  }

  // Verify a session token (used by the client to confirm auth / by future routes).
  app.get('/me', async (req, reply) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing bearer token' });
    }
    try {
      const claims = verifySession(header.slice('Bearer '.length), env.sessionSecret);
      const user: SessionUser = { id: claims.sub, displayName: claims.name };
      return user;
    } catch (e) {
      if (e instanceof SessionError) return reply.code(401).send({ error: e.message });
      throw e;
    }
  });
}
