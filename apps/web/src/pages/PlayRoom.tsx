import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MP_GAMES, MP_GAME_IDS, isMpGameId, type MessageKey, type MpGameId } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useMultiplayer } from '../lib/multiplayer';
import { RequireAccount, Spinner } from '../components/ui';
import { GameView } from '../multiplayer/GameView';

function Room() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { client, room, state, error, clearError } = useMultiplayer(!!user);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  // First connection: create (for /play/new) or join the code from the URL.
  useEffect(() => {
    if (state !== 'online' || started.current) return;
    started.current = true;
    if (code === 'new') {
      const g = params.get('game');
      const game: MpGameId = isMpGameId(g) ? g : 'tic-tac-toe';
      void client.create(game, Number(params.get('max')) || MP_GAMES[game].min).catch(() => undefined);
    } else void client.join(code).catch(() => undefined);
  }, [state, code, params, client]);
  // Keep the URL on the real room code so it can be shared or reloaded.
  useEffect(() => { if (room && room.code !== code) nav(`/play/${room.code}`, { replace: true }); }, [room, code, nav]);

  const err = (e: unknown) => { void e; };
  const errorText = error ? (['room_not_found', 'room_full', 'already_started', 'kicked'].includes(error.code) ? t(`mp.error.${error.code}` as MessageKey) : t('mp.error.generic', { message: error.message })) : null;
  const statusBadge = <span className={`badge ${state === 'online' ? 'success' : 'warning'}`} role="status">● {t(`mp.status.${state === 'idle' ? 'connecting' : state}` as MessageKey)}</span>;

  if (!room) return (
    <div className="stack">
      <div className="row">{statusBadge}<Link to="/play" className="btn ghost sm">← {t('mp.title')}</Link></div>
      {errorText ? <div className="alert danger" role="alert">{errorText}</div> : <Spinner />}
    </div>
  );

  const me = room.players.find((p) => p.userId === client.userId);
  const isHost = room.hostId === client.userId;
  const spec = MP_GAMES[room.game];
  const invite = `${window.location.origin}/play/${room.code}`;
  const everyoneReady = room.players.length >= spec.min && room.players.every((p) => p.host || (p.ready && p.connected));
  const v = room.view;
  const winners = (v?.winners as number[] | null) ?? null;
  const nameOf = (seat: number) => room.players.find((p) => p.seat === seat)?.name ?? '?';
  const resultText = v?.over ? (winners && winners.length === 1 ? (winners[0] === room.mySeat ? t('mp.youWon') : t('mp.winner', { name: nameOf(winners[0]!) })) : winners && winners.length > 1 ? winners.map(nameOf).join(' & ') + ' 🏆' : t('mp.draw')) : null;

  return (
    <div className="arcade stack">
      <div className="arcade-playhead">
        <Link to="/play" className="btn ghost sm" onClick={() => void client.leave().catch(() => undefined)}>← {t('mp.leave')}</Link>
        <h1>{spec.emoji} {t(`mp.g.${room.game}` as MessageKey)}</h1>
        {statusBadge}
      </div>
      {errorText && <div className="alert warning" role="alert">{errorText} <button className="btn sm ghost" onClick={clearError}>{t('common.close')}</button></div>}

      <section className="card stack" aria-label={t('mp.lobby')}>
        <div className="row between">
          <div className="row"><span className="faint">{t('mp.code')}</span><strong className="mono room-code" data-testid="room-code">{room.code}</strong></div>
          <div className="row"><input className="input mono" readOnly value={invite} aria-label={t('mp.invite')} style={{ minWidth: 220 }} onFocus={(e) => e.target.select()} />
            <button className="btn sm" onClick={() => { void navigator.clipboard?.writeText(invite).then(() => setCopied(true)).catch(() => undefined); }}>{copied ? t('mp.copied') : t('mp.copy')}</button></div>
        </div>
        <ul className="list" aria-label={t('mp.maxPlayers')}>
          {room.players.map((p) => (
            <li key={p.userId} className="list-item">
              <span className="row"><span style={{ fontSize: '1.5rem' }} aria-hidden>{p.avatar}</span><strong>{p.name}</strong>{p.userId === client.userId && <span className="faint">({t('mp.you')})</span>}{p.host && <span className="badge info">{t('mp.host')}</span>}</span>
              <span className="row">
                {v && <span className="badge">{t('mp.score')}: {v.scores[p.seat] ?? 0}</span>}
                <span className={`badge ${p.connected ? 'success' : 'warning'}`}>{p.connected ? t('mp.connected') : t('mp.disconnected')}</span>
                {room.status === 'lobby' && !p.host && <span className={`badge ${p.ready ? 'success' : ''}`}>{p.ready ? t('mp.ready') : t('mp.notReady')}</span>}
                {room.status === 'lobby' && isHost && !p.host && <button className="btn sm ghost" onClick={() => void client.kick(p.userId).catch(err)} aria-label={t('mp.kick', { name: p.name })}>✕</button>}
              </span>
            </li>
          ))}
        </ul>
        {room.status === 'lobby' && (
          <div className="stack">
            {isHost ? (
              <>
                <div className="chips" role="group" aria-label={t('mp.game')}>{MP_GAME_IDS.map((g) => <button key={g} className={`chip${room.game === g ? ' active' : ''}`} aria-pressed={room.game === g} disabled={room.players.length > MP_GAMES[g].max} onClick={() => void client.select(g, Math.max(room.players.length, MP_GAMES[g].min === MP_GAMES[g].max ? 2 : room.maxPlayers)).catch(err)}>{MP_GAMES[g].emoji} {t(`mp.g.${g}` as MessageKey)}</button>)}</div>
                {spec.max > spec.min && <label className="row">{t('mp.maxPlayers')} <select className="input" style={{ width: 'auto' }} value={room.maxPlayers} onChange={(e) => void client.select(room.game, Number(e.target.value)).catch(err)}>{Array.from({ length: spec.max - spec.min + 1 }, (_, i) => spec.min + i).filter((n) => n >= room.players.length).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}
                <p className="faint">{t('mp.needPlayers', { n: room.players.length, max: room.maxPlayers })}</p>
                <button className="btn primary lg" disabled={!everyoneReady} onClick={() => void client.start().catch(err)}>▶ {t('mp.start')}</button>
              </>
            ) : (
              <>
                <p className="faint">{t('mp.waitingHost')}</p>
                <button className={`btn lg${me?.ready ? '' : ' primary'}`} onClick={() => void client.ready(!me?.ready).catch(err)}>{me?.ready ? t('mp.notReadyBtn') : t('mp.imReady')}</button>
              </>
            )}
          </div>
        )}
      </section>

      {v && room.status !== 'lobby' && (
        <section className="arcade-board" aria-label={t(`mp.g.${room.game}` as MessageKey)}>
          <GameView room={room} client={client} t={t} locale={locale} onError={err} />
          {resultText && (
            <div className="stack center" style={{ marginTop: 16 }} role="status">
              <h2 className={winners?.includes(room.mySeat ?? -1) ? 'win' : ''} data-testid="mp-result">{resultText}</h2>
              {v.forfeit !== null && v.forfeit !== undefined && <p className="faint">{t('mp.forfeit', { name: nameOf(v.forfeit as number) })}</p>}
              {isHost ? <button className="btn primary" onClick={() => void client.rematch().catch(err)}>↻ {t('mp.rematch')}</button> : <p className="faint">{t('mp.waitingHost')}</p>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function PlayRoom() {
  return <RequireAccount><Room /></RequireAccount>;
}
