// Authoritative hand state machine: preflop → flop → turn → river → showdown,
// with all-in branches. Lives in `shared` so the client can validate intents
// optimistically against the same rules the server enforces.
//
// STATUS: stub. Implement in build-order step 4 (single pot), then step 5
// (side pots via ./pots.js). See ARCHITECTURE.md §7 and §11.

import type { Card, RandomInt } from '../cards.js';
import type { RoomConfig } from '../config.js';
import type { PlayerActionIntent } from '../actions.js';
import type { PublicTableState, Street } from '../state.js';

export interface SeatInit {
  seat: number;
  userId: string;
  displayName: string;
  stack: number;
}

export interface HandResult {
  board: Card[];
  /** seat → chips won this hand. */
  payouts: Record<number, number>;
}

/**
 * Owns one hand's lifecycle. Construct per hand; the table actor advances it.
 * The server passes a CSPRNG-backed `randomInt`; tests pass a seeded one.
 */
export class HandMachine {
  readonly street: Street = 'preflop';

  constructor(
    private readonly _config: RoomConfig,
    private readonly _seats: SeatInit[],
    private readonly _buttonSeat: number,
    private readonly _randomInt: RandomInt,
  ) {}

  /** Deal hole cards, post blinds, set first actor. */
  start(): void {
    throw new Error('HandMachine.start not implemented yet');
  }

  /** Validate + apply a player action; advance street/turn as needed. */
  applyAction(_seat: number, _intent: PlayerActionIntent): void {
    throw new Error('HandMachine.applyAction not implemented yet');
  }

  /** Public snapshot (no hidden cards). */
  publicState(): PublicTableState {
    throw new Error('HandMachine.publicState not implemented yet');
  }

  /** True once the hand has reached showdown / everyone but one folded. */
  isComplete(): boolean {
    return false;
  }

  result(): HandResult {
    throw new Error('HandMachine.result not implemented yet');
  }
}
