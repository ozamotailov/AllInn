import { useState } from 'react';
import { DEFAULT_CONFIG, validateConfig, type RoomConfig } from '@allinn/shared';
import { createRoom } from './api.js';
import { t } from './i18n.js';

export function CreateRoom({
  token,
  onCreated,
}: {
  token: string;
  onCreated: (code: string, inviteLink: string) => void;
}) {
  const [cfg, setCfg] = useState<RoomConfig>(DEFAULT_CONFIG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    const errs = validateConfig(cfg);
    if (errs.length) {
      setError(errs.join('; '));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const res = await createRoom(cfg, token);
      onCreated(res.code, res.inviteLink);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>{t('create.title')}</h2>
      <label>
        {t('create.smallBlind')}
        <input
          type="number"
          value={cfg.smallBlind}
          onChange={(e) => setCfg({ ...cfg, smallBlind: Number(e.target.value) })}
        />
      </label>
      <label>
        {t('create.bigBlind')}
        <input
          type="number"
          value={cfg.bigBlind}
          onChange={(e) => setCfg({ ...cfg, bigBlind: Number(e.target.value) })}
        />
      </label>
      <label>
        {t('create.startingStack')}
        <input
          type="number"
          value={cfg.startingStack}
          onChange={(e) => setCfg({ ...cfg, startingStack: Number(e.target.value) })}
        />
      </label>
      <label>
        {t('create.maxPlayers')}
        <input
          type="number"
          min={2}
          max={9}
          value={cfg.maxPlayers}
          onChange={(e) => setCfg({ ...cfg, maxPlayers: Number(e.target.value) })}
        />
      </label>
      <label>
        {t('create.actionTimer')}
        <input
          type="number"
          value={cfg.actionTimerSeconds}
          onChange={(e) => setCfg({ ...cfg, actionTimerSeconds: Number(e.target.value) })}
        />
      </label>
      <label>
        {t('create.autoStart')}
        <input
          type="checkbox"
          checked={cfg.autoStart}
          onChange={(e) => setCfg({ ...cfg, autoStart: e.target.checked })}
        />
      </label>

      {error && <p className="error">{error}</p>}
      <button className="primary" onClick={submit} disabled={busy}>
        {busy ? t('create.creating') : t('create.create')}
      </button>
    </section>
  );
}
