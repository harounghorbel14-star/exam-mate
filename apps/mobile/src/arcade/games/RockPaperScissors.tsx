import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { rpsNew, rpsPlayRound, rpsAiChoice, RPS_CHOICES, type RPSChoice, type RPSMatch } from '@exammate/core';
import { a, Key, Status, type ArcadeGameProps } from '../shared';
import { colors } from '../../lib/theme';

const ICON: Record<RPSChoice, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

export default function RockPaperScissors({ difficulty, mode, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const vsAi = mode === 'ai';
  const [m, setM] = useState<RPSMatch>(() => rpsNew(5));
  const [pending, setPending] = useState<RPSChoice | null>(null);
  const name = (p: 1 | 2) => (vsAi ? (p === 1 ? t('arcade.you') : t('arcade.computer')) : t('arcade.player', { n: p }));
  const last = m.rounds[m.rounds.length - 1];
  const choose = (c: RPSChoice) => {
    if (paused || m.winner) return;
    sfx.play('move'); sfx.buzz(10);
    if (vsAi) setM(rpsPlayRound(m, c, rpsAiChoice(m.rounds.map((r) => r.p1), difficulty, seed + m.rounds.length * 13)));
    else if (!pending) setPending(c);
    else { setM(rpsPlayRound(m, pending, c)); setPending(null); }
  };
  useEffect(() => {
    if (!m.winner) return;
    const outcome = vsAi ? (m.winner === 1 ? 'win' : 'loss') : 'win';
    sfx.play(outcome === 'loss' ? 'lose' : 'win');
    onFinish({ outcome, score: m.score[0], message: vsAi ? undefined : t('arcade.playerWins', { name: name(m.winner) }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.winner]);
  return (
    <View style={a.center}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{name(1)} {m.score[0]} – {m.score[1]} {name(2)}</Text>
      {last && !pending && (
        <View style={a.center}>
          <Text style={{ fontSize: 56 }}>{ICON[last.p1]}  <Text style={{ fontSize: 18, color: colors.muted }}>vs</Text>  {ICON[last.p2]}</Text>
          <Status>{last.winner === 0 ? t('arcade.rps.tie') : t('arcade.rps.roundWin', { name: name(last.winner) })}</Status>
        </View>
      )}
      {pending && <Status>{t('arcade.rps.hidden', { name: name(2) })}</Status>}
      {!m.winner && <Text style={a.faint}>{t('arcade.rps.pick', { name: name(vsAi ? 1 : pending ? 2 : 1) })}</Text>}
      <View style={a.row}>
        {RPS_CHOICES.map((c) => <Key key={c} label={`${ICON[c]} ${t(`arcade.rps.${c}`)}`} onPress={() => choose(c)} disabled={!!m.winner} style={{ minHeight: 72, minWidth: 100 }} />)}
      </View>
    </View>
  );
}
