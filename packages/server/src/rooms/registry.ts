// In-memory room registry. Holds one TableActor per active room.
// Persistence (Postgres) and idle-room eviction come in later steps.

import crypto from 'node:crypto';
import type { RoomConfig } from '@allinn/shared';
import { TableActor } from '../table/actor.js';

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

  create(config: RoomConfig, hostId: string): TableActor {
    let code = generateCode();
    while (this.rooms.has(code)) code = generateCode();
    const actor = new TableActor(code, config, hostId);
    this.rooms.set(code, actor);
    return actor;
  }

  get(code: string): TableActor | undefined {
    return this.rooms.get(code);
  }

  get size(): number {
    return this.rooms.size;
  }
}
