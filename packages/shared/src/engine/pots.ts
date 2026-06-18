// Side-pot computation — the #1 source of poker bugs. Keep it isolated and
// heavily unit-tested. Given the total each player has committed to the hand,
// produce the main pot + side pots with their eligible seats.
//
// STATUS: stub. Implement in build-order step 5 (see ARCHITECTURE.md §11) and
// add a dedicated pots.test.ts covering multiple all-ins of different sizes.

import type { Pot } from '../state.js';

export interface SeatCommitment {
  seat: number;
  /** Total chips this seat put into the hand. */
  committed: number;
  /** False if the seat folded (chips stay in the pot, seat can't win). */
  contestable: boolean;
}

/**
 * Build main + side pots from per-seat commitments.
 *
 * Algorithm to implement: sort distinct commitment levels ascending; for each
 * layer, pot += (layer - prevLayer) * (number of seats reaching this layer);
 * eligibleSeats = contestable seats that reached this layer.
 */
export function buildPots(_commitments: SeatCommitment[]): Pot[] {
  // TODO(step 5): implement layered side-pot construction + tests.
  throw new Error('buildPots not implemented yet');
}
