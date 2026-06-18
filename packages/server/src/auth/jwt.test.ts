import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signSession, verifySession, SessionError } from './jwt.js';

const SECRET = 'test-secret';

test('sign/verify round-trip preserves claims', () => {
  const token = signSession({ sub: '42', name: 'Alice' }, SECRET);
  const claims = verifySession(token, SECRET);
  assert.equal(claims.sub, '42');
  assert.equal(claims.name, 'Alice');
  assert.ok(claims.exp > claims.iat);
});

test('rejects a token signed with a different secret', () => {
  const token = signSession({ sub: '1', name: 'x' }, SECRET);
  assert.throws(() => verifySession(token, 'wrong-secret'), SessionError);
});

test('rejects a tampered payload', () => {
  const token = signSession({ sub: '1', name: 'x' }, SECRET);
  const [header, , sig] = token.split('.');
  const forged = Buffer.from(
    JSON.stringify({ sub: '999', name: 'hax', iat: 0, exp: 9_999_999_999 }),
  ).toString('base64url');
  assert.throws(() => verifySession(`${header}.${forged}.${sig}`, SECRET), SessionError);
});

test('rejects an expired token', () => {
  const token = signSession({ sub: '1', name: 'x' }, SECRET, -1);
  assert.throws(() => verifySession(token, SECRET), /expired/);
});
