// Table actor — one per room. Owns authoritative room + hand state and is the
// only writer. JS is single-threaded, so synchronous method calls serialize
// actions; no queue needed yet.
//
// Now drives gameplay: starts a hand when >=2 seated players have chips, routes
// actions into the HandMachine, broadcasts personalized state (hole cards never
// leak), and runs a short intermission between hands.
//
// Known gap (step 6): a mid-hand disconnect on the actor's turn has no timeout
// yet, so the hand can stall. Action timer + auto-fold come next.

import crypto from 'node:crypto';
import type {
  RoomConfig,
  RoomPublicState,
  SeatState,
  ServerMessage,
  PlayerActionIntent,
  Card,
  ShowdownEntry,
  Settlement,
  FairnessReveal,
} from '@allinn/shared';
import { HandMachine, computeLedger, simplifyDebts, seededRandomInt, deckSeedString } from '@allinn/shared';
import type { RoomSnapshot, DepartedEntry } from '../store/types.js';

const SHOWDOWN_INTERMISSION_MS = 6000; // linger so players can read the reveal
const FOLD_INTERMISSION_MS = 3500; // shorter when nobody showed cards

export interface Connection {
  userId: string;
  displayName: string;
  send(msg: ServerMessage): void;
}

export type SitResult = { ok: true } | { ok: false; error: string };

type Phase = 'lobby' | 'playing';

export class TableActor {
  private readonly connections = new Map<string, Connection>();
  private readonly seats: SeatState[];
  private phase: Phase = 'lobby';
  private hand?: HandMachine;
  private buttonSeat = -1;
  private intermission?: ReturnType<typeof setTimeout>;
  private actionTimer?: ReturnType<typeof setTimeout>;
  private actionDeadline?: number;
  private handNonce = 0;
  private fairness?: FairnessReveal;
  private lastActivityAt = Date.now();
  /** Whether the game is actively dealing hands (host can pause/resume). */
  private running = true;
  /** Final net of players who left the table mid-session, kept for the ledger. */
  private departed: DepartedEntry[] = [];
  /** Set by the registry to persist between-hand state after each change. */
  onPersist?: () => void;
  /** Optional logger (set by the registry) for hand lifecycle diagnostics. */
  log?: (obj: object, msg: string) => void;

  constructor(
    readonly roomCode: string,
    private readonly config: RoomConfig,
    private readonly hostId: string,
    restore?: Pick<RoomSnapshot, 'seats' | 'departed' | 'buttonSeat'>,
  ) {
    if (restore) {
      this.seats = restore.seats.map((s) => ({ ...s }));
      this.departed = restore.departed.map((d) => ({ ...d }));
      this.buttonSeat = restore.buttonSeat;
    } else {
      this.seats = Array.from({ length: config.maxPlayers }, (_, i): SeatState => ({
        seat: i,
        stack: 0,
        buyIn: 0,
        status: 'empty',
      }));
    }
    // autoStart rooms run immediately; manual rooms wait for the host to start.
    this.running = config.autoStart !== false;
  }

  /** Between-hand state for persistence. */
  toSnapshot(): RoomSnapshot {
    return {
      code: this.roomCode,
      hostId: this.hostId,
      config: this.config,
      seats: this.seats.map((s) => ({ ...s })),
      departed: this.departed.map((d) => ({ ...d })),
      buttonSeat: this.buttonSeat,
    };
  }

  private persist(): void {
    this.onPersist?.();
  }

  private touch(): void {
    this.lastActivityAt = Date.now();
  }

