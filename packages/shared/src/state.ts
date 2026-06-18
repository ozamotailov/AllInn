// Table state split into a PUBLIC view (everyone sees) and a PERSONAL view
// (public + only the recipient's own hole cards). The server builds a
// PersonalTableState per connection so hole cards never leak.

import type { Card } from './cards.js';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type SeatStatus =
  | 'empty'
  | 'active'      // in the hand, can act
  | 'folded'
  | 'allin'
  | 'sitting_out';

export interface PublicPlayer {
  seat: number;
  userId?: string;
  displayName?: string;
  stack: number;
  /** Chips committed to the pot this street. */
  committed: number;
  status: SeatStatus;
  /** True if the player currently holds (hidden) cards. */
  hasCards: boolean;
}

export interface Pot {
  amount: number;
  /** Seats eligible to win this pot (drives side-pot logic). */
  eligibleSeats: number[];
}

export interface PublicTableState {
  roomCode: string;
  street: Street;
  board: Card[];
  pots: Pot[];
  /** Seat that must act now, if any. */
  toActSeat?: number;
  /** Minimum legal raise-to amount for the player to act. */
  minRaiseTo: number;
  /** Highest committed amount this street (what you must match to call). */
  currentBet: number;
  buttonSeat: number;
  players: PublicPlayer[];
  /** Unix ms when the current actor's timer expires, if a hand is live. */
  actionDeadline?: number;
}

/** What a single connection receives: public state + that player's own cards. */
export interface PersonalTableState extends PublicTableState {
  yourSeat?: number;
  yourHoleCards?: [Card, Card];
}
