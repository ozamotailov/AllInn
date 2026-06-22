import { useState } from 'react';
import type { RoomPublicState } from '@allinn/shared';
import { confirmDialog, copyText } from './telegram.js';

export function Lobby({
  state,
  meId,
  inviteLink,
  onSit,
  onLeave,
  onSettle,
  onRebuy,
  onStart,
  onPause,
}: {
  state: RoomPublicState;
  meId: string;
  inviteLink?: string;
  onSit: (seat: number) => void;
  onLeave: () => void;
  onSettle: () => void;
  onRebuy: () => void;
  onStart: () => void;
  onPause: () => void;
}) {
  const { config } = state;
  const seated = state.seats.some((s) => s.userId === meId);
  const isHost = meId === state.hostId;
  const running = state.running;
  const readyCount = state.seats.filter(
    (s) => s.status !== 'empty' && s.stack > 0 && s.userId && state.presentUserIds.includes(s.userId),
  ).length;

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyText(inviteLink || state.roomCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <section className="card">
      <h2>Lobby</h2>
      <p className="muted">
        {config.smallBlind}/{config.bigBlind} · stack {config.startingStack} ·{' '}
        {config.maxPlayers}-max · {config.actionTimerSeconds}s
      </p>

      <div className="invite">
        <div className="muted small">Room code</div>
        <div className="invite-row">
          <code className="room-code">{state.roomCode}</code>
          <button className="ghost small" onClick={copy}>
            {copied ? 'Copied ✓' : inviteLink ? 'Copy link' : 'Copy code'}
          </button>
        </div>
        {inviteLink && <div className="muted small link-url">{inviteLink}</div>}
      </div>

      <ul className="seats">
        {state.seats.map((s) => (
          <li key={s.seat} className={`seat ${s.status}`}>
            <span className="seat-no">#{s.seat + 1}</span>
            {s.status === 'empty' ? (
              <button className="link" onClick={() => onSit(s.seat)} disabled={seated}>
                Sit here
              </button>
            ) : (
              <span>
                {s.displayName}
                {s.userId === meId ? ' (you)' : ''} — {s.stack}
              </span>
            )}
          </li>
        ))}
      </ul>

      {seated && state.seats.filter((s) => s.status !== 'empty').length < 2 && (
        <p className="muted small">Waiting for another player to sit…</p>
      )}
      {isHost ? (
        running ? (
          <button className="ghost" onClick={onPause}>
            ⏸ Pause game
          </button>
        ) : (
          readyCount >= 2 && (
            <button className="primary" onClick={onStart}>
              ▶ Start game
            </button>
          )
        )
      ) : (
        !running && <p className="muted small">⏸ Game paused — waiting for the host…</p>
      )}
      <p className="muted small">{state.presentUserIds.length} online</p>

      <div className="toolbar">
        <button className="ghost" onClick={onSettle}>
          Settle up
        </button>
        {seated && (
          <>
            <button className="ghost" onClick={onRebuy}>
              Rebuy +{config.startingStack}
            </button>
            <button
              className="ghost"
              onClick={async () => {
                if (await confirmDialog('Leave your seat?')) onLeave();
              }}
            >
              Leave seat
            </button>
          </>
        )}
      </div>
    </section>
  );
}
