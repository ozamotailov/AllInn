// Table state split into a PUBLIC view (everyone sees) and a PERSONAL view
// (public + only the recipient's own hole cards). The server builds a
// PersonalTableState per connection so hole cards never leak.

import type { Card } from './cards.js';
import type { RoomConfig } from './config.js';

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

/** The legal actions for the player to act, as raise-to totals for this street. */
export interface LegalMoves {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
}

/** What a single connection receives: public state + that player's own cards. */
export interface PersonalTableState extends PublicTableState {
  yourSeat?: number;
  yourHoleCards?: [Card, Card];
  /** Present only when it's this player's turn. */
  yourLegalMoves?: LegalMoves;
}

// ── Lobby / room-level state (pre-gameplay; contains no hidden information,
//    so the same snapshot is broadcast to everyone) ───────────────────────────

export type LobbySeatStatus = 'empty' | 'seated' | 'sitting_out';

export interface SeatState {
  seat: number;
  userId?: string;
  displayName?: string;
  /** Chips at the seat (= buy-in until gameplay exists). */
  stack: number;
  status: LobbySeatStatus;
}

export type RoomPhase = 'lobby' | 'playing';

export interface RoomPublicState {
  roomCode: string;
  phase: RoomPhase;
  hostId: string;
  config: RoomConfig;
  seats: SeatState[];
  /** userIds currently connected to the room (seated or just watching). */
  presentUserIds: string[];
}
