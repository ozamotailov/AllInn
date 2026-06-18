// Card model + a pure, injectable-randomness shuffle.
// The engine never calls Math.random — the server injects a CSPRNG so the
// shuffle stays deterministic-for-tests and cryptographically sound in prod.

export type Suit = 'c' | 'd' | 'h' | 's';
export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const RANKS: readonly Rank[] = [
  '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A',
];
export const SUITS: readonly Suit[] = ['c', 'd', 'h', 's'];

/** A fresh, ordered 52-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Returns a uniformly random integer in [0, maxExclusive).
 * Server: back this with `crypto.randomInt`. Tests: a seeded PRNG.
 */
export type RandomInt = (maxExclusive: number) => number;

/** Fisher–Yates shuffle using an injected random source. Returns a new array. */
export function shuffle(deck: readonly Card[], randomInt: RandomInt): Card[] {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function cardToString(c: Card): string {
  return `${c.rank}${c.suit}`;
}
