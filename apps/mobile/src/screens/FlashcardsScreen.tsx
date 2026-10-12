import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { buildSession, review as srsReview, newSchedule, type CardSchedule, type ReviewRating } from '@exammate/core';
import { useApp } from '../lib/app';
import { api } from '../lib/api';
import { readJson, writeJson } from '../lib/store';
import { queueReview } from '../lib/sync';
import { Badge, Button, Card, P, Screen, Title, s } from '../components/ui';

interface Card_ { id: string; deck_id: string; front: string; back: string; schedule: CardSchedule | null }
interface Bundle { generatedAt: number; decks: Array<{ id: string; title: string }>; cards: Card_[] }
const KEY = 'exammate.flash.bundle';

/** Study downloaded decks offline; reviews are scheduled locally and queued for sync. */
export function FlashcardsScreen() {
  const { t, user, online } = useApp();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [session, setSession] = useState<Card_[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shown, setShown] = useState(Date.now());
  const [msg, setMsg] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { void readJson<Bundle | null>(KEY, null).then(setBundle); }, []));

  const download = async () => {
    try {
      const b = await api<Bundle>('/flashcards/offline-bundle');
      await writeJson(KEY, b); setBundle(b);
      await writeJson('exammate.flash.offlineDeck', b.cards.slice(0, 200).map((c) => ({ front: c.front, back: c.back })));
      setMsg(t('common.saved'));
    } catch (e) { setMsg((e as Error).message); }
  };

  const rate = async (rating: ReviewRating) => {
    const card = session?.[idx];
    if (!card || !bundle) return;
    const now = Date.now();
    await queueReview({ cardId: card.id, rating, at: now, elapsedMs: now - shown });
    const next = { ...bundle, cards: bundle.cards.map((c) => (c.id === card.id ? { ...c, schedule: srsReview(c.schedule ?? newSchedule(now), rating, now) } : c)) };
    setBundle(next); await writeJson(KEY, next);
    if (rating === 'again') setSession([...session!, card]);
    setIdx(idx + 1); setFlipped(false); setShown(Date.now());
  };

  if (session) {
    const card = session[idx];
    return (
      <Screen>
        <Title>{t('flash.title')}</Title>
        {!card ? <P>{t('flash.done')}</P> : (
          <>
            <P muted>{idx + 1} / {session.length}</P>
            <Card style={{ minHeight: 200, justifyContent: 'center' }}>
              <P style={{ fontSize: 22, textAlign: 'center' }}>{card.front}</P>
              {flipped && <P style={{ fontSize: 20, textAlign: 'center', color: '#22d3ee' }}>{card.back}</P>}
            </Card>
            {!flipped ? <Button title={t('flash.show')} variant="primary" onPress={() => setFlipped(true)} /> : (
              <View style={s.row}>{(['again', 'hard', 'good', 'easy'] as const).map((r) => <Button key={r} title={t(`flash.${r}`)} variant={r === 'good' ? 'primary' : 'default'} onPress={() => void rate(r)} />)}</View>
            )}
          </>
        )}
        <Button title={t('common.close')} variant="ghost" onPress={() => setSession(null)} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Title>{t('flash.title')}</Title>
      <P muted>{t('flash.subtitle')}</P>
      {user && online && <Button title={`⬇ ${t('games.downloadPack')}`} onPress={() => void download()} />}
      {!user && <P muted>{t('flash.signInNote')}</P>}
      {msg && <P muted>{msg}</P>}
      {bundle && <Badge text={`${t('flash.download')} · ${bundle.cards.length}`} tone="success" />}
      {bundle?.decks.map((d) => {
        const cards = bundle.cards.filter((c) => c.deck_id === d.id);
        const due = buildSession(cards, Date.now()).length;
        return (
          <Card key={d.id}>
            <P style={{ fontWeight: '700' }}>{d.title}</P>
            <P muted>{cards.length} · {t('flash.due')}: {due}</P>
            <Button title={t('flash.study')} variant="primary" disabled={due === 0} onPress={() => { setSession(buildSession(cards, Date.now())); setIdx(0); setFlipped(false); setShown(Date.now()); }} />
          </Card>
        );
      })}
      {!bundle && <P muted>{t('flash.empty')}</P>}
    </Screen>
  );
}
