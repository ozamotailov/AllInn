import { useEffect, useState } from 'react';
import { verifyReveal } from '@allinn/shared';
import type {
  PersonalTableState,
  PublicPlayer,
  LegalMoves,
  PlayerActionIntent,
  Card,
  FairnessReveal,
} from '@allinn/shared';
import { CardView } from './Card.js';
import { haptic, confirmDialog } from './telegram.js';
import type { HandResultView } from './room.js';

function useCountdown(deadline?: number): number | undefined {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return undefined;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function Table({
  state,
  result,
  actionSeconds,
  onAct,
  onLeave,
  onSettle,
  onRebuy,
}: {
  state: PersonalTableState;
  result?: HandResultView;
  actionSeconds: number;
  onAct: (intent: PlayerActionIntent) => void;
  onLeave: () => void;
  onSettle: () => void;
  onRebuy: () => void;
}) {
  const potTotal = state.pots.reduce((a, p) => a + p.amount, 0);
  const lm = state.yourLegalMoves;
  const secsLeft = useCountdown(state.street === 'showdown' ? undefined : state.actionDeadline);

  const players = [...state.players].sort((a, b) => a.seat - b.seat);
  const n = players.length;
  const myIndex = Math.max(0, players.findIndex((p) => p.seat === state.yourSeat));

  // Place seat j on the table ellipse, rotated so "you" sit at the bottom.
  const seatPos = (j: number) => {
    const rel = (j - myIndex + n) % n;
    const ang = Math.PI / 2 + (rel * 2 * Math.PI) / n;
    return { left: `${50 + 42 * Math.cos(ang)}%`, top: `${50 + 43 * Math.sin(ang)}%` };
  };

  const act = (intent: PlayerActionIntent) => {
    haptic('tap');
    onAct(intent);
  };

  return (
    <div className="poker">
      <div className="felt">
        <div className="center">
          <div className="pot">
            {potTotal > 0 ? `Pot ${potTotal}` : ' '}
            <span className="muted small"> · {state.street}</span>
          </div>
          <div className="board">
            {state.board.map((c, i) => <CardView key={i} card={c} />)}
            {Array.from({ length: 5 - state.board.length }).map((_, i) => (
              <span key={`ph${i}`} className="playing-card placeholder" />
            ))}
          </div>
        </div>

        {players.map((p, j) => (
          <Seat key={p.seat} p={p} pos={seatPos(j)} state={state} secsLeft={secsLeft} />
        ))}
      </div>

      <div className="hole">
        {state.yourHoleCards ? (
          state.yourHoleCards.map((c, i) => <CardView key={i} card={c} />)
        ) : (
          <span className="muted">spectating</span>
        )}
      </div>

      {state.deckCommitment && state.street !== 'showdown' && (
        <p className="muted small mono center-text">🔒 {state.deckCommitment.slice(0, 10)}…</p>
      )}

      {result && <ResultBanner result={result} />}

      {lm ? (
        <ActionBar
          key={`${state.toActSeat}-${lm.minRaiseTo}-${lm.maxRaiseTo}`}
          lm={lm}
          secsLeft={secsLeft}
          actionSeconds={actionSeconds}
          onAct={act}
        />
      ) : (
        <div className="toolbar">
          <span className="muted small waiting">Waiting…</span>
          <button className="ghost" onClick={onSettle}>Settle up</button>
          <button className="ghost" onClick={onRebuy}>Rebuy</button>
          <button
            className="ghost"
            onClick={async () => {
              if (await confirmDialog('Leave the table?')) onLeave();
            }}
          >
            Leave
          </button>
        </div>
      )}
    </div>
  );
}

function Seat({
  p,
  pos,
  state,
  secsLeft,
}: {
  p: PublicPlayer;
  pos: { left: string; top: string };
  state: PersonalTableState;
  secsLeft?: number;
}) {
  const you = p.seat === state.yourSeat;
  const turn = p.seat === state.toActSeat;
  const initial = (p.displayName ?? '?').trim().slice(0, 1).toUpperCase() || '?';
  return (
    <div className={`pseat ${p.status} ${turn ? 'turn' : ''} ${you ? 'you' : ''}`} style={pos}>
      <div className="avatar">
        {initial}
        {p.seat === state.buttonSeat && <span className="dealer">D</span>}
      </div>
      <div className="info">
        <div className="nm">{p.displayName ?? '—'}{you ? ' (you)' : ''}</div>
        <div className="st">
          {p.status === 'folded' ? 'folded' : p.status === 'allin' ? 'all-in' : p.stack}
          {turn && secsLeft !== undefined ? ` · ${secsLeft}s` : ''}
        </div>
      </div>
      {p.committed > 0 && <div className="bet">{p.committed}</div>}
    </div>
  );
}

function ActionBar({
  lm,
  secsLeft,
  actionSeconds,
  onAct,
}: {
  lm: LegalMoves;
  secsLeft?: number;
  actionSeconds: number;
  onAct: (intent: PlayerActionIntent) => void;
}) {
  const [raiseTo, setRaiseTo] = useState(lm.minRaiseTo);
  const clamped = Math.min(Math.max(raiseTo, lm.minRaiseTo), lm.maxRaiseTo);
  const frac = actionSeconds > 0 && secsLeft !== undefined ? Math.min(1, secsLeft / actionSeconds) : 0;

  return (
    <div className="actionbar">
      <div className="timer">
        <div className="timer-fill" style={{ width: `${frac * 100}%` }} />
      </div>
      {lm.canRaise && lm.maxRaiseTo > lm.minRaiseTo && (
        <input
          className="raise-slider"
          type="range"
          min={lm.minRaiseTo}
          max={lm.maxRaiseTo}
          value={clamped}
          onChange={(e) => setRaiseTo(Number(e.target.value))}
        />
      )}
      <div className="actions">
        {lm.canFold && (
          <button className="act fold" onClick={() => onAct({ type: 'fold' })}>Fold</button>
        )}
        {lm.canCheck && (
          <button className="act" onClick={() => onAct({ type: 'check' })}>Check</button>
        )}
        {lm.canCall && (
          <button className="act" onClick={() => onAct({ type: 'call' })}>Call {lm.callAmount}</button>
        )}
        {lm.canRaise && (
          <button className="act raise" onClick={() => onAct({ type: lm.canCheck ? 'bet' : 'raise', amount: clamped })}>
            {lm.canCheck ? 'Bet' : 'Raise'} {clamped}
          </button>
        )}
      </div>
    </div>
  );
}

function ResultBanner({ result }: { result: HandResultView }) {
  return (
    <div className="result">
      <strong>Hand result</strong>
      <ul>
        {result.showdown.length === 0 ? (
          <li>Won uncontested</li>
        ) : (
          result.showdown.map((e) => (
            <li key={e.seat}>
              {e.handName}
              {e.won > 0 ? ` — won ${e.won}` : ''}
            </li>
          ))
        )}
      </ul>
      {result.fairness && <Fairness reveal={result.fairness} board={result.board} />}
    </div>
  );
}

function Fairness({ reveal, board }: { reveal: FairnessReveal; board: Card[] }) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle');
  const verify = async () => {
    setStatus('checking');
    const { hashOk, boardOk } = await verifyReveal(reveal, board);
    setStatus(hashOk && boardOk ? 'ok' : 'bad');
  };
  return (
    <div className="fairness">
      {status === 'idle' && (
        <button className="link" onClick={verify}>Verify deck (provably fair)</button>
      )}
      {status === 'checking' && <span className="muted small">checking…</span>}
      {status === 'ok' && <span className="ok small">✓ deck committed before the deal, unaltered</span>}
      {status === 'bad' && <span className="error small">✗ verification failed</span>}
    </div>
  );
}
