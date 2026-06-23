import type { LedgerView } from './room.js';
import { t } from './i18n.js';

export function Ledger({ ledger, onClose }: { ledger: LedgerView; onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>{t('common.settleUp')}</h2>

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
