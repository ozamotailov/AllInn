import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RoomConfig } from '../config.js';
import type { PlayerActionIntent } from '../actions.js';
import { HandMachine, type HandPlayer } from './handMachine.js';

const cfg = (sb: number, bb: number): RoomConfig => ({
  gameType: 'cash', smallBlind: sb, bigBlind: bb, startingStack: 200,
  maxPlayers: 9, actionTimerSeconds: 20, rebuy: { enabled: true },
});

function players(stacks: number[]): HandPlayer[] {
  return stacks.map((stack, i) => ({ seat: i, userId: `u${i}`, displayName: `P${i}`, stack }));
}
const committedOf = (hm: HandMachine, seat: number) =>
  hm.publicState('r').players.find((p) => p.seat === seat)!.committed;

test('heads-up: button posts small blind and acts first preflop', () => {
  const hm = new HandMachine(cfg(1, 2), players([100, 100]), 0, () => 0);
  hm.start();
  assert.equal(committedOf(hm, 0), 1); // button = SB
  assert.equal(committedOf(hm, 1), 2); // other = BB
  assert.equal(hm.toActSeat, 0);
});

test('3-handed: SB/BB are left of the button, UTG acts first', () => {
  const hm = new HandMachine(cfg(1, 2), players([100, 100, 100]), 0, () => 0);
  hm.start();
  assert.equal(committedOf(hm, 1), 1); // SB
  assert.equal(committedOf(hm, 2), 2); // BB
  assert.equal(hm.toActSeat, 0); // UTG (next after BB)
});

test('everyone folds to one player → that player wins the pot; chips conserved', () => {
  const hm = new HandMachine(cfg(1, 2), players([100, 100]), 0, () => 0);
  hm.start();
  assert.deepEqual(hm.applyAction(0, { type: 'fold' }), { ok: true });
  assert.ok(hm.isComplete());
  const stacks = hm.finalStacks();
  assert.equal(stacks.find((s) => s.seat === 1)!.stack, 101); // won SB(1)+BB(2) over own 2
  assert.equal(stacks.find((s) => s.seat === 0)!.stack, 99);
  assert.equal(stacks[0].stack + stacks[1].stack, 200);
});

test('rejects illegal actions: wrong turn, check facing a bet, sub-min raise', () => {
  const hm = new HandMachine(cfg(1, 2), players([100, 100]), 0, () => 0);
  hm.start(); // toAct = seat 0, currentBet 2, minRaise 2
  assert.equal(hm.applyAction(1, { type: 'check' }).ok, false); // not your turn
  assert.equal(hm.applyAction(0, { type: 'check' }).ok, false); // facing the BB
  assert.equal(hm.applyAction(0, { type: 'raise', amount: 3 }).ok, false); // < min raise (to 4)
  assert.equal(hm.applyAction(0, { type: 'raise', amount: 4 }).ok, true); // legal min raise
});

// ── Property test: random legal play always conserves chips and stays legal ────
function playRandom(seed: number): { before: number; after: number; completed: boolean } {
  let s = seed >>> 0 || 1;
  const rnd = (n: number) => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return n <= 0 ? 0 : s % n;
  };
  const count = 2 + rnd(5);
  const stacks = Array.from({ length: count }, () => 1 + rnd(80)); // short stacks force all-ins
  const before = stacks.reduce((a, b) => a + b, 0);
  const hm = new HandMachine(cfg(1, 2), players(stacks), rnd(count), (max) => rnd(max));
  hm.start();

  let guard = 0;
  while (!hm.isComplete() && guard++ < 2000) {
    const seat = hm.toActSeat;
    if (seat === undefined) break;
    const lm = hm.legalMoves();
    if (!lm) break;
    const choices: PlayerActionIntent[] = [{ type: 'fold' }];
    if (lm.canCheck) choices.push({ type: 'check' });
    if (lm.canCall) choices.push({ type: 'call' });
    if (lm.canRaise) {
      const span = lm.maxRaiseTo - lm.minRaiseTo;
      choices.push({ type: 'raise', amount: lm.minRaiseTo + rnd(span + 1) });
    }
    const choice = choices[rnd(choices.length)];
    const res = hm.applyAction(seat, choice);
    assert.ok(res.ok, `engine offered an illegal move: ${JSON.stringify({ choice, lm, res })}`);
  }
  const after = hm.finalStacks().reduce((a, b) => a + b.stack, 0);
  return { before, after, completed: hm.isComplete() };
}

test('random playouts: chips conserved and hand always completes (500 seeds)', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const { before, after, completed } = playRandom(seed);
    assert.ok(completed, `hand did not complete (seed ${seed})`);
    assert.equal(after, before, `chips not conserved (seed ${seed})`);
  }
});
