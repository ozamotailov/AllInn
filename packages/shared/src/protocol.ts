// WebSocket message contract between client and server.
// `t` is the discriminant. Keep this the single source of truth for both ends.

import type { PlayerActionIntent } from './actions.js';
import type { PersonalTableState } from './state.js';
import type { Card } from './cards.js';
import type { LedgerRow, Settlement } from './settlement.js';

// ── Client → Server ──────────────────────────────────────────────────────────
export type ClientMessage =
  | { t: 'join'; roomCode: string }
  | { t: 'sit'; seat: number; buyIn: number }
  | { t: 'leave' }
  | { t: 'action'; intent: PlayerActionIntent }
  | { t: 'rebuy'; amount: number }
  | { t: 'ping' };

// ── Server → Client ──────────────────────────────────────────────────────────
export interface ShowdownEntry {
  seat: number;
  holeCards: [Card, Card];
  /** Human description, e.g. "Full House, Kings over Tens". */
  handName: string;
  won: number;
}

export type ServerMessage =
  | { t: 'state'; state: PersonalTableState }
  | { t: 'handResult'; board: Card[]; showdown: ShowdownEntry[] }
  | { t: 'ledger'; rows: LedgerRow[]; settlements: Settlement[] }
  | { t: 'error'; code: string; message: string }
  | { t: 'pong' };
