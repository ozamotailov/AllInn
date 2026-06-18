# AllInn 🃏

> All in, with your inner circle.

Texas Hold'em **home-game** client as a Telegram Mini App. Play with friends on
**virtual chips**; settle up outside the app. No real money / crypto inside.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design and the MVP build order.

## Monorepo layout

```
packages/
  shared/   Pure TS: card model, game types, WS protocol, poker engine, settlement optimizer.
            Imported by BOTH client and server (single source of truth).
  server/   Node + Fastify + ws. initData auth, table actors, authoritative game loop.
  client/   React + Vite Mini App. Renders the table, sends action intents.
```

## Prerequisites

- Node.js **>= 22** (this repo was scaffolded on Node 24; dev/test scripts use
  `tsx` to run TypeScript directly).
- A Telegram bot token from [@BotFather](https://t.me/BotFather), with a Mini App /
  direct link configured.

## Getting started

```bash
npm install

# shared must be built first — server & client import its compiled output
npm run build -w @allinn/shared

# run the settlement optimizer's unit tests (real, working code)
npm test -w @allinn/shared

# dev (two terminals)
cp packages/server/.env.example packages/server/.env
# For browser testing without Telegram, set in that .env:
#   ALLOW_DEV_AUTH=true        (enables POST /auth/dev so the client can log in)
# The server auto-loads packages/server/.env on startup.
npm run dev:server
npm run dev:client
```

> Browser dev login uses `/auth/dev`, which only exists when `ALLOW_DEV_AUTH=true`.
> Without it you'll see "Sign-in failed: Request failed (404)" — that's expected
> until you enable the flag (or open the app from inside Telegram with a real bot).

> To run it inside real Telegram (one HTTPS tunnel, bot setup, invite links),
> follow [docs/telegram-setup.md](docs/telegram-setup.md). Vite proxies the API
> and WebSocket to the backend, so a single tunnel to port 5173 is all you need.

## Status

Scaffold. Implemented for real: **initData validation**
(`packages/server/src/auth/initData.ts`) and the **settlement optimizer**
(`packages/shared/src/settlement.ts`, with tests). Everything else is typed stubs
with `TODO` markers following the build order in `ARCHITECTURE.md` §11.

Dependency versions in the `package.json` files are sensible starting points —
run `npm install` and bump as needed.
