import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RoomConfig } from '@allinn/shared';
import { RoomRegistry } from './registry.js';
import { SqliteRoomStore } from '../store/sqlite.js';

const cfg: RoomConfig = {
  gameType: 'cash', smallBlind: 1, bigBlind: 2, startingStack: 200,
  maxPlayers: 6, actionTimerSeconds: 20, rebuy: { enabled: true },
};
// In-memory store + a long sweep interval so we drive evictIdle() manually.
const newRegistry = (ttlMs: number) =>
  new RoomRegistry(new SqliteRoomStore(':memory:'), { ttlMs, sweepMs: 3_600_000 });

test('evicts an idle room with no connections and removes it from the store', () => {
  const store = new SqliteRoomStore(':memory:');
  const reg = new RoomRegistry(store, { ttlMs: 0, sweepMs: 3_600_000 });
  const actor = reg.create(cfg, 'host1');
  assert.equal(reg.size, 1);
  assert.equal(store.loadAll().length, 1);

  assert.deepEqual(reg.evictIdle(), [actor.roomCode]);
  assert.equal(reg.size, 0);
  assert.equal(store.loadAll().length, 0);
  reg.stop();
});

test('keeps a room that has a live connection', () => {
  const reg = newRegistry(0);
  const actor = reg.create(cfg, 'host1');
  actor.attach({ userId: 'u1', displayName: 'U1', send: () => {} });
  assert.deepEqual(reg.evictIdle(), []);
  assert.equal(reg.size, 1);
  reg.stop();
});

test('does not evict before the TTL elapses', () => {
  const reg = newRegistry(60_000);
  reg.create(cfg, 'host1');
  assert.deepEqual(reg.evictIdle(), []); // just created → idle ~0ms < 60s
  assert.equal(reg.size, 1);
  reg.stop();
});

test('a disconnected room becomes evictable once empty', () => {
  const reg = newRegistry(0);
  const actor = reg.create(cfg, 'host1');
  actor.attach({ userId: 'u1', displayName: 'U1', send: () => {} });
  assert.deepEqual(reg.evictIdle(), []); // connected → safe
  actor.detach('u1');
  assert.deepEqual(reg.evictIdle(), [actor.roomCode]); // now empty + idle
  assert.equal(reg.size, 0);
  reg.stop();
});
