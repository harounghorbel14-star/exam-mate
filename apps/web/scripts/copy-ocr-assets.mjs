// Copy tesseract.js worker, WASM cores and language data into public/ocr so in-browser OCR
// works offline from our own origin (no CDN). These are cached on first use by the service worker.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const out = path.resolve('public/ocr');
mkdirSync(out, { recursive: true });
const tjs = path.dirname(require.resolve('tesseract.js/package.json'));
const core = path.dirname(require.resolve('tesseract.js-core/package.json'));
cpSync(path.join(tjs, 'dist/worker.min.js'), path.join(out, 'worker.min.js'));
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) cpSync(path.join(core, f), path.join(out, f));
for (const l of ['eng', 'fra', 'ara']) {
  const dir = path.dirname(require.resolve(`@tesseract.js-data/${l}/package.json`));
  const src = path.join(dir, '4.0.0_best_int', `${l}.traineddata.gz`);
  if (existsSync(src)) cpSync(src, path.join(out, `${l}.traineddata.gz`));
}
console.log('OCR assets copied to public/ocr');
