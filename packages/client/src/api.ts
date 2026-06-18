import type {
  AuthResponse,
  CreateRoomResponse,
  RoomConfig,
  RoomInfo,
} from '@allinn/shared';
import { API_URL } from './config.js';

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: { body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
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
  return request<AuthResponse>('POST', '/auth', { body: { initData } });
}

/** Dev login (requires ALLOW_DEV_AUTH=true on the server). */
export function devAuthenticate(id?: string, name?: string): Promise<AuthResponse> {
  const q = new URLSearchParams();
  if (id) q.set('id', id);
  if (name) q.set('name', name);
  const qs = q.toString();
  return request<AuthResponse>('POST', `/auth/dev${qs ? `?${qs}` : ''}`);
}

export function createRoom(config: RoomConfig, token: string): Promise<CreateRoomResponse> {
  return request<CreateRoomResponse>('POST', '/rooms', { body: { config }, token });
}

export function getRoomInfo(code: string): Promise<RoomInfo> {
  return request<RoomInfo>('GET', `/rooms/${encodeURIComponent(code)}`);
}
