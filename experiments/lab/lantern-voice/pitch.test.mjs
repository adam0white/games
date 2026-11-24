// Pitch detection check: node experiments/lab/lantern-voice/pitch.test.mjs
// Synthetic sine, sawtooth and vowel-like waves at 110 to 660 Hz, clean and with white noise at 20 dB and 10 dB SNR,
// at 48 kHz and 44.1 kHz, 2048-sample frames, 8 frames each at different offsets. Pass marks, set before the first run:
// every voiced frame within 1 semitone of the true pitch (a null counts as a failure); null on every frame of pure
// noise and of silence. Also a whistle at 1500 and 2500 Hz. Prints the error table; exits non-zero on a failure.
import { detect, semis } from './pitch.js';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const N = 2048;

// The vowel: harmonics shaped by two formant peaks near 700 Hz and 1200 Hz (an open "ah"), with fixed random phases.
const WAVES = {
  sine: (f, t) => Math.sin(2 * Math.PI * f * t),
  sawtooth: (f, t) => { const p = (f * t) % 1; return 2 * p - 1; },
  vowel: (() => {
    const ph = Array.from({ length: 40 }, (_, i) => (i * 2.39996) % (2 * Math.PI));
    const formant = h => Math.exp(-(((h - 700) / 220) ** 2)) + 0.7 * Math.exp(-(((h - 1200) / 260) ** 2)) + 0.25 / (1 + h / 300);
    return (f, t) => { let v = 0; for (let k = 1; k * f < 5000 && k <= 40; k++) v += formant(k * f) * Math.sin(2 * Math.PI * k * f * t + ph[k - 1]); return v; };
  })(),
};

function frame(kind, f, rate, snr, offset, r) {
  const buf = new Float32Array(N); let p = 0;
  for (let i = 0; i < N; i++) { buf[i] = WAVES[kind](f, (i + offset) / rate); p += buf[i] * buf[i]; }
  const scale = 0.3 / Math.sqrt(p / N); // every wave at the same loudness, 0.3 RMS
  for (let i = 0; i < N; i++) buf[i] *= scale;
  if (snr !== null) { const sd = 0.3 / 10 ** (snr / 20); for (let i = 0; i < N; i++) buf[i] += sd * gauss(r); }
  return buf;
}

let failed = 0;
const r = rng(12345);
const table = [];
for (const rate of [48000, 44100]) for (const kind of Object.keys(WAVES)) for (const snr of [null, 20, 10]) {
  const row = { rate, kind, snr: snr === null ? 'clean' : `${snr} dB` };
  for (const f of [110, 220, 330, 440, 660]) {
    let worst = 0, misses = 0;
    for (let k = 0; k < 8; k++) {
      const res = detect(frame(kind, f, rate, snr, Math.floor(r() * 100000), r), rate);
      if (res.hz === null) { misses++; continue; }
      worst = Math.max(worst, Math.abs(semis(res.hz) - semis(f)));
    }
    row[f] = misses ? `${misses} null` : worst.toFixed(3);
    if (misses || worst > 1) failed++;
  }
  table.push(row);
}
console.log('Worst error in semitones over 8 frames (a null counts as a failure):');
console.table(table);

// Whistles.
const whistle = [];
for (const f of [1500, 2500]) for (const snr of [null, 20, 10]) {
  let worst = 0, misses = 0;
  for (let k = 0; k < 8; k++) { const res = detect(frame('sine', f, 48000, snr, Math.floor(r() * 100000), r), 48000); if (res.hz === null) misses++; else worst = Math.max(worst, Math.abs(semis(res.hz) - semis(f))); }
  whistle.push({ hz: f, snr: snr === null ? 'clean' : `${snr} dB`, worst: worst.toFixed(3), nulls: misses });
  if (misses || worst > 1) failed++;
}
console.log('Whistles at 48 kHz:'); console.table(whistle);

// Pure noise at several loudnesses, and silence. Every frame must give null.
let noiseHits = 0, noiseFrames = 0, maxClarity = 0;
for (const rate of [48000, 44100]) for (const level of [0.01, 0.05, 0.1, 0.3, 0.6]) for (let k = 0; k < 40; k++) {
  const buf = new Float32Array(N); for (let i = 0; i < N; i++) buf[i] = level * gauss(r);
  const res = detect(buf, rate); noiseFrames++; maxClarity = Math.max(maxClarity, res.clarity);
  if (res.hz !== null) noiseHits++;
}
let silentHits = 0;
for (const buf of [new Float32Array(N), Float32Array.from({ length: N }, () => 0.001 * gauss(r)), Float32Array.from({ length: N }, () => 0.004 * gauss(r))]) if (detect(buf, 48000).hz !== null) silentHits++;
console.log(`pure noise: ${noiseHits} of ${noiseFrames} frames gave a pitch (highest clarity ${maxClarity.toFixed(3)}); silence: ${silentHits} of 3 gave a pitch`);
if (noiseHits || silentHits) failed++;

// Cost: one frame at 48 kHz.
const big = frame('vowel', 220, 48000, 20, 0, r), t0 = performance.now();
for (let i = 0; i < 200; i++) detect(big, 48000);
console.log(`cost: ${((performance.now() - t0) / 200).toFixed(2)} ms a frame in node`);

if (failed) { console.error(`FAIL: ${failed} cases`); process.exit(1); }
console.log('PASS');
