// Room configuration — what the host sets when creating a table.
// MVP: cash NL Hold'em only. Tournament fields come in v2.

export type GameType = 'cash'; // 'tournament' later

export interface RebuyPolicy {
  enabled: boolean;
  /** Min/max top-up in chips. Defaults applied at validation time. */
  min?: number;
  max?: number;
}

export interface RoomConfig {
  gameType: GameType;
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  /** 2..9 seats. */
  maxPlayers: number;
  /** Seconds a player has to act before auto fold/check. */
  actionTimerSeconds: number;
  rebuy: RebuyPolicy;
  /** Auto-deal when ≥2 are seated; if false, the host starts each hand. */
  autoStart: boolean;
}

export const DEFAULT_CONFIG: RoomConfig = {
  gameType: 'cash',
  smallBlind: 1,
  bigBlind: 2,
  startingStack: 200,
  maxPlayers: 6,
  actionTimerSeconds: 20,
  rebuy: { enabled: true },
  autoStart: true,
};

/** Returns a list of human-readable validation errors (empty = valid). */
export function validateConfig(c: RoomConfig): string[] {
  const errors: string[] = [];
  if (c.smallBlind <= 0) errors.push('Small blind must be positive');
  if (c.bigBlind <= c.smallBlind) errors.push('Big blind must exceed small blind');
  if (c.startingStack < c.bigBlind * 10) {
    errors.push('Starting stack should be at least 10 big blinds');
  }
  if (c.maxPlayers < 2 || c.maxPlayers > 9) {
    errors.push('Table size must be between 2 and 9');
  }
  if (c.actionTimerSeconds < 5 || c.actionTimerSeconds > 120) {
    errors.push('Action timer must be between 5 and 120 seconds');
  }
  return errors;
}
