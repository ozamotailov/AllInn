// Minimal HS256 JWT (sign + verify) on node:crypto — no external dependency.
// We control both ends, so we only need one algorithm and a small claim set.

import crypto from 'node:crypto';

export interface SessionClaims {
  /** User id (Telegram user id as string). */
  sub: string;
  /** Display name, cached for convenience. */
  name: string;
  /** Issued-at (unix seconds). */
  iat: number;
  /** Expiry (unix seconds). */
  exp: number;
}

export class SessionError extends Error {}

function b64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

export function signSession(
  data: { sub: string; name: string },
  secret: string,
  ttlSeconds = 86_400,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ sub: data.sub, name: data.name, iat: now, exp: now + ttlSeconds }),
  );
  const signingInput = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${sig}`;
}

export function verifySession(token: string, secret: string): SessionClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new SessionError('Malformed token');
  const [header, payload, sig] = parts;
  const signingInput = `${header}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new SessionError('Bad signature');
  }

  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    throw new SessionError('Malformed payload');
  }
  if (typeof claims.exp !== 'number' || Math.floor(Date.now() / 1000) >= claims.exp) {
    throw new SessionError('Token expired');
  }
  return claims;
}
