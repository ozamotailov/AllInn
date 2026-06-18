// In-memory room registry backed by a RoomStore. Rooms are restored on startup
// and re-persisted (between hands) whenever their state changes.

import crypto from 'node:crypto';
import type { RoomConfig } from '@allinn/shared';
import { TableActor } from '../table/actor.js';
import type { RoomStore } from '../store/types.js';

// URL-safe alphabet (matches Telegram startapp constraints: A-Za-z0-9_-).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generateCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

export class RoomRegistry {
  private readonly rooms = new Map<string, TableActor>();

  constructor(private readonly store: RoomStore) {
    for (const snap of store.loadAll()) {
      const actor = new TableActor(snap.code, snap.config, snap.hostId, {
        seats: snap.seats,
        departed: snap.departed,
        buttonSeat: snap.buttonSeat,
      });
      this.wirePersistence(actor);
      this.rooms.set(snap.code, actor);
    }
  }

  create(config: RoomConfig, hostId: string): TableActor {
    let code = generateCode();
    while (this.rooms.has(code)) code = generateCode();
    const actor = new TableActor(code, config, hostId);
    this.wirePersistence(actor);
    this.rooms.set(code, actor);
    actor.onPersist?.(); // initial save
    return actor;
  }

  get(code: string): TableActor | undefined {
    return this.rooms.get(code);
  }

  get size(): number {
    return this.rooms.size;
  }

  private wirePersistence(actor: TableActor): void {
    actor.onPersist = () => this.store.save(actor.toSnapshot());
  }
}
