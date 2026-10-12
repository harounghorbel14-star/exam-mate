import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GAMES, progressTotals, type GameProgressRecord } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { gameRepo } from '../lib/sync';
import { PageHead, Stars } from '../components/ui';

export default function Games() {
  const { t, locale, num } = useI18n();
  const [progress, setProgress] = useState<Record<string, GameProgressRecord>>({});
  useEffect(() => { void gameRepo.all().then(setProgress); }, []);
  return (
    <>
      <PageHead title={t('games.title')} subtitle={t('games.subtitle')} />
      <div className="grid cols-3">
        {GAMES.map((g) => {
          const p = progress[g.id];
          const bestStars = p ? Math.max(0, ...Object.values(p.stars)) : 0;
          const totals = p ? progressTotals(p) : null;
          return (
            <Link key={g.id} to={`/games/${g.id}`} className="card game-card" style={{ color: 'inherit', textDecoration: 'none' }} aria-label={g.title[locale]}>
              <div className="row between"><span className="game-icon" aria-hidden>{g.icon}</span><span className="badge success">{t('games.available')}</span></div>
              <h3 style={{ margin: 0 }}>{g.title[locale]}</h3>
              <p className="muted" style={{ margin: 0, fontSize: '0.92rem' }}>{g.description[locale]}</p>
              <div className="row between faint">
                <span>{t('games.highScore')}: {num(p?.highScore ?? 0)}</span>
                <span>{t('common.level')} {p?.unlockedLevel ?? 1}/{g.maxLevel}</span>
              </div>
              <div className="row between"><Stars n={bestStars} />{totals && <span className="faint">{num(totals.plays)} ▶</span>}</div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
