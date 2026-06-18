import type { LedgerView } from './room.js';

export function Ledger({ ledger, onClose }: { ledger: LedgerView; onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Settle up</h2>

        <table className="ledger">
          <thead>
            <tr>
              <th>Player</th>
              <th>Buy-in</th>
              <th>Stack</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {ledger.rows.map((r) => (
              <tr key={r.userId}>
                <td>{r.displayName}</td>
                <td>{r.buyIn}</td>
                <td>{r.finalStack}</td>
                <td className={r.net >= 0 ? 'pos' : 'neg'}>
                  {r.net >= 0 ? '+' : ''}
                  {r.net}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Who pays whom</h3>
        {ledger.settlements.length === 0 ? (
          <p className="muted">Everyone's even — nothing to settle.</p>
        ) : (
          <ul className="transfers">
            {ledger.settlements.map((s, i) => (
              <li key={i}>
                {s.fromName} → {s.toName}: <strong>{s.amount}</strong>
              </li>
            ))}
          </ul>
        )}

        <button className="primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
