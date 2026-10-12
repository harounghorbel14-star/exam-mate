import { useCallback, useEffect, useState } from 'react';
import { review as srsReview, newSchedule, buildSession, isLeech, type CardSchedule, type ReviewRating } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useOnline } from '../lib/online';
import { api } from '../lib/api';
import { readJson, writeJson } from '../lib/kv';
import { queueReview } from '../lib/sync';
import { Empty, ErrorState, Modal, PageHead, Spinner } from '../components/ui';

interface Deck { id: string; title: string; subject: string | null; cards: number; due: number }
interface Card { id: string; deck_id: string; front: string; back: string; kind: string; schedule: CardSchedule | null; deck_title?: string }
interface Bundle { generatedAt: number; decks: Array<{ id: string; title: string }>; cards: Card[] }

const BUNDLE_KEY = 'exammate.flash.bundle';

export default function Flashcards() {
  const { t, num } = useI18n();
  const { user } = useAuth();
  const online = useOnline();
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(() => readJson<Bundle | null>(BUNDLE_KEY, null));
  const [session, setSession] = useState<Card[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shownAt, setShownAt] = useState(Date.now());
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<{ deck: Deck; cards: Card[] } | null>(null);

  const load = useCallback(async () => {
    if (!user || !online) { setDecks([]); return; }
    try {
      const r = await api<{ decks: Deck[] }>('/flashcards/decks');
      setDecks(r.decks);
      // Keep an offline copy of all cards (and a deck for Flashcard Sprint).
      const b = await api<Bundle>('/flashcards/offline-bundle');
      writeJson(BUNDLE_KEY, b); setBundle(b);
      writeJson('exammate.flash.offlineDeck', b.cards.slice(0, 200).map((c) => ({ front: c.front, back: c.back })));
    } catch (e) { setError(e); }
  }, [user, online]);
  useEffect(() => { void load(); }, [load]);

  const startSession = async (deckId?: string) => {
    setError(null);
    try {
      let cards: Card[];
      if (online && user) cards = (await api<{ cards: Card[] }>(`/flashcards/due${deckId ? `?deckId=${deckId}` : ''}`)).cards;
      else cards = buildSession((bundle?.cards ?? []).filter((c) => !deckId || c.deck_id === deckId), Date.now());
      setSession(cards); setIdx(0); setFlipped(false); setShownAt(Date.now());
    } catch (e) { setError(e); }
  };

  const rate = useCallback(async (rating: ReviewRating) => {
    if (!session) return;
    const card = session[idx];
    if (!card) return;
    const elapsedMs = Date.now() - shownAt;
    if (online && user) {
      try { await api(`/flashcards/cards/${card.id}/review`, { method: 'POST', body: { rating, elapsedMs } }); }
      catch { queueReview({ cardId: card.id, rating, at: Date.now(), elapsedMs }); }
    } else {
      // Offline: schedule locally for this device and queue the review for sync.
      queueReview({ cardId: card.id, rating, at: Date.now(), elapsedMs });
      if (bundle) {
        const next = { ...bundle, cards: bundle.cards.map((c) => (c.id === card.id ? { ...c, schedule: srsReview(c.schedule ?? newSchedule(Date.now()), rating, Date.now()) } : c)) };
        setBundle(next); writeJson(BUNDLE_KEY, next);
      }
    }
    const nextSession = rating === 'again' ? [...session, card] : session;
    setSession(nextSession);
    setIdx((i) => i + 1); setFlipped(false); setShownAt(Date.now());
  }, [session, idx, shownAt, online, user, bundle]);

  useEffect(() => {
    if (!session) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); }
      if (flipped && /^[1-4]$/.test(e.key)) void rate((['again', 'hard', 'good', 'easy'] as const)[Number(e.key) - 1]!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, flipped, rate]);

  const create = async () => {
    const cards = raw.split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((p) => p.length >= 2 && p[0] && p[1]).map(([front, back]) => ({ front: front!, back: back! }));
    try {
      await api('/flashcards/decks', { method: 'POST', body: { title, cards } });
      setCreating(false); setTitle(''); setRaw(''); await load();
    } catch (e) { setError(e); }
  };

  const openEditor = async (deck: Deck) => {
    const r = await api<{ cards: Card[] }>(`/flashcards/decks/${deck.id}/cards`);
    setEditing({ deck, cards: r.cards });
  };

  if (session) {
    const card = session[idx];
    return (
      <>
        <PageHead title={t('flash.title')} actions={<button className="btn" onClick={() => { setSession(null); void load(); }}>{t('common.close')}</button>} />
        {!card ? <div className="alert success">{t('flash.done')}</div> : (
          <div className="stack" style={{ maxWidth: 680, margin: '0 auto' }}>
            <div className="faint">{idx + 1} / {session.length}{card.deck_title ? ` · ${card.deck_title}` : ''}</div>
            <button className="card glass flashcard" onClick={() => setFlipped((f) => !f)} aria-live="polite" dir="auto">
              {flipped ? <div><div className="faint">{card.front}</div><div style={{ marginTop: 10 }}>{card.back}</div></div> : card.front}
            </button>
            {!flipped ? <button className="btn primary lg" onClick={() => setFlipped(true)}>{t('flash.show')} <kbd>Space</kbd></button> : (
              <div className="grid cols-4">
                {(['again', 'hard', 'good', 'easy'] as const).map((r, i) => <button key={r} className={`btn${r === 'good' ? ' primary' : ''}`} onClick={() => void rate(r)}>{t(`flash.${r}`)} <kbd>{i + 1}</kbd></button>)}
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  const offlineDecks = bundle?.decks ?? [];
  return (
    <>
      <PageHead title={t('flash.title')} subtitle={t('flash.subtitle')} actions={user && online ? <button className="btn primary" onClick={() => setCreating(true)}>{t('flash.newDeck')}</button> : undefined} />
      {error !== null && <div style={{ marginBottom: 12 }}><ErrorState error={error} /></div>}
      {!user && <div className="alert info" style={{ marginBottom: 12 }}>{t('flash.signInNote')}</div>}
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn primary lg" onClick={() => void startSession()} disabled={!user && !bundle}>{t('flash.study')}</button>
        {bundle && <span className="badge success">{t('flash.download')} · {num(bundle.cards.length)}</span>}
      </div>
      {decks === null ? <Spinner /> : (online && user ? decks : offlineDecks.map((d) => ({ ...d, subject: null, cards: bundle!.cards.filter((c) => c.deck_id === d.id).length, due: 0 }))).length === 0 ? <Empty>{t('flash.empty')}</Empty> : (
        <ul className="list">
          {(online && user ? decks : offlineDecks.map((d) => ({ ...d, subject: null, cards: bundle!.cards.filter((c) => c.deck_id === d.id).length, due: buildSession(bundle!.cards.filter((c) => c.deck_id === d.id), Date.now()).length }))).map((d) => (
            <li key={d.id} className="list-item">
              <div><strong>{d.title}</strong><div className="faint">{num(d.cards)} · {t('flash.due')}: {num(d.due)}</div></div>
              <div className="row">
                <button className="btn sm primary" onClick={() => void startSession(d.id)}>{t('flash.study')}</button>
                {online && user && <button className="btn sm" onClick={() => void openEditor(d)}>{t('common.edit')}</button>}
                {online && user && <button className="btn sm danger" onClick={async () => { if (confirm(t('common.confirmDelete'))) { await api(`/flashcards/decks/${d.id}`, { method: 'DELETE' }); await load(); } }}>{t('common.delete')}</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <Modal title={t('flash.newDeck')} onClose={() => setCreating(false)}>
          <div className="stack">
            <div className="field"><label htmlFor="dt">{t('common.title')}</label><input id="dt" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
            <div className="field"><label htmlFor="dc">{t('flash.cardsInput')}</label><textarea id="dc" className="input" dir="auto" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'H2O | water\nF = ma | Newton’s second law'} /><span className="hint">{t('flash.cardsInputHint')}</span></div>
            <button className="btn primary" disabled={!title.trim()} onClick={() => void create()}>{t('common.save')}</button>
          </div>
        </Modal>
      )}
      {editing && (
        <Modal title={editing.deck.title} onClose={() => { setEditing(null); void load(); }}>
          <ul className="list">
            {editing.cards.map((c) => (
              <li key={c.id} className="list-item">
                <div dir="auto"><strong>{c.front}</strong><div className="faint">{c.back}</div>{c.schedule && isLeech(c.schedule) && <span className="badge warning">{t('flash.forgotten')}</span>}</div>
                <button className="btn sm danger" aria-label={t('common.delete')} onClick={async () => { await api(`/flashcards/cards/${c.id}`, { method: 'DELETE' }); setEditing({ ...editing, cards: editing.cards.filter((x) => x.id !== c.id) }); }}>✕</button>
              </li>
            ))}
          </ul>
          <form className="stack" style={{ marginTop: 12 }} onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const r = await api<{ card: Card }>(`/flashcards/decks/${editing.deck.id}/cards`, { method: 'POST', body: { front: f.get('front'), back: f.get('back') } });
            setEditing({ ...editing, cards: [...editing.cards, { ...r.card, deck_id: editing.deck.id, schedule: null }] });
            e.currentTarget.reset();
          }}>
            <input name="front" className="input" dir="auto" placeholder={t('flash.front')} required maxLength={2000} />
            <input name="back" className="input" dir="auto" placeholder={t('flash.back')} required maxLength={4000} />
            <button className="btn primary">{t('flash.newCard')}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
