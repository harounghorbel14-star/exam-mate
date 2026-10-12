import { copyFile, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { config } from '../config.js';

const require = createRequire(import.meta.url);

export type OcrLang = 'eng' | 'fra' | 'ara';
export interface OcrResult { text: string; confidence: number; lang: string; durationMs: number }

const LANG_DIR = path.resolve(config.STORAGE_DIR, '..', '.ocr-lang');

/** Language data ships inside npm packages (@tesseract.js-data/*); nothing is downloaded at runtime. */
async function prepareLanguageData(langs: OcrLang[]): Promise<string> {
  await mkdir(LANG_DIR, { recursive: true });
  for (const l of langs) {
    const target = path.join(LANG_DIR, `${l}.traineddata.gz`);
    try { await stat(target); continue; } catch { /* copy below */ }
    const pkgDir = path.dirname(require.resolve(`@tesseract.js-data/${l}/package.json`));
    await copyFile(path.join(pkgDir, '4.0.0_best_int', `${l}.traineddata.gz`), target);
  }
  return LANG_DIR;
}

type Worker = { recognize(img: Buffer): Promise<{ data: { text: string; confidence: number } }>; terminate(): Promise<unknown> };
const workers = new Map<string, Promise<Worker>>();
let queue: Promise<unknown> = Promise.resolve();

async function getWorker(langs: OcrLang[]): Promise<Worker> {
  const key = langs.join('+');
  let w = workers.get(key);
  if (!w) {
    w = (async () => {
      const langPath = await prepareLanguageData(langs);
      const { createWorker } = await import('tesseract.js');
      return (await createWorker(langs, 1, { langPath, cachePath: langPath, gzip: true, cacheMethod: 'none', logger: () => undefined } as never)) as unknown as Worker;
    })();
    workers.set(key, w);
    w.catch(() => workers.delete(key));
  }
  return w;
}

/** Run OCR locally with a timeout. Calls are serialised to bound CPU and memory use. */
export async function recognize(image: Buffer, langs: OcrLang[] = ['eng', 'fra'], timeoutMs = 60_000): Promise<OcrResult> {
  if (!config.OCR_ENABLED) throw new Error('OCR is disabled on this server');
  const run = async () => {
    const started = Date.now();
    const worker = await getWorker(langs);
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('OCR timed out')), timeoutMs); });
    try {
      const { data } = await Promise.race([worker.recognize(image), timeout]);
      return { text: data.text.trim(), confidence: Math.round(data.confidence), lang: langs.join('+'), durationMs: Date.now() - started };
    } finally {
      clearTimeout(timer);
    }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export async function shutdownOcr(): Promise<void> {
  for (const w of workers.values()) await (await w).terminate().catch(() => undefined);
  workers.clear();
}
