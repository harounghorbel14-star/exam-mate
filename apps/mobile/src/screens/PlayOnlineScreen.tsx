import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import {
  MP_GAMES, MP_GAME_IDS, MultiplayerClient, isRoomCode, normalizeRoomCode,
  type ConnectionState, type MessageKey, type MpGameId, type MpTriviaQuestion, type RoomSnapshot,
} from '@exammate/core';
import { useApp } from '../lib/app';
import { api, apiBase } from '../lib/api';
import { colors } from '../lib/theme';
import { Badge, Button, Card, Input, P, Screen, Title, s } from '../components/ui';
import { a, boardWidth, Key } from '../arcade/shared';

const RPS: Record<string, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

/** Online multiplayer (needs an account and a connection). Offline play stays in the Arcade. */
export function PlayOnlineScreen({ route }: { route?: { params?: { code?: string } } } = {}) {
  const invited = route?.params?.code ? normalizeRoomCode(route.params.code) : null;
  const { t, locale, user, online } = useApp();
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [state, setState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<MpGameId>('tic-tac-toe');
  const [max, setMax] = useState(2);
  const [code, setCode] = useState('');
  const ref = useRef<MultiplayerClient | null>(null);
  const autoJoined = useRef(false);

  useEffect(() => {
    if (!user || !online) return;
    let client: MultiplayerClient | null = null;
    void apiBase().then((base) => {
      const u = new URL(base);
      client = new MultiplayerClient({
        url: `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}/ws`,
        getTicket: async () => (await api<{ ticket: string }>('/mp/ticket', { method: 'POST', body: {} })).ticket,
        createSocket: (url) => new WebSocket(url) as never,
        onRoom: setRoom, onState: setState,
        onError: (c, m) => setError(['room_not_found', 'room_full', 'already_started', 'kicked'].includes(c) ? t(`mp.error.${c}` as MessageKey) : t('mp.error.generic', { message: m })),
      });
      ref.current = client;
      void client.connect().catch(() => undefined);
    });
    return () => { client?.close(); ref.current = null; };
  }, [user, online, t]);

  const c = ref.current;
  // Opened from an invite link: join that room once the socket is live.
  useEffect(() => {
    if (state !== 'online' || autoJoined.current || !invited || !isRoomCode(invited) || !ref.current) return;
    autoJoined.current = true;
    void ref.current.join(invited).catch(() => undefined);
  }, [state, invited]);
  const run = (p: Promise<void> | undefined) => { void p?.catch(() => undefined); };

  if (!user) return <Screen><Title>🌐 {t('mp.title')}</Title><P>{t('auth.signInToUse')}</P><P muted>{t('mp.offlineHint')}</P></Screen>;
  if (!online) return <Screen><Title>🌐 {t('mp.title')}</Title><Badge text={t('mp.status.offline')} tone="warning" /><P muted>{t('mp.offlineHint')}</P></Screen>;

  const status = <Badge text={`● ${t(`mp.status.${state === 'idle' ? 'connecting' : state}` as MessageKey)}`} tone={state === 'online' ? 'success' : 'warning'} />;

  if (!room) {
    const spec = MP_GAMES[game];
    return (
      <Screen>
        <Title>🌐 {t('mp.title')}</Title>
        <P muted>{t('mp.subtitle')}</P>
        <View style={s.row}>{status}<Badge text={t('mp.onlineBadge')} /></View>
        {error && <P style={{ color: colors.danger }}>{error}</P>}
        <Card>
          <P style={{ fontWeight: '700' }}>{t('mp.create')}</P>
          <View style={s.row}>{MP_GAME_IDS.map((g) => <Key key={g} label={`${MP_GAMES[g].emoji} ${t(`mp.g.${g}` as MessageKey)}`} active={game === g} onPress={() => { setGame(g); setMax(MP_GAMES[g].min); }} />)}</View>
          {spec.max > spec.min && <View style={s.row}><Text style={a.faint}>{t('mp.maxPlayers')}</Text>{Array.from({ length: spec.max - spec.min + 1 }, (_, i) => spec.min + i).map((n) => <Key key={n} label={String(n)} active={max === n} onPress={() => setMax(n)} />)}</View>}
          <Button title={t('mp.create')} variant="primary" disabled={state !== 'online'} onPress={() => { setError(null); run(c?.create(game, max)); }} />
        </Card>
        <Card>
          <P style={{ fontWeight: '700' }}>{t('mp.join')}</P>
          <Input value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="ABC234" autoCapitalize="characters" accessibilityLabel={t('mp.code')} maxLength={8} />
          <Button title={t('mp.joinButton')} variant="primary" disabled={state !== 'online' || !isRoomCode(normalizeRoomCode(code))} onPress={() => { setError(null); run(c?.join(normalizeRoomCode(code))); }} />
        </Card>
        <P muted>{t('mp.offlineHint')}</P>
      </Screen>
    );
  }

  const isHost = room.hostId === c?.userId;
  const me = room.players.find((p) => p.userId === c?.userId);
  const spec = MP_GAMES[room.game];
  const v = room.view as (Record<string, unknown> & { game: string; turn: number | null; scores: number[]; over: boolean; winners: number[] | null; forfeit: number | null }) | null;
  const nameOf = (seat: number) => room.players.find((p) => p.seat === seat)?.name ?? '?';
  const myTurn = v?.turn !== null && v?.turn === room.mySeat;
  const move = (m: Parameters<MultiplayerClient['move']>[0]) => run(c?.move(m));
  const everyoneReady = room.players.length >= spec.min && room.players.every((p) => p.host || (p.ready && p.connected));
  const result = v?.over ? (v.winners?.length === 1 ? (v.winners[0] === room.mySeat ? t('mp.youWon') : t('mp.winner', { name: nameOf(v.winners[0]!) })) : t('mp.draw')) : null;

  return (
    <Screen>
      <View style={[s.row, { justifyContent: 'space-between' }]}><Title>{spec.emoji} {t(`mp.g.${room.game}` as MessageKey)}</Title>{status}</View>
      {error && <P style={{ color: colors.danger }}>{error}</P>}
      <Card>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: 3 }} accessibilityLabel={`${t('mp.code')} ${room.code}`}>{room.code}</Text>
          <Key label={t('mp.invite')} onPress={() => void Share.share({ message: `${t('mp.join')}: ${room.code}\nexammate://play/${room.code}` })} />
        </View>
        {room.players.map((p) => (
          <View key={p.userId} style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={{ color: colors.text, fontSize: 16 }}>{p.avatar} {p.name}{p.userId === c?.userId ? ` (${t('mp.you')})` : ''}{p.host ? ` · ${t('mp.host')}` : ''}</Text>
            <View style={s.row}>
              {v && <Badge text={`${t('mp.score')}: ${v.scores[p.seat] ?? 0}`} />}
              <Badge text={p.connected ? t('mp.connected') : t('mp.disconnected')} tone={p.connected ? 'success' : 'warning'} />
              {room.status === 'lobby' && !p.host && <Badge text={p.ready ? t('mp.ready') : t('mp.notReady')} tone={p.ready ? 'success' : 'default'} />}
              {room.status === 'lobby' && isHost && !p.host && <Key label="✕" a11y={t('mp.kick', { name: p.name })} onPress={() => run(c?.kick(p.userId))} />}
            </View>
          </View>
        ))}
        {room.status === 'lobby' && (isHost
          ? <><P muted>{t('mp.needPlayers', { n: room.players.length, max: room.maxPlayers })}</P><Button title={`▶ ${t('mp.start')}`} variant="primary" disabled={!everyoneReady} onPress={() => run(c?.start())} /></>
          : <><P muted>{t('mp.waitingHost')}</P><Button title={me?.ready ? t('mp.notReadyBtn') : t('mp.imReady')} variant={me?.ready ? 'default' : 'primary'} onPress={() => run(c?.ready(!me?.ready))} /></>)}
        <Button title={t('mp.leave')} variant="ghost" onPress={() => run(c?.leave())} />
      </Card>

      {v && room.status !== 'lobby' && (
        <Card>
          {!v.over && <P style={{ fontWeight: '700', textAlign: 'center' }}>{v.turn !== null ? (myTurn ? t('mp.yourTurn') : t('mp.theirTurn', { name: nameOf(v.turn) })) : ''}</P>}
          <MobileGame v={v} myTurn={myTurn} mySeat={room.mySeat} move={move} t={t} locale={locale} nameOf={nameOf} />
          {result && <View style={a.center}><Title>{result}</Title>{v.forfeit !== null && <P muted>{t('mp.forfeit', { name: nameOf(v.forfeit) })}</P>}
            {isHost ? <Button title={`↻ ${t('mp.rematch')}`} variant="primary" onPress={() => run(c?.rematch())} /> : <P muted>{t('mp.waitingHost')}</P>}</View>}
        </Card>
      )}
    </Screen>
  );
}

