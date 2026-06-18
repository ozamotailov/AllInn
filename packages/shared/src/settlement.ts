// Settlement optimizer — the product's hero feature.
// Turns each player's net chip result into the MINIMUM set of "A pays B"
// transfers so friends can settle up outside the app. Pure + fully testable.

export interface PlayerLedgerInput {
  userId: string;
  displayName: string;
  /** Sum of initial buy-in + all rebuys/top-ups, in chips. */
  totalBuyIn: number;
  /** Chips held at cash-out / session end. */
  finalStack: number;
}

export interface LedgerRow {
  userId: string;
  displayName: string;
  buyIn: number;
  finalStack: number;
  /** finalStack - buyIn. Positive = winner, negative = loser. */
  net: number;
}

export interface Settlement {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  /** Positive chips that `from` pays `to`. */
  amount: number;
}

export function computeLedger(players: PlayerLedgerInput[]): LedgerRow[] {
  return players.map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    buyIn: p.totalBuyIn,
    finalStack: p.finalStack,
    net: p.finalStack - p.totalBuyIn,
  }));
}

/**
 * Greedy min-cash-flow: repeatedly settle the largest debtor against the
 * largest creditor. Produces at most (n-1) transfers. Chips are integers, so
 * there is no float rounding.
 *
 * Throws if the ledger does not balance (sum of nets ≠ 0) — that means chips
 * were lost or created upstream (a missed buy-in, stray chips), which we surface
 * loudly rather than hide in the settlement.
 */
export function simplifyDebts(rows: LedgerRow[]): Settlement[] {
  const total = rows.reduce((s, r) => s + r.net, 0);
  if (total !== 0) {
    throw new Error(`Ledger does not balance: net sum = ${total}, expected 0`);
  }

  const creditors = rows
    .filter((r) => r.net > 0)
    .map((r) => ({ id: r.userId, name: r.displayName, amt: r.net }))
    .sort((a, b) => b.amt - a.amt);

  const debtors = rows
    .filter((r) => r.net < 0)
    .map((r) => ({ id: r.userId, name: r.displayName, amt: -r.net }))
    .sort((a, b) => b.amt - a.amt);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(d.amt, c.amt);
    if (pay > 0) {
      settlements.push({
        fromUserId: d.id,
        fromName: d.name,
        toUserId: c.id,
        toName: c.name,
        amount: pay,
      });
      d.amt -= pay;
      c.amt -= pay;
    }
    if (d.amt === 0) i++;
    if (c.amt === 0) j++;
  }
  return settlements;
}
