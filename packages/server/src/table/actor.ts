// Table actor — one per active table. Owns authoritative state and SERIALIZES
// all incoming actions so there is never a race on "who acted first". The WS
// gateway routes a room's messages here; this is the only writer of table state.
//
// STATUS: skeleton. Flesh out across build-order steps 3–7 (ARCHITECTURE.md §11):
//   - seat/stack management + presence (step 3)
//   - drive HandMachine, broadcast PersonalTableState (step 4–5)
//   - server-owned action timer (step 6)
//   - rebuy + end-of-session ledger (step 7)

import crypto from 'node:crypto';
import {
  type RoomConfig,
  type PlayerActionIntent,
  type PersonalTableState,
  type RandomInt,
} from '@allinn/shared';

/** CSPRNG-backed uniform int in [0, max) — injected into the shuffle. */
export const cryptoRandomInt: RandomInt = (max) => crypto.randomInt(max);

export interface Connection {
  userId: string;
  displayName: string;
  send(state: PersonalTableState): void;
}

export class TableActor {
  private readonly connections = new Map<string, Connection>();

  constructor(
    readonly roomCode: string,
    private readonly config: RoomConfig,
  ) {}

  attach(conn: Connection): void {
    this.connections.set(conn.userId, conn);
    // TODO(step 3): mark presence, send current snapshot.
  }

  detach(userId: string): void {
    this.connections.delete(userId);
    // TODO(step 6): keep seat, let the action timer continue, sit out on repeated timeout.
  }

  sit(_userId: string, _seat: number, _buyIn: number): void {
    // TODO(step 3): seat the player with a buy-in; start a hand when >= 2 are ready.
    throw new Error('TableActor.sit not implemented yet');
  }

  /** Enqueue + apply one validated action. Single-threaded by construction. */
  handleAction(_userId: string, _intent: PlayerActionIntent): void {
    // TODO(step 4): validate (turn/amount/chips) via HandMachine, then broadcast.
    throw new Error('TableActor.handleAction not implemented yet');
  }

  private broadcast(): void {
    // TODO: build a PersonalTableState per connection (own hole cards only) and send.
  }
}
