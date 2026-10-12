import { useEffect, useState } from 'react';
import { rpsNew, rpsPlayRound, rpsAiChoice, RPS_CHOICES, type RPSChoice, type RPSMatch } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { useKeys } from '../shared';

const ICON: Record<RPSChoice, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

export default function RockPaperScissors({ difficulty, mode, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const vsAi = mode === 'ai';
  const [m, setM] = useState<RPSMatch>(() => rpsNew(5));
  const [pending, setPending] = useState<RPSChoice | null>(null); // player 1's hidden choice in pass-and-play
  const name = (p: 1 | 2) => (vsAi ? (p === 1 ? t('arcade.you') : t('arcade.computer')) : t('arcade.player', { n: p }));
  const last = m.rounds[m.rounds.length - 1];

  const choose = (c: RPSChoice) => {
    if (paused || m.winner) return;
    sfx.play('move'); sfx.buzz(15);
    if (vsAi) {
      const ai = rpsAiChoice(m.rounds.map((r) => r.p1), difficulty, seed + m.rounds.length * 13);
      const next = rpsPlayRound(m, c, ai);
      sfx.play(next.rounds[next.rounds.length - 1]!.winner === 1 ? 'score' : next.rounds[next.rounds.length - 1]!.winner === 2 ? 'error' : 'tick');
      setM(next);
    } else if (!pending) setPending(c);
    else { setM(rpsPlayRound(m, pending, c)); setPending(null); }
  };

  useEffect(() => {
    if (!m.winner) return;
    const outcome = vsAi ? (m.winner === 1 ? 'win' : 'loss') : 'win';
    sfx.play(outcome === 'loss' ? 'lose' : 'win');
    onFinish({ outcome, score: m.score[0], message: vsAi ? undefined : t('arcade.playerWins', { name: name(m.winner) }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.winner]);

  useKeys((e) => {
    const map: Record<string, RPSChoice> = { '1': 'rock', '2': 'paper', '3': 'scissors', r: 'rock', p: 'paper', s: 'scissors' };
    const c = map[e.key.toLowerCase()];
    if (c) choose(c);
  }, !paused);

  const picker = vsAi ? 1 : pending ? 2 : 1;
  return (
    <div className="stack center">
      <div className="rps-score" aria-live="polite"><strong>{name(1)}</strong> {m.score[0]} – {m.score[1]} <strong>{name(2)}</strong></div>
      {last && !pending && (
        <div className="rps-reveal" role="status">
          <span className="rps-hand" aria-label={t(`arcade.rps.${last.p1}`)}>{ICON[last.p1]}</span>
          <span className="faint">vs</span>
          <span className="rps-hand flip" aria-label={t(`arcade.rps.${last.p2}`)}>{ICON[last.p2]}</span>
          <p style={{ flexBasis: '100%', textAlign: 'center' }}>{last.winner === 0 ? t('arcade.rps.tie') : t('arcade.rps.roundWin', { name: name(last.winner) })}</p>
        </div>
      )}
      {pending && <p className="alert info" role="status">{t('arcade.rps.hidden', { name: name(2) })}</p>}
      {!m.winner && <p className="arcade-status">{t('arcade.rps.pick', { name: name(picker) })}</p>}
      <div className="row center">
        {RPS_CHOICES.map((c, i) => (
          <button key={c} className="btn rps-btn" onClick={() => choose(c)} disabled={!!m.winner} aria-label={`${t(`arcade.rps.${c}`)} (${i + 1})`}>
            <span aria-hidden style={{ fontSize: '2.2rem' }}>{ICON[c]}</span>{t(`arcade.rps.${c}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
