import { create } from 'zustand';
import type { SessionUser } from '@allinn/shared';
import { authenticate, devAuthenticate } from './api.js';
import { getInitDataRaw, isInsideTelegram } from './telegram.js';

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
      const res =
        isInsideTelegram() || !import.meta.env.DEV
          ? await authenticate(getInitDataRaw())
          : await devAuthenticate();
      set({ status: 'authed', user: res.user, token: res.token });
    } catch (e) {
      set({ status: 'error', error: (e as Error).message });
    }
  },
}));
