// Centralized environment config with sane defaults.

export interface Env {
  port: number;
  botToken: string;
  sessionSecret: string;
  /** Dev-only: enables POST /auth/dev (no Telegram). MUST be false in prod. */
  allowDevAuth: boolean;
  /** Bot username (no @) — used to build invite links. */
  botUsername: string;
  /** Direct Mini App short name — used to build invite links. */
  appShortName: string;
  /** SQLite file path for room persistence. */
  dbPath: string;
  /** Evict rooms with no connections after this many minutes idle. */
  roomTtlMinutes: number;
  /** Log non-secret diagnostics when initData validation fails. */
  authDebug: boolean;
}

export function loadEnv(): Env {
  return {
    port: Number(process.env.PORT ?? 8080),
    botToken: process.env.BOT_TOKEN ?? '',
    sessionSecret: process.env.SESSION_SECRET ?? '',
    allowDevAuth: process.env.ALLOW_DEV_AUTH === 'true',
    botUsername: process.env.BOT_USERNAME ?? '',
    appShortName: process.env.APP_SHORT_NAME ?? '',
    dbPath: process.env.DB_PATH ?? 'allinn.db',
    roomTtlMinutes: Number(process.env.ROOM_TTL_MINUTES ?? 30),
    authDebug: process.env.AUTH_DEBUG === 'true',
  };
}

/** Build a Direct Mini App invite link, or '' if bot identity isn't configured. */
export function inviteLinkFor(code: string, env: Env): string {
  if (!env.botUsername || !env.appShortName) return '';
  return `https://t.me/${env.botUsername}/${env.appShortName}?startapp=${code}`;
}
