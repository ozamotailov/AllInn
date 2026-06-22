import { create } from 'zustand';
import type {
  RoomPublicState,
  PersonalTableState,
  ServerMessage,
  Card,
  ShowdownEntry,
  PlayerActionIntent,
  LedgerRow,
  Settlement,
  FairnessReveal,
} from '@allinn/shared';
import { connectRoom, type RoomSocket } from './ws.js';
import { report } from './report.js';

type ConnState = 'idle' | 'connecting' | 'connected' | 'error';

export interface HandResultView {
  board: Card[];
  showdown: ShowdownEntry[];
  fairness?: FairnessReveal;
  payouts?: Record<number, number>;
}

export interface LedgerView {
  rows: LedgerRow[];
  settlements: Settlement[];
}

interface RoomStore {
  conn: ConnState;
  mode: 'lobby' | 'table';
  room?: RoomPublicState;
  table?: PersonalTableState;
  result?: HandResultView;
  ledger?: LedgerView;
  error?: string;
  socket?: RoomSocket;
  connect: (roomCode: string, token: string) => void;
  sit: (seat: number) => void;
  leave: () => void;
  act: (intent: PlayerActionIntent) => void;
  rebuy: (amount: number) => void;
  requestLedger: () => void;
  clearLedger: () => void;
  disconnect: () => void;
}

export const useRoom = create<RoomStore>((set, get) => {
  // Reconnect bookkeeping (mobile Telegram drops the socket when backgrounded).
  let roomCode = '';
  let token = '';
  let stopped = false; // intentional disconnect or fatal error → don't reconnect
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  // Delay table→lobby switches so a reconnect / between-hands gap doesn't flash
  // the lobby before the next hand's state arrives.
  let lobbyTimer: ReturnType<typeof setTimeout> | undefined;

  const handle = (msg: ServerMessage) => {
    attempt = 0; // any message = healthy connection
    switch (msg.t) {
      case 'room':
        set({ room: msg.state, conn: 'connected' });
        if (get().mode !== 'table') {
          // initial entry / already in lobby → show it now
          set({ mode: 'lobby', table: undefined, result: undefined });
        } else if (!lobbyTimer) {
          // was at the table → wait a beat; if a hand's state arrives we stay put
          lobbyTimer = setTimeout(() => {
            lobbyTimer = undefined;
            set({ mode: 'lobby', table: undefined, result: undefined });
          }, 1200);
        }
        break;
      case 'state':
        if (lobbyTimer) {
          clearTimeout(lobbyTimer);
          lobbyTimer = undefined;
        }
        set((s) => ({
          table: msg.state,
          mode: 'table',
          conn: 'connected',
          result: msg.state.street === 'showdown' ? s.result : undefined,
        }));
        break;
      case 'handResult':
        set({
          result: {
            board: msg.board,
            showdown: msg.showdown,
            fairness: msg.fairness,
            payouts: msg.payouts,
          },
        });
        break;
      case 'ledger':
        set({ ledger: { rows: msg.rows, settlements: msg.settlements } });
        break;
      case 'error':
        if (msg.code === 'auth' || msg.code === 'no_room') {
          stopped = true; // pointless to retry
          set({ conn: 'error', error: msg.message });
        } else {
          set({ error: msg.message });
        }
        break;
      default:
        break;
    }
  };

  const open = () => {
    report({ kind: 'wsopen', attempt });
    const socket = connectRoom(roomCode, token, handle, (code, reason) => {
      report({ kind: 'wsclose', code, reason, stopped, attempt });
      set({ socket: undefined });
      if (stopped) return;
      // Reconnect with capped backoff; keep showing the last table meanwhile.
      const delay = Math.min(500 * 2 ** attempt, 5000);
      attempt += 1;
      set({ conn: 'connecting' });
      reconnectTimer = setTimeout(open, delay);
    });
    set({ socket });
  };

  return {
    conn: 'idle',
    mode: 'lobby',
    connect: (rc, t) => {
      if (get().socket) return;
      roomCode = rc;
      token = t;
      stopped = false;
      attempt = 0;
      set({ conn: 'connecting', error: undefined });
      open();
    },
    sit: (seat) => get().socket?.send({ t: 'sit', seat, buyIn: 0 }),
    leave: () => get().socket?.send({ t: 'leave' }),
    act: (intent) => get().socket?.send({ t: 'action', intent }),
    rebuy: (amount) => get().socket?.send({ t: 'rebuy', amount }),
    requestLedger: () => get().socket?.send({ t: 'ledger' }),
    clearLedger: () => set({ ledger: undefined }),
    disconnect: () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (lobbyTimer) clearTimeout(lobbyTimer);
      get().socket?.close();
      set({ socket: undefined, room: undefined, table: undefined, result: undefined, ledger: undefined, conn: 'idle', mode: 'lobby' });
    },
  };
});
