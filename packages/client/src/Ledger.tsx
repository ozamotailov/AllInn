import type { LedgerView } from './room.js';
import { t } from './i18n.js';

export function Ledger({
  ledger,
  meId,
  onClose,
}: {
  ledger: LedgerView;
  meId: string;
  onClose: () => void;
}) {
  const myRow = ledger.rows.find((r) => r.userId === meId);
  const incoming = ledger.settlements.filter((s) => s.toUserId === meId);
  const outgoing = ledger.settlements.filter((s) => s.fromUserId === meId);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{t('common.settleUp')}</h2>

        {myRow && (
          <div className={`you-summary ${myRow.net >= 0 ? 'pos' : 'neg'}`}>
            <div className="you-net">
              <span>{t('ledger.yourResult')}</span>
              <strong>
                {myRow.net > 0 ? '+' : ''}
                {myRow.net}
              </strong>
            </div>
            {myRow.net > 0 && incoming.length > 0 && (
              <>
                <div className="you-label">{t('ledger.youReceive')}</div>
                <ul className="you-list">
                  {incoming.map((s, i) => (
                    <li key={i}>
                      <span>{s.fromName}</span>
                      <strong>+{s.amount}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {myRow.net < 0 && outgoing.length > 0 && (
              <>
                <div className="you-label">{t('ledger.youSend')}</div>
                <ul className="you-list">
                  {outgoing.map((s, i) => (
                    <li key={i}>
                      <span>{s.toName}</span>
                      <strong>−{s.amount}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {myRow.net === 0 && <div className="you-label">{t('ledger.youEven')}</div>}
          </div>
        )}

        <table className="ledger">
          <thead>
            <tr>
              <th>{t('ledger.player')}</th>
              <th>{t('ledger.buyIn')}</th>
              <th>{t('ledger.stack')}</th>
              <th>{t('ledger.net')}</th>
            </tr>
          </thead>
          <tbody>
            {ledger.rows.map((r) => (
              <tr key={r.userId} className={r.userId === meId ? 'me' : undefined}>
                <td>
                  {r.displayName}
                  {r.userId === meId ? ` ${t('common.you')}` : ''}
                </td>
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

        <h3>{t('ledger.whoPays')}</h3>
        {ledger.settlements.length === 0 ? (
          <p className="muted">{t('ledger.even')}</p>
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
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
