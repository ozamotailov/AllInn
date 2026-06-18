import { useEffect } from 'react';
import { useSession } from './session.js';
import { getStartParam } from './telegram.js';

// Step 1 (ARCHITECTURE.md §11): authenticate via initData and greet the user.
// Room create/join (using the startapp room code below) comes in step 2.

export function App() {
  const { status, user, error, login } = useSession();
  const roomCode = getStartParam();

  useEffect(() => {
    void login();
  }, [login]);

  return (
    <main className="screen">
      <h1>🃏 AllInn</h1>

      {status === 'loading' && <p className="muted">Signing in…</p>}

      {status === 'authed' && user && (
        <>
          <p>
            Привет, <strong>{user.displayName}</strong> 👋
          </p>
          {roomCode && (
            <p className="muted">
              Invite room: <code className="room-code">{roomCode}</code> (join lands in step 2)
            </p>
          )}
        </>
      )}

      {status === 'error' && (
        <p className="muted">Sign-in failed: {error}</p>
      )}
    </main>
  );
}
