// In-memory room registry backed by a RoomStore. Rooms are restored on startup
// and re-persisted (between hands) whenever their state changes. A periodic
// sweep evicts rooms that have had no connections for longer than the TTL,
// removing them from memory and the store.

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

export interface RegistryOptions {
  /** Evict EMPTY rooms (no seated players) idle longer than this. Default 30 min. */
  ttlMs?: number;
  /** Evict rooms that HAVE seated players but no connections after this long
   *  (players may gather slowly). Default 12 h. */
  abandonMs?: number;
  /** Sweep interval. Default 60s. */
  sweepMs?: number;
  /** Called with each evicted room code (e.g. for logging). */
  onEvict?: (code: string) => void;
  /** Optional logger passed to each table actor for hand lifecycle diagnostics. */
  log?: (obj: object, msg: string) => void;
}

export class RoomRegistry {
  private readonly rooms = new Map<string, TableActor>();
  private readonly ttlMs: number;
  private readonly abandonMs: number;
  private readonly onEvict?: (code: string) => void;
  private readonly log?: (obj: object, msg: string) => void;
  private readonly sweepTimer: ReturnType<typeof setInterval>;

  constructor(
    private readonly store: RoomStore,
    opts: RegistryOptions = {},
  ) {
    this.ttlMs = opts.ttlMs ?? 30 * 60 * 1000;
    this.abandonMs = opts.abandonMs ?? 12 * 60 * 60 * 1000;
    this.onEvict = opts.onEvict;
    this.log = opts.log;

    for (const snap of store.loadAll()) {
      const actor = new TableActor(snap.code, snap.config, snap.hostId, {
        seats: snap.seats,
        departed: snap.departed,
        buttonSeat: snap.buttonSeat,
      });
      this.wirePersistence(actor);
      this.rooms.set(snap.code, actor);
    }

    this.sweepTimer = setInterval(() => this.evictIdle(), opts.sweepMs ?? 60 * 1000);
    this.sweepTimer.unref(); // don't keep the process alive just for the sweep
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

  /** Remove rooms with no connections idle longer than the TTL. Returns codes. */
  evictIdle(): string[] {
    const evicted: string[] = [];
    for (const [code, actor] of this.rooms) {
      const ttl = actor.hasPlayers ? this.abandonMs : this.ttlMs;
      if (actor.connectionCount === 0 && actor.idleMs >= ttl) {
        actor.dispose();
        this.rooms.delete(code);
        this.store.remove(code);
        this.onEvict?.(code);
        evicted.push(code);
      }
    }
    return evicted;
  }

  /** Stop the sweep timer (tests / shutdown). */
  stop(): void {
    clearInterval(this.sweepTimer);
  }

  private wirePersistence(actor: TableActor): void {
    actor.onPersist = () => this.store.save(actor.toSnapshot());
    actor.log = this.log;
  }
}
