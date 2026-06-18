// Side-pot construction from per-seat contributions — the #1 source of poker
// bugs, so it lives isolated and is property-tested for chip conservation.
//
// Given how much each seat put into the hand (and whether they folded), produce
// the main + side pots with their eligible seats, plus refunds for uncalled
// chips (a layer only one seat reached, or a layer no live seat contested).

import type { Pot } from '../state.js';

export interface SeatContribution {
  seat: number;
  /** Total chips this seat put into the hand. */
  total: number;
  /** True if the seat folded (chips stay in the pot, seat can't win). */
  folded: boolean;
}

export interface PotsResult {
  pots: Pot[];
  /** seat → chips returned (uncalled). */
  refunds: Record<number, number>;
}

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

export function buildPots(contribs: SeatContribution[]): PotsResult {
  const refunds: Record<number, number> = {};
  const addRefund = (seat: number, amt: number) => {
    refunds[seat] = (refunds[seat] ?? 0) + amt;
  };

  const active = contribs.filter((c) => c.total > 0);
  const levels = [...new Set(active.map((c) => c.total))].sort((a, b) => a - b);

  const raw: Pot[] = [];
  let prev = 0;
  for (const level of levels) {
    const layer = level - prev;
    const participants = active.filter((c) => c.total >= level);
    if (participants.length === 1) {
      // Uncalled top slice → refund to the lone contributor.
      addRefund(participants[0].seat, layer);
    } else {
      const eligible = participants.filter((c) => !c.folded).map((c) => c.seat);
      if (eligible.length === 0) {
        // Dead layer (all contributors folded) → refund each their slice.
        for (const p of participants) addRefund(p.seat, layer);
      } else {
        raw.push({ amount: layer * participants.length, eligibleSeats: eligible });
      }
    }
    prev = level;
  }

  // Merge adjacent pots that share the same eligible set.
  const pots: Pot[] = [];
  for (const pot of raw) {
    const last = pots[pots.length - 1];
    if (last && sameSet(last.eligibleSeats, pot.eligibleSeats)) last.amount += pot.amount;
    else pots.push({ amount: pot.amount, eligibleSeats: [...pot.eligibleSeats] });
  }

  return { pots, refunds };
}
