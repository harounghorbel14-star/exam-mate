type Level = 'debug' | 'info' | 'warn' | 'error';

/** Structured JSON logger. Never pass secrets, tokens, passwords or document contents. */
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
  if (level === 'error') console.error(line); else console.log(line);
}
