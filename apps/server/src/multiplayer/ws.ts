import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { MP_MAX_MESSAGE_BYTES, parseClientMessage, type ServerMessage } from '@exammate/core';
import { consumeTicket } from './tickets.js';
import type { Conn, RoomManager } from './rooms.js';
import { log } from '../logger.js';

export interface WsOptions { origins: string[]; authTimeoutMs?: number; maxConnectionsPerUser?: number; heartbeatMs?: number }

/**
 * Attaches the multiplayer WebSocket endpoint (/ws) to the existing HTTP server.
 * Close codes: 4001 unauthorized, 4008 rate limited, 4009 too many connections.
 */
export function attachMultiplayer(server: HttpServer, rooms: RoomManager, opts: WsOptions) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MP_MAX_MESSAGE_BYTES });

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws') return;
    // Browsers always send Origin; reject cross-site pages. Native apps send none.
    const origin = req.headers.origin;
    if (origin && !opts.origins.includes(origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket & { alive?: boolean }) => {
    let conn: Conn | null = null;
    let queue = Promise.resolve();
    let tokens = 30, lastRefill = Date.now(), strikes = 0;
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    const send = (m: ServerMessage) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); };
    const authTimer = setTimeout(() => { if (!conn) ws.close(4001, 'authentication timeout'); }, opts.authTimeoutMs ?? 5000);

    ws.on('message', (data, isBinary) => {
      // Token bucket: ~6 messages/second sustained, bursts of 30.
      const now = Date.now();
      tokens = Math.min(30, tokens + ((now - lastRefill) / 1000) * 6); lastRefill = now;
      if (tokens < 1) {
        send({ type: 'error', code: 'rate_limited', message: 'Too many messages' });
        if (++strikes > 20) ws.close(4008, 'rate limited');
        return;
      }
      tokens--;
      const msg = isBinary ? null : parseClientMessage(data.toString());
      if (!msg) { send({ type: 'error', code: 'bad_request', message: 'Malformed message' }); return; }
      // Messages from one connection are processed strictly in order.
      queue = queue.then(async () => {
        if (!conn) {
          if (msg.type !== 'auth') { ws.close(4001, 'authenticate first'); return; }
          const user = await consumeTicket(msg.ticket);
          if (!user) { ws.close(4001, 'invalid or expired ticket'); return; }
          if (rooms.connectionCount(user.id) >= (opts.maxConnectionsPerUser ?? 5)) { ws.close(4009, 'too many connections'); return; }
          clearTimeout(authTimer);
          conn = { userId: user.id, name: user.displayName, send, close: (c, r) => ws.close(c, r) };
          rooms.attach(conn);
          send({ type: 'welcome', userId: user.id, name: user.displayName });
          return;
        }
        if (msg.type === 'auth') return;
        await rooms.handle(conn, msg);
      }).catch((e) => log('error', 'ws message failed', { message: (e as Error).message }));
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      if (conn) rooms.detach(conn);
    });
    ws.on('error', () => undefined);
  });

  // Heartbeat: terminate dead connections so disconnects are detected even without a FIN.
  const hb = setInterval(() => {
    for (const ws of wss.clients as Set<WebSocket & { alive?: boolean }>) {
      if (ws.alive === false) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, opts.heartbeatMs ?? 30_000);
  hb.unref?.();

  return { wss, close: () => { clearInterval(hb); for (const c of wss.clients) c.terminate(); wss.close(); } };
}
