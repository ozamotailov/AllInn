// 7-card Texas Hold'em hand evaluator. Produces a comparable HandValue
// (category + tiebreak ranks). Best-5-of-7 by brute force over the 21 combos —
// cheap and obviously correct, which is what matters for money math.

import type { Card, Rank } from '../cards.js';

const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

export type HandCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const CATEGORY_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
] as const;

export interface HandValue {
  category: HandCategory;
  /** Tiebreak ranks, high → low, comparable lexicographically within a category. */
  tiebreak: number[];
}

/** >0 if a beats b, <0 if b beats a, 0 if tied. */
export function compareValue(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category;
  const n = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < n; i++) {
    const x = a.tiebreak[i] ?? 0;
    const y = b.tiebreak[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function straightHighOf(uniqueDesc: number[]): number {
  if (uniqueDesc.length !== 5) return 0;
  let consecutive = true;
  for (let i = 0; i < 4; i++) {
    if (uniqueDesc[i] - 1 !== uniqueDesc[i + 1]) consecutive = false;
  }
  if (consecutive) return uniqueDesc[0];
  // Wheel: A-2-3-4-5 (Ace plays low).
  if (uniqueDesc[0] === 14 && uniqueDesc[1] === 5 && uniqueDesc[2] === 4 &&
      uniqueDesc[3] === 3 && uniqueDesc[4] === 2) {
    return 5;
  }
  return 0;
}

/** Rank exactly 5 cards. */
export function rank5(cards: Card[]): HandValue {
  const vals = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);
  const uniqueDesc = [...new Set(vals)].sort((a, b) => b - a);
  const straightHigh = straightHighOf(uniqueDesc);

  const freq = new Map<number, number>();
  for (const v of vals) freq.set(v, (freq.get(v) ?? 0) + 1);
  const groups = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const counts = groups.map((g) => g[1]);
  const byCount = (c: number) => groups.filter((g) => g[1] === c).map((g) => g[0]);

  if (isFlush && straightHigh) return { category: 8, tiebreak: [straightHigh] };
  if (counts[0] === 4) {
    const quad = byCount(4)[0];
    return { category: 7, tiebreak: [quad, Math.max(...vals.filter((v) => v !== quad))] };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    return { category: 6, tiebreak: [byCount(3)[0], byCount(2)[0]] };
  }
  if (isFlush) return { category: 5, tiebreak: [...vals] };
  if (straightHigh) return { category: 4, tiebreak: [straightHigh] };
  if (counts[0] === 3) {
    const trip = byCount(3)[0];
    const kickers = vals.filter((v) => v !== trip).sort((a, b) => b - a);
    return { category: 3, tiebreak: [trip, ...kickers] };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    const pairs = byCount(2).sort((a, b) => b - a);
    const kicker = Math.max(...vals.filter((v) => !pairs.includes(v)));
    return { category: 2, tiebreak: [pairs[0], pairs[1], kicker] };
  }
  if (counts[0] === 2) {
    const pair = byCount(2)[0];
    const kickers = vals.filter((v) => v !== pair).sort((a, b) => b - a);
    return { category: 1, tiebreak: [pair, ...kickers] };
  }
  return { category: 0, tiebreak: [...vals] };
}

/** Best 5-card value from 7 cards (also accepts exactly 5). */
export function evaluate7(cards: Card[]): HandValue {
  if (cards.length === 5) return rank5(cards);
  if (cards.length !== 7) throw new Error(`evaluate7 expects 5 or 7 cards, got ${cards.length}`);
  let best: HandValue | undefined;
  // Choose 5 of 7 = drop 2.
  for (let i = 0; i < 7; i++) {
    for (let j = i + 1; j < 7; j++) {
      const five = cards.filter((_, k) => k !== i && k !== j);
      const v = rank5(five);
      if (!best || compareValue(v, best) > 0) best = v;
    }
  }
  return best as HandValue;
}

export function bestHand(hole: readonly [Card, Card], board: readonly Card[]): HandValue {
  return evaluate7([...hole, ...board]);
}

export function handName(v: HandValue): string {
  return CATEGORY_NAMES[v.category];
}
