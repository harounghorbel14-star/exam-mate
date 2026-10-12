import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

/** Stream-hash a model file so multi-GB weights are verified without loading them into memory. */
export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    createReadStream(path).on('data', (d) => hash.update(d)).on('end', () => resolve()).on('error', reject);
  });
  return hash.digest('hex');
}

/** GGUF files start with the ASCII magic "GGUF". */
export async function isGguf(path: string): Promise<boolean> {
  const stream = createReadStream(path, { start: 0, end: 3 });
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('latin1') === 'GGUF';
}

export async function verifyModelFile(path: string, expectedSha256: string): Promise<{ ok: boolean; sizeBytes: number; sha256: string; reason?: string }> {
  const s = await stat(path);
  if (!(await isGguf(path))) return { ok: false, sizeBytes: s.size, sha256: '', reason: 'Not a GGUF file' };
  const sha = await sha256File(path);
  if (expectedSha256 && sha.toLowerCase() !== expectedSha256.toLowerCase()) return { ok: false, sizeBytes: s.size, sha256: sha, reason: 'SHA-256 mismatch: refusing to load an unverified model' };
  return { ok: true, sizeBytes: s.size, sha256: sha, ...(expectedSha256 ? {} : { reason: 'No expected SHA-256 configured; integrity not verified' }) };
}
