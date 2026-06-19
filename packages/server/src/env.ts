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

/**
 * Build a Mini App invite link, or '' if the bot username isn't configured.
 * - With APP_SHORT_NAME → a named Direct Mini App link (needs /newapp + its URL).
 * - Without it → the bot's MAIN Mini App link (the menu-button app).
 * Both pass `code` through as start_param.
 */
export function inviteLinkFor(code: string, env: Env): string {
  if (!env.botUsername) return '';
  return env.appShortName
    ? `https://t.me/${env.botUsername}/${env.appShortName}?startapp=${code}`
    : `https://t.me/${env.botUsername}?startapp=${code}`;
}
