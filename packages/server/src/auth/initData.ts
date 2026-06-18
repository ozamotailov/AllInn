// Telegram Mini App initData validation (HMAC-SHA256).
// Algorithm per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
//   secret      = HMAC_SHA256("WebAppData" as key, botToken)
//   dataCheck   = all fields except `hash`, as `key=value`, sorted by key, '\n'-joined
//   expected    = hex( HMAC_SHA256(secret as key, dataCheck) )
//   valid       <=> expected === hash  (and auth_date is fresh)

import crypto from 'node:crypto';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface ValidatedInitData {
  user: TelegramUser;
  /** Unix seconds when Telegram signed the data. */
  authDate: number;
  /** `startapp` value from a Direct Mini App invite link, if present. */
  startParam?: string;
}

export class InitDataError extends Error {}

/**
 * Validates a raw `initData` query string and returns the trusted payload.
 * Throws `InitDataError` on a bad signature or stale data.
 *
 * @param maxAgeSeconds reject data older than this (default 5 min, per Telegram guidance).
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 300,
): ValidatedInitData {
  if (!botToken) throw new InitDataError('BOT_TOKEN is not configured');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new InitDataError('Missing hash');
  params.delete('hash');
  // `signature` (Ed25519 third-party validation) is not part of the HMAC check.
  params.delete('signature');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new InitDataError('Invalid hash');
  }

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) throw new InitDataError('Missing auth_date');
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > maxAgeSeconds) {
    throw new InitDataError(`Stale initData (${ageSeconds}s old)`);
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new InitDataError('Missing user');
  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    throw new InitDataError('Malformed user payload');
  }

  return {
    user,
    authDate,
    startParam: params.get('start_param') ?? undefined,
  };
}
