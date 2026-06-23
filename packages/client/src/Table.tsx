import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
import { t, tHand } from './i18n.js';
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

/** Seat j on the table ellipse, rotated so "you" sit at the bottom. */
function seatPos(j: number, myIndex: number, n: number): { left: string; top: string } {
  const rel = (j - myIndex + n) % n;
  const ang = Math.PI / 2 + (rel * 2 * Math.PI) / n;
  return { left: `${50 + 42 * Math.cos(ang)}%`, top: `${50 + 43 * Math.sin(ang)}%` };
}

// Offset (px) from a seat toward the table center — where its bet chips sit.
function betOffset(j: number, myIndex: number, n: number): { x: number; y: number } {
  const rel = (j - myIndex + n) % n;
  const ang = Math.PI / 2 + (rel * 2 * Math.PI) / n;
  const R = 64;
  return { x: -Math.cos(ang) * R, y: -Math.sin(ang) * R };
}

// Key cards by identity so only newly dealt cards animate in (existing ones don't replay).
const cardKey = (c: Card): string => `${c.rank}${c.suit}`;

interface FlyChip {
  id: number;
  left: string;
  top: string;
  delay: number;
}

export function Table({
  state,
  result,
  actionSeconds,
  isHost,
  onAct,
  onLeave,
  onSettle,
  onRebuy,
  onStart,
  onPause,
}: {
  state: PersonalTableState;
  result?: HandResultView;
  actionSeconds: number;
  isHost: boolean;
  onAct: (intent: PlayerActionIntent) => void;
  onLeave: () => void;
  onSettle: () => void;
  onRebuy: () => void;
  onStart: () => void;
  onPause: () => void;
}) {
  const potTotal = state.pots.reduce((a, p) => a + p.amount, 0);
  const lm = state.yourLegalMoves;
  const secsLeft = useCountdown(state.street === 'showdown' ? undefined : state.actionDeadline);

  const players = [...state.players].sort((a, b) => a.seat - b.seat);
  const n = players.length;
  const myIndex = Math.max(0, players.findIndex((p) => p.seat === state.yourSeat));

  // At a contested showdown, highlight the winner's 5 cards and dim the rest.
  const showdownHl = state.street === 'showdown' && !!result && result.showdown.length > 0;
  const winners = showdownHl ? result!.showdown.filter((e) => e.won > 0) : [];
  const winCards = new Set(winners.flatMap((e) => e.best5.map(cardKey)));
  const cardState = (c: Card): { dim?: boolean; highlight?: boolean } =>
    showdownHl ? (winCards.has(cardKey(c)) ? { highlight: true } : { dim: true }) : {};

  // Fly a gold chip from a seat to the pot whenever that seat's committed grows.
  const prevBets = useRef<Record<number, number>>({});
  const chipId = useRef(0);
  const [chips, setChips] = useState<FlyChip[]>([]);
  useEffect(() => {
    const spawned: FlyChip[] = [];
    players.forEach((p, j) => {
      const before = prevBets.current[p.seat] ?? 0;
      if (p.committed > before) {
        const pos = seatPos(j, myIndex, n);
        const delta = p.committed - before;
        const count = Math.min(4, 1 + Math.floor(delta / 12)); // bigger bet → more chips
        for (let k = 0; k < count; k++) {
          const jx = (Math.random() * 12 - 6).toFixed(1);
          const jy = (Math.random() * 12 - 6).toFixed(1);
          spawned.push({
            id: ++chipId.current,
            left: `calc(${pos.left} + ${jx}px)`,
            top: `calc(${pos.top} + ${jy}px)`,
            delay: k * 70,
          });
        }
      }
      prevBets.current[p.seat] = p.committed;
    });
    if (spawned.length) setChips((cs) => [...cs, ...spawned]);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = (intent: PlayerActionIntent) => {
    haptic('tap');
    onAct(intent);
  };

  return (
    <div className="poker">
      <div className="felt">
        <div className="center">
          <div className="pot" key={potTotal}>
            {potTotal > 0 ? t('table.pot', { n: potTotal }) : ' '}
            <span className="muted small"> · {t(`street.${state.street}`)}</span>
          </div>
          <div className="board">
            {state.board.map((c) => <CardView key={cardKey(c)} card={c} {...cardState(c)} />)}
            {Array.from({ length: 5 - state.board.length }).map((_, i) => (
              <span key={`ph${i}`} className="playing-card placeholder" />
            ))}
          </div>
          {showdownHl && winners.length > 0 && (
            <div className="showdown-label">
              {winners.map((e) => (
                <div key={e.seat}>
                  <strong>{players.find((p) => p.seat === e.seat)?.displayName ?? '—'}</strong>
                  {' — '}
                  {tHand(e.handName)}
                </div>
              ))}
            </div>
          )}
        </div>

        {players.map((p, j) => (
          <Seat
            key={p.seat}
            p={p}
            pos={seatPos(j, myIndex, n)}
            bet={betOffset(j, myIndex, n)}
            won={result?.payouts?.[p.seat] ?? 0}
            reveal={result?.showdown.find((e) => e.seat === p.seat)?.holeCards}
            cardState={cardState}
            state={state}
            secsLeft={secsLeft}
          />
        ))}

        {chips.map((c) => (
          <div
            key={c.id}
            className="flychip"
            style={{ '--fx': c.left, '--fy': c.top, animationDelay: `${c.delay}ms` } as unknown as CSSProperties}
            onAnimationEnd={() => setChips((cs) => cs.filter((x) => x.id !== c.id))}
          />
        ))}
      </div>

      <div className="hole">
        {state.yourHoleCards ? (
          state.yourHoleCards.map((c) => <CardView key={cardKey(c)} card={c} {...cardState(c)} />)
        ) : (
          <span className="muted">{t('table.spectating')}</span>
        )}
      </div>

      {state.deckCommitment && state.street !== 'showdown' && (
        <p className="muted small mono center-text">🔒 {state.deckCommitment.slice(0, 10)}…</p>
      )}

      {state.running === false && state.street !== 'showdown' && (
        <p className="muted small center-text">{t('table.pausing')}</p>
      )}

      {result?.fairness && (
        <div className="result-fair">
          <Fairness reveal={result.fairness} board={result.board} />
        </div>
      )}

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
          <span className="muted small waiting">{t('table.waiting')}</span>
          {isHost &&
            (state.running ? (
              <button className="ghost" onClick={onPause}>{t('table.pause')}</button>
            ) : (
              <button className="ghost" onClick={onStart}>{t('table.resume')}</button>
            ))}
          <button className="ghost" onClick={onSettle}>{t('common.settleUp')}</button>
          <button className="ghost" onClick={onRebuy}>{t('common.rebuy')}</button>
          <button
            className="ghost"
            onClick={async () => {
              if (await confirmDialog(t('confirm.leaveTable'))) onLeave();
            }}
          >
            {t('common.leave')}
          </button>
        </div>
      )}
    </div>
  );
}

