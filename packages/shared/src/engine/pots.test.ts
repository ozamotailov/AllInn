import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPots, type SeatContribution } from './pots.js';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
function conserved(contribs: SeatContribution[]) {
  const { pots, refunds } = buildPots(contribs);
  const out = sum(pots.map((p) => p.amount)) + sum(Object.values(refunds));
  assert.equal(out, sum(contribs.map((c) => c.total)), 'chips must be conserved');
  return { pots, refunds };
}

test('equal contributions → single pot, everyone eligible', () => {
  const { pots, refunds } = conserved([
    { seat: 0, total: 100, folded: false },
    { seat: 1, total: 100, folded: false },
    { seat: 2, total: 100, folded: false },
  ]);
  assert.equal(pots.length, 1);
  assert.equal(pots[0].amount, 300);
  assert.deepEqual([...pots[0].eligibleSeats].sort(), [0, 1, 2]);
  assert.deepEqual(refunds, {});
});

test('one short all-in → main pot + side pot', () => {
  // seat 0 all-in 50; seats 1,2 put 100.
  const { pots } = conserved([
    { seat: 0, total: 50, folded: false },
    { seat: 1, total: 100, folded: false },
    { seat: 2, total: 100, folded: false },
  ]);
  assert.equal(pots.length, 2);
  assert.equal(pots[0].amount, 150); // 50*3, all eligible
  assert.deepEqual([...pots[0].eligibleSeats].sort(), [0, 1, 2]);
  assert.equal(pots[1].amount, 100); // 50*2, only 1 and 2
  assert.deepEqual([...pots[1].eligibleSeats].sort(), [1, 2]);
});

test('uncalled overbet is refunded, not put in a pot', () => {
  // seat 2 bets 200 but 0 and 1 only called 100 → top 100 refunded to seat 2.
  const { pots, refunds } = conserved([
    { seat: 0, total: 100, folded: false },
    { seat: 1, total: 100, folded: false },
    { seat: 2, total: 200, folded: false },
  ]);
  assert.equal(pots.length, 1);
  assert.equal(pots[0].amount, 300);
  assert.equal(refunds[2], 100);
});

test('folded contributors add chips to the pot but cannot win', () => {
  const { pots } = conserved([
    { seat: 0, total: 100, folded: false },
    { seat: 1, total: 100, folded: true },
    { seat: 2, total: 100, folded: false },
  ]);
  assert.equal(pots[0].amount, 300);
  assert.deepEqual([...pots[0].eligibleSeats].sort(), [0, 2]);
});

test('conservation holds across many random contribution sets', () => {
  // Deterministic pseudo-random (no Date/Math.random needed): linear congruential.
  let s = 123456789;
  const rnd = (n: number) => ((s = (s * 1103515245 + 12345) & 0x7fffffff) % n);
  for (let iter = 0; iter < 500; iter++) {
    const n = 2 + rnd(7);
    const contribs: SeatContribution[] = [];
    for (let i = 0; i < n; i++) {
      contribs.push({ seat: i, total: rnd(300), folded: rnd(3) === 0 });
    }
    conserved(contribs);
  }
});
