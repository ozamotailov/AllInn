import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLedger,
  simplifyDebts,
  type LedgerRow,
  type PlayerLedgerInput,
} from './settlement.js';

function rows(...nets: Array<[string, number]>): LedgerRow[] {
  return nets.map(([id, net]) => ({
    userId: id,
    displayName: id,
    buyIn: 0,
    finalStack: net,
    net,
  }));
}

test('computeLedger derives net from buy-in and final stack', () => {
  const input: PlayerLedgerInput[] = [
    { userId: 'a', displayName: 'Alice', totalBuyIn: 200, finalStack: 350 },
    { userId: 'b', displayName: 'Bob', totalBuyIn: 200, finalStack: 50 },
  ];
  const ledger = computeLedger(input);
  assert.equal(ledger[0].net, 150);
  assert.equal(ledger[1].net, -150);
});

test('simplifyDebts: single loser pays single winner', () => {
  const s = simplifyDebts(rows(['a', 150], ['b', -150]));
  assert.deepEqual(s, [
    { fromUserId: 'b', fromName: 'b', toUserId: 'a', toName: 'a', amount: 150 },
  ]);
});

test('simplifyDebts: produces at most n-1 transfers', () => {
  // 4 players, balanced. Naive pairing could need more; greedy stays minimal.
  const s = simplifyDebts(rows(['a', 100], ['b', 50], ['c', -120], ['d', -30]));
  assert.ok(s.length <= 3, `expected <= 3 transfers, got ${s.length}`);
  // Every transfer is positive.
  for (const t of s) assert.ok(t.amount > 0);
  // Conservation: total moved equals total owed.
  const moved = s.reduce((sum, t) => sum + t.amount, 0);
  assert.equal(moved, 150);
});

test('simplifyDebts: net-zero player is not involved', () => {
  const s = simplifyDebts(rows(['a', 100], ['b', 0], ['c', -100]));
  assert.equal(s.length, 1);
  assert.ok(!s.some((t) => t.fromUserId === 'b' || t.toUserId === 'b'));
});

test('simplifyDebts: throws when the ledger does not balance', () => {
  assert.throws(() => simplifyDebts(rows(['a', 100], ['b', -50])), /does not balance/);
});
