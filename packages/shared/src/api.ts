// REST DTOs shared between client and server (the WS protocol lives in protocol.ts).

import type { RoomConfig } from './config.js';
import type { RoomPhase } from './state.js';

export interface SessionUser {
  id: string;
  displayName: string;
}

export interface AuthRequest {
  /** Raw Telegram Mini App initData query string. */
  initData: string;
}

export interface AuthResponse {
  /** Session JWT to use as `Authorization: Bearer <token>`. */
  token: string;
  user: SessionUser;
}

export interface CreateRoomRequest {
  config: RoomConfig;
}

export interface CreateRoomResponse {
  code: string;
  /** Direct Mini App invite link, or '' if the server's bot identity isn't configured. */
  inviteLink: string;
  config: RoomConfig;
}

export interface RoomInfo {
  code: string;
  phase: RoomPhase;
  config: RoomConfig;
  seatsTaken: number;
  maxPlayers: number;
}
