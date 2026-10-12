import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

/**
 * Object storage interface. The bundled implementation stores files on local disk outside
 * any web root; an S3-compatible implementation can replace it without touching callers.
 */
export interface ObjectStorage {
  put(userId: string, data: Buffer, ext: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deletePrefix(userId: string): Promise<void>;
}

const SAFE_KEY = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/;

export class LocalDiskStorage implements ObjectStorage {
  constructor(private root: string) {}

  private resolve(key: string): string {
    if (!SAFE_KEY.test(key)) throw new Error('Invalid storage key');
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(userId: string, data: Buffer, ext: string): Promise<string> {
    if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error('Invalid owner');
    const key = `${userId}/${randomUUID()}.${ext.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 5) || 'bin'}`;
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
    await writeFile(full, data, { mode: 0o600 });
    return key;
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async deletePrefix(userId: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error('Invalid owner');
    await rm(path.resolve(this.root, userId), { recursive: true, force: true });
  }
}

export const storage: ObjectStorage = new LocalDiskStorage(path.resolve(config.STORAGE_DIR));