function MobileGame({ v, myTurn, mySeat, move, t, locale, nameOf }: { v: Record<string, unknown> & { game: string; over: boolean }; myTurn: boolean; mySeat: number | null; move(m: Parameters<MultiplayerClient['move']>[0]): void; t: ReturnType<typeof useApp>['t']; locale: ReturnType<typeof useApp>['locale']; nameOf(s: number): string }) {
  const W = boardWidth();
  switch (v.game) {
    case 'tic-tac-toe': {
      const board = v.board as Array<string | null>, size = Math.min(W, 300) / 3 - 8;
      return <View style={[a.row, a.ltr, { width: (size + 8) * 3, alignSelf: 'center' }]}>{board.map((c, i) => (
        <Pressable key={i} disabled={!myTurn || !!c} onPress={() => move({ cell: i })} accessibilityRole="button" accessibilityLabel={`${t('arcade.cell', { r: Math.floor(i / 3) + 1, c: (i % 3) + 1 })}${c ? `: ${c}` : ''}`}
          style={{ width: size, height: size, borderRadius: 14, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.elev, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: size * 0.5, fontWeight: '800', color: c === 'X' ? '#f472b6' : '#22d3ee' }}>{c ?? ''}</Text>
        </Pressable>))}</View>;
    }
    case 'connect-four': {
      const board = v.board as number[][], cell = (W - 20) / 7;
      return <View style={[a.ltr, { flexDirection: 'row', backgroundColor: '#1d4ed8', padding: 6, borderRadius: 14, alignSelf: 'center' }]}>{board[0]!.map((_, col) => (
        <Pressable key={col} disabled={!myTurn} onPress={() => move({ col })} accessibilityRole="button" accessibilityLabel={t('arcade.column', { n: col + 1 })} style={{ gap: 3, padding: 1.5 }}>
          {board.map((row, r) => <View key={r} style={{ width: cell - 3, height: cell - 3, borderRadius: cell, backgroundColor: row[col] === 1 ? '#e11d48' : row[col] === 2 ? '#eab308' : '#0b1220' }} />)}
        </Pressable>))}</View>;
    }
    case 'checkers': return <MobileCheckers v={v} myTurn={myTurn} move={move} t={t} nameOf={nameOf} />;
    case 'rock-paper-scissors': {
      const rounds = v.rounds as Array<{ p1: string; p2: string; winner: number }>, last = rounds[rounds.length - 1], mine = v.myChoice as string | null, chosen = v.chosen as boolean[];
      return <View style={a.center}>
        <Text style={a.faint}>{[0, 1].map((s2) => `${nameOf(s2)}: ${chosen[s2] ? `✓ ${t('mp.chosen')}` : t('mp.waitingChoice')}`).join('  ·  ')}</Text>
        {last && <Text style={{ fontSize: 44 }}>{RPS[last.p1]} vs {RPS[last.p2]}</Text>}
        {!v.over && <View style={a.row}>{(['rock', 'paper', 'scissors'] as const).map((ch) => <Key key={ch} label={`${RPS[ch]} ${t(`arcade.rps.${ch}`)}`} active={mine === ch} disabled={!!mine || mySeat === null} onPress={() => move({ choice: ch })} />)}</View>}
      </View>;
    }
    case 'memory-challenge': {
      const cards = v.cards as Array<{ id: number; symbol: string | null; matched: boolean }>, size = (W - 18) / 4;
      return <View style={[a.ltr, { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: W, alignSelf: 'center' }]}>{cards.map((cd, i) => (
        <Pressable key={cd.id} disabled={!myTurn || cd.matched || !!cd.symbol} onPress={() => move({ card: cd.id })} accessibilityRole="button" accessibilityLabel={cd.symbol ? t('arcade.cardFaceUp', { n: i + 1, symbol: cd.symbol }) : t('arcade.card', { n: i + 1 })}
          style={{ width: size, height: size, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: cd.symbol ? colors.elev : '#7c3aed', opacity: cd.matched ? 0.55 : 1 }}>
          <Text style={{ fontSize: size * 0.45, color: '#fff' }}>{cd.symbol ?? '?'}</Text>
        </Pressable>))}</View>;
    }
    case 'reaction-race': {
      const phase = v.phase as string, out = v.out as boolean[], winner = v.roundWinner as number | null, times = v.times as Array<number | null>;
      const amOut = mySeat !== null && out[mySeat];
      const label = phase === 'wait' ? (amOut ? t('mp.reaction.out') : t('mp.reaction.wait')) : phase === 'go' ? (amOut ? t('mp.reaction.out') : t('mp.reaction.go'))
        : winner !== null ? t('mp.reaction.roundWinner', { name: nameOf(winner), ms: times[winner] ?? 0 }) : t('mp.reaction.noWinner');
      return <Pressable onPressIn={() => move({ tap: true })} disabled={phase === 'result' || amOut || mySeat === null} accessibilityRole="button" accessibilityLabel={label}
        style={{ minHeight: 240, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: phase === 'wait' ? '#b91c1c' : phase === 'go' ? '#15803d' : '#1d4ed8' }}>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' }}>{label}</Text></Pressable>;
    }
    case 'trivia': {
      const q = v.question as MpTriviaQuestion, myAnswer = v.myAnswer as number | null, phase = v.phase as string;
      return <View style={{ gap: 8 }}>
        <Text style={a.faint}>{t('mp.question', { n: (v.q as number) + 1, total: v.total as number })}</Text>
        <P style={{ fontWeight: '700', fontSize: 18 }}>{q.q[locale]}</P>
        {q.choices.map((ch, i) => <Key key={i} label={ch[locale]} active={myAnswer === i} disabled={phase !== 'question' || myAnswer !== null || mySeat === null} onPress={() => move({ choice: i })}
          style={q.answer !== undefined ? { borderColor: i === q.answer ? colors.success : colors.border, borderWidth: i === q.answer ? 2 : 1 } : undefined} />)}
      </View>;
    }
    default: return null;
  }
}

