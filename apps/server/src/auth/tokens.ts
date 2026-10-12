import { createHash, randomBytes } from 'node:crypto';

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Only hashes of bearer secrets are stored, so a database leak does not expose live sessions. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}
