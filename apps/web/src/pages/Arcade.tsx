import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ARCADE_BY_ID, ARCADE_CATEGORIES, arcadeSummary, arcadeTotals, searchArcade, type ArcadeCategory, type ArcadeId, type ArcadeStatsRecord, type MessageKey } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { arcadeRepo, formatMs } from '../arcade/shared';

type Filter = ArcadeCategory | 'all' | 'favorites';

export default function Arcade() {
  const { t, locale, num } = useI18n();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [favorites, setFavorites] = useState<ArcadeId[]>([]);
  const [recent, setRecent] = useState<ArcadeId[]>([]);
  const [stats, setStats] = useState<Partial<Record<ArcadeId, ArcadeStatsRecord>>>({});
  useEffect(() => {
    void arcadeRepo.meta().then((m) => { setFavorites(m.favorites); setRecent(m.recent); });
    void arcadeRepo.allStats().then(setStats);
  }, []);
  const games = useMemo(() => searchArcade(q, { category: filter === 'favorites' ? 'all' : filter, favorites, onlyFavorites: filter === 'favorites' }), [q, filter, favorites]);
  const summary = arcadeSummary(stats);
  const toggleFav = async (id: ArcadeId) => setFavorites(await arcadeRepo.toggleFavorite(id));

  const statLine = (id: ArcadeId) => {
    const st = stats[id];
    if (!st || arcadeTotals(st).plays === 0) return t('arcade.notPlayed');
    const kind = ARCADE_BY_ID[id].scoreKind;
    const tot = arcadeTotals(st);
    if (kind === 'time') return st.bestTimeMs ? `${t('arcade.bestTime')}: ${id === 'reaction-test' ? `${st.bestTimeMs} ms` : formatMs(st.bestTimeMs)}` : `${t('arcade.plays')}: ${num(tot.plays)}`;
    if (kind === 'wins') return `${t('arcade.wins')}: ${num(tot.wins)}/${num(tot.plays)}`;
    return `${t('arcade.best')}: ${num(st.bestScore)}`;
  };

  return (
    <div className="arcade">
      <header className="arcade-hero">
        <div>
          <h1>🕹️ {t('arcade.title')}</h1>
          <p>{t('arcade.subtitle')}</p>
          <p className="arcade-summary">{t('arcade.summary', { played: summary.gamesPlayed, plays: summary.plays, wins: summary.wins })}</p>
        </div>
        <span className="badge success">● {t('arcade.offlineReady')}</span>
      </header>

      <div className="arcade-toolbar">
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('arcade.search')} aria-label={t('arcade.search')} />
        <div className="chips" role="tablist" aria-label={t('arcade.category', { name: '' })}>
          {(['all', 'favorites', ...ARCADE_CATEGORIES] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? t('arcade.all') : f === 'favorites' ? `★ ${t('arcade.favorites')}` : t(`arcade.cat.${f}` as MessageKey)}
            </button>
          ))}
        </div>
      </div>

      {recent.length > 0 && !q && filter === 'all' && (
        <section aria-label={t('arcade.recent')} style={{ marginBottom: 18 }}>
          <h2 className="arcade-h2">{t('arcade.recent')}</h2>
          <div className="arcade-recent">
            {recent.map((id) => (
              <Link key={id} to={`/arcade/${id}`} className="arcade-chip" style={{ ['--g' as string]: ARCADE_BY_ID[id].color }}>
                <span aria-hidden>{ARCADE_BY_ID[id].emoji}</span>{ARCADE_BY_ID[id].text[locale].title}
              </Link>
            ))}
          </div>
        </section>
      )}

      {games.length === 0 ? <p className="muted">{t('arcade.noResults')}</p> : (
        <div className="arcade-grid">
          {games.map((g) => {
            const fav = favorites.includes(g.id);
            const title = g.text[locale].title;
            return (
              <article key={g.id} className="arcade-card" style={{ ['--g' as string]: g.color }}>
                <Link to={`/arcade/${g.id}`} className="arcade-card-link" aria-label={title}>
                  <span className="arcade-emoji" aria-hidden>{g.emoji}</span>
                  <h3>{title}</h3>
                  <p>{g.text[locale].tagline}</p>
                  <span className="arcade-meta">{t(`arcade.cat.${g.category}` as MessageKey)} · {statLine(g.id)}</span>
                </Link>
                <button className={`arcade-fav${fav ? ' on' : ''}`} onClick={() => void toggleFav(g.id)} aria-pressed={fav}
                  aria-label={fav ? t('arcade.removeFavorite', { name: title }) : t('arcade.addFavorite', { name: title })}>{fav ? '★' : '☆'}</button>
              </article>
            );
          })}
        </div>
      )}
      <p className="faint" style={{ marginTop: 20 }}><Link to="/games">{t('arcade.educationalLink')}</Link></p>
    </div>
  );
}
