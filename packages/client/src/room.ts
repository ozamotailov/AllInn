import { create } from 'zustand';
import type { RoomPublicState, ServerMessage } from '@allinn/shared';
import { connectRoom, type RoomSocket } from './ws.js';

type ConnState = 'idle' | 'connecting' | 'connected' | 'error';

interface RoomStore {
  conn: ConnState;
  state?: RoomPublicState;
  error?: string;
  socket?: RoomSocket;
  connect: (roomCode: string, token: string) => void;
  sit: (seat: number) => void;
  leave: () => void;
  disconnect: () => void;
}

export const useRoom = create<RoomStore>((set, get) => ({
  conn: 'idle',
  connect: (roomCode, token) => {
    if (get().socket) return; // already connected/connecting
    set({ conn: 'connecting', error: undefined });
    const socket = connectRoom(roomCode, token, (msg: ServerMessage) => {
      if (msg.t === 'room') {
        set({ state: msg.state, conn: 'connected' });
      } else if (msg.t === 'error') {
        set({ conn: 'error', error: msg.message });
      }
    });
    set({ socket });
  },
  sit: (seat) => get().socket?.send({ t: 'sit', seat, buyIn: 0 }),
  leave: () => get().socket?.send({ t: 'leave' }),
  disconnect: () => {
    get().socket?.close();
    set({ socket: undefined, state: undefined, conn: 'idle' });
  },
}));
