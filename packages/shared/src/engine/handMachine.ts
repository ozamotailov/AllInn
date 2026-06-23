// Authoritative hand state machine: preflop → flop → turn → river → showdown,
// including all-in branches. Pure (no I/O) so the client can validate intents
// against the same rules the server enforces, and so it's exhaustively testable.
//
// Money correctness (pot conservation, side pots) is the priority. One known
// simplification: a short all-in below the min-raise currently reopens betting
// for everyone; standard rules don't reopen for players who already acted. This
// affects who *may* re-raise, never the chips. Refine in a later pass.

import { createDeck, shuffle } from '../cards.js';
import { buildPots } from './pots.js';
import { bestHand, compareValue, handName, type HandValue } from './evaluator.js';
import type { Card, RandomInt } from '../cards.js';
import type { RoomConfig } from '../config.js';
import type { PlayerActionIntent } from '../actions.js';
import type {
  Street,
  PublicTableState,
  PersonalTableState,
  SeatStatus,
  LegalMoves,
} from '../state.js';
import type { ShowdownEntry } from '../protocol.js';

export interface HandPlayer {
  seat: number;
  userId: string;
  displayName: string;
  stack: number;
}

export type ApplyResult = { ok: true } | { ok: false; error: string };

export interface HandResult {
  board: Card[];
  /** seat → chips received this hand (pot winnings + refunds). */
  payouts: Record<number, number>;
  /** Empty when the hand ended by everyone folding (no reveal). */
  showdown: ShowdownEntry[];
}

interface Seat {
  seat: number;
  userId: string;
  displayName: string;
  stack: number;
  hole: [Card, Card] | null;
  /** Chips committed this street. */
  street: number;
  /** Chips committed this hand (drives pots). */
  total: number;
  status: 'active' | 'folded' | 'allin';
  /** Acted since the last bet/raise on this street. */
  acted: boolean;
}

export class HandMachine {
  private readonly seats: Seat[];
  private readonly sb: number;
  private readonly bb: number;
  private deck: Card[] = [];
  private board: Card[] = [];
  private _street: Street = 'preflop';
  private currentBet = 0;
  private minRaise = 0;
  private toAct: number | undefined;
  private sbSeat = -1;
  private bbSeat = -1;
  private complete = false;
  private payouts: Record<number, number> = {};
  private showdownEntries: ShowdownEntry[] = [];

  constructor(
    config: RoomConfig,
    players: HandPlayer[],
    private readonly buttonSeat: number,
    private readonly randomInt: RandomInt,
  ) {
    this.sb = config.smallBlind;
    this.bb = config.bigBlind;
    this.seats = players
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((p) => ({
        seat: p.seat,
        userId: p.userId,
        displayName: p.displayName,
        stack: p.stack,
        hole: null,
        street: 0,
        total: 0,
        status: 'active',
        acted: false,
      }));
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    if (this.seats.length < 2) throw new Error('Need at least 2 players');
    this.deck = shuffle(createDeck(), this.randomInt);

    if (this.seats.length === 2) {
      this.sbSeat = this.buttonSeat;
      this.bbSeat = this.nextSeat(this.buttonSeat, () => true)!;
    } else {
      this.sbSeat = this.nextSeat(this.buttonSeat, () => true)!;
      this.bbSeat = this.nextSeat(this.sbSeat, () => true)!;
    }
    this.postBlind(this.sbSeat, this.sb);
    this.postBlind(this.bbSeat, this.bb);
    this.currentBet = this.bb;
    this.minRaise = this.bb;

    for (const s of this.seats) s.hole = [this.draw(), this.draw()];

    this._street = 'preflop';
    this.toAct =
      this.seats.length === 2
        ? this.sbSeat
        : this.nextSeat(this.bbSeat, (s) => s.status === 'active');

    if (this.countActive() <= 1) this.advanceStreet(); // everyone all-in on blinds
  }

