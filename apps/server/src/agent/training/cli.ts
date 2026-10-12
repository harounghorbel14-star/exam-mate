import { pool } from '../../db/pool.js';
import { retrainClassifier, rollbackClassifier } from './classifierRegistry.js';

const cmd = process.argv[2] ?? 'train';
const run = cmd === 'rollback' ? rollbackClassifier() : retrainClassifier();
run.then((r) => { console.log(JSON.stringify(r, (k, v) => (k === 'confusion' || k === 'perClass' ? undefined : v), 2)); return pool.end(); })
  .catch((e) => { console.error(e); process.exit(1); });
