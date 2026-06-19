import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initTelegram } from './telegram.js';
import { API_URL } from './config.js';
import { App } from './App.js';
import './styles.css';

// ── Diagnostics: report client errors / page lifecycle to the server so they
//    surface in the dev:server console during on-device testing. ──
function report(payload: Record<string, unknown>): void {
  try {
    const url = `${API_URL}/clienterror`;
    const body = JSON.stringify({ ...payload, t: Date.now() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
    }
  } catch {
    /* ignore */
  }
}
report({ kind: 'load' });
window.addEventListener('error', (e) =>
  report({ kind: 'error', message: e.message, src: e.filename, line: e.lineno, stack: e.error?.stack }),
);
window.addEventListener('unhandledrejection', (e) =>
  report({ kind: 'reject', message: String((e as PromiseRejectionEvent).reason), stack: (e as PromiseRejectionEvent).reason?.stack }),
);
window.addEventListener('pagehide', () => report({ kind: 'pagehide' }));

initTelegram();

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
