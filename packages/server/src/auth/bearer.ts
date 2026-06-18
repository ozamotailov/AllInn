import type { FastifyRequest } from 'fastify';
import { verifySession, SessionError, type SessionClaims } from './jwt.js';

/** Extract and verify the `Authorization: Bearer <jwt>` session. Throws SessionError. */
export function requireSession(req: FastifyRequest, secret: string): SessionClaims {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new SessionError('Missing bearer token');
  return verifySession(header.slice('Bearer '.length), secret);
}
