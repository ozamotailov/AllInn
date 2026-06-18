// Server entrypoint: HTTP (health + future REST) + WebSocket gateway.

import Fastify from 'fastify';
import { createGateway } from './ws/gateway.js';

const PORT = Number(process.env.PORT ?? 8080);
const BOT_TOKEN = process.env.BOT_TOKEN ?? '';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true }));

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    createGateway(app.server, { botToken: BOT_TOKEN });
    app.log.info(`WebSocket gateway listening on ws://localhost:${PORT}/ws`);
    if (!BOT_TOKEN) {
      app.log.warn('BOT_TOKEN is empty — initData validation will reject all connections.');
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();
