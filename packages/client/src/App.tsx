import { getStartParam, isInsideTelegram } from './telegram.js';

// MVP shell. Build-order step 1–2 (ARCHITECTURE.md §11):
//   - if a room code arrived via ?startapp=, show the "join room" screen
//   - otherwise show the "create room" screen (host sets blinds/stack/etc.)

export function App() {
  const roomCode = getStartParam();

  if (!isInsideTelegram()) {
    return (
      <main className="screen">
        <h1>🃏 Telegram Poker</h1>
        <p className="muted">Open this app from inside Telegram to play.</p>
      </main>
    );
  }

  return (
    <main className="screen">
      <h1>🃏 Telegram Poker</h1>
      {roomCode ? (
        <section>
          <p>Joining room</p>
          <code className="room-code">{roomCode}</code>
          {/* TODO(step 2): connect WS, show lobby + seating. */}
        </section>
      ) : (
        <section>
          <p>Create a table and invite friends.</p>
          {/* TODO(step 2): room-config form (blinds, starting stack, seats, timer). */}
          <button className="primary" disabled>
            Create room (TODO)
          </button>
        </section>
      )}
    </main>
  );
}
