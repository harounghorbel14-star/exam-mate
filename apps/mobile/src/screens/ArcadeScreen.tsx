import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ARCADE_BY_ID, ARCADE_CATEGORIES, MEMORY_GRIDS, DEFAULT_ARCADE_SETTINGS, arcadeSummary, arcadeTotals, searchArcade,
  type ArcadeCategory, type ArcadeDifficulty, type ArcadeId, type ArcadeMode, type ArcadeSettings, type ArcadeStatsRecord, type MessageKey,
} from '@exammate/core';
import { useApp } from '../lib/app';
import { colors } from '../lib/theme';
import { Badge, Button, Card, Input, P, Title, s } from '../components/ui';
import { ARCADE_COMPONENTS, RESUMABLE } from '../arcade/registry';
import { a, arcadeRepo, createSfx, formatMs, Key, type FinishInfo } from '../arcade/shared';

type Filter = ArcadeCategory | 'all' | 'favorites';

export function ArcadeScreen({ navigation }: { navigation: { navigate(name: string, params: object): void } }) {
  const { t, locale } = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [favorites, setFavorites] = useState<ArcadeId[]>([]);
  const [recent, setRecent] = useState<ArcadeId[]>([]);
  const [stats, setStats] = useState<Partial<Record<ArcadeId, ArcadeStatsRecord>>>({});
  useFocusEffect(useCallback(() => {
    void arcadeRepo().then(async (r) => { const m = await r.meta(); setFavorites(m.favorites); setRecent(m.recent); setStats(await r.allStats()); });
  }, []));
  const games = useMemo(() => searchArcade(q, { category: filter === 'favorites' ? 'all' : filter, favorites, onlyFavorites: filter === 'favorites' }), [q, filter, favorites]);
  const sum = arcadeSummary(stats);
  const statLine = (id: ArcadeId) => {
    const st = stats[id];
    if (!st || arcadeTotals(st).plays === 0) return t('arcade.notPlayed');
    const kind = ARCADE_BY_ID[id].scoreKind, tot = arcadeTotals(st);
    if (kind === 'time') return st.bestTimeMs ? `${t('arcade.bestTime')}: ${id === 'reaction-test' ? `${st.bestTimeMs} ms` : formatMs(st.bestTimeMs)}` : `${t('arcade.plays')}: ${tot.plays}`;
    if (kind === 'wins') return `${t('arcade.wins')}: ${tot.wins}/${tot.plays}`;
    return `${t('arcade.best')}: ${st.bestScore}`;
  };
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={games}
      keyExtractor={(g) => g.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 10 }}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <Title>🕹️ {t('arcade.title')}</Title>
          <P muted>{t('arcade.subtitle')}</P>
          <Button title={`🌐 ${t('nav.play')}`} onPress={() => navigation.navigate('PlayOnline', {})} />
          <P style={{ fontWeight: '700' }}>{t('arcade.summary', { played: sum.gamesPlayed, plays: sum.plays, wins: sum.wins })}</P>
          <Input value={q} onChangeText={setQ} placeholder={t('arcade.search')} accessibilityLabel={t('arcade.search')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {(['all', 'favorites', ...ARCADE_CATEGORIES] as Filter[]).map((f) => (
              <Key key={f} label={f === 'all' ? t('arcade.all') : f === 'favorites' ? `★ ${t('arcade.favorites')}` : t(`arcade.cat.${f}` as MessageKey)} onPress={() => setFilter(f)} active={filter === f} />
            ))}
          </ScrollView>
          {recent.length > 0 && !q && filter === 'all' && (
            <View style={{ gap: 6 }}>
              <Text style={a.faint}>{t('arcade.recent')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {recent.map((id) => <Key key={id} label={`${ARCADE_BY_ID[id].emoji} ${ARCADE_BY_ID[id].text[locale].title}`} onPress={() => navigation.navigate('ArcadePlay', { id })} />)}
              </ScrollView>
            </View>
          )}
          {games.length === 0 && <P muted>{t('arcade.noResults')}</P>}
        </View>
      }
      renderItem={({ item: g }) => {
        const fav = favorites.includes(g.id);
        const title = g.text[locale].title;
        return (
          <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('ArcadePlay', { id: g.id })} accessibilityRole="button" accessibilityLabel={title}>
            <Card style={{ borderColor: g.color, minHeight: 170 }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={{ fontSize: 30 }}>{g.emoji}</Text>
                <Pressable hitSlop={10} onPress={async () => setFavorites(await (await arcadeRepo()).toggleFavorite(g.id))} accessibilityRole="button"
                  accessibilityLabel={fav ? t('arcade.removeFavorite', { name: title }) : t('arcade.addFavorite', { name: title })} accessibilityState={{ selected: fav }}>
                  <Text style={{ fontSize: 22, color: fav ? '#facc15' : colors.muted }}>{fav ? '★' : '☆'}</Text>
                </Pressable>
              </View>
              <P style={{ fontWeight: '700' }}>{title}</P>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{g.text[locale].tagline}</Text>
              <Text style={{ color: colors.faint, fontSize: 12, marginTop: 'auto' }}>{statLine(g.id)}</Text>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

export function ArcadePlayScreen({ route }: { route: { params: { id: ArcadeId } } }) {
  const id = route.params.id;
  const info = ARCADE_BY_ID[id];
  const { t, locale } = useApp();
  const text = info.text[locale];
  const [phase, setPhase] = useState<'menu' | 'playing' | 'over'>('menu');
  const [paused, setPaused] = useState(false);
  const [difficulty, setDifficulty] = useState<ArcadeDifficulty>(info.difficulties.includes('medium') ? 'medium' : info.difficulties[0]!);
  const [mode, setMode] = useState<ArcadeMode>(info.modes[0]!);
  const [grid, setGrid] = useState('4x4');
  const [run, setRun] = useState(0);
  const [seed, setSeed] = useState(() => Date.now() >>> 0);
  const [settings, setSettings] = useState<ArcadeSettings>(DEFAULT_ARCADE_SETTINGS);
  const [stats, setStats] = useState<ArcadeStatsRecord | undefined>();
  const [result, setResult] = useState<(FinishInfo & { newBest: boolean }) | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [rules, setRules] = useState(false);
  const startedAt = useRef(0);
  const sfx = useMemo(() => createSfx(settings), [settings]);

  useEffect(() => { void arcadeRepo().then(async (r) => { const m = await r.meta(); setSettings(m.settings); if (!m.seenRules.includes(id)) setRules(true); setStats(await r.stats(id)); }); }, [id]);
  // Pause when the app goes to the background.
  useEffect(() => { const sub = AppState.addEventListener('change', (st) => { if (st !== 'active') setPaused(true); }); return () => sub.remove(); }, []);

  const start = (fresh: boolean) => {
    if (fresh && RESUMABLE.includes(id)) void arcadeRepo().then((r) => r.clearGame(id));
    setSeed((Date.now() ^ (run * 7919)) >>> 0); setRun((r) => r + 1); setResult(null); setLive(null); setPaused(false); setPhase('playing');
    startedAt.current = Date.now();
    void arcadeRepo().then((r) => r.touchRecent(id));
  };
  const onFinish = useCallback((f: FinishInfo) => {
    void arcadeRepo().then((r) => r.record({ gameId: id, outcome: f.outcome, score: f.score, timeMs: f.timeMs, playMs: Date.now() - startedAt.current, difficulty, mode })).then((r) => {
      setStats(r.stats); setResult({ ...f, newBest: r.newBestScore || r.newBestTime });
    });
    setTimeout(() => setPhase('over'), 600);
  }, [id, difficulty, mode]);
  const onScore = useCallback((n: number) => setLive(n), []);
  const update = async (p: Partial<ArcadeSettings>) => setSettings(await (await arcadeRepo()).updateSettings(p));

  const Game = ARCADE_COMPONENTS[id];
  const tot = stats ? arcadeTotals(stats) : null;
  const best = info.scoreKind === 'time' ? (stats?.bestTimeMs ? (id === 'reaction-test' ? `${stats.bestTimeMs} ms` : formatMs(stats.bestTimeMs)) : '—') : info.scoreKind === 'wins' ? String(tot?.wins ?? 0) : String(stats?.bestScore ?? 0);
  const bestLabel = info.scoreKind === 'time' ? t('arcade.bestTime') : info.scoreKind === 'wins' ? t('arcade.wins') : t('arcade.best');
  const title = result ? (result.message && result.outcome !== 'loss' && result.outcome !== 'done' ? result.message
    : result.outcome === 'win' ? t('arcade.youWin') : result.outcome === 'loss' ? t('arcade.youLose') : result.outcome === 'draw' ? t('arcade.draw') : t('arcade.gameOver')) : '';
  const realtime = info.realtime;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} scrollEnabled={!(phase === 'playing' && realtime)} keyboardShouldPersistTaps="handled">
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Title>{info.emoji} {text.title}</Title>
          <View style={s.row}>
            <Badge text={`${bestLabel}: ${best}`} />
            {phase === 'playing' && live !== null && <Badge text={`${t('arcade.score')}: ${live}`} tone="success" />}
          </View>
        </View>

        {phase === 'menu' && (
          <Card style={{ borderColor: info.color, gap: 12 }}>
            <P style={{ fontWeight: '700' }}>{text.tagline}</P>
            {info.modes.length > 1 && <View style={{ gap: 6 }}><Text style={a.faint}>{t('arcade.mode')}</Text><View style={s.row}>{info.modes.map((m) => <Key key={m} label={t(`arcade.mode.${m}` as MessageKey)} onPress={() => setMode(m)} active={mode === m} />)}</View></View>}
            {info.difficulties.length > 1 && mode !== 'local' && id !== 'memory-match' && (
              <View style={{ gap: 6 }}><Text style={a.faint}>{t('arcade.difficulty')}</Text><View style={s.row}>{info.difficulties.map((d) => <Key key={d} label={t(`arcade.diff.${d}` as MessageKey)} onPress={() => setDifficulty(d)} active={difficulty === d} />)}</View></View>
            )}
            {id === 'memory-match' && <View style={{ gap: 6 }}><Text style={a.faint}>{t('arcade.grid')}</Text><View style={s.row}>{Object.keys(MEMORY_GRIDS).map((g) => <Key key={g} label={g.replace('x', '×')} onPress={() => setGrid(g)} active={grid === g} />)}</View></View>}
            <Button title={`▶ ${t('arcade.play')}`} variant="primary" onPress={() => start(false)} />
            <Button title={`? ${t('arcade.howToPlay')}`} onPress={() => setRules(true)} />
            {tot && tot.plays > 0 && <P muted>{t('arcade.plays')}: {tot.plays} · {t('arcade.wins')}: {tot.wins} · {t('arcade.bestStreak')}: {stats!.bestStreak} · {t('arcade.time')}: {formatMs(tot.playMs)}</P>}
            <View style={[s.row, { justifyContent: 'space-between' }]}><P>{t('arcade.sound')}</P><Switch value={settings.sound} onValueChange={(v) => void update({ sound: v })} accessibilityLabel={t('arcade.sound')} /></View>
            <View style={[s.row, { justifyContent: 'space-between' }]}><P>{t('arcade.haptics')}</P><Switch value={settings.haptics} onValueChange={(v) => void update({ haptics: v })} accessibilityLabel={t('arcade.haptics')} /></View>
            <Text style={a.faint}>{t('arcade.localOnly')}</Text>
          </Card>
        )}

        {phase !== 'menu' && (
          <View style={{ gap: 10 }}>
            <View style={[s.row, { justifyContent: 'flex-end' }]}>
              {phase === 'playing' && <Key label={paused ? `▶ ${t('arcade.resume')}` : `⏸ ${t('arcade.pause')}`} onPress={() => setPaused((p) => !p)} />}
              <Key label={`↻ ${t('arcade.restart')}`} onPress={() => start(true)} />
              <Key label={t('arcade.quit')} onPress={() => { setPhase('menu'); setPaused(false); }} />
            </View>
            <View style={{ opacity: paused ? 0.15 : 1 }} pointerEvents={paused ? 'none' : 'auto'}>
              <Game key={run} difficulty={difficulty} mode={mode} seed={seed} paused={paused || phase !== 'playing'} locale={locale} t={t} sfx={sfx} onFinish={onFinish} onScore={onScore} option={id === 'memory-match' ? grid : undefined} />
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={paused && phase === 'playing'} transparent animationType="fade" onRequestClose={() => setPaused(false)}>
        <View style={{ flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          <Title>⏸ {t('arcade.paused')}</Title>
          <Button title={`▶ ${t('arcade.resume')}`} variant="primary" onPress={() => setPaused(false)} />
          <Button title={`↻ ${t('arcade.restart')}`} onPress={() => start(true)} />
        </View>
      </Modal>
      <Modal visible={phase === 'over' && !!result} transparent animationType="fade" onRequestClose={() => setPhase('menu')}>
        <View style={{ flex: 1, backgroundColor: '#000b', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          <Title>{title}</Title>
          {result?.message && result.message !== title ? <P>{result.message}</P> : null}
          {result?.score !== undefined && info.scoreKind === 'high' ? <Text style={{ color: colors.text, fontSize: 40, fontWeight: '800' }}>{result.score}</Text> : null}
          {result?.timeMs !== undefined && info.scoreKind === 'time' && result.outcome !== 'loss' ? <Text style={{ color: colors.text, fontSize: 40, fontWeight: '800' }}>{id === 'reaction-test' ? `${result.timeMs} ms` : formatMs(result.timeMs)}</Text> : null}
          {result?.newBest ? <Badge text={`🏆 ${t('arcade.newRecord')}`} tone="warning" /> : null}
          <Button title={`↻ ${t('arcade.playAgain')}`} variant="primary" onPress={() => start(true)} />
          <Button title={t('arcade.quit')} onPress={() => setPhase('menu')} />
        </View>
      </Modal>
      <Modal visible={rules} transparent animationType="slide" onRequestClose={() => setRules(false)}>
        <View style={{ flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.elev, padding: 20, gap: 8, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <Title>{info.emoji} {t('arcade.howToPlay')}</Title>
            <P style={{ fontWeight: '700' }}>{t('arcade.rules')}</P>
            {text.rules.map((r, i) => <P key={i} muted>• {r}</P>)}
            <P style={{ fontWeight: '700' }}>{t('arcade.controls')}</P>
            {text.controls.map((r, i) => <P key={i} muted>• {r}</P>)}
            <Button title={t('arcade.gotIt')} variant="primary" onPress={() => { setRules(false); void arcadeRepo().then((r) => r.markRulesSeen(id)); }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
