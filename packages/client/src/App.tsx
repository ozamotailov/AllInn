import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from './session.js';
import { useRoom } from './room.js';
import { getStartParam } from './telegram.js';
import { CreateRoom } from './CreateRoom.js';
import { Lobby } from './Lobby.js';
import { Table } from './Table.js';
import { Ledger } from './Ledger.js';

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
      <header className="brand">
        <img className="brand-logo" src="/logo.png" alt="" />
        <span className="brand-name">All-Inn</span>
      </header>
      {children}
    </main>
  );
}

function RoomFlow({ token, userId }: { token: string; userId: string }) {
  const [code, setCode] = useState<string | undefined>(getStartParam());
  const [inviteLink, setInviteLink] = useState<string>();
  const { conn, mode, room, table, result, ledger, error, connect, sit, leave, act, rebuy, requestLedger, clearLedger } =
    useRoom();

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

  const buyIn = room?.config.startingStack ?? 0;
  const overlay = ledger ? <Ledger ledger={ledger} onClose={clearLedger} /> : null;
  const banner =
    conn === 'connecting' && (table || room) ? <div className="reconn">reconnecting…</div> : null;

  if (mode === 'table' && table) {
    return (
      <>
        {banner}
        <Table
          state={table}
          result={result}
          actionSeconds={room?.config.actionTimerSeconds ?? 20}
          onAct={act}
          onLeave={leave}
          onSettle={requestLedger}
          onRebuy={() => rebuy(buyIn)}
        />
        {overlay}
      </>
    );
  }
  if (room) {
    return (
      <>
        {banner}
        <Lobby
          state={room}
          meId={userId}
          inviteLink={inviteLink}
          onSit={sit}
          onLeave={leave}
          onSettle={requestLedger}
          onRebuy={() => rebuy(buyIn)}
        />
        {overlay}
      </>
    );
  }
  return <p className="muted">Joining room {code}…</p>;
}
