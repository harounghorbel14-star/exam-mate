import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { resolveSession, type SessionUser } from '../auth/sessions.js';
import { HttpError, forbidden, unauthorized } from './errors.js';
import { log } from '../logger.js';

export const SESSION_COOKIE = 'em_session';
export const CSRF_HEADER = 'x-exammate-client';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
    authVia?: 'cookie' | 'bearer';
  }
}

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };

/** Resolve the session from the Bearer header (mobile) or the httpOnly cookie (web). */
export const loadUser: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const cookie = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  const token = bearer ?? cookie;
  if (token && token.length < 200) {
    const user = await resolveSession(token);
    if (user) { req.user = user; req.authVia = bearer ? 'bearer' : 'cookie'; }
  }
  next();
});

/**
 * CSRF defence for cookie-authenticated mutations: require a custom header. Browsers can only
 * send it cross-origin after a CORS preflight, which our CORS allowlist rejects.
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (safe || req.authVia === 'bearer') return next();
  const hasCookie = !!(req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  if (hasCookie && req.headers[CSRF_HEADER] !== '1') return next(forbidden('Missing CSRF header'));
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => (req.user ? next() : next(unauthorized()));

export const requireAdmin: RequestHandler = (req, _res, next) => (req.user?.role === 'admin' ? next() : next(forbidden('Admin only')));

export function body<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  return schema.parse(req.body ?? {});
}

export function query<T extends ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  return schema.parse(req.query ?? {});
}

export function clientMeta(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'validation_error', message: 'Invalid request', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  const e = err as { type?: string; status?: number; code?: string; message?: string };
  if (e?.type === 'entity.too.large' || e?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: { code: 'payload_too_large', message: 'Upload is too large' } });
  if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'bad_json', message: 'Malformed JSON' } });
  log('error', 'unhandled error', { path: req.path, message: e?.message });
  res.status(500).json({ error: { code: 'internal', message: 'Internal server error' } });
}
