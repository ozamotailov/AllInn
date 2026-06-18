import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from './session.js';
import { useRoom } from './room.js';
import { getStartParam } from './telegram.js';
import { CreateRoom } from './CreateRoom.js';
import { Lobby } from './Lobby.js';

// Step 2 (ARCHITECTURE.md §11): authenticate → create a room (or join via the
// startapp deep link) → connect WS → lobby with live seating.

export function App() {
  const { status, user, token, error, login } = useSession();

  useEffect(() => {
    void login();
  }, [login]);

  if (status === 'idle' || status === 'loading') {
    return <Shell><p className="muted">Signing in…</p></Shell>;
  }
  if (status === 'error' || !user || !token) {
    return (
      <Shell>
        <p className="error">Sign-in failed{error ? `: ${error}` : ''}</p>
      </Shell>
    );
  }
  return (
    <Shell>
      <RoomFlow token={token} userId={user.id} />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="screen">
      <h1>🃏 AllInn</h1>
      {children}
    </main>
  );
}

function RoomFlow({ token, userId }: { token: string; userId: string }) {
  const [code, setCode] = useState<string | undefined>(getStartParam());
  const [inviteLink, setInviteLink] = useState<string>();
  const { conn, state, error, connect, sit, leave } = useRoom();

  useEffect(() => {
    if (code) connect(code, token);
  }, [code, token, connect]);

  if (!code) {
    return (
      <CreateRoom
        token={token}
        onCreated={(c, link) => {
          setInviteLink(link);
          setCode(c);
        }}
      />
    );
  }
  if (conn === 'error') return <p className="error">Room error: {error}</p>;
  if (!state) return <p className="muted">Joining room {code}…</p>;
  return (
    <Lobby state={state} meId={userId} inviteLink={inviteLink} onSit={sit} onLeave={leave} />
  );
}
