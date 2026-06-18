// Thin, typed accessor over the Telegram WebApp bridge (window.Telegram.WebApp,
// provided by telegram-web-app.js in index.html). Only the bits the MVP needs.

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { start_param?: string; user?: { id: number; first_name?: string } };
  ready(): void;
  expand(): void;
  colorScheme: 'light' | 'dark';
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function webApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/** Tell Telegram the app is ready and expand to full height. */
export function initTelegram(): void {
  const wa = webApp();
  wa?.ready();
  wa?.expand();
}

/** Raw initData to send to the backend for HMAC validation. */
export function getInitDataRaw(): string {
  return webApp()?.initData ?? '';
}

/** Room code from a Direct Mini App invite link (?startapp=<roomCode>). */
export function getStartParam(): string | undefined {
  return webApp()?.initDataUnsafe.start_param;
}

/** True when running inside the real Telegram client (vs. a plain browser tab). */
export function isInsideTelegram(): boolean {
  return Boolean(webApp()?.initData);
}
