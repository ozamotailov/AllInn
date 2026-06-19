import { API_URL } from './config.js';

/** Best-effort diagnostic beacon to the server (shows up in dev:server logs). */
export function report(payload: Record<string, unknown>): void {
  try {
    const url = `${API_URL}/clienterror`;
    const body = JSON.stringify({ ...payload, t: Date.now() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      });
    }
  } catch {
    /* ignore */
  }
}
