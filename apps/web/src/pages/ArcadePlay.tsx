import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ARCADE_BY_ID, arcadeTotals, isArcadeId, MEMORY_GRIDS, DEFAULT_ARCADE_SETTINGS, type ArcadeDifficulty, type ArcadeMode, type ArcadeSettings, type ArcadeStatsRecord, type MessageKey } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { Spinner } from '../components/ui';
import { ARCADE_COMPONENTS, RESUMABLE } from '../arcade/registry';
import { arcadeRepo, createSfx, formatMs, type FinishInfo } from '../arcade/shared';

type Phase = 'menu' | 'playing' | 'over';

export default function ArcadePlay() {
  const { id = '' } = useParams();
  const { t, locale, num } = useI18n();
  const valid = isArcadeId(id);
  const info = valid ? ARCADE_BY_ID[id] : null;
  const [phase, setPhase] = useState<Phase>('menu');
  const [paused, setPaused] = useState(false);
  const [difficulty, setDifficulty] = useState<ArcadeDifficulty>(info?.difficulties.includes('medium') ? 'medium' : info?.difficulties[0] ?? 'medium');
  const [mode, setMode] = useState<ArcadeMode>(info?.modes[0] ?? 'solo');
  const [grid, setGrid] = useState<string>('4x4');
  const [run, setRun] = useState(0);
  const [seed, setSeed] = useState(() => Date.now() >>> 0);
  const [settings, setSettings] = useState<ArcadeSettings>(DEFAULT_ARCADE_SETTINGS);
  const [stats, setStats] = useState<ArcadeStatsRecord | undefined>();
  const [result, setResult] = useState<(FinishInfo & { newBest: boolean }) | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const startedAt = useRef(0);
  const sfx = useMemo(() => createSfx(settings), [settings]);

  useEffect(() => {
    if (!valid) return;
    void arcadeRepo.meta().then((m) => { setSettings(m.settings); if (!m.seenRules.includes(id)) setShowRules(true); });
    void arcadeRepo.stats(id).then(setStats);
  }, [id, valid]);

  // Real-time games pause automatically when the tab is hidden.
  useEffect(() => {
    const onHide = () => { if (document.hidden && phase === 'playing') setPaused(true); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || ((e.key === 'p' || e.key === 'P') && info?.realtime)) { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, info]);

  const start = (fresh: boolean) => {
    if (!valid) return;
    if (fresh && RESUMABLE.includes(id)) void arcadeRepo.clearGame(id);
    setSeed((Date.now() ^ (run * 7919)) >>> 0);
    setRun((r) => r + 1); setResult(null); setLive(null); setPaused(false); setPhase('playing');
    startedAt.current = Date.now();
    void arcadeRepo.touchRecent(id);
  };

  const onFinish = useCallback((f: FinishInfo) => {
    if (!valid) return;
    void arcadeRepo.record({ gameId: id, outcome: f.outcome, score: f.score, timeMs: f.timeMs, playMs: Date.now() - startedAt.current, difficulty, mode }).then((r) => {
      setStats(r.stats);
      setResult({ ...f, newBest: r.newBestScore || r.newBestTime });
    });
    setTimeout(() => setPhase('over'), 700);
  }, [id, valid, difficulty, mode]);
  const onScore = useCallback((n: number) => setLive(n), []);

  const updateSettings = async (p: Partial<ArcadeSettings>) => setSettings(await arcadeRepo.updateSettings(p));

  if (!valid || !info) return <div className="card"><p>{t('common.error')}</p><Link to="/arcade" className="btn">{t('arcade.backToArcade')}</Link></div>;
  const text = info.text[locale];
  const Game = ARCADE_COMPONENTS[id];
  const tot = stats ? arcadeTotals(stats) : null;
  const best = info.scoreKind === 'time' ? (stats?.bestTimeMs ? (id === 'reaction-test' ? `${stats.bestTimeMs} ms` : formatMs(stats.bestTimeMs)) : '—') : info.scoreKind === 'wins' ? `${tot?.wins ?? 0}` : num(stats?.bestScore ?? 0);
  const bestLabel = info.scoreKind === 'time' ? t('arcade.bestTime') : info.scoreKind === 'wins' ? t('arcade.wins') : t('arcade.best');

  const resultTitle = result ? (result.message && result.outcome !== 'loss' && result.outcome !== 'done' ? result.message
    : result.outcome === 'win' ? t('arcade.youWin') : result.outcome === 'loss' ? t('arcade.youLose') : result.outcome === 'draw' ? t('arcade.draw') : t('arcade.gameOver')) : '';

  return (
    <div className="arcade" style={{ ['--g' as string]: info.color }}>
      <div className="arcade-playhead">
        <Link to="/arcade" className="btn ghost sm">← {t('arcade.backToArcade')}</Link>
        <h1><span aria-hidden>{info.emoji}</span> {text.title}</h1>
        <div className="row">
          <span className="badge">{bestLabel}: {best}</span>
          {stats && stats.streak > 1 && <span className="badge warning">🔥 {t('arcade.streak')}: {stats.streak}</span>}
          {phase === 'playing' && live !== null && <span className="badge info" aria-live="polite">{t('arcade.score')}: {num(live)}</span>}
        </div>
      </div>

      {phase === 'menu' && (
        <div className="arcade-menu card">
          <p className="arcade-tagline">{text.tagline}</p>
          {info.modes.length > 1 && (
            <fieldset className="field"><legend className="faint">{t('arcade.mode')}</legend>
              <div className="chips">{info.modes.map((m) => <button key={m} className={`chip${mode === m ? ' active' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{t(`arcade.mode.${m}` as MessageKey)}</button>)}</div>
            </fieldset>
          )}
          {info.difficulties.length > 1 && mode !== 'local' && id !== 'memory-match' && (
            <fieldset className="field"><legend className="faint">{t('arcade.difficulty')}</legend>
              <div className="chips">{info.difficulties.map((d) => <button key={d} className={`chip${difficulty === d ? ' active' : ''}`} aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>{t(`arcade.diff.${d}` as MessageKey)}</button>)}</div>
            </fieldset>
          )}
          {id === 'memory-match' && (
            <fieldset className="field"><legend className="faint">{t('arcade.grid')}</legend>
              <div className="chips">{Object.keys(MEMORY_GRIDS).map((g) => <button key={g} className={`chip${grid === g ? ' active' : ''}`} aria-pressed={grid === g} onClick={() => setGrid(g)}>{g.replace('x', '×')}</button>)}</div>
            </fieldset>
          )}
          <div className="row">
            <button className="btn primary lg arcade-play" onClick={() => start(false)}>▶ {t('arcade.play')}</button>
            <button className="btn" onClick={() => setShowRules(true)}>? {t('arcade.howToPlay')}</button>
          </div>
          {tot && tot.plays > 0 && (
            <div className="arcade-stats">
              <div className="stat"><span className="faint">{t('arcade.plays')}</span><strong>{num(tot.plays)}</strong></div>
              <div className="stat"><span className="faint">{t('arcade.wins')}</span><strong>{num(tot.wins)}</strong></div>
              <div className="stat"><span className="faint">{t('arcade.bestStreak')}</span><strong>{num(stats!.bestStreak)}</strong></div>
              <div className="stat"><span className="faint">{t('arcade.time')}</span><strong>{formatMs(tot.playMs)}</strong></div>
            </div>
          )}
          <details className="arcade-settings">
            <summary>{t('arcade.settings')}</summary>
            <label className="row"><input type="checkbox" checked={settings.sound} onChange={(e) => void updateSettings({ sound: e.target.checked })} /> {t('arcade.sound')}</label>
            <label className="row">{t('arcade.volume')} <input type="range" min={0} max={1} step={0.1} value={settings.volume} onChange={(e) => void updateSettings({ volume: Number(e.target.value) })} aria-label={t('arcade.volume')} /></label>
            <label className="row"><input type="checkbox" checked={settings.haptics} onChange={(e) => void updateSettings({ haptics: e.target.checked })} /> {t('arcade.haptics')}</label>
          </details>
          <p className="faint">{t('arcade.localOnly')}</p>
        </div>
      )}

      {phase !== 'menu' && (
        <div className="arcade-stage">
          <div className="row arcade-controls">
            {phase === 'playing' && <button className="btn sm" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? `▶ ${t('arcade.resume')}` : `⏸ ${t('arcade.pause')}`}</button>}
            <button className="btn sm" onClick={() => start(true)}>↻ {t('arcade.restart')}</button>
            <button className="btn sm ghost" onClick={() => { setPhase('menu'); setPaused(false); }}>{t('arcade.quit')}</button>
          </div>
          <div className={`arcade-board${paused ? ' is-paused' : ''}`}>
            <Suspense fallback={<Spinner />}>
              <Game key={run} difficulty={difficulty} mode={mode} seed={seed} paused={paused || phase !== 'playing'} locale={locale} t={t} sfx={sfx}
                onFinish={onFinish} onScore={onScore} option={id === 'memory-match' ? grid : undefined} />
            </Suspense>
            {paused && phase === 'playing' && (
              <div className="arcade-overlay" role="dialog" aria-label={t('arcade.paused')}>
                <h2>⏸ {t('arcade.paused')}</h2>
                <button className="btn primary lg" autoFocus onClick={() => setPaused(false)}>▶ {t('arcade.resume')}</button>
                <button className="btn" onClick={() => start(true)}>↻ {t('arcade.restart')}</button>
              </div>
            )}
            {phase === 'over' && result && (
              <div className="arcade-overlay" role="dialog" aria-label={t('arcade.gameOver')}>
                <h2 className={result.outcome === 'win' ? 'win' : ''}>{resultTitle}</h2>
                {result.message && result.message !== resultTitle && <p>{result.message}</p>}
                {result.score !== undefined && info.scoreKind === 'high' && <p className="arcade-big">{num(result.score)}</p>}
                {result.timeMs !== undefined && info.scoreKind === 'time' && result.outcome !== 'loss' && <p className="arcade-big">{id === 'reaction-test' ? `${result.timeMs} ms` : formatMs(result.timeMs)}</p>}
                {result.newBest && <p className="badge warning arcade-record">🏆 {t('arcade.newRecord')}</p>}
                <div className="row center">
                  <button className="btn primary lg" autoFocus onClick={() => start(true)}>↻ {t('arcade.playAgain')}</button>
                  <button className="btn" onClick={() => setPhase('menu')}>{t('arcade.quit')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showRules && (
        <div className="modal-backdrop" onClick={() => setShowRules(false)}>
          <div className="modal arcade-rules" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="rules-title">{info.emoji} {t('arcade.howToPlay')} — {text.title}</h2>
            <h3>{t('arcade.rules')}</h3>
            <ul>{text.rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
            <h3>{t('arcade.controls')}</h3>
            <ul>{text.controls.map((r, i) => <li key={i}>{r}</li>)}</ul>
            <button className="btn primary" autoFocus onClick={() => { setShowRules(false); void arcadeRepo.markRulesSeen(id); }}>{t('arcade.gotIt')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
