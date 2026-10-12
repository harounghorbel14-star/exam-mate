import { useEffect, useRef, useState } from 'react';
import { hangmanNew, hangmanGuess, hangmanMask, hangmanFold, HANGMAN_ALPHABET, type HangmanState, type MessageKey } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { arcadeRepo, useKeys } from '../shared';

function Gallows({ wrong }: { wrong: number }) {
  const parts = [
    <circle key="h" cx="70" cy="38" r="10" />, <line key="b" x1="70" y1="48" x2="70" y2="82" />,
    <line key="la" x1="70" y1="58" x2="56" y2="70" />, <line key="ra" x1="70" y1="58" x2="84" y2="70" />,
    <line key="ll" x1="70" y1="82" x2="58" y2="100" />, <line key="rl" x1="70" y1="82" x2="82" y2="100" />,
  ];
  return (
    <svg viewBox="0 0 120 120" width="150" height="150" className="gallows" aria-hidden>
      <path d="M10 112 H70 M30 112 V10 H70 V28" />
      {parts.slice(0, wrong)}
    </svg>
  );
}

export default function Hangman({ difficulty, locale, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<HangmanState | null>(null);
  const done = useRef(false);
  useEffect(() => {
    // Avoid repeating recently used words.
    void arcadeRepo.loadGame<string[]>('hangman').then((recent) => setS(hangmanNew(locale, difficulty, seed, Array.isArray(recent) ? recent : [])));
  }, [locale, difficulty, seed]);

  const guess = (ch: string) => {
    if (!s || paused) return;
    const r = hangmanGuess(s, ch);
    if (r.hit === null) return;
    sfx.play(r.hit ? 'hit' : 'error'); if (!r.hit) sfx.buzz(40);
    setS(r.state);
  };
  useEffect(() => {
    if (!s || s.status === 'playing' || done.current) return;
    done.current = true;
    void arcadeRepo.loadGame<string[]>('hangman').then((recent) => arcadeRepo.saveGame('hangman', [s.word, ...(Array.isArray(recent) ? recent : [])].slice(0, 10)));
    sfx.play(s.status === 'won' ? 'win' : 'lose');
    onFinish({ outcome: s.status === 'won' ? 'win' : 'loss', score: s.status === 'won' ? (s.maxWrong - s.wrong.length) * 10 + s.word.length : 0, message: s.status === 'lost' ? t('arcade.wordWas', { word: s.word }) : undefined });
  }, [s, sfx, onFinish, t]);

  useKeys((e) => { if (e.key.length === 1 && /\p{L}/u.test(e.key) && !e.ctrlKey && !e.metaKey) guess(e.key); }, !paused);
  if (!s) return null;
  const mask = hangmanMask(s);
  return (
    <div className="stack center">
      <span className="badge info">{t('arcade.category', { name: t(`arcade.hangman.${s.category}` as MessageKey) })}</span>
      <Gallows wrong={s.wrong.length} />
      <div className="hm-word" dir={locale === 'ar' ? 'rtl' : 'ltr'} aria-label={mask.map((c) => c ?? '_').join(' ')} aria-live="polite">
        {mask.map((c, i) => <span key={i} className={`hm-slot${c === ' ' ? ' space' : ''}`}>{c ?? (s.status === 'lost' ? <em>{s.word[i]}</em> : '')}</span>)}
      </div>
      <p className="faint">{t('arcade.wrongLeft', { n: s.maxWrong - s.wrong.length })}</p>
      <div className="hm-keys" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {HANGMAN_ALPHABET[locale].map((ch) => {
          const used = s.guessed.includes(ch) || s.wrong.includes(ch);
          const hit = s.guessed.includes(hangmanFold(ch, locale));
          return <button key={ch} className={`btn hm-key${used ? (hit ? ' hit' : ' miss') : ''}`} disabled={used || s.status !== 'playing'} onClick={() => guess(ch)}>{ch.toUpperCase()}</button>;
        })}
      </div>
    </div>
  );
}
