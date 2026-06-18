// Backend base URL. Empty = same origin (Vite proxies /auth, /rooms, /ws to the
// backend), which is what we use both in local dev and behind a Telegram tunnel.
// Set VITE_API_URL only to target a separately-hosted backend.
export const API_URL: string = import.meta.env.VITE_API_URL ?? '';