function Seat({
  p,
  pos,
  bet,
  won,
  reveal,
  cardState,
  state,
  secsLeft,
}: {
  p: PublicPlayer;
  pos: { left: string; top: string };
  bet: { x: number; y: number };
  won: number;
  reveal?: [Card, Card];
  cardState: (c: Card) => { dim?: boolean; highlight?: boolean };
  state: PersonalTableState;
  secsLeft?: number;
}) {
  const you = p.seat === state.yourSeat;
  const turn = p.seat === state.toActSeat;
  const winner = won > 0;
  const initial = (p.displayName ?? '?').trim().slice(0, 1).toUpperCase() || '?';
  return (
    <div
      className={`pseat ${p.status} ${turn ? 'turn' : ''} ${you ? 'you' : ''} ${winner ? 'winner' : ''}`}
      style={pos}
    >
      {winner && <div className="won">+{won}</div>}
      {reveal && !you && (
        <div className="reveal">
          <CardView key={cardKey(reveal[0])} card={reveal[0]} {...cardState(reveal[0])} />
          <CardView key={cardKey(reveal[1])} card={reveal[1]} {...cardState(reveal[1])} />
        </div>
      )}
      <div className="avatar">
        {initial}
        {p.seat === state.buttonSeat && <span className="dealer">D</span>}
      </div>
      <div className="info">
        <div className="nm">{p.displayName ?? '—'}{you ? ` ${t('common.you')}` : ''}</div>
        <div className="st">
          {p.status === 'folded' ? t('seat.folded') : p.status === 'allin' ? t('seat.allin') : p.stack}
          {turn && secsLeft !== undefined ? ` · ${t('common.seconds', { n: secsLeft })}` : ''}
        </div>
      </div>
      {p.committed > 0 && (
        <div
          className="bet-pos"
          style={{ transform: `translate(-50%, -50%) translate(${bet.x}px, ${bet.y}px)` }}
        >
          <div className="bet" key={p.committed}>{p.committed}</div>
        </div>
      )}
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
  const [raiseTo, setRaiseTo] = useState<number>(lm.minRaiseTo);
  const safe = Number.isFinite(raiseTo) ? raiseTo : lm.minRaiseTo;
  const clamped = Math.min(Math.max(safe, lm.minRaiseTo), lm.maxRaiseTo);
  const hasRange = lm.maxRaiseTo > lm.minRaiseTo;
  const frac = actionSeconds > 0 && secsLeft !== undefined ? Math.min(1, secsLeft / actionSeconds) : 0;

  return (
    <div className="actionbar">
      <div className="timer">
        <div className="timer-fill" style={{ width: `${frac * 100}%` }} />
      </div>
      {lm.canRaise && (
        <>
          {hasRange && (
            <input
              className="raise-slider"
              type="range"
              min={lm.minRaiseTo}
              max={lm.maxRaiseTo}
              value={clamped}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
            />
          )}
          <div className="raise-row">
            <input
              className="raise-num"
              type="number"
              inputMode="numeric"
              min={lm.minRaiseTo}
              max={lm.maxRaiseTo}
              value={Number.isFinite(raiseTo) ? raiseTo : ''}
              onChange={(e) => setRaiseTo(e.target.value === '' ? NaN : Number(e.target.value))}
              onBlur={() => setRaiseTo(clamped)}
            />
            {hasRange && (
              <button type="button" className="ghost" onClick={() => setRaiseTo(lm.maxRaiseTo)}>
                {t('act.allIn')}
              </button>
            )}
          </div>
        </>
      )}
      <div className="actions">
        {lm.canFold && (
          <button className="act fold" onClick={() => onAct({ type: 'fold' })}>{t('act.fold')}</button>
        )}
        {lm.canCheck && (
          <button className="act" onClick={() => onAct({ type: 'check' })}>{t('act.check')}</button>
        )}
        {lm.canCall && (
          <button className="act" onClick={() => onAct({ type: 'call' })}>{t('act.call', { n: lm.callAmount })}</button>
        )}
        {lm.canRaise && (
          <button className="act raise" onClick={() => onAct({ type: lm.canCheck ? 'bet' : 'raise', amount: clamped })}>
            {lm.canCheck ? t('act.bet', { n: clamped }) : t('act.raise', { n: clamped })}
          </button>
        )}
      </div>
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
        <button className="link" onClick={verify}>{t('fair.verify')}</button>
      )}
      {status === 'checking' && <span className="muted small">{t('fair.checking')}</span>}
      {status === 'ok' && <span className="ok small">{t('fair.ok')}</span>}
      {status === 'bad' && <span className="error small">{t('fair.bad')}</span>}
    </div>
  );
}