  applyAction(seat: number, intent: PlayerActionIntent): ApplyResult {
    if (this.complete) return { ok: false, error: 'Hand is complete' };
    if (seat !== this.toAct) return { ok: false, error: 'Not your turn' };
    const s = this.get(seat);
    if (!s || s.status !== 'active') return { ok: false, error: 'Cannot act' };
    const toCall = this.currentBet - s.street;

    switch (intent.type) {
      case 'fold':
        s.status = 'folded';
        s.acted = true;
        break;
      case 'check':
        if (toCall !== 0) return { ok: false, error: 'Cannot check facing a bet' };
        s.acted = true;
        break;
      case 'call': {
        if (toCall <= 0) return { ok: false, error: 'Nothing to call' };
        const pay = Math.min(toCall, s.stack);
        this.commit(s, pay);
        s.acted = true;
        break;
      }
      case 'bet':
      case 'raise': {
        const target = intent.amount ?? 0; // raise-to total this street
        const maxTo = s.street + s.stack;
        if (target <= this.currentBet) return { ok: false, error: 'Raise must exceed current bet' };
        if (target > maxTo) return { ok: false, error: 'Not enough chips' };
        const isAllIn = target === maxTo;
        const raiseSize = target - this.currentBet;
        if (raiseSize < this.minRaise && !isAllIn) {
          return { ok: false, error: `Min raise is to ${this.currentBet + this.minRaise}` };
        }
        this.commit(s, target - s.street);
        if (raiseSize >= this.minRaise) this.minRaise = raiseSize;
        this.currentBet = target;
        s.acted = true;
        for (const o of this.seats) if (o !== s && o.status === 'active') o.acted = false;
        break;
      }
      default:
        return { ok: false, error: 'Unknown action' };
    }

    this.afterAction();
    return { ok: true };
  }

  /** Fold a player out of turn (e.g. they left the table). Resolves the hand if
   *  only one player remains, and advances the street if the round is now done. */
  forfeit(seat: number): void {
    if (this.complete) return;
    const s = this.get(seat);
    if (!s || s.status !== 'active') return;
    s.status = 'folded';
    s.acted = true;
    if (seat === this.toAct) {
      this.afterAction();
    } else {
      const live = this.seats.filter((x) => x.status !== 'folded');
      if (live.length === 1) this.endUncontested(live[0]);
      else if (this.roundComplete()) this.advanceStreet();
    }
  }

  // ── Internal flow ────────────────────────────────────────────────────────────

  private afterAction(): void {
    const live = this.seats.filter((s) => s.status !== 'folded');
    if (live.length === 1) {
      this.endUncontested(live[0]);
      return;
    }
    if (this.roundComplete()) {
      this.advanceStreet();
      return;
    }
    this.toAct = this.nextSeat(this.toAct!, (s) => s.status === 'active');
    if (this.toAct === undefined) this.advanceStreet();
  }

  private roundComplete(): boolean {
    const actives = this.seats.filter((s) => s.status === 'active');
    if (actives.length === 0) return true;
    return actives.every((s) => s.acted && s.street === this.currentBet);
  }

  private advanceStreet(): void {
    if (this._street === 'river') {
      this.showdown();
      return;
    }
    for (const s of this.seats) {
      s.street = 0;
      s.acted = false;
    }
    this.currentBet = 0;
    this.minRaise = this.bb;

    if (this._street === 'preflop') {
      this.board.push(this.draw(), this.draw(), this.draw());
      this._street = 'flop';
    } else if (this._street === 'flop') {
      this.board.push(this.draw());
      this._street = 'turn';
    } else {
      this.board.push(this.draw());
      this._street = 'river';
    }

    if (this.countActive() <= 1) {
      this.advanceStreet(); // no betting possible — run out the board
      return;
    }
    this.toAct = this.nextSeat(this.buttonSeat, (s) => s.status === 'active');
  }

  private showdown(): void {
    this._street = 'showdown';
    const { pots, refunds } = buildPots(
      this.seats.map((s) => ({ seat: s.seat, total: s.total, folded: s.status === 'folded' })),
    );

    const payouts: Record<number, number> = {};
    const add = (seat: number, amt: number) => {
      payouts[seat] = (payouts[seat] ?? 0) + amt;
    };
    for (const [seat, amt] of Object.entries(refunds)) add(Number(seat), amt);

    const values = new Map<number, HandValue>();
    for (const s of this.seats) {
      if (s.status !== 'folded' && s.hole) values.set(s.seat, bestHand(s.hole, this.board));
    }

    for (const pot of pots) {
      let best: HandValue | undefined;
      let winners: number[] = [];
      for (const seat of pot.eligibleSeats) {
        const v = values.get(seat);
        if (!v) continue;
        const c = best ? compareValue(v, best) : 1;
        if (c > 0) {
          best = v;
          winners = [seat];
        } else if (c === 0) {
          winners.push(seat);
        }
      }
      if (winners.length === 0) continue;
      const ordered = winners.sort((a, b) => a - b);
      const share = Math.floor(pot.amount / ordered.length);
      const remainder = pot.amount - share * ordered.length;
      for (const w of ordered) add(w, share);
      // Odd chips go to the first eligible winners in seat order (left of button).
      for (let i = 0; i < remainder; i++) add(ordered[i % ordered.length], 1);
    }

    for (const s of this.seats) {
      const p = payouts[s.seat];
      if (p) s.stack += p;
    }

    this.showdownEntries = this.seats
      .filter((s) => s.status !== 'folded' && s.hole)
      .map((s) => ({
        seat: s.seat,
        holeCards: s.hole as [Card, Card],
        handName: handName(values.get(s.seat) as HandValue),
        won: payouts[s.seat] ?? 0,
      }));
    this.payouts = payouts;
    this.complete = true;
    this.toAct = undefined;
  }

