import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  GAMES, GAME_BY_ID, startQuiz, answerQuiz, tickQuiz, quizResult, remainingMs, startMemory, flipCard, memoryResult, applyResult, dailySeed, todayKey, mulberry32,
  type GameId, type GameProgressRecord, type QuizState, type MemoryState, type GameResult,
} from '@exammate/core';
import { useApp } from '../lib/app';
import { gameRepo, deviceId, readJson } from '../lib/store';
import { colors } from '../lib/theme';
import { Badge, Button, Card, Input, P, Screen, Title, s } from '../components/ui';

export function GamesScreen({ navigation }: { navigation: { navigate(name: string, params: object): void } }) {
  const { t, locale } = useApp();
  const [progress, setProgress] = useState<Record<string, GameProgressRecord>>({});
  useFocusEffect(useCallback(() => { void gameRepo.all().then(setProgress); }, []));
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={GAMES}
      keyExtractor={(g) => g.id}
      ListHeaderComponent={<><Title>{t('games.title')}</Title><P muted>{t('games.subtitle')}</P></>}
      renderItem={({ item: g }) => (
        <Pressable onPress={() => navigation.navigate('GamePlay', { id: g.id })} accessibilityRole="button" accessibilityLabel={g.title[locale]}>
          <Card>
            <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={{ fontSize: 26 }}>{g.icon}</Text><Badge text={t('games.available')} tone="success" /></View>
            <P style={{ fontWeight: '700' }}>{g.title[locale]}</P>
            <P muted>{g.description[locale]}</P>
            <P muted>{t('games.highScore')}: {progress[g.id]?.highScore ?? 0} · {t('common.level')} {progress[g.id]?.unlockedLevel ?? 1}/{g.maxLevel}</P>
          </Card>
        </Pressable>
      )}
    />
  );
}

