// REST DTOs shared between client and server (the WS protocol lives in protocol.ts).

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
