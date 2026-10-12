// Generates the arcade sound effects as small 8-bit mono WAV files.
// They are synthesised here (original, no third-party audio), mirroring the web WebAudio tones.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 11025;
const TONES = {
  move: [[440, 0.04]], hit: [[660, 0.05]], tick: [[880, 0.02]],
  score: [[523, 0.08], [784, 0.1]], win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.2]],
  lose: [[392, 0.15], [330, 0.15], [262, 0.3]], error: [[160, 0.18]],
  pad0: [[330, 0.3]], pad1: [[392, 0.3]], pad2: [[494, 0.3]], pad3: [[587, 0.3]], pad4: [[659, 0.3]], pad5: [[784, 0.3]],
};

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length, 40);
  samples.forEach((v, i) => buf.writeUInt8(Math.max(0, Math.min(255, Math.round(128 + v * 100))), 44 + i));
  return buf;
}

const out = join(dirname(fileURLToPath(import.meta.url)), '../assets/sfx');
mkdirSync(out, { recursive: true });
for (const [name, notes] of Object.entries(TONES)) {
  const samples = [];
  for (const [freq, dur] of notes) {
    const n = Math.round(dur * RATE);
    for (let i = 0; i < n; i++) {
      const env = Math.exp((-5 * i) / n);
      const wave = name.startsWith('pad') ? Math.sin((2 * Math.PI * freq * i) / RATE) : Math.sign(Math.sin((2 * Math.PI * freq * i) / RATE)) * 0.5;
      samples.push(wave * env);
    }
  }
  writeFileSync(join(out, `${name}.wav`), wav(samples));
}
console.log('wrote', Object.keys(TONES).length, 'sounds to', out);
