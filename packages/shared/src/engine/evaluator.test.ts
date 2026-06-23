import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Card, Rank, Suit } from '../cards.js';
import { rank5, evaluate7, compareValue, bestHand, bestFive } from './evaluator.js';

function cards(s: string): Card[] {
  return s.split(' ').map((t) => ({ rank: t[0] as Rank, suit: t[1] as Suit }));
}
const cmp = (a: string, b: string) => compareValue(rank5(cards(a)), rank5(cards(b)));

test('category ordering: straight flush > quads > full house > flush > straight > trips', () => {
  assert.ok(cmp('Ah Kh Qh Jh Th', 'As Ad Ac Ah Ks') > 0); // SF > quads
  assert.ok(cmp('As Ad Ac Ah Ks', 'Ks Kd Kc 2s 2d') > 0); // quads > full house
  assert.ok(cmp('Ks Kd Kc 2s 2d', 'Ah Qh 9h 5h 2h') > 0); // full house > flush
  assert.ok(cmp('Ah Qh 9h 5h 2h', '9s 8d 7h 6c 5s') > 0); // flush > straight
  assert.ok(cmp('9s 8d 7h 6c 5s', 'Qs Qd Qc 7h 2s') > 0); // straight > trips
});

test('wheel A-2-3-4-5 is a 5-high straight, beaten by 6-high', () => {
  const wheel = rank5(cards('Ah 2d 3c 4s 5h'));
  assert.equal(wheel.category, 4);
  assert.equal(wheel.tiebreak[0], 5);
  assert.ok(compareValue(rank5(cards('6h 5d 4c 3s 2h')), wheel) > 0);
});

test('pair vs pair decided by kicker', () => {
  assert.ok(cmp('As Ad Kh 7c 5s', 'As Ad Qh 7c 5s') > 0);
  assert.equal(cmp('As Ad Kh 7c 5s', 'Ah Ac Ks 7d 5h'), 0); // identical ranks → tie
});

test('two pair decided by top pair then bottom then kicker', () => {
  assert.ok(cmp('Ks Kd 5h 5c Qs', 'Qs Qd Jh Jc As') > 0);
});

test('evaluate7 picks the best 5 of 7', () => {
  // Board makes a flush available; hole completes nut flush.
  const v = bestHand(
    [{ rank: 'A', suit: 'h' }, { rank: 'K', suit: 'd' }],
    cards('Qh Jh 9h 2h 3c'),
  );
  assert.equal(v.category, 5); // flush (Ah high)
  assert.equal(v.tiebreak[0], 14);
});

test('evaluate7 finds a straight using both hole and board', () => {
  const v = evaluate7(cards('9c 8d 7h 6s 5c 2h 2d'));
  assert.equal(v.category, 4);
  assert.equal(v.tiebreak[0], 9);
});

test('bestFive returns the 5 cards of the winning combination', () => {
  const key = (c: Card) => `${c.rank}${c.suit}`;
  // Nut flush in hearts; the 5 hearts should be chosen, not the off-suit kicker.
  const five = bestFive(
    [{ rank: 'A', suit: 'h' }, { rank: 'K', suit: 'd' }],
    cards('Qh Jh 9h 2h 3c'),
  );
  assert.equal(five.length, 5);
  const keys = new Set(five.map(key));
  assert.deepEqual(keys, new Set(['Ah', 'Qh', 'Jh', '9h', '2h']));
});
