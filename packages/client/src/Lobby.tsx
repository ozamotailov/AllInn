import type { RoomPublicState } from '@allinn/shared';

export function Lobby({
  state,
  meId,
  inviteLink,
  onSit,
  onLeave,
}: {
  state: RoomPublicState;
  meId: string;
  inviteLink?: string;
  onSit: (seat: number) => void;
  onLeave: () => void;
}) {
  const { config } = state;
  const seated = state.seats.some((s) => s.userId === meId);

  return (
    <section className="card">
      <h2>Lobby</h2>
      <p className="muted">
        {config.smallBlind}/{config.bigBlind} · stack {config.startingStack} ·{' '}
        {config.maxPlayers}-max · {config.actionTimerSeconds}s
      </p>

      <div className="invite">
        Room code: <code className="room-code">{state.roomCode}</code>
        {inviteLink && <div className="muted small">{inviteLink}</div>}
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

      <p className="muted small">{state.presentUserIds.length} online</p>
      {seated && (
        <button className="ghost" onClick={onLeave}>
          Leave seat
        </button>
      )}
    </section>
  );
}
