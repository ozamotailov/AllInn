import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card } from '../cards.js';
import type { RoomConfig } from '../config.js';
import {
  buildShuffledDeck,
  dealFromDeck,
  deckSeedString,
  seededRandomInt,
  sha256Hex,
  verifyReveal,
} from './fairness.js';
import { HandMachine, type HandPlayer } from './handMachine.js';

const cardEq = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;
const cfg = (): RoomConfig => ({
  gameType: 'cash', smallBlind: 1, bigBlind: 2, startingStack: 100,
  maxPlayers: 9, actionTimerSeconds: 20, rebuy: { enabled: true },
});

test('shuffle is deterministic per seed and varies across seeds', () => {
  const a = buildShuffledDeck('aa', 'c', 1);
  const b = buildShuffledDeck('aa', 'c', 1);
  const c = buildShuffledDeck('bb', 'c', 1);
  assert.ok(a.every((card, i) => cardEq(card, b[i])), 'same seed → same deck');
  assert.ok(!a.every((card, i) => cardEq(card, c[i])), 'different seed → different deck');
  assert.equal(new Set(a.map((x) => x.rank + x.suit)).size, 52, 'still 52 distinct cards');
});

test('verifyReveal accepts a correct reveal and rejects a tampered seed', async () => {
  const serverSeed = 'deadbeefcafef00d';
  const clientSeed = 'u1,u2';
  const nonce = 7;
  const commitment = await sha256Hex(serverSeed);
  const deck = buildShuffledDeck(serverSeed, clientSeed, nonce);
  const board = dealFromDeck(deck, 2).board;

  const good = await verifyReveal({ commitment, serverSeed, clientSeed, nonce, seatCount: 2 }, board);
  assert.deepEqual(good, { hashOk: true, boardOk: true });

  const tampered = await verifyReveal(
    { commitment, serverSeed: 'ffffffffffffffff', clientSeed, nonce, seatCount: 2 },
    board,
  );
  assert.equal(tampered.hashOk, false);
});

test('dealFromDeck reproduces the exact cards the engine deals', () => {
  const serverSeed = 'a1b2c3d4';
  const clientSeed = 'u0,u1';
  const nonce = 3;
  const seed = deckSeedString(serverSeed, clientSeed, nonce);

  const players: HandPlayer[] = [
    { seat: 0, userId: 'u0', displayName: 'P0', stack: 100 },
    { seat: 1, userId: 'u1', displayName: 'P1', stack: 100 },
  ];
  const hm = new HandMachine(cfg(), players, 0, seededRandomInt(seed));
  hm.start();
  // Drive heads-up to showdown with check/call only (full 5-card board).
  let guard = 0;
  while (!hm.isComplete() && guard++ < 50) {
    const seat = hm.toActSeat;
    if (seat === undefined) break;
    const lm = hm.legalMoves();
    if (!lm) break;
    hm.applyAction(seat, lm.canCheck ? { type: 'check' } : { type: 'call' });
  }
  assert.ok(hm.isComplete());

  const expected = dealFromDeck(buildShuffledDeck(serverSeed, clientSeed, nonce), 2);
  const result = hm.result();
  assert.equal(result.board.length, 5);
  assert.ok(result.board.every((c, i) => cardEq(c, expected.board[i])), 'board matches');
  for (const entry of result.showdown) {
    const hole = expected.holeCards[entry.seat];
    assert.ok(entry.holeCards.every((c, i) => cardEq(c, hole[i])), `seat ${entry.seat} hole matches`);
  }
});
