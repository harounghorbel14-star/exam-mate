import { pool } from '../../db/pool.js';

export type MemoryKind = 'preference' | 'level' | 'subject' | 'goal' | 'concept' | 'note';
export interface MemoryItem { id: string; kind: MemoryKind; key: string; value: string; source: 'user' | 'inferred'; updatedAt: string; expiresAt: string | null }

/** Patterns that look like personal or sensitive data are never stored in inferred memory. */
const SENSITIVE = [
  /[\w.+-]+@[\w-]+\.[\w.]+/, /\+?\d[\d\s-]{7,}\d/, /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/,
  /\b(password|mot de passe|كلمة المرور|passport|address|adresse|عنوان)\b/i,
  /\b(diagnos|depress|anxiety|pregnan|religion|sexual|medical|maladie|مرض)\w*/i,
];

export function looksSensitive(text: string): boolean {
  return SENSITIVE.some((r) => r.test(text));
}

export async function memoryEnabled(userId: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT memory_enabled FROM preferences WHERE user_id = $1', [userId]);
  return rows[0]?.memory_enabled ?? true;
}

export async function listMemory(userId: string): Promise<MemoryItem[]> {
  const { rows } = await pool.query(
    `SELECT id, kind, key, value, source, updated_at, expires_at FROM learning_memory
     WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > now()) ORDER BY kind, key`,
    [userId],
  );
  return rows.map((r) => ({ id: r.id, kind: r.kind, key: r.key, value: r.value, source: r.source, updatedAt: r.updated_at, expiresAt: r.expires_at }));
}

/** Upsert a memory item. Inferred items expire after 180 days and are skipped if memory is off or text looks sensitive. */
export async function remember(userId: string, item: { kind: MemoryKind; key: string; value: string; source: 'user' | 'inferred' }): Promise<boolean> {
  if (item.source === 'inferred') {
    if (!(await memoryEnabled(userId))) return false;
    if (looksSensitive(item.key) || looksSensitive(item.value)) return false;
  }
  await pool.query(
    `INSERT INTO learning_memory (user_id, kind, key, value, source, expires_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 = 'inferred' THEN now() + interval '180 days' END)
     ON CONFLICT (user_id, kind, key) DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, expires_at = EXCLUDED.expires_at, updated_at = now()`,
    [userId, item.kind, item.key.slice(0, 120), item.value.slice(0, 500), item.source],
  );
  return true;
}

export async function forget(userId: string, id: string): Promise<boolean> {
  const r = await pool.query('DELETE FROM learning_memory WHERE id = $1 AND user_id = $2', [id, userId]);
  return (r.rowCount ?? 0) > 0;
}

export async function forgetAll(userId: string): Promise<number> {
  const r = await pool.query('DELETE FROM learning_memory WHERE user_id = $1', [userId]);
  return r.rowCount ?? 0;
}

/** Record that a concept was studied (counter in value), used to personalise recommendations. */
export async function noteConcept(userId: string, subject: string, concept: string): Promise<void> {
  if (!(await memoryEnabled(userId))) return;
  const key = `${subject}:${concept}`.slice(0, 120);
  await pool.query(
    `INSERT INTO learning_memory (user_id, kind, key, value, source, expires_at) VALUES ($1, 'concept', $2, '1', 'inferred', now() + interval '180 days')
     ON CONFLICT (user_id, kind, key) DO UPDATE SET value = (COALESCE(NULLIF(learning_memory.value, ''), '0')::int + 1)::text, updated_at = now(), expires_at = now() + interval '180 days'
     WHERE learning_memory.source = 'inferred'`,
    [userId, key],
  );
}

export async function personalContext(userId: string): Promise<{ level?: string; style?: string; locale?: string; subjects: string[] }> {
  const [prof, pref] = await Promise.all([
    pool.query('SELECT academic_level, subjects, locale FROM profiles WHERE user_id = $1', [userId]),
    pool.query('SELECT explanation_style, memory_enabled FROM preferences WHERE user_id = $1', [userId]),
  ]);
  return { level: prof.rows[0]?.academic_level ?? undefined, locale: prof.rows[0]?.locale, subjects: prof.rows[0]?.subjects ?? [], style: pref.rows[0]?.explanation_style };
}