  private endUncontested(winner: Seat): void {
    const pot = this.seats.reduce((sum, s) => sum + s.total, 0);
    winner.stack += pot;
    this.payouts = { [winner.seat]: pot };
    this.showdownEntries = [];
    this._street = 'showdown';
    this.complete = true;
    this.toAct = undefined;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private get(seat: number): Seat | undefined {
    return this.seats.find((s) => s.seat === seat);
  }

  private draw(): Card {
    const c = this.deck.pop();
    if (!c) throw new Error('Deck exhausted');
    return c;
  }

  private countActive(): number {
    return this.seats.filter((s) => s.status === 'active').length;
  }

  private commit(s: Seat, amount: number): void {
    s.stack -= amount;
    s.street += amount;
    s.total += amount;
    if (s.stack === 0) s.status = 'allin';
  }

  private postBlind(seat: number, blind: number): void {
    const s = this.get(seat)!;
    this.commit(s, Math.min(blind, s.stack));
    s.acted = false; // blinds don't count as acting (BB keeps the option)
  }

  /** Next seat (by table order, wrapping) after `fromSeat` matching `pred`. */
  private nextSeat(fromSeat: number, pred: (s: Seat) => boolean): number | undefined {
    const n = this.seats.length;
    const start = this.seats.findIndex((s) => s.seat === fromSeat);
    for (let k = 1; k <= n; k++) {
      const s = this.seats[(start + k) % n];
      if (pred(s)) return s.seat;
    }
    return undefined;
  }

  // ── Views ────────────────────────────────────────────────────────────────────

  get street(): Street {
    return this._street;
  }
  get toActSeat(): number | undefined {
    return this.toAct;
  }
  isComplete(): boolean {
    return this.complete;
  }
  result(): HandResult {
    return { board: [...this.board], payouts: { ...this.payouts }, showdown: this.showdownEntries };
  }
  finalStacks(): Array<{ seat: number; userId: string; stack: number }> {
    return this.seats.map((s) => ({ seat: s.seat, userId: s.userId, stack: s.stack }));
  }

  legalMoves(): LegalMoves | undefined {
    if (this.complete || this.toAct === undefined) return undefined;
    const s = this.get(this.toAct);
    if (!s) return undefined;
    const toCall = this.currentBet - s.street;
    const maxTo = s.street + s.stack;
    return {
      canFold: true,
      canCheck: toCall === 0,
      canCall: toCall > 0,
      callAmount: Math.min(Math.max(toCall, 0), s.stack),
      canRaise: maxTo > this.currentBet,
      minRaiseTo: Math.min(this.currentBet + this.minRaise, maxTo),
      maxRaiseTo: maxTo,
    };
  }

  publicState(roomCode: string): PublicTableState {
    const { pots } = buildPots(
      this.seats.map((s) => ({ seat: s.seat, total: s.total, folded: s.status === 'folded' })),
    );
    const status = (s: Seat): SeatStatus => s.status;
    return {
      roomCode,
      street: this._street,
      board: [...this.board],
      pots,
      toActSeat: this.toAct,
      minRaiseTo: this.currentBet + this.minRaise,
      currentBet: this.currentBet,
      buttonSeat: this.buttonSeat,
      players: this.seats.map((s) => ({
        seat: s.seat,
        userId: s.userId,
        displayName: s.displayName,
        stack: s.stack,
        committed: s.street,
        status: status(s),
        hasCards: s.hole !== null && s.status !== 'folded',
      })),
    };
  }

  personalState(userId: string, roomCode: string): PersonalTableState {
    const pub = this.publicState(roomCode);
    const mine = this.seats.find((s) => s.userId === userId);
    const yourLegalMoves = mine && mine.seat === this.toAct ? this.legalMoves() : undefined;
    return {
      ...pub,
      yourSeat: mine?.seat,
      yourHoleCards: mine?.hole ?? undefined,
      yourLegalMoves,
    };
  }
}
