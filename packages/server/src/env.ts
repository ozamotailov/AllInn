// Centralized environment config with sane defaults.

export interface Env {
  port: number;
  botToken: string;
  sessionSecret: string;
  /** Dev-only: enables POST /auth/dev (no Telegram). MUST be false in prod. */
  allowDevAuth: boolean;
}

export function loadEnv(): Env {
  return {
    port: Number(process.env.PORT ?? 8080),
    botToken: process.env.BOT_TOKEN ?? '',
    sessionSecret: process.env.SESSION_SECRET ?? '',
    allowDevAuth: process.env.ALLOW_DEV_AUTH === 'true',
  };
}
