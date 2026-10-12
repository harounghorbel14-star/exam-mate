import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  GAME_BY_ID, startQuiz, answerQuiz, tickQuiz, quizResult, remainingMs, startMemory, flipCard, memoryResult, applyResult, dailySeed, todayKey,
  mulberry32, type GameId, type QuizState, type MemoryState, type GameResult, type GameQuestion,
} from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { gameRepo, queuePractice } from '../lib/sync';
import { deviceId, readJson } from '../lib/kv';
import { Modal, PageHead, Stars, Bar } from '../components/ui';

type Feedback = { correct: boolean; expected: GameQuestion; response: string | number } | null;

export default function GamePlay() {
  const { id } = useParams();
  const def = GAME_BY_ID[id as GameId];
  const { t, locale, num } = useI18n();
  const { user } = useAuth();
  const [level, setLevel] = useState(1);
  const [unlocked, setUnlocked] = useState(1);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [memory, setMemory] = useState<MemoryState | null>(null);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [result, setResult] = useState<(GameResult & { unlockedLevel: number | null; newHigh: boolean }) | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!def) return;
    void gameRepo.get(def.id).then((p) => { const u = p?.unlockedLevel ?? 1; setUnlocked(u); setLevel(Math.min(u, def.maxLevel)); });
  }, [def]);

  const finish = useCallback(async (r: GameResult, questions?: GameQuestion[], answers?: QuizState['answers']) => {
    if (finishedRef.current || !def) return;
    finishedRef.current = true;
    const prev = await gameRepo.get(def.id);
    const { progress, newlyUnlocked, newHighScore } = applyResult(prev, r, def.maxLevel, deviceId(), Date.now());
    await gameRepo.save(progress);
    setUnlocked(progress.unlockedLevel);
    setResult({ ...r, unlockedLevel: newlyUnlocked, newHigh: newHighScore });
    // Feed practice records to the weakness detector (synced when online & signed in).
    if (user && questions && answers) {
      queuePractice(answers.map((a) => {
        const q = questions.find((x) => x.id === a.questionId);
        return { subject: def.subject, topic: `${def.id}:${q?.topic ?? 'general'}`, correct: a.correct, timeSpent: a.timeMs / 1000, source: 'game', at: Date.now() };
      }));
    }
  }, [def, user]);

  const start = (lvl = level) => {
    if (!def) return;
    finishedRef.current = false;
    setResult(null); setFeedback(null); setInput('');
    const seed = def.id === 'daily-challenge' ? dailySeed(todayKey()) : Math.floor(Math.random() * 2 ** 31);
    const deck = readJson<Array<{ front: string; back: string }>>('exammate.flash.offlineDeck', []);
    if (def.mode === 'memory') {
      const pairs = def.pairs!({ level: lvl, rng: mulberry32(seed), locale, deck: deck.length >= 4 ? deck : undefined });
      setMemory(startMemory(def.id, lvl, pairs, seed, Date.now()));
      setQuiz(null);
    } else {
      setQuiz(startQuiz(def, { level: lvl, seed, locale, now: Date.now(), deck: deck.length >= 4 ? deck : undefined, dateKey: todayKey() }));
      setMemory(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Timer for sprint games.
  useEffect(() => {
    if (!quiz || quiz.finished || quiz.deadline === null) return;
    const i = setInterval(() => {
      const n = Date.now();
      setNow(n);
      setQuiz((q) => (q ? tickQuiz(q, n) : q));
    }, 200);
    return () => clearInterval(i);
  }, [quiz?.deadline, quiz?.finished]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (quiz?.finished && def) void finish(quizResult(def, quiz), quiz.questions, quiz.answers); }, [quiz?.finished]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (memory?.finishedAt) void finish(memoryResult(memory)); }, [memory?.finishedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = useCallback((response: string | number) => {
    if (!def || !quiz || quiz.finished || feedback) return;
    const r = answerQuiz(def, quiz, response, Date.now());
    setFeedback({ correct: r.correct, expected: r.expected, response });
    setInput('');
    // Sprint games advance instantly; round games show feedback briefly.
    const delay = def.timing === 'sprint' ? (r.correct ? 150 : 700) : (r.correct ? 600 : 1600);
    setTimeout(() => { setQuiz(r.state); setFeedback(null); inputRef.current?.focus(); }, delay);
  }, [def, quiz, feedback]);

  // Keyboard: 1–4 / A–D choose, T/F for true-false, Enter submits input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!quiz || quiz.finished || (document.activeElement?.tagName === 'INPUT')) return;
      const q = quiz.questions[quiz.index];
      if (!q) return;
      if (q.kind === 'truefalse' && /^[tf]$/i.test(e.key)) answer(e.key.toLowerCase() === 't' ? 0 : 1);
      else if (q.kind !== 'input' && /^[1-4]$/.test(e.key) && Number(e.key) <= (q.choices?.length ?? 0)) answer(Number(e.key) - 1);
      else if (q.kind === 'choice' && /^[a-d]$/i.test(e.key)) answer(e.key.toLowerCase().charCodeAt(0) - 97);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quiz, answer]);

  if (!def) return <div className="alert danger">{t('common.error')} <Link to="/games">{t('common.back')}</Link></div>;
  const q = quiz && !quiz.finished ? quiz.questions[quiz.index] : null;
  const rem = quiz ? remainingMs(quiz, now) : null;

  return (
    <>
      <PageHead title={`${def.icon} ${def.title[locale]}`} subtitle={def.description[locale]} actions={<><button className="btn" onClick={() => setShowHelp(true)}>{t('games.howToPlay')}</button><Link className="btn ghost" to="/games">{t('common.back')}</Link></>} />
      {!quiz && !memory && (
        <div className="card glass stack" style={{ maxWidth: 640 }}>
          <p>{def.instructions[locale]}</p>
          {def.maxLevel > 1 && (
            <div className="field"><span className="label">{t('games.selectLevel')}</span>
              <div className="chips">{Array.from({ length: def.maxLevel }, (_, i) => i + 1).map((l) => (
                <button key={l} className="chip" aria-pressed={level === l} disabled={l > unlocked} onClick={() => setLevel(l)}>{l > unlocked ? '🔒 ' : ''}{t('common.level')} {l}</button>))}</div>
            </div>
          )}
          <div><button className="btn primary lg" onClick={() => start()}>{t('games.play')}</button></div>
          <span className="faint">{t('common.offlineReady')} · {t('games.bundled')}</span>
        </div>
      )}

      {quiz && !quiz.finished && q && (
        <div className="stack">
          <div className="card row between">
            <span>{t('common.score')}: <strong>{num(quiz.score)}</strong></span>
            <span>{t('games.streak')}: <strong>{quiz.streak}</strong></span>
            {quiz.livesLeft !== null && <span aria-label={t('games.lives')}>{'❤'.repeat(quiz.livesLeft)}{'♡'.repeat((def.lives ?? 0) - quiz.livesLeft)}</span>}
            {rem !== null ? <span className="timer">⏱ {Math.ceil(rem / 1000)}s</span> : <span className="faint">{quiz.index + 1}/{quiz.questions.length}</span>}
            {quiz.opponent && <span>🤖 {quiz.opponent.name}: <strong>{num(quiz.opponent.score)}</strong></span>}
          </div>
          {rem !== null && <Bar value={rem} max={def.timeLimitSec * 1000} warn={rem < 10_000} />}
          <div className="card glass stack" aria-live="polite">
            <h2 dir="auto" style={{ fontSize: '1.3rem' }}>{q.prompt}</h2>
            {q.code && <pre className="code-block">{q.code}</pre>}
            {(q.kind === 'choice' || q.kind === 'truefalse') && (
              <div className="choice-grid">
                {q.choices!.map((c, i) => {
                  const cls = feedback ? (i === feedback.expected.answer ? ' correct' : i === feedback.response ? ' wrong' : '') : '';
                  return <button key={i} className={`choice${cls}`} disabled={!!feedback} onClick={() => answer(i)} dir="auto">{c}<kbd>{q.kind === 'truefalse' ? (i === 0 ? 'T' : 'F') : i + 1}</kbd></button>;
                })}
              </div>
            )}
            {q.kind === 'input' && (
              <form className="row" onSubmit={(e) => { e.preventDefault(); if (input.trim()) answer(input.trim()); }}>
                <input ref={inputRef} className="input" style={{ flex: 1, fontSize: '1.2rem' }} dir="auto" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('games.typeAnswer')} disabled={!!feedback} autoComplete="off" inputMode={typeof q.answer === 'number' ? 'decimal' : 'text'} aria-label={t('games.typeAnswer')} />
                <button className="btn primary" disabled={!!feedback}>{t('common.submit')}</button>
              </form>
            )}
            {feedback && (
              <div className={`alert ${feedback.correct ? 'success' : 'danger'}`} role="status">
                <strong>{feedback.correct ? `✓ ${t('common.correct')}` : `✗ ${t('common.incorrect')}`}</strong>
                {!feedback.correct && <span>&nbsp;→ <span dir="auto">{q.kind === 'input' ? String(feedback.expected.answer) : feedback.expected.choices?.[feedback.expected.answer as number]}</span></span>}
                {feedback.expected.explanation && !feedback.correct && <span className="faint">&nbsp;{feedback.expected.explanation}</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {memory && (
        <div className="stack">
          <div className="card row between"><span>{t('games.moves')}: <strong>{memory.moves}</strong></span><span>{t('games.pairsFound')}: <strong>{memory.matchedPairs}/{memory.cards.length / 2}</strong></span></div>
          <div className="memory-grid" role="grid">
            {memory.cards.map((c) => {
              const open = c.matched || memory.open.includes(c.id);
              return <button key={c.id} className={`memory-card${open ? ' open' : ''}${c.matched ? ' matched' : ''}`} disabled={c.matched} aria-label={open ? c.text : t('games.flip')} onClick={() => setMemory((m) => (m ? flipCard(m, c.id, Date.now()).state : m))} dir="auto">{open ? c.text : '?'}</button>;
            })}
          </div>
        </div>
      )}

      {result && (
        <Modal title={result.passed ? t('games.levelComplete') : t('games.gameOver')} onClose={() => { setResult(null); setQuiz(null); setMemory(null); }}>
          <div className="stack">
            <Stars n={result.stars} />
            {result.won !== undefined && <div className={`alert ${result.won ? 'success' : 'warning'}`}>{result.won ? t('games.youWin') : t('games.youLose')}</div>}
            <div className="grid cols-3">
              <div className="stat"><span className="value">{num(result.score)}</span><span className="label">{t('common.score')}</span></div>
              <div className="stat"><span className="value">{num(Math.round(result.accuracy * 100))}%</span><span className="label">{t('games.accuracy')}</span></div>
              <div className="stat"><span className="value">{(result.avgTimeMs / 1000).toFixed(1)}s</span><span className="label">{t('games.avgTime')}</span></div>
            </div>
            {result.newHigh && <div className="alert success">🏆 {t('games.newHighScore')}</div>}
            {result.unlockedLevel && <div className="alert success">🔓 {t('games.unlocked', { level: result.unlockedLevel })}</div>}
            <div className="row">
              <button className="btn primary" onClick={() => start(level)}>{t('common.restart')}</button>
              {result.unlockedLevel && <button className="btn" onClick={() => { setLevel(result.unlockedLevel!); start(result.unlockedLevel!); }}>{t('common.level')} {result.unlockedLevel} →</button>}
              <Link className="btn ghost" to="/games">{t('games.title')}</Link>
            </div>
          </div>
        </Modal>
      )}
      {showHelp && <Modal title={t('games.howToPlay')} onClose={() => setShowHelp(false)}><p>{def.instructions[locale]}</p><p className="faint">{t('games.keyboardHelp')}</p></Modal>}
    </>
  );
}
