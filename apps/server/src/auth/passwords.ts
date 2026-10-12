import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

const PARAMS = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };

/** scrypt$N$r$p$salt$hash (base64). Memory-hard KDF from Node's standard library. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, PARAMS.keylen, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p, maxmem: 128 * PARAMS.N * PARAMS.r * 2 });
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const N = Number(n), R = Number(r), P = Number(p);
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A pre-computed hash used to equalise timing when the account does not exist. */
export const DUMMY_HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

export function passwordProblems(pw: string): string[] {
  const problems: string[] = [];
  if (pw.length < 10) problems.push('Password must be at least 10 characters');
  if (pw.length > 200) problems.push('Password is too long');
  if (/^(.)\1+$/.test(pw)) problems.push('Password is too repetitive');
  if (['password12', '1234567890', 'qwertyuiop', 'exammate123'].includes(pw.toLowerCase())) problems.push('Password is too common');
  return problems;
}
