import { create } from 'zustand';
import type { SessionUser } from '@allinn/shared';
import { authenticate, devAuthenticate } from './api.js';
import { getInitDataRaw, isInsideTelegram } from './telegram.js';

// A distinct dev identity per browser tab so two tabs are two players.
// Override with ?dev=<name>; otherwise a random id is kept in sessionStorage
// (which is per-tab, so each tab gets its own).
function devIdentity(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('dev');
  if (fromUrl) return fromUrl;
  let id = sessionStorage.getItem('devId');
  if (!id) {
    id = `dev-${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem('devId', id);
  }
  return id;
}

type Status = 'idle' | 'loading' | 'authed' | 'error';

interface SessionState {
  status: Status;
  user?: SessionUser;
  token?: string;
  error?: string;
  login: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: 'idle',
  login: async () => {
    set({ status: 'loading', error: undefined });
    try {
      // Inside Telegram → real initData login. In a plain browser during dev →
      // fall back to the dev endpoint (only works if the server allows it).
      const devId = devIdentity();
      const res =
        isInsideTelegram() || !import.meta.env.DEV
          ? await authenticate(getInitDataRaw())
          : await devAuthenticate(devId, devId);
      set({ status: 'authed', user: res.user, token: res.token });
    } catch (e) {
      set({ status: 'error', error: (e as Error).message });
    }
  },
}));
