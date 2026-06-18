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

type ConnState = 'idle' | 'connecting' | 'connected' | 'error';

export interface HandResultView {
  board: Card[];
  showdown: ShowdownEntry[];
  fairness?: FairnessReveal;
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

export const useRoom = create<RoomStore>((set, get) => ({
  conn: 'idle',
  mode: 'lobby',
  connect: (roomCode, token) => {
    if (get().socket) return;
    set({ conn: 'connecting', error: undefined });
    const socket = connectRoom(roomCode, token, (msg: ServerMessage) => {
      switch (msg.t) {
        case 'room':
          set({ room: msg.state, mode: 'lobby', conn: 'connected', table: undefined, result: undefined });
          break;
        case 'state':
          set((s) => ({
            table: msg.state,
            mode: 'table',
            conn: 'connected',
            // Keep the result during the showdown view; clear once a new hand deals.
            result: msg.state.street === 'showdown' ? s.result : undefined,
          }));
          break;
        case 'handResult':
          set({ result: { board: msg.board, showdown: msg.showdown, fairness: msg.fairness } });
          break;
        case 'ledger':
          set({ ledger: { rows: msg.rows, settlements: msg.settlements } });
          break;
        case 'error':
          if (msg.code === 'auth' || msg.code === 'no_room') set({ conn: 'error', error: msg.message });
          else set({ error: msg.message });
          break;
        default:
          break;
      }
    });
    set({ socket });
  },
  sit: (seat) => get().socket?.send({ t: 'sit', seat, buyIn: 0 }),
  leave: () => get().socket?.send({ t: 'leave' }),
  act: (intent) => get().socket?.send({ t: 'action', intent }),
  rebuy: (amount) => get().socket?.send({ t: 'rebuy', amount }),
  requestLedger: () => get().socket?.send({ t: 'ledger' }),
  clearLedger: () => set({ ledger: undefined }),
  disconnect: () => {
    get().socket?.close();
    set({ socket: undefined, room: undefined, table: undefined, result: undefined, conn: 'idle', mode: 'lobby' });
  },
}));
