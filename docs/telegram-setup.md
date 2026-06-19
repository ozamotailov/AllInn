# Running AllInn in real Telegram

You need the app running locally, **one** HTTPS tunnel to the Vite dev server
(port 5173 — Vite proxies the API and WebSocket to the backend, so a single
tunnel is enough), and a Telegram bot.

## 1. Create the bot + Mini App in [@BotFather](https://t.me/BotFather)

1. `/newbot` → follow the prompts → copy the **bot token** and note the **bot
   username** (e.g. `AllInnBot`).
2. `/newapp` → pick your bot → set a title, description, and a **short name**
   (e.g. `play`). For the Web App URL, paste your tunnel URL from step 4 (you can
   put a placeholder now and update it later).
   - This creates the direct link `https://t.me/<bot>/<shortname>`.
3. (Optional) `/setmenubutton` to add a launch button in the chat.

## 2. Configure the server

```bash
cp packages/server/.env.example packages/server/.env
```
Set in `packages/server/.env`:
- `BOT_TOKEN=` — from BotFather
- `SESSION_SECRET=` — any long random string; **keep it stable** so sessions/JWTs survive restarts
- `BOT_USERNAME=` — your bot username, no `@`
- `APP_SHORT_NAME=` — the short name from step 1 (e.g. `play`)
- `ALLOW_DEV_AUTH=false` — real Telegram provides `initData`; the dev bypass must be **off**
- `DB_PATH=allinn.db`

## 3. Start the app (two terminals)

```bash
npm run build -w @allinn/shared
npm run dev:server     # → http://localhost:8080
npm run dev:client     # → http://localhost:5173
```

## 4. Expose it with an HTTPS tunnel

Pick one (tunnels port 5173):
```bash
cloudflared tunnel --url http://localhost:5173
#   or
ngrok http 5173
```
Copy the `https://…` URL it prints.

## 5. Point the Mini App at the tunnel

In BotFather → your app → **Edit Web App URL** → paste the tunnel `https://…` URL.
On free tiers the tunnel URL changes each session — update it here whenever it
changes (or use a static domain / named tunnel).

## 6. Play

- Launch the Mini App (menu button, or the link `t.me/<bot>/<shortname>`).
- **Create a table** → you get a room code and an invite link
  `https://t.me/<bot>/<shortname>?startapp=<code>`.
- Send that link into a Telegram chat; tapping it opens the Mini App straight
  into your room.
- Everyone **sits**; with 2+ seated the hand starts. Use the action bar on your
  turn. After a hand, **Settle up** shows who-pays-whom; **Verify deck** checks
  the provably-fair commitment.

## Troubleshooting

- **"Sign-in failed: Failed to fetch", server logs empty** — the request was
  blocked before reaching the backend, almost always **mixed content**: the page
  is https (tunnel) but the client tried an `http://localhost` API URL. Fix:
  tunnel **port 5173** (Vite, which proxies the API), and make sure
  `packages/client/.env` does **not** set `VITE_API_URL` to an `http://` URL
  (leave it empty for same-origin). Then restart `npm run dev:client`.
- **`POST /auth/dev` 403 inside Telegram** — the app wasn't opened *as a Mini
  App* (empty initData). Launch it via the bot's menu button or `t.me/<bot>/play`.
- **`POST /auth` 401 "Invalid hash"** — `BOT_TOKEN` isn't the token of the bot
  whose Mini App you opened.

## Notes & gotchas

- **HTTPS is mandatory** for Telegram Web App URLs — always use the tunnel URL,
  never `localhost`. Tunnel **port 5173** (Vite), not 8080.
- Keep `SESSION_SECRET` stable; rooms persist in SQLite (`DB_PATH`) across restarts.
- Tunnel URL changed? Re-set the Web App URL in BotFather and re-open the app.
- `ALLOW_DEV_AUTH` must be `false` in real use — it's an auth bypass for browser dev.
- Invite links only render when `BOT_USERNAME` + `APP_SHORT_NAME` match your app.
- Both mobile and desktop Telegram clients work.
