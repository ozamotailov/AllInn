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
  /** Evict EMPTY rooms (no seated players) with no connections after this idle. */
  roomTtlMinutes: number;
  /** Evict rooms that have seated players but no connections after this idle. */
  roomAbandonMinutes: number;
  /** Log non-secret diagnostics when initData validation fails. */
  authDebug: boolean;
  /** Run the Telegram bot (long-polling) that answers /start with a welcome. */
  botPolling: boolean;
  /** Public HTTPS URL of the Mini App — used for the /start launch button. */
  miniAppUrl: string;
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
    roomAbandonMinutes: Number(process.env.ROOM_ABANDON_MINUTES ?? 720),
    authDebug: process.env.AUTH_DEBUG === 'true',
    botPolling: process.env.BOT_POLLING === 'true',
    miniAppUrl: process.env.MINI_APP_URL ?? '',
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

/**
 * A t.me link that opens the app fresh (no room) — only for a NAMED Direct Mini
 * App. The main menu-button app has no such link, so prefer MINI_APP_URL
 * (a web_app button) there. Returns '' when neither applies.
 */
export function appLinkFor(env: Env): string {
  if (!env.botUsername || !env.appShortName) return '';
  return `https://t.me/${env.botUsername}/${env.appShortName}`;
}
