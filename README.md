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
cp packages/server/.env.example packages/server/.env   # add your BOT_TOKEN
npm run dev:server
npm run dev:client
```

> For local testing inside Telegram you'll need an HTTPS tunnel to the Vite dev
> server (e.g. `cloudflared` / `ngrok`) and set that URL as the Mini App URL in
> BotFather.

## Status

Scaffold. Implemented for real: **initData validation**
(`packages/server/src/auth/initData.ts`) and the **settlement optimizer**
(`packages/shared/src/settlement.ts`, with tests). Everything else is typed stubs
with `TODO` markers following the build order in `ARCHITECTURE.md` §11.

Dependency versions in the `package.json` files are sensible starting points —
run `npm install` and bump as needed.
