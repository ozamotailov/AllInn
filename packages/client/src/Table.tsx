import { useState } from 'react';
import type { PersonalTableState, LegalMoves, PlayerActionIntent } from '@allinn/shared';
import { CardView } from './Card.js';
import type { HandResultView } from './room.js';

export function Table({
  state,
  result,
  onAct,
  onLeave,
}: {
  state: PersonalTableState;
  result?: HandResultView;
  onAct: (intent: PlayerActionIntent) => void;
  onLeave: () => void;
}) {
  const potTotal = state.pots.reduce((a, p) => a + p.amount, 0);
  const lm = state.yourLegalMoves;

  return (
    <section className="table">
      <div className="board">
        {state.board.map((c, i) => <CardView key={i} card={c} />)}
        {Array.from({ length: 5 - state.board.length }).map((_, i) => (
          <span key={`ph${i}`} className="card placeholder" />
        ))}
      </div>

      <p className="pot">
        Pot {potTotal}
        {state.street !== 'showdown' && state.currentBet > 0 ? ` · bet ${state.currentBet}` : ''}
        <span className="muted small"> · {state.street}</span>
      </p>

      <ul className="players">
        {state.players.map((p) => {
          const you = p.seat === state.yourSeat;
          const turn = p.seat === state.toActSeat;
          return (
            <li key={p.seat} className={`prow ${p.status} ${turn ? 'turn' : ''}`}>
              <span className="who">
                {p.seat === state.buttonSeat ? '🔘 ' : ''}
                {p.displayName}
                {you ? ' (you)' : ''}
              </span>
              <span className="muted small">
                {p.status === 'folded' ? 'folded' : p.status === 'allin' ? 'all-in' : ''}
                {p.committed > 0 ? ` · bet ${p.committed}` : ''}
              </span>
              <span className="stack">{p.stack}</span>
            </li>
          );
        })}
      </ul>

      <div className="hole">
        {state.yourHoleCards ? (
          state.yourHoleCards.map((c, i) => <CardView key={i} card={c} />)
        ) : (
          <span className="muted">spectating</span>
        )}
      </div>

      {result && (
        <div className="result">
          <strong>Hand result</strong>
          <ul>
            {result.showdown.length === 0 ? (
              <li>Won uncontested</li>
            ) : (
              result.showdown.map((e) => (
                <li key={e.seat}>
                  Seat {e.seat + 1}: {e.handName}
                  {e.won > 0 ? ` — won ${e.won}` : ''}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {lm && (
        <ActionBar
          key={`${state.toActSeat}-${lm.minRaiseTo}-${lm.maxRaiseTo}`}
          lm={lm}
          onAct={onAct}
        />
      )}

      <button className="ghost small" onClick={onLeave}>
        Leave table
      </button>
    </section>
  );
}

function ActionBar({ lm, onAct }: { lm: LegalMoves; onAct: (intent: PlayerActionIntent) => void }) {
  const [raiseTo, setRaiseTo] = useState(lm.minRaiseTo);
  const clamped = Math.min(Math.max(raiseTo, lm.minRaiseTo), lm.maxRaiseTo);

  return (
    <div className="actions">
      {lm.canFold && <button onClick={() => onAct({ type: 'fold' })}>Fold</button>}
      {lm.canCheck && <button onClick={() => onAct({ type: 'check' })}>Check</button>}
      {lm.canCall && (
        <button onClick={() => onAct({ type: 'call' })}>Call {lm.callAmount}</button>
      )}
      {lm.canRaise && (
        <span className="raise">
          {lm.maxRaiseTo > lm.minRaiseTo && (
            <input
              type="range"
              min={lm.minRaiseTo}
              max={lm.maxRaiseTo}
              value={clamped}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
            />
          )}
          <button onClick={() => onAct({ type: lm.canCheck ? 'bet' : 'raise', amount: clamped })}>
            {lm.canCheck ? 'Bet' : 'Raise to'} {clamped}
          </button>
        </span>
      )}
    </div>
  );
}