function MobileCheckers({ v, myTurn, move, t, nameOf }: { v: Record<string, unknown>; myTurn: boolean; move(m: { from: number; path: number[] }): void; t: ReturnType<typeof useApp>['t']; nameOf(s: number): string }) {
  const [sel, setSel] = useState<number | null>(null);
  const board = v.board as number[], legal = v.legal as Array<{ from: number; path: number[] }>;
  const movable = new Set(myTurn ? legal.map((m) => m.from) : []);
  const targets = sel !== null ? legal.filter((m) => m.from === sel) : [];
  const sq = boardWidth() / 8;
  return <View style={[a.ltr, { flexDirection: 'row', flexWrap: 'wrap', width: sq * 8, alignSelf: 'center' }]}>{board.map((p, i) => {
    const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1, target = targets.find((m) => m.path[m.path.length - 1] === i), owner = p === 0 ? 0 : p === 1 || p === 3 ? 1 : 2;
    return <Pressable key={i} disabled={!dark} onPress={() => { if (target) { move({ from: target.from, path: target.path }); setSel(null); } else if (movable.has(i)) setSel(i); }}
      accessibilityRole="button" accessibilityLabel={`${t('arcade.cell', { r: Math.floor(i / 8) + 1, c: (i % 8) + 1 })}${p ? `: ${nameOf(owner - 1)}` : ''}`}
      style={{ width: sq, height: sq, backgroundColor: dark ? (sel === i ? '#b45309' : '#9a3412') : '#fde7c7', alignItems: 'center', justifyContent: 'center', borderWidth: movable.has(i) ? 2 : 0, borderColor: '#facc15' }}>
      {p ? <View style={{ width: sq * 0.7, height: sq * 0.7, borderRadius: sq, backgroundColor: owner === 1 ? '#dc2626' : '#1f2937' }}><Text style={{ color: '#facc15', textAlign: 'center' }}>{p > 2 ? '♛' : ''}</Text></View>
        : target ? <View style={{ width: sq * 0.3, height: sq * 0.3, borderRadius: sq, backgroundColor: '#facc15' }} /> : null}
    </Pressable>;
  })}</View>;
}
