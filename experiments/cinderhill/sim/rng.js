// Seeded random numbers: mulberry32, one independent stream per purpose, so that adding a draw in one
// subsystem never shifts the numbers another subsystem gets. The state is a Uint32Array that the sim hashes
// and snapshots.

export const STREAM = { world: 0, ants: 1, spare: 2 };
export const STREAMS = 3;

/** Stream states from a seed. Each stream's start is mixed from the seed and its index. */
export function seedStreams(seed) {
  const s = new Uint32Array(STREAMS);
  for (let i = 0; i < STREAMS; i++) s[i] = mix((seed >>> 0) ^ Math.imul(i + 1, 0x9E3779B1));
  return s;
}

function mix(x) {
  x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B);
  x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Next 32-bit unsigned value of stream i. */
export function next(s, i) {
  const t0 = (s[i] + 0x6D2B79F5) | 0;
  s[i] = t0;
  let t = Math.imul(t0 ^ (t0 >>> 15), t0 | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Integer in [0, n) for n up to 2^16 (the top 16 bits times n keeps the product exact). */
export function below(s, i, n) {
  return ((next(s, i) >>> 16) * n) >>> 16;
}
