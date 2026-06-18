// SQLite-backed room store using Node's built-in node:sqlite (no native build).
// Rooms are persisted as a JSON document keyed by code. Synchronous, which is
// fine at home-game scale and keeps the actor code simple.

import { DatabaseSync } from 'node:sqlite';
import type { RoomSnapshot, RoomStore } from './types.js';

export class SqliteRoomStore implements RoomStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        code       TEXT PRIMARY KEY,
        host_id    TEXT NOT NULL,
        data       TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  loadAll(): RoomSnapshot[] {
    const rows = this.db.prepare('SELECT data FROM rooms').all() as Array<{ data: string }>;
    return rows.map((r) => JSON.parse(r.data) as RoomSnapshot);
  }

  save(snapshot: RoomSnapshot): void {
    this.db
      .prepare(
        `INSERT INTO rooms (code, host_id, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           host_id = excluded.host_id, data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(snapshot.code, snapshot.hostId, JSON.stringify(snapshot), Date.now());
  }

  remove(code: string): void {
    this.db.prepare('DELETE FROM rooms WHERE code = ?').run(code);
  }
}