  /** Milliseconds since the last meaningful activity. */
  get idleMs(): number {
    return Date.now() - this.lastActivityAt;
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  /** Stop all timers — called by the registry before evicting an idle room. */
  dispose(): void {
    this.clearTimer();
    if (this.intermission) {
      clearTimeout(this.intermission);
      this.intermission = undefined;
    }
  }

  // ── Presence / seating ───────────────────────────────────────────────────────

  attach(conn: Connection): void {
    this.touch();
    this.connections.set(conn.userId, conn);
    this.sendStateTo(conn);
    // A reconnecting player may complete the table (e.g. after a restart).
    this.maybeStartHand();
  }

  detach(userId: string, conn?: Connection): void {
    this.touch();
    // Ignore a stale close whose connection was already replaced by a reconnect
    // (otherwise the late close of the old socket evicts the new one).
    if (conn && this.connections.get(userId) !== conn) return;
    this.connections.delete(userId);
    this.broadcast();
  }

  sit(userId: string, displayName: string, seat: number): SitResult {
    this.touch();
    if (this.phase !== 'lobby') return { ok: false, error: 'Cannot sit during a hand' };
    if (seat < 0 || seat >= this.seats.length) return { ok: false, error: 'Invalid seat' };
    if (this.seats.some((s) => s.userId === userId)) return { ok: false, error: 'Already seated' };
    const target = this.seats[seat];
    if (target.status !== 'empty') return { ok: false, error: 'Seat taken' };

    target.userId = userId;
    target.displayName = displayName;
    target.stack = this.config.startingStack;
    target.buyIn = this.config.startingStack;
    target.status = 'seated';
    this.broadcast();
    this.persist();
    this.maybeStartHand();
    return { ok: true };
  }

  leave(userId: string): void {
    this.touch();
    if (this.phase === 'playing' && this.hand) {
      // Mid-hand: only meaningful if it's their turn → treat as a fold.
      const seat = this.seatOf(userId);
      if (seat !== undefined && this.hand.toActSeat === seat) {
        this.hand.applyAction(seat, { type: 'fold' });
        this.afterHandProgress();
      }
      return;
    }
    const seat = this.seats.find((s) => s.userId === userId);
    if (!seat) return;
    // Record their final net so the session ledger still balances after they go.
    if (seat.buyIn > 0) {
      this.departed.push({
        userId: seat.userId as string,
        displayName: seat.displayName as string,
        buyIn: seat.buyIn,
        stack: seat.stack,
      });
    }
    seat.userId = undefined;
    seat.displayName = undefined;
    seat.stack = 0;
    seat.buyIn = 0;
    seat.status = 'empty';
    this.broadcast();
    this.persist();
  }

  rebuy(userId: string, amount: number): void {
    this.touch();
    const conn = this.connections.get(userId);
    if (this.handActive()) {
      conn?.send({ t: 'error', code: 'rebuy', message: 'Wait until the hand ends' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      conn?.send({ t: 'error', code: 'rebuy', message: 'Invalid amount' });
      return;
    }
    const seat = this.seats.find((s) => s.userId === userId);
    if (!seat || seat.status !== 'seated') {
      conn?.send({ t: 'error', code: 'rebuy', message: 'Not seated' });
      return;
    }
    seat.stack += amount;
    seat.buyIn += amount;
    this.broadcast();
    this.persist();
    this.maybeStartHand();
  }

  /** Compute and broadcast the session ledger ("who pays whom"). */
  sendLedger(): void {
    const entries = [
      ...this.seats
        .filter((s) => s.status === 'seated' && s.buyIn > 0)
        .map((s) => ({
          userId: s.userId as string,
          displayName: s.displayName as string,
          totalBuyIn: s.buyIn,
          finalStack: s.stack,
        })),
      ...this.departed.map((d) => ({
        userId: d.userId,
        displayName: d.displayName,
        totalBuyIn: d.buyIn,
        finalStack: d.stack,
      })),
    ];
    const rows = computeLedger(entries);
    let settlements: Settlement[];
    try {
      settlements = simplifyDebts(rows);
    } catch {
      settlements = []; // unbalanced (shouldn't happen) — show rows without transfers
    }
    const msg: ServerMessage = { t: 'ledger', rows, settlements };
    for (const conn of this.connections.values()) conn.send(msg);
  }

  private handActive(): boolean {
    return this.phase === 'playing' && !!this.hand && !this.hand.isComplete();
  }

  // ── Gameplay ─────────────────────────────────────────────────────────────────

  handleAction(userId: string, intent: PlayerActionIntent): void {
    this.touch();
    const conn = this.connections.get(userId);
    if (this.phase !== 'playing' || !this.hand) {
      conn?.send({ t: 'error', code: 'no_hand', message: 'No hand in progress' });
      return;
    }
    const seat = this.seatOf(userId);
    if (seat === undefined) {
      conn?.send({ t: 'error', code: 'not_seated', message: 'You are not in this hand' });
      return;
    }
    const res = this.hand.applyAction(seat, intent);
    if (!res.ok) {
      conn?.send({ t: 'error', code: 'illegal', message: res.error });
      return;
    }
    this.afterHandProgress();
  }

  private afterHandProgress(): void {
    if (this.hand?.isComplete()) {
      this.finishHand();
    } else {
      this.armTimer();
      this.broadcast();
    }
  }

  // ── Action timer ─────────────────────────────────────────────────────────────

  private armTimer(): void {
    this.clearTimer();
    const seat = this.hand?.toActSeat;
    if (!this.hand || this.hand.isComplete() || seat === undefined) {
      this.actionDeadline = undefined;
      return;
    }
    const ms = this.config.actionTimerSeconds * 1000;
    this.actionDeadline = Date.now() + ms;
    this.actionTimer = setTimeout(() => this.onTimeout(seat), ms);
  }

  private clearTimer(): void {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = undefined;
    }
  }

  /** Time ran out: auto-check if legal, otherwise fold. */
  private onTimeout(seat: number): void {
    this.actionTimer = undefined;
    if (!this.hand || this.hand.isComplete() || this.hand.toActSeat !== seat) return;
    const lm = this.hand.legalMoves();
    const intent: PlayerActionIntent = lm?.canCheck ? { type: 'check' } : { type: 'fold' };
    this.hand.applyAction(seat, intent);
    this.afterHandProgress();
  }

  /** Deal the next hand if the game is running (sit/attach/rebuy/intermission). */
  private maybeStartHand(): void {
    if (!this.running) return; // not started yet, or paused
    this.tryBeginHand();
  }

  /** Host starts/resumes the game; it then runs continuously until paused. */
  startByHost(userId: string): void {
    if (!this.requireHost(userId)) return;
    this.running = true;
    this.tryBeginHand();
    if (this.phase === 'lobby') this.broadcast(); // reflect running even if <2 ready
  }

  /** Host pauses: the current hand finishes, then the game stops until resumed. */
  pauseByHost(userId: string): void {
    if (!this.requireHost(userId)) return;
    this.running = false;
    this.broadcast();
  }

  private requireHost(userId: string): boolean {
    if (userId === this.hostId) return true;
    this.connections.get(userId)?.send({
      t: 'error',
      code: 'not_host',
      message: 'Only the host can control the game',
    });
    return false;
  }

  private tryBeginHand(): void {
    if (this.phase !== 'lobby' || this.intermission) return;
    // Only connected seated players with chips — avoids looping hands in an
    // abandoned room (auto-fold would otherwise play it out forever).
    const seatedWithChips = this.seats.filter((s) => s.status === 'seated' && s.stack > 0);
    const ready = seatedWithChips.filter((s) => this.connections.has(s.userId as string));
    if (ready.length < 2) {
      if (seatedWithChips.length > 0) {
        this.log?.(
          { room: this.roomCode, seatedWithChips: seatedWithChips.length, connected: ready.length },
          'not starting next hand: need 2 connected seated players with chips',
        );
      }
      return;
    }

    this.buttonSeat = this.nextButton(ready.map((s) => s.seat));

    // Provably-fair: commit to a random server seed before dealing.
    const serverSeed = crypto.randomBytes(16).toString('hex');
    const clientSeed = ready.map((s) => s.userId).join(',');
    const nonce = ++this.handNonce;
    const commitment = crypto.createHash('sha256').update(serverSeed).digest('hex');
    this.fairness = { commitment, serverSeed, clientSeed, nonce, seatCount: ready.length };
    const randomInt = seededRandomInt(deckSeedString(serverSeed, clientSeed, nonce));

    this.hand = new HandMachine(
      this.config,
      ready.map((s) => ({
        seat: s.seat,
        userId: s.userId as string,
        displayName: s.displayName as string,
        stack: s.stack,
      })),
      this.buttonSeat,
      randomInt,
    );
    this.phase = 'playing';
    this.hand.start();
    this.log?.({ room: this.roomCode, players: ready.length, button: this.buttonSeat }, 'hand started');
    if (this.hand.isComplete()) this.finishHand();
    else {
      this.armTimer();
      this.broadcast();
    }
  }

  private finishHand(): void {
    if (!this.hand) return;
    this.clearTimer();
    this.actionDeadline = undefined;
    for (const fs of this.hand.finalStacks()) {
      const seat = this.seats.find((s) => s.seat === fs.seat);
      if (seat) seat.stack = fs.stack;
    }
    this.persist();
    const result = this.hand.result();
    this.broadcast(); // final hand state (showdown board + stacks)
    this.broadcastResult(result.board, result.showdown, this.fairness, result.payouts);
    this.scheduleIntermission(
      result.showdown.length > 0 ? SHOWDOWN_INTERMISSION_MS : FOLD_INTERMISSION_MS,
    );
  }

  private scheduleIntermission(ms: number): void {
    if (this.intermission) return;
    this.intermission = setTimeout(() => {
      this.intermission = undefined;
      this.hand = undefined;
      this.phase = 'lobby';
      this.broadcast();
      this.maybeStartHand();
    }, ms);
  }

  private nextButton(seatNumbers: number[]): number {
    const asc = [...seatNumbers].sort((a, b) => a - b);
    if (this.buttonSeat < 0) return asc[0];
    return asc.find((s) => s > this.buttonSeat) ?? asc[0];
  }

  private seatOf(userId: string): number | undefined {
    return this.seats.find((s) => s.userId === userId)?.seat;
  }

  // ── Broadcast ────────────────────────────────────────────────────────────────

  snapshot(): RoomPublicState {
    return {
      roomCode: this.roomCode,
      phase: this.phase,
      hostId: this.hostId,
      config: this.config,
      seats: this.seats.map((s) => ({ ...s })),
      presentUserIds: [...this.connections.keys()],
      running: this.running,
    };
  }

  private sendStateTo(conn: Connection): void {
    if (this.phase === 'playing' && this.hand) {
      const state = this.hand.personalState(conn.userId, this.roomCode);
      state.actionDeadline = this.actionDeadline;
      state.deckCommitment = this.fairness?.commitment;
      state.running = this.running;
      conn.send({ t: 'state', state });
    } else {
      conn.send({ t: 'room', state: this.snapshot() });
    }
  }

  private broadcast(): void {
    for (const conn of this.connections.values()) this.sendStateTo(conn);
  }

  private broadcastResult(
    board: Card[],
    showdown: ShowdownEntry[],
    fairness?: FairnessReveal,
    payouts?: Record<number, number>,
  ): void {
    const msg: ServerMessage = { t: 'handResult', board, showdown, fairness, payouts };
    for (const conn of this.connections.values()) conn.send(msg);
  }
}
