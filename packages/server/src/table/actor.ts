// Table actor — one per room. Owns authoritative room state and is the only
// writer of it. JS is single-threaded, so synchronous method calls already
// serialize actions; a queue can come later if any handler turns async.
//
// Step 2 scope: lobby + seating + presence. Gameplay (HandMachine, timers,
// side pots) arrives in steps 4–7 (ARCHITECTURE.md §11).

import type {
  RoomConfig,
  RoomPublicState,
  SeatState,
  ServerMessage,
} from '@allinn/shared';

export interface Connection {
  userId: string;
  displayName: string;
  send(msg: ServerMessage): void;
}

export type SitResult = { ok: true } | { ok: false; error: string };

export class TableActor {
  private readonly connections = new Map<string, Connection>();
  private readonly seats: SeatState[];

  constructor(
    readonly roomCode: string,
    private readonly config: RoomConfig,
    private readonly hostId: string,
  ) {
    this.seats = Array.from({ length: config.maxPlayers }, (_, i): SeatState => ({
      seat: i,
      stack: 0,
      status: 'empty',
    }));
  }

  attach(conn: Connection): void {
    this.connections.set(conn.userId, conn);
    this.broadcast();
  }

  detach(userId: string): void {
    // Keep the seat (the player may reconnect); only presence drops.
    this.connections.delete(userId);
    this.broadcast();
  }

  sit(userId: string, displayName: string, seat: number): SitResult {
    if (seat < 0 || seat >= this.seats.length) return { ok: false, error: 'Invalid seat' };
    if (this.seats.some((s) => s.userId === userId)) return { ok: false, error: 'Already seated' };
    const target = this.seats[seat];
    if (target.status !== 'empty') return { ok: false, error: 'Seat taken' };

    target.userId = userId;
    target.displayName = displayName;
    target.stack = this.config.startingStack;
    target.status = 'seated';
    this.broadcast();
    return { ok: true };
  }

  leave(userId: string): void {
    const seat = this.seats.find((s) => s.userId === userId);
    if (!seat) return;
    seat.userId = undefined;
    seat.displayName = undefined;
    seat.stack = 0;
    seat.status = 'empty';
    this.broadcast();
  }

  snapshot(): RoomPublicState {
    return {
      roomCode: this.roomCode,
      phase: 'lobby',
      hostId: this.hostId,
      config: this.config,
      seats: this.seats.map((s) => ({ ...s })),
      presentUserIds: [...this.connections.keys()],
    };
  }

  private broadcast(): void {
    const msg: ServerMessage = { t: 'room', state: this.snapshot() };
    for (const conn of this.connections.values()) conn.send(msg);
  }
}
