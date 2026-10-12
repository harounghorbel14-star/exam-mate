import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MP_GAMES, MP_GAME_IDS, normalizeRoomCode, isRoomCode, type MessageKey, type MpGameId } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useOnline } from '../lib/online';
import { PageHead, RequireAccount } from '../components/ui';

export default function Play() {
  const { t } = useI18n();
  const online = useOnline();
  const nav = useNavigate();
  const [game, setGame] = useState<MpGameId>('tic-tac-toe');
  const [max, setMax] = useState(2);
  const [code, setCode] = useState('');
  const spec = MP_GAMES[game];
  const choose = (g: MpGameId) => { setGame(g); setMax((m) => Math.max(MP_GAMES[g].min, Math.min(MP_GAMES[g].max, m))); };
  return (
    <div className="arcade">
      <PageHead title={`🌐 ${t('mp.title')}`} subtitle={t('mp.subtitle')} actions={<span className="badge info">{t('mp.onlineBadge')}</span>} />
      {!online && <div className="alert warning" role="status">{t('mp.offlineHint')} <Link to="/arcade">{t('nav.arcade')}</Link></div>}
      <RequireAccount>
        <div className="grid cols-2">
          <section className="card stack" aria-labelledby="create-h">
            <h2 id="create-h">{t('mp.create')}</h2>
            <fieldset className="field" style={{ border: 'none', padding: 0 }}><legend className="faint">{t('mp.game')}</legend>
              <div className="chips">{MP_GAME_IDS.map((g) => <button key={g} className={`chip${game === g ? ' active' : ''}`} aria-pressed={game === g} onClick={() => choose(g)}>{MP_GAMES[g].emoji} {t(`mp.g.${g}` as MessageKey)}</button>)}</div>
            </fieldset>
            <p className="faint">{spec.party ? t('mp.party') : t('mp.duel')}</p>
            {spec.max > spec.min && (
              <label className="field">{t('mp.maxPlayers')}
                <select className="input" value={max} onChange={(e) => setMax(Number(e.target.value))}>{Array.from({ length: spec.max - spec.min + 1 }, (_, i) => spec.min + i).map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </label>
            )}
            <button className="btn primary lg" disabled={!online} onClick={() => nav(`/play/new?game=${game}&max=${max}`)}>{t('mp.create')}</button>
          </section>
          <section className="card stack" aria-labelledby="join-h">
            <h2 id="join-h">{t('mp.join')}</h2>
            <form className="stack" onSubmit={(e) => { e.preventDefault(); const c = normalizeRoomCode(code); if (isRoomCode(c)) nav(`/play/${c}`); }}>
              <label className="field">{t('mp.code')}<input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" placeholder="ABC234" /></label>
              <button className="btn primary" disabled={!online || !isRoomCode(normalizeRoomCode(code))}>{t('mp.joinButton')}</button>
            </form>
            <p className="faint">{t('mp.offlineHint')}</p>
          </section>
        </div>
      </RequireAccount>
    </div>
  );
}
