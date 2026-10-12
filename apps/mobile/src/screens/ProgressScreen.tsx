import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { GAMES, progressTotals, type GameProgressRecord, type WeaknessReport } from '@exammate/core';
import { useApp } from '../lib/app';
import { api } from '../lib/api';
import { gameRepo } from '../lib/store';
import { Card, P, Screen, Title } from '../components/ui';

export function ProgressScreen() {
  const { t, locale, user, online } = useApp();
  const [games, setGames] = useState<Record<string, GameProgressRecord>>({});
  const [report, setReport] = useState<WeaknessReport | null>(null);
  useFocusEffect(useCallback(() => {
    void gameRepo.all().then(setGames);
    if (user && online) void api<{ report: WeaknessReport }>('/progress/weaknesses').then((r) => setReport(r.report)).catch(() => undefined);
  }, [user, online]));
  return (
    <Screen>
      <Title>{t('progress.title')}</Title>
      {report && (
        <Card>
          <P style={{ fontWeight: '700' }}>{t('progress.weaknesses')}</P>
          {report.topics.length === 0 ? <P muted>{t('progress.noData')}</P> : report.topics.slice(0, 6).map((tp) => (
            <P key={tp.subject + tp.topic}>{tp.topic}: {Math.round(tp.accuracy * 100)}%{tp.reasons.length ? ` — ${tp.reasons.join('; ')}` : ''}</P>
          ))}
        </Card>
      )}
      {!user && <P muted>{t('progress.signInNote')}</P>}
      <Card>
        <P style={{ fontWeight: '700' }}>{t('progress.gameStats')}</P>
        {GAMES.map((g) => {
          const p = games[g.id];
          const tot = p ? progressTotals(p) : null;
          return <P key={g.id}>{g.icon} {g.title[locale]}: {p?.highScore ?? 0} · {t('common.level')} {p?.unlockedLevel ?? 1}{tot?.answered ? ` · ${Math.round((tot.correct / tot.answered) * 100)}%` : ''}</P>;
        })}
      </Card>
    </Screen>
  );
}
