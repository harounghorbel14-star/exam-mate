import { Router } from 'express';
import { isRoomCode, normalizeRoomCode } from '@exammate/core';
import { asyncHandler, requireAuth } from '../middleware.js';
import { notFound } from '../errors.js';
import { issueTicket } from '../../multiplayer/tickets.js';
import type { RoomManager } from '../../multiplayer/rooms.js';

export function multiplayerRouter(rooms: RoomManager | null) {
  const r = Router();
  r.use(requireAuth);
  /** One-time WebSocket credential (60 s). Works with cookie sessions (web) and bearer tokens (mobile). */
  r.post('/ticket', asyncHandler(async (req, res) => {
    const t = await issueTicket(req.user!.id);
    res.status(201).json({ ticket: t.ticket, expiresAt: t.expiresAt.toISOString(), path: '/ws' });
  }));
  /** Minimal info shown on an invite link before joining. */
  r.get('/rooms/:code', (req, res) => {
    const code = normalizeRoomCode(String(req.params.code));
    const p = isRoomCode(code) && rooms ? rooms.preview(code) : null;
    if (!p) throw notFound('Room not found');
    res.json({ room: p });
  });
  return r;
}
