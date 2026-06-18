// Provably-fair deck: the shuffle is a deterministic, fully-specified function
// of (serverSeed, clientSeed, nonce). The server commits sha256(serverSeed)
// BEFORE the hand and reveals serverSeed AFTER it, so anyone can recompute the
// exact deck and confirm no card was altered mid-hand.
//
// The PRNG (cyrb128 + sfc32, public-domain by bryc) is deterministic across JS
// engines, so server and client reproduce byte-identical shuffles with no async
// and no native crypto. Only the commitment uses SHA-256.
//
// Scope note: this proves the deck was fixed before any action and unaltered
// after (no mid-hand manipulation). Full anti-grinding (per-hand client-seed
// commitments) is future hardening; clientSeed here is public hand context.

import { createDeck, shuffle, type Card, type RandomInt } from '../cards.js';

export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Deterministic RandomInt stream seeded from a string. */
export function seededRandomInt(seed: string): RandomInt {
  const [a, b, c, d] = cyrb128(seed);
  const rng = sfc32(a, b, c, d);
  return (max) => Math.floor(rng() * max);
}

export function deckSeedString(serverSeed: string, clientSeed: string, nonce: number): string {
  return `${serverSeed}:${clientSeed}:${nonce}`;
}

/** The exact deck the engine deals from for a given seed triple. */
export function buildShuffledDeck(serverSeed: string, clientSeed: string, nonce: number): Card[] {
  return shuffle(createDeck(), seededRandomInt(deckSeedString(serverSeed, clientSeed, nonce)));
}

/**
 * Reproduces the engine's deal order: cards are drawn from the end of the
 * shuffled deck — two per seat (ascending seat order), then the 5-card board.
 */
export function dealFromDeck(
  deck: Card[],
  seatCount: number,
): { holeCards: Array<[Card, Card]>; board: Card[] } {
  let i = deck.length - 1;
  const draw = () => deck[i--];
  const holeCards: Array<[Card, Card]> = [];
  for (let s = 0; s < seatCount; s++) holeCards.push([draw(), draw()]);
  const board: Card[] = [draw(), draw(), draw(), draw(), draw()];
  return { holeCards, board };
}

/** SHA-256 hex via Web Crypto (available in browsers and Node 20+). */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Revealed after a hand so anyone can recompute and verify the deck. */
export interface FairnessReveal {
  commitment: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  /** Players dealt into the hand — needed to locate the board in the deck. */
  seatCount: number;
}

/** Verify a reveal: the commitment matches serverSeed, and the actual board
 *  matches the board the committed shuffle produces. */
export async function verifyReveal(
  reveal: FairnessReveal,
  board: Card[],
): Promise<{ hashOk: boolean; boardOk: boolean }> {
  const hashOk = (await sha256Hex(reveal.serverSeed)) === reveal.commitment;
  const deck = buildShuffledDeck(reveal.serverSeed, reveal.clientSeed, reveal.nonce);
  const expected = dealFromDeck(deck, reveal.seatCount).board;
  const boardOk =
    board.length <= expected.length &&
    board.every((c, i) => c.rank === expected[i].rank && c.suit === expected[i].suit);
  return { hashOk, boardOk };
}
