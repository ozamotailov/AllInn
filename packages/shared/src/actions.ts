// Player intents sent from client to server. The server validates legality
// (whose turn, legal amount, sufficient chips) — the client never decides.

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface PlayerActionIntent {
  type: ActionType;
  /** Total chips for bet/raise (the target amount, not the delta). Omit for fold/check/call. */
  amount?: number;
}
