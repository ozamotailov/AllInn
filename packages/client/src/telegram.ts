// Thin, typed accessor over the Telegram WebApp bridge (window.Telegram.WebApp,
// provided by telegram-web-app.js in index.html). Only the bits the app needs.

interface HapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { start_param?: string; user?: { id: number; first_name?: string } };
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  disableVerticalSwipes?(): void;
  showConfirm?(message: string, callback: (ok: boolean) => void): void;
  HapticFeedback?: HapticFeedback;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function webApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/** Tell Telegram we're ready, go full-height, match the theme, and stop
 *  swipe-to-close from firing while dragging on the table. */
export function initTelegram(): void {
  const wa = webApp();
  if (!wa) return;
  wa.ready();
  wa.expand();
  try {
    wa.setHeaderColor?.('secondary_bg_color');
    wa.setBackgroundColor?.('bg_color');
    wa.disableVerticalSwipes?.();
  } catch {
    /* older clients lack some methods — ignore */
  }
}

export type Haptic = 'tap' | 'select' | 'success' | 'warn' | 'error';

export function haptic(kind: Haptic): void {
  const h = webApp()?.HapticFeedback;
  if (!h) return;
  try {
    if (kind === 'tap') h.impactOccurred('medium');
    else if (kind === 'select') h.selectionChanged();
    else h.notificationOccurred(kind === 'success' ? 'success' : kind === 'warn' ? 'warning' : 'error');
  } catch {
    /* ignore */
  }
}

/** Native confirm dialog (Telegram's if available, else the browser's). */
export function confirmDialog(message: string): Promise<boolean> {
  const wa = webApp();
  if (wa?.showConfirm) {
    return new Promise((resolve) => {
      try {
        wa.showConfirm!(message, (ok) => resolve(ok));
      } catch {
        resolve(window.confirm(message));
      }
    });
  }
  return Promise.resolve(window.confirm(message));
}

/** Copy text to the clipboard (Clipboard API, with a textarea fallback). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Raw initData to send to the backend for HMAC validation. */
export function getInitDataRaw(): string {
  return webApp()?.initData ?? '';
}

/** Room code from a Direct Mini App invite link (?startapp=<roomCode>). */
export function getStartParam(): string | undefined {
  const fromTelegram = webApp()?.initDataUnsafe.start_param;
  if (fromTelegram) return fromTelegram;
  // Plain-browser dev fallback: Telegram only maps ?startapp= → start_param when
  // launched from a t.me link, so read it from the URL ourselves.
  const q = new URLSearchParams(window.location.search);
  return q.get('startapp') ?? q.get('tgWebAppStartParam') ?? undefined;
}

/** True when running inside the real Telegram client (vs. a plain browser tab). */
export function isInsideTelegram(): boolean {
  return Boolean(webApp()?.initData);
}
