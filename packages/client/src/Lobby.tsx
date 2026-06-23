import { useState } from 'react';
import type { RoomPublicState } from '@allinn/shared';
import { confirmDialog, copyText } from './telegram.js';
import { t } from './i18n.js';

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
      <h2>{t('lobby.title')}</h2>
      <p className="muted">
        {t('lobby.config', {
          sb: config.smallBlind,
          bb: config.bigBlind,
          stack: config.startingStack,
          max: config.maxPlayers,
          timer: config.actionTimerSeconds,
        })}
      </p>

      <div className="invite">
        <div className="muted small">{t('lobby.roomCode')}</div>
        <div className="invite-row">
          <code className="room-code">{state.roomCode}</code>
          <button className="ghost small" onClick={copy}>
            {copied ? t('lobby.copied') : inviteLink ? t('lobby.copyLink') : t('lobby.copyCode')}
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
                {t('lobby.sitHere')}
              </button>
            ) : (
              <span>
                {s.displayName}
                {s.userId === meId ? ` ${t('common.you')}` : ''} — {s.stack}
              </span>
            )}
          </li>
        ))}
      </ul>

      {seated && state.seats.filter((s) => s.status !== 'empty').length < 2 && (
        <p className="muted small">{t('lobby.waitingPlayer')}</p>
      )}
      {isHost
        ? // Start/Pause only once there's a game to run (≥2 players seated).
          readyCount >= 2 &&
          (running ? (
            <button className="ghost" onClick={onPause}>
              {t('lobby.pauseGame')}
            </button>
          ) : (
            <button className="primary" onClick={onStart}>
              {t('lobby.startGame')}
            </button>
          ))
        : !running && <p className="muted small">{t('lobby.pausedWaitHost')}</p>}
      <p className="muted small">{t('lobby.online', { n: state.presentUserIds.length })}</p>

      <div className="toolbar">
        <button className="ghost" onClick={onSettle}>
          {t('common.settleUp')}
        </button>
        {seated && (
          <>
            <button className="ghost" onClick={onRebuy}>
              {t('lobby.rebuy', { n: config.startingStack })}
            </button>
            <button
              className="ghost"
              onClick={async () => {
                if (await confirmDialog(t('confirm.leaveSeat'))) onLeave();
              }}
            >
              {t('lobby.leaveSeat')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
