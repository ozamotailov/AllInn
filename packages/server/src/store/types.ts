// Persistence abstraction. Rooms are stored as document snapshots so the schema
// can evolve freely; swap SqliteRoomStore for a Postgres impl later without
// touching the registry/actor.

import type { RoomConfig, SeatState } from '@allinn/shared';

export interface DepartedEntry {
  userId: string;
  displayName: string;
  buyIn: number;
  stack: number;
}

/** The between-hand state of a room — enough to restore a table after a restart. */
export interface RoomSnapshot {
  code: string;
  hostId: string;
  config: RoomConfig;
  seats: SeatState[];
  departed: DepartedEntry[];
  buttonSeat: number;
}

export interface RoomStore {
  loadAll(): RoomSnapshot[];
  save(snapshot: RoomSnapshot): void;
  remove(code: string): void;
}
