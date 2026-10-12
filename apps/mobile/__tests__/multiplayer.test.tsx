import { render, fireEvent, screen, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mpInit, mpView } from '@exammate/core';
import { AppProvider } from '../src/lib/app';
import { PlayOnlineScreen } from '../src/screens/PlayOnlineScreen';

/** Fake socket standing in for the server: answers auth, create and moves with snapshots. */
class FakeSocket {
  static last: FakeSocket | null = null;
  readyState = 0; sent: Array<Record<string, unknown>> = [];
  onopen: ((e: unknown) => void) | null = null; onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null; onerror: ((e: unknown) => void) | null = null;
  constructor(public url: string) { FakeSocket.last = this; setTimeout(() => { this.readyState = 1; this.onopen?.({}); }, 0); }
  push(m: unknown) { this.onmessage?.({ data: JSON.stringify(m) }); }
  send(d: string) {
    const m = JSON.parse(d);
    this.sent.push(m);
    if (m.type === 'auth') this.push({ type: 'welcome', userId: 'u1', name: 'A' });
    if (m.type === 'create') {
      this.push({ type: 'room', room: { code: 'ABC234', game: m.game, maxPlayers: 2, status: 'playing', hostId: 'u1', seq: 1, mySeat: 0, serverTime: Date.now(),
        players: [{ userId: 'u1', name: 'A', avatar: '🦊', seat: 0, ready: true, connected: true, host: true }, { userId: 'u2', name: 'B', avatar: '🐼', seat: 1, ready: true, connected: true, host: false }],
        view: mpView(mpInit('tic-tac-toe', 2, 1, Date.now()), 0) } });
      this.push({ type: 'ack', id: m.id });
    }
    if (m.type === 'move') this.push({ type: 'ack', id: m.id });
  }
  close() { this.readyState = 3; this.onclose?.({ code: 1000 }); }
}

describe('mobile online play', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('exammate.user', JSON.stringify({ id: 'u1', email: 'a@b.c', displayName: 'A' }));
    (global as unknown as { WebSocket: unknown }).WebSocket = FakeSocket;
    global.fetch = jest.fn(async () => ({ ok: true, status: 201, text: async () => JSON.stringify({ ticket: 't' }) })) as unknown as typeof fetch;
  });

  it('creates a room over the socket with a ticket, shows the code and sends moves with the current step', async () => {
    await render(<AppProvider><PlayOnlineScreen /></AppProvider>);
    await waitFor(() => expect(screen.getByText('● Live')).toBeTruthy());
    expect(FakeSocket.last!.url).toMatch(/^ws:\/\/.+\/ws$/);
    expect(FakeSocket.last!.sent[0]).toEqual({ type: 'auth', ticket: 't' });
    await fireEvent.press(screen.getAllByText('Create a room')[1]!);
    expect(await screen.findByLabelText('Room code ABC234')).toBeTruthy();
    expect(screen.getByText('Your turn')).toBeTruthy();
    await act(async () => { await fireEvent.press(screen.getByLabelText('Row 2, column 2')); });
    expect(FakeSocket.last!.sent.at(-1)).toMatchObject({ type: 'move', step: 0, move: { cell: 4 } });
  });

  it('explains that online play needs an account and points to offline modes', async () => {
    await AsyncStorage.removeItem('exammate.user');
    await render(<AppProvider><PlayOnlineScreen /></AppProvider>);
    expect(await screen.findByText(/Arcade's solo and pass-and-play modes work offline/)).toBeTruthy();
  });
});
