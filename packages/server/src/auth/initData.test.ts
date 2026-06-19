import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateInitData, InitDataError } from './initData.js';

const TOKEN = 'test-token';

function sign(params: URLSearchParams, token: string): string {
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  return crypto.createHmac('sha256', secret).update(dcs).digest('hex');
}

// Build initData exactly like Telegram: the hash covers ALL fields except hash
// (including `signature` when present).
function build(withSignature: boolean): string {
  const p = new URLSearchParams();
  p.set('user', JSON.stringify({ id: 7, first_name: 'Sig' }));
  p.set('auth_date', String(Math.floor(Date.now() / 1000)));
  p.set('query_id', 'AAA');
  if (withSignature) p.set('signature', 'abc123_signature');
  p.set('hash', sign(p, TOKEN));
  return p.toString();
}

test('accepts initData whose hash includes the signature field', () => {
  const v = validateInitData(build(true), TOKEN);
  assert.equal(v.user.id, 7);
});

test('accepts initData without a signature field', () => {
  const v = validateInitData(build(false), TOKEN);
  assert.equal(v.user.id, 7);
});

test('rejects when the signature is tampered after signing', () => {
  const raw = build(true).replace(/signature=[^&]+/, 'signature=tampered');
  assert.throws(() => validateInitData(raw, TOKEN), InitDataError);
});
