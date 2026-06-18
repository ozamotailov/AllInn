import type { AuthResponse } from '@allinn/shared';
import { API_URL } from './config.js';

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: 'POST' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(detail.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Telegram login: exchange initData for a session token. */
export function authenticate(initData: string): Promise<AuthResponse> {
  return postJson<AuthResponse>('/auth', { initData });
}

/** Dev login (requires ALLOW_DEV_AUTH=true on the server). */
export function devAuthenticate(): Promise<AuthResponse> {
  return postJson<AuthResponse>('/auth/dev');
}
