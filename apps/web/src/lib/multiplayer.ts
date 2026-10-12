import { useEffect, useRef, useState } from 'react';
import { MultiplayerClient, type ConnectionState, type MpErrorCode, type RoomSnapshot } from '@exammate/core';
import { api } from './api';

/** WebSocket URL on the same origin (or VITE_API_URL's host). */
export function wsUrl(): string {
  const base = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL) : new URL(window.location.href);
  return `${base.protocol === 'https:' ? 'wss:' : 'ws:'}//${base.host}/ws`;
}

/** Connects while mounted; exposes the authoritative room snapshot and connection state. */
export function useMultiplayer(enabled: boolean) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [state, setState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<{ code: MpErrorCode; message: string } | null>(null);
  const ref = useRef<MultiplayerClient | null>(null);
  if (!ref.current) {
    ref.current = new MultiplayerClient({
      url: wsUrl(),
      getTicket: async () => (await api<{ ticket: string }>('/mp/ticket', { method: 'POST', body: {} })).ticket,
      createSocket: (u) => new WebSocket(u) as never,
      onRoom: setRoom,
      onState: setState,
      onError: (code, message) => setError({ code, message }),
    });
  }
  useEffect(() => {
    if (!enabled) return;
    const c = ref.current!;
    void c.connect().catch(() => undefined);
    return () => c.close();
  }, [enabled]);
  return { client: ref.current, room, state, error, clearError: () => setError(null) };
}
