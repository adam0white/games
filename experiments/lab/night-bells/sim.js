// Night Bells: pure seeded rules. A fixed step is DT seconds.
// Small-angle pendula: length sets the period; damping reduces amplitude.
// A timed impulse restores energy without moving the phase or reversing motion.
export const DT = 1 / 120;
export const LEVELS = 8;
const TAU = Math.PI * 2;
const CONFIG = [
  [1, 15, .34, 0, 0], [2, 22, .28, .017, 60],
  [2, 26, .26, .020, 65], [2, 30, .24, .023, 65],
  [3, 34, .27, .023, 70], [3, 38, .25, .026, 70],
  [3, 42, .23, .029, 75], [3, 46, .21, .032, 75],
];
export function rng(seed = 1) {
  let a = (Number.isFinite(seed) ? seed : 1) >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function create(level = 1, seed = 1, endless = false) {
  const n = Number.isFinite(level) ? Math.max(1, Math.min(LEVELS, Math.trunc(level))) : 1;
  const [count, target, window, decay, timeLimit] = CONFIG[n - 1];
  const random = rng(seed);
  const s = { level: n, seed: Number.isFinite(seed) ? seed : 1, endless: !!endless,
    t: 0, ticks: 0, hits: 0, misses: 0, score: 0, lights: 0, target: endless ? 0 : target,
    harmony: 0, flash: 0, over: false, won: false, combo: 0, accuracy: 1,
    why: '', grace: 4, window, decay: endless ? .030 : decay,
    timeLimit: endless ? 0 : timeLimit, difficulty: 1, nextTap: 0,
    aligned: false, events: [], bells: [],
  };
  for (let i = 0; i < (endless ? 3 : count); i++) {
    const length = [61, 73, 88][i] + (random() - .5) * 2;
    const omega = Math.sqrt(470 / length);
    const first = .85 + i * .08 + (random() - .5) * .035;
    s.bells.push({ length, color: i, omega, phase: TAU - omega * first,
      energy: .90, lastApex: null, lastGood: -100, hitFlash: 0, missFlash: 0 });
  }
  return s;
}
function apexDistance(b) { return Math.abs(b.phase - Math.round(b.phase / Math.PI) * Math.PI); }
function halfWindow(s) { return s.window / Math.sqrt(s.difficulty); }
function near(s, b) { return apexDistance(b) <= halfWindow(s) * b.omega * s.difficulty + 1e-10; }
function canHit(s, b) { return !s.over && s.t + 1e-10 >= s.nextTap && near(s, b) && b.lastApex !== Math.round(b.phase / Math.PI); }
export function view(s, i) {
  const b = s.bells[i];
  if (!b) return null;
  return { angle: .68 * Math.sqrt(Math.max(.015, b.energy)) * Math.cos(b.phase),
    ready: canHit(s, b), energy: b.energy, hitFlash: b.hitFlash, missFlash: b.missFlash,
    phase: ((b.phase % TAU) + TAU) % TAU,
    period: TAU / (b.omega * s.difficulty), window: halfWindow(s), apex: Math.round(b.phase / Math.PI) };
}
export function step(s, taps = []) {
  if (s.over) return s;
  s.events.length = 0;
  // Accept one physical action per step. Bad indices and malformed packets are inert.
  const index = Array.isArray(taps) ? taps.find(i => Number.isInteger(i) && i >= 0 && i < s.bells.length) : undefined;
  if (index !== undefined && s.t + 1e-10 >= s.nextTap) {
    const b = s.bells[index], good = canHit(s, b);
    s.nextTap = s.t + .14; // one thumb; repeated held input cannot strike every frame
    if (good) {
      const quality = 1 - apexDistance(b) / (halfWindow(s) * b.omega * s.difficulty);
      b.lastApex = Math.round(b.phase / Math.PI); b.lastGood = s.t;
      b.energy = Math.min(1, b.energy + .12); b.hitFlash = .28;
      s.hits++; s.combo++; s.lights++; s.score += 10 + Math.round(quality * 5);
      s.events.push({ type: 'hit', index, quality });
    } else {
      b.energy = Math.max(0, b.energy - .055); b.missFlash = .18;
      s.misses++; s.combo = 0; s.lights = Math.max(0, s.lights - (s.level === 1 && !s.endless ? 1 : .5));
      s.events.push({ type: 'miss', index });
    }
    s.accuracy = s.hits / (s.hits + s.misses);
  }
  s.ticks++; s.t = s.ticks * DT;
  s.difficulty = s.endless ? Math.min(1.7, 1 + s.t / 180) : 1;
  s.flash = Math.max(0, s.flash - DT);
  for (const b of s.bells) {
    b.phase += b.omega * s.difficulty * DT;
    const decay = s.decay * (s.endless ? s.difficulty * s.difficulty : 1);
    b.energy = Math.max(0, b.energy * Math.exp(-decay * DT));
    b.hitFlash = Math.max(0, b.hitFlash - DT);
    b.missFlash = Math.max(0, b.missFlash - DT);
  }
  // Three-bell campaign overlaps can be shorter than two cooldowns. Allow a
  // strike from the previous half-swing while still requiring a real overlap.
  const aligned = s.bells.every(b => {
    const recent = !s.endless && s.bells.length === 3 ? Math.PI / b.omega + halfWindow(s) : .65;
    return near(s, b) && b.energy > .25 && s.t - b.lastGood < recent;
  });
  if (aligned && !s.aligned) {
    s.harmony++; s.flash = .70; s.score += 40 * s.bells.length;
    s.events.push({ type: 'harmony' });
  }
  s.aligned = aligned;
  if (!s.endless && s.lights >= s.target && s.harmony > 0) {
    s.over = true; s.won = true; s.why = 'lit'; s.events.push({ type: 'win' });
  } else if ((s.endless || s.level > 1) && s.t > s.grace &&
    (s.bells.some(b => b.energy < .16) || (s.timeLimit && s.t >= s.timeLimit))) {
    s.over = true; s.why = s.timeLimit && s.t >= s.timeLimit ? 'time' : 'faded'; s.events.push({ type: 'lose' });
  }
  return s;
}
export const clone = s => structuredClone(s);
export const digest = s => JSON.stringify(s);