export function GamePlayScreen({ route }: { route: { params: { id: GameId } } }) {
  const def = GAME_BY_ID[route.params.id];
  const { t, locale } = useApp();
  const [level, setLevel] = useState(1);
  const [unlocked, setUnlocked] = useState(1);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [memory, setMemory] = useState<MemoryState | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<(GameResult & { unlocked: number | null }) | null>(null);
  const [now, setNow] = useState(Date.now());
  const [last, setLast] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => { void gameRepo.get(def.id).then((p) => { setUnlocked(p?.unlockedLevel ?? 1); setLevel(p?.unlockedLevel ?? 1); }); }, [def.id]);

  const finish = useCallback(async (r: GameResult) => {
    if (done.current) return;
    done.current = true;
    const { progress, newlyUnlocked } = applyResult(await gameRepo.get(def.id), r, def.maxLevel, await deviceId(), Date.now());
    await gameRepo.save(progress);
    setUnlocked(progress.unlockedLevel);
    setResult({ ...r, unlocked: newlyUnlocked });
  }, [def]);

  const start = async (lvl = level) => {
    done.current = false; setResult(null); setLast(null);
    const seed = def.id === 'daily-challenge' ? dailySeed(todayKey()) : Math.floor(Math.random() * 2 ** 31);
    const deck = await readJson<Array<{ front: string; back: string }>>('exammate.flash.offlineDeck', []);
    if (def.mode === 'memory') { setMemory(startMemory(def.id, lvl, def.pairs!({ level: lvl, rng: mulberry32(seed), locale, deck: deck.length >= 4 ? deck : undefined }), seed, Date.now())); setQuiz(null); }
    else { setQuiz(startQuiz(def, { level: lvl, seed, locale, now: Date.now(), deck: deck.length >= 4 ? deck : undefined, dateKey: todayKey() })); setMemory(null); }
  };

  useEffect(() => {
    if (!quiz || quiz.finished || quiz.deadline === null) return;
    const i = setInterval(() => { const n = Date.now(); setNow(n); setQuiz((q) => (q ? tickQuiz(q, n) : q)); }, 250);
    return () => clearInterval(i);
  }, [quiz?.deadline, quiz?.finished]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (quiz?.finished) void finish(quizResult(def, quiz)); }, [quiz?.finished]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (memory?.finishedAt) void finish(memoryResult(memory)); }, [memory?.finishedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (resp: string | number) => {
    if (!quiz || quiz.finished) return;
    const r = answerQuiz(def, quiz, resp, Date.now());
    setLast(r.correct ? `✓ ${t('common.correct')}` : `✗ ${t('common.incorrect')} → ${r.expected.kind === 'input' ? r.expected.answer : r.expected.choices?.[r.expected.answer as number]}`);
    setQuiz(r.state); setInput('');
  };

  const q = quiz && !quiz.finished ? quiz.questions[quiz.index] : null;
  const rem = quiz ? remainingMs(quiz, now) : null;
  return (
    <Screen>
      <Title>{def.icon} {def.title[locale]}</Title>
      {!quiz && !memory && !result && (
        <Card>
          <P>{def.instructions[locale]}</P>
          {def.maxLevel > 1 && <View style={s.row}>{Array.from({ length: def.maxLevel }, (_, i) => i + 1).map((l) => <Button key={l} title={l > unlocked ? `🔒 ${l}` : String(l)} variant={l === level ? 'primary' : 'default'} disabled={l > unlocked} onPress={() => setLevel(l)} />)}</View>}
          <Button title={t('games.play')} variant="primary" onPress={() => void start()} />
          <P muted>{t('common.offlineReady')}</P>
        </Card>
      )}
      {q && quiz && (
        <View style={{ gap: 10 }}>
          <View style={s.row}>
            <Badge text={`${t('common.score')}: ${quiz.score}`} />
            <Badge text={`${t('games.streak')}: ${quiz.streak}`} />
            {quiz.livesLeft !== null && <Badge text={'❤'.repeat(quiz.livesLeft)} tone="danger" />}
            {rem !== null ? <Badge text={`⏱ ${Math.ceil(rem / 1000)}s`} tone="warning" /> : <Badge text={`${quiz.index + 1}/${quiz.questions.length}`} />}
            {quiz.opponent && <Badge text={`🤖 ${quiz.opponent.score}`} />}
          </View>
          <Card>
            <P style={{ fontSize: 19, fontWeight: '700' }}>{q.prompt}</P>
            {q.code && <Text style={[s.mono, { backgroundColor: colors.elev, padding: 10, borderRadius: 8 }]}>{q.code}</Text>}
            {q.kind !== 'input' ? q.choices!.map((c, i) => <Button key={i} title={c} onPress={() => answer(i)} />) : (
              <View style={{ gap: 8 }}>
                <Input value={input} onChangeText={setInput} placeholder={t('games.typeAnswer')} onSubmitEditing={() => input.trim() && answer(input.trim())} returnKeyType="done" autoFocus keyboardType={typeof q.answer === 'number' ? 'numbers-and-punctuation' : 'default'} />
                <Button title={t('common.submit')} variant="primary" onPress={() => input.trim() && answer(input.trim())} />
              </View>
            )}
          </Card>
          {last && <P style={{ color: last.startsWith('✓') ? colors.success : colors.danger }}>{last}</P>}
        </View>
      )}
      {memory && !result && (
        <View style={{ gap: 10 }}>
          <View style={s.row}><Badge text={`${t('games.moves')}: ${memory.moves}`} /><Badge text={`${t('games.pairsFound')}: ${memory.matchedPairs}/${memory.cards.length / 2}`} /></View>
          <View style={[s.row, { justifyContent: 'center' }]}>
            {memory.cards.map((c) => {
              const open = c.matched || memory.open.includes(c.id);
              return (
                <Pressable key={c.id} onPress={() => setMemory((m) => (m ? flipCard(m, c.id, Date.now()).state : m))} accessibilityLabel={open ? c.text : t('games.flip')}
                  style={{ width: '30%', aspectRatio: 1.2, borderRadius: 12, borderWidth: 1, borderColor: c.matched ? colors.success : colors.border, backgroundColor: open ? colors.elev : '#2a3a6a', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', textAlign: 'center' }}>{open ? c.text : '?'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {result && (
        <Card>
          <P style={{ fontSize: 20, fontWeight: '700' }}>{result.passed ? t('games.levelComplete') : t('games.gameOver')}</P>
          <Text style={{ color: colors.warning, fontSize: 24 }}>{'★'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</Text>
          <P>{t('common.score')}: {result.score} · {t('games.accuracy')}: {Math.round(result.accuracy * 100)}%</P>
          {result.won !== undefined && <P>{result.won ? t('games.youWin') : t('games.youLose')}</P>}
          {result.unlocked && <P style={{ color: colors.success }}>{t('games.unlocked', { level: result.unlocked })}</P>}
          <Button title={t('common.restart')} variant="primary" onPress={() => { setQuiz(null); setMemory(null); void start(result.unlocked ?? level); if (result.unlocked) setLevel(result.unlocked); }} />
        </Card>
      )}
    </Screen>
  );
}
