# Architecture — AllInn (Texas Hold'em home-game)

A Telegram Mini App for playing Texas Hold'em with friends on **virtual chips**.
Friends agree chips ≈ real money by convention and **settle outside the app**.
There are **no real-money or crypto flows inside the app** — this keeps the
product out of gambling regulation and Telegram's tightening real-money rules.
Stars monetization is **deferred** (when added, lean toward a "host pays for the
room" model; see `MEMORY`/project notes).

The differentiator vs existing Telegram poker (shallow social funnels + public
crypto rooms) is a real **home-game** experience: deep room config + a native
**settlement optimizer** ("who pays whom") that even PokerNow lacks.

---

## 1. Core principle: the server is authoritative

Poker has hidden information (hole cards) and chips that players treat as money.
Therefore the client must **never** hold anything secret:

- Full deck, shuffle, and RNG live only on the server.
- The client receives a **personalized** view: public table state + *only its own*
  hole cards.
- The client sends **intents** (`fold/check/call/bet/raise`), never authoritative
  results. The server validates every action (is it your turn? legal amount?
  enough chips?).

This is non-negotiable — otherwise cheating via DevTools is trivial.

---

## 2. Component overview

```
 Telegram client (private chat / group)
        │  opens Mini App via  t.me/<bot>/<app>?startapp=<roomCode>
        ▼
┌─────────────────────────┐         ┌──────────────────────────────┐
│  Frontend (Mini App)    │  WSS    │   Backend (Node + TS)          │
│  React + TG WebApp      │◄───────►│                                │
│  - table render (DOM)   │         │  Gateway: initData auth + WS    │
│  - action buttons       │  HTTPS  │  ───────────────────────────   │
│  - settlement screen     │ initData│  Table Actor (one per table):  │
└─────────────────────────┘────────►│   authoritative game loop,      │
                                     │   serializes actions,           │
                                     │   holds state in memory         │
                                     │  ───────────────────────────   │
                                     │  Poker Engine (pure TS, shared) │
                                     │  Provably-fair RNG              │
                                     └───────────┬──────────────────┘
                                          ┌──────┴───────┐
                                     ┌────▼────┐    ┌─────▼─────┐
                                     │Postgres │    │  Redis    │
                                     │users,   │    │ pub/sub,  │
                                     │rooms,   │    │ presence, │
                                     │hands,   │    │ reconnect │
                                     │ledger   │    └───────────┘
                                     └─────────┘
```

The **poker engine and all shared types live in `packages/shared`** so the client
can reuse them for optimistic UI and input validation, and the server uses the
same code as the source of truth.

---

## 3. Stack

| Layer       | Choice                                            | Why |
|-------------|---------------------------------------------------|-----|
| Frontend    | React + TS + Vite, Telegram WebApp JS             | Mini App standard. MVP table = DOM/CSS (canvas/Pixi later for animation) |
| Backend     | Node.js + TS (Fastify + `ws`)                     | **Share the TS engine with the client**; fast to ship |
| Realtime    | WebSocket                                         | Persistent connection, push personalized state. Not serverless |
| DB          | PostgreSQL                                        | users, rooms, hand history, ledger |
| Ephemeral   | Redis                                             | pub/sub across nodes, presence, restart recovery |
| Hosting     | Fly.io / Railway / VPS (long-running container)   | Live WS connections — edge/lambda is a poor fit |

> Scale alternative (not for MVP): **Elixir/Phoenix** (GenServer actor per table,
> Channels, Presence) or Go. Node wins for MVP because of the shared TS engine.

---

## 4. Actor-per-table concurrency model

Each active table is **one in-memory game loop** that owns its state and
**serializes actions** (no race on "who acted first"). Every state transition is
persisted to Postgres for crash recovery.

Scaling rule: a table is **sticky to one node** (its authoritative state is in
memory there). Scale horizontally by routing all of a room's connections to the
same node (consistent hashing / Redis-backed routing). **Never** split a single
table across nodes — action serialization must stay in one place.

See `packages/server/src/table/actor.ts`.

---

## 5. Telegram integration  (verified against core.telegram.org docs)

**Auth.** Client sends raw `initData` to the backend over HTTPS. Backend validates:
`secret = HMAC_SHA256(botToken, "WebAppData")`, then compares the `hash` against an
HMAC of the alphabetically-sorted `data-check-string`, and checks `auth_date`
freshness (~5 min). On success, issue **your own session JWT** so you don't
re-validate initData on every WS message. Implemented in
`packages/server/src/auth/initData.ts`.

**Invite links.** Use a **Direct Mini App link**:
`https://t.me/<bot>/<app>?startapp=<roomCode>`. The value arrives as `start_param`
(and `tgWebAppStartParam`). ⚠️ Allowed chars: `A-Z a-z 0-9 _ -`, max 512 — so
`roomCode` must be URL-safe (base62 code, **not** a raw UUID). Host taps "Invite"
→ app builds the link → shares into the group chat → friend taps → Mini App opens
**straight into that room**.

**Sharing.** Use Telegram's share sheet / `switchInlineQuery` to drop the invite
link into a chat.

---

## 6. Realtime / WebSocket

- One WS connection per player; subscribes to its table channel.
- Server pushes `{ t: 'state', state: PersonalTableState }` after every transition.
- **Action timer owned by the server**: on a player's turn, start a countdown
  (e.g. 20s + optional time bank); on expiry → auto fold/check. Client only renders
  the remaining time.
- **Disconnect**: seat is kept, timer keeps running; repeated timeouts → sit out.
  On reconnect: re-auth + server sends a full personalized state snapshot.

The message contract is defined in `packages/shared/src/protocol.ts`
(`ClientMessage` / `ServerMessage` unions).

---

## 7. Game engine

- **Hand state machine**: `preflop → flop → turn → river → showdown`, plus all-in
  branches. (`packages/shared/src/engine/handMachine.ts`)
- **Side pots** are the #1 source of bugs — multiple all-ins of different sizes.
  Build this as an isolated, unit-tested module from day one.
  (`packages/shared/src/engine/pots.ts`)
- **RNG**: server-side CSPRNG (`crypto.randomInt` + Fisher-Yates). **Never
  `Math.random`.** The shuffle takes an injected random source so the engine stays
  pure/testable (`packages/shared/src/cards.ts`).
- **Provably-fair (v1.5)**: commit–reveal. Before a hand the server publishes
  `hash(serverSeed)`; afterward it reveals `serverSeed` so anyone can recompute the
  shuffle and verify it wasn't manipulated. Cheap to add; strong trust/marketing.

---

## 8. Data model (core tables)

```
users(telegram_id PK, username, display_name, avatar_url, created_at)
rooms(id PK, code UNIQUE, host_id FK, config JSONB, status, created_at)
    config = { gameType, smallBlind, bigBlind, startingStack,
               maxPlayers, actionTimerSeconds, rebuy }
room_players(room_id FK, user_id FK, seat, stack, status, total_buyin)
hands(id PK, room_id FK, hand_no, board, pot, seed_hash, seed_revealed, ts)
hand_actions(hand_id FK, seq, user_id, street, action, amount)   -- the log
```

Ledger/settlement rows are **derived** from `total_buyin` and final stacks — see §9.

---

## 9. Settlement optimizer (hero feature)

Pure math, no money in the app:

1. Each player's `net = finalStack − totalBuyIn`. The sum of nets is 0 (chips are
   conserved).
