// Server entrypoint: HTTP (auth + rooms + health) + WebSocket gateway.

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadEnv } from './env.js';
import { registerRoutes } from './http/routes.js';
import { createGateway } from './ws/gateway.js';
import { RoomRegistry } from './rooms/registry.js';
import { SqliteRoomStore } from './store/sqlite.js';

// Load packages/server/.env (if present) before reading config. Node 20.12+.
try {
  (process as NodeJS.Process & { loadEnvFile?: (path?: string) => void }).loadEnvFile?.();
} catch {
  /* no .env file — fall back to the real environment */
}

const env = loadEnv();
const app = Fastify({ logger: true });
const registry = new RoomRegistry(new SqliteRoomStore(env.dbPath), {
  ttlMs: env.roomTtlMinutes * 60 * 1000,
  abandonMs: env.roomAbandonMinutes * 60 * 1000,
  onEvict: (code) => app.log.info({ code }, 'evicted idle room'),
  log: (obj, msg) => app.log.info(obj, msg),
});

const start = async () => {
  try {
    // Dev: the Mini App is served from a different origin (Vite/tunnel).
    await app.register(cors, { origin: true });
    registerRoutes(app, env, registry);

    await app.listen({ port: env.port, host: '0.0.0.0' });
    createGateway(app.server, { sessionSecret: env.sessionSecret, registry, log: app.log });

    if (!env.sessionSecret) {
      app.log.warn('SESSION_SECRET is empty — set it before any real use.');
    }
    if (!env.botToken) {
      app.log.warn('BOT_TOKEN is empty — /auth will reject all Telegram logins.');
    } else {
      // The id before ':' is the bot's (public) user id — compare it with the
      // bot whose Mini App you launch. A mismatch causes "Invalid hash".
      app.log.info(`auth bot id: ${env.botToken.split(':')[0]}`);
    }
    if (env.allowDevAuth) {
      app.log.warn('ALLOW_DEV_AUTH=true — POST /auth/dev is OPEN. Local development only!');
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();