2. Collapse nets into the **minimum set of transfers** ("A pays B amount") via a
   greedy min-cash-flow match (largest creditor ↔ largest debtor).
3. Render a clear "Settle up" screen at session end — this is what people remember
   when they leave the table.

Implemented and unit-tested in `packages/shared/src/settlement.ts`.

---

## 10. Security / anti-cheat

- Server authoritative; never trust the client for cards or move legality.
- Validate every action server-side; validate `initData`; short-lived session JWTs;
  rate-limit messages.
- Provably-fair shuffle for trust (v1.5).
- **Out of scope**: real-time collusion between players over a side channel is not
  technically solvable and isn't the threat model for a friends' home game.

---

## 11. MVP build order (thin vertical slices)

1. **Skeleton**: bot + Mini App shell; `initData` auth → session JWT → "hi, <name>".
2. **Room lifecycle**: create room with config; join via `startapp` deep link;
   lobby with seating (no gameplay yet).
3. **WS + actor**: seat/stack sync, presence, reconnect.
4. **Engine**: one full NLH hand (deal → betting rounds → showdown, single pot).
5. **Side pots** + correct all-in handling.
6. **Action timer** + disconnect handling.
7. **Rebuy/top-up** + session ledger + settlement screen.
8. **Hand log**, polish. → (v1.5) provably-fair commit–reveal.

Each numbered slice should be demoable end-to-end before starting the next.
