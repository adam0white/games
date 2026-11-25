// Night Bells: pure seeded rules. A fixed step is DT seconds.
// Small-angle pendula: length sets the period; damping reduces amplitude.
// A timed impulse restores energy without moving the phase or reversing motion.
// Each night is a spec (NIGHTS). A spec field that is absent leaves the rule exactly as main had it on
// 2026-11-24 (LEGACY holds those eight nights; bots.mjs replays them against values taken from main).
export const DT = 1 / 120;
const TAU = Math.PI * 2;
export const CHORD = .32; // seconds between two strikes that ring as one chord
export const TRIAD = .6;  // three strikes by one thumb, at least 140 ms apart, ring as one chord within this

// main's eight nights, unchanged: [bells, target, half-window, damping, time limit]
const OLD = [
  [1, 15, .34, 0, 0], [2, 22, .28, .017, 60],
  [2, 26, .26, .020, 65], [2, 30, .24, .023, 65],
  [3, 34, .27, .023, 70], [3, 38, .25, .026, 70],
  [3, 42, .23, .029, 75], [3, 46, .21, .032, 75],
];
const legacy = ([n, target, window, decay, time], i) => ({ n, target, window, decay, time,
  penalty: i === 0 ? 1 : .5, canFade: i > 0, recentLong: n === 3 });
export const LEGACY = OLD.map(legacy);

// The plain hunt on three: each row swaps first the front pair, then the back pair, and comes home after six rows.
export function plainHunt(n = 3, rows = 6) {
  let row = [...Array(n).keys()]; const out = [];
  for (let r = 0; r < rows; r++) {
    out.push(...row); row = row.slice();
    for (let i = r % 2; i + 1 < n; i += 2) [row[i], row[i + 1]] = [row[i + 1], row[i]];
  }
  return out;
}
// Lengths for the octave and triad nights: a pendulum's period goes with the square root of its length,
// so lengths 4:1 swing 1:2 and 36:16:9 swing 2:3:4; their tops keep meeting.
// idea: the one new thing each night brings (words.js key `idea<n>`); NOTES.md lists the physics.
export const NIGHTS = [
  { ...LEGACY[0], idea: 'swing' },
  { ...LEGACY[1], target: 20, window: .29, decay: .015, time: 60, hold: true, idea: 'periods' },
  { ...LEGACY[2], target: 22, window: .28, decay: .017, time: 62, hold: true, idea: 'drift' },
  { ...LEGACY[3], target: 24, window: .275, decay: .019, time: 64, hold: true, idea: 'together' },
  { ...LEGACY[4], target: 26, window: .265, decay: .018, time: 70, hold: true, idea: 'three' },
  { ...LEGACY[5], target: 28, window: .275, decay: .019, time: 72, hold: true, idea: 'tight' },
  { ...LEGACY[6], target: 30, window: .275, decay: .020, time: 74, hold: true, idea: 'tighter' },
  { ...LEGACY[7], target: 32, window: .27, decay: .021, time: 76, hold: true, idea: 'eight' },
  // 9-24: one idea each from real pendulums and bells
  { n: 2, target: 22, window: .325, decay: .010, time: 70, penalty: .75, canFade: true, hold: true, start: .16, fade: .05, idea: 'ringUp' },
  { n: 2, target: 20, window: .285, decay: .012, time: 70, penalty: .75, canFade: true, hold: true, side: [null, 0], idea: 'handstroke' },
  { n: 2, target: 26, window: .265, decay: .012, time: 70, penalty: .75, canFade: true, hold: true, lengths: [120, 30], exact: true, harmony: 0, chords: 4, idea: 'octave' },
  { n: 3, target: 26, window: .28, decay: .014, time: 72, penalty: .75, canFade: true, hold: true, muffle: [1, 3.2, 1], recentLong: true, idea: 'muffled' },
  { n: 3, target: 21, window: .275, decay: .008, time: 80, penalty: .75, canFade: true, hold: true, order: [0, 1, 2], harmony: 0, idea: 'rounds' },
  { n: 2, target: 22, window: .295, decay: .012, time: 72, penalty: .75, canFade: true, hold: true, couple: .08, lengths: [70, 76], idea: 'beam' },
  { n: 3, target: 26, window: .275, decay: .014, time: 76, penalty: .75, canFade: true, hold: true, gust: { every: 5.5, push: .34 }, recentLong: true, idea: 'gust' },
  { n: 2, target: 22, window: .25, decay: .013, time: 72, penalty: .75, canFade: true, hold: true, amp: 1.25, nonlinear: true, idea: 'high' },
  { n: 3, target: 24, window: .275, decay: .008, time: 84, penalty: .75, canFade: true, hold: true, order: plainHunt(3, 6), harmony: 0, idea: 'hunt' },
  { n: 3, target: 26, window: .27, decay: .014, time: 78, penalty: .75, canFade: true, hold: true, shorten: { bell: 2, at: 12, factor: .55 }, recentLong: true, idea: 'rope' },
  { n: 3, target: 30, window: .30, decay: .012, time: 80, penalty: .75, canFade: true, hold: true, lengths: [144, 64, 36], exact: true, harmony: 0, chords: 3, triad: true, idea: 'triad' },
  { n: 3, target: 18, window: .305, decay: .012, time: 80, penalty: .75, canFade: true, hold: true, lengths: [64, 72, 72], exact: true, free: [2], couple: .12, harmony: 0, wake: .45, idea: 'sympathy' },
  { n: 3, target: 26, window: .265, decay: .015, time: 80, penalty: .75, canFade: true, hold: true, couple: .08, recentLong: true, idea: 'chain' },
  { n: 3, target: 26, window: .265, decay: .015, time: 80, penalty: .75, canFade: true, hold: true, heavy: [1, 1, .55], lengths: [58, 70, 100], recentLong: true, idea: 'heavy' },
  { n: 3, target: 28, window: .275, decay: .016, time: 82, penalty: .75, canFade: true, hold: true, sync: .35, harmony: 3, recentLong: true, idea: 'huygens' },
  { n: 3, target: 30, window: .27, decay: .010, time: 96, penalty: .75, canFade: true, hold: true, order: [...plainHunt(3, 6), 0, 1, 2], gust: { every: 7, push: .26 }, harmony: 0, idea: 'peal' },
];
export const LEVELS = NIGHTS.length;
export const CLASSIC = 8; // the nights main had; their stars live in the old save

export function rng(seed = 1) {
  let a = (Number.isFinite(seed) ? seed : 1) >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// The daily peal: one spec and one seed from the UTC day, the same on every phone.
export function dayNumber(day) {
  let h = 2166136261; for (const c of String(day)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % 2147483646 + 1;
}
const DAILY_IDEAS = [
  { order: [0, 1, 2], harmony: 0, decay: .008, idea: 'rounds' },
  { gust: { every: 6, push: .3 }, idea: 'gust' },
  { muffle: [1, 2.6, 1], idea: 'muffled' },
  { couple: .08, idea: 'chain' },
  { side: [null, null, 1], idea: 'handstroke' },
  { lengths: [144, 64, 36], exact: true, harmony: 0, chords: 2, triad: true, idea: 'triad' },
  { sync: .35, harmony: 2, idea: 'huygens' },
  { heavy: [1, 1, .55], lengths: [58, 70, 100], idea: 'heavy' },
];
export function dailySpec(day) {
  const r = rng(dayNumber(day)), pick = DAILY_IDEAS[Math.floor(r() * DAILY_IDEAS.length)];
  return { n: 3, target: 28, window: .28, decay: .014, time: 80, penalty: .75, canFade: true, hold: true, recentLong: true, ...pick, daily: day };
}

export function create(level = 1, seed = 1, endless = false, spec = null) {
  const n = Number.isFinite(level) ? Math.max(1, Math.min(LEVELS, Math.trunc(level))) : 1;
  const L = spec && typeof spec === 'object' ? spec : NIGHTS[n - 1];
  const { target, window, decay, time } = L;
  const count = endless ? 3 : L.n;
  const random = rng(seed);
  const s = { level: n, seed: Number.isFinite(seed) ? seed : 1, endless: !!endless,
    t: 0, ticks: 0, hits: 0, misses: 0, score: 0, lights: 0, target: endless ? 0 : target,
    harmony: 0, flash: 0, over: false, won: false, combo: 0, accuracy: 1,
    why: '', grace: 4, window, decay: endless ? .030 : decay,
    timeLimit: endless ? 0 : time, difficulty: 1, nextTap: 0,
    aligned: false, events: [], bells: [],
    // rules a night may add; absent means main's rule
    penalty: endless ? .5 : L.penalty, canFade: !endless && !!L.canFade, recentLong: !endless && !!L.recentLong,
    fade: L.fade ?? .16, need: endless ? 0 : L.harmony ?? 1, hold: !endless && !!L.hold, held: 0,
    order: endless ? null : L.order ?? null, orderAt: 0, chords: 0, chordNeed: endless ? 0 : L.chords ?? 0, triad: !!L.triad,
    couple: endless ? 0 : L.couple ?? 0, sync: endless ? 0 : L.sync ?? 0, nonlinear: !endless && !!L.nonlinear, amp: endless ? .68 : L.amp ?? .68,
    gusts: [], gustAt: 0, shorten: endless ? null : L.shorten ? { ...L.shorten, done: false } : null,
    wake: endless ? 0 : L.wake ?? 0, woke: false, idea: endless ? 'endless' : L.idea ?? '', daily: L.daily ?? '', rung: [],
  };
  const base = !endless && L.lengths ? L.lengths : [61, 73, 88];
  for (let i = 0; i < count; i++) {
    const jitter = (random() - .5) * 2, length = !endless && L.exact ? base[i] : base[i] + jitter;
    const omega = Math.sqrt(470 / length);
    const first = .85 + i * .08 + (random() - .5) * .035;
    const b = { length, color: i, omega, phase: TAU - omega * first,
      energy: .90, lastApex: null, lastGood: -100, hitFlash: 0, missFlash: 0 };
    if (!endless) {
      if (L.start !== undefined) b.energy = L.start;
      if (L.side?.[i] != null) b.side = L.side[i];
      if (L.muffle) b.muffle = L.muffle[i];
      if (L.heavy) b.heavy = L.heavy[i];
      if (L.free?.includes(i)) { b.free = true; b.energy = .01; }
    }
    s.bells.push(b);
  }
  // Octave and triad bells start their swings together, so their tops keep meeting.
  if (!endless && L.exact) for (const b of s.bells) b.phase = TAU - b.omega * .9;
  // A driven bell answers a quarter swing behind its driver.
  if (!endless && L.free) for (const i of L.free) if (s.bells[i - 1]) s.bells[i].phase = s.bells[i - 1].phase - Math.PI / 2;
  if (!endless && L.gust) {
    for (let at = 3 + random() * 2; at < (time || 120); at += L.gust.every * (.8 + random() * .4))
      s.gusts.push({ at, bell: Math.floor(random() * count), push: L.gust.push * (random() < .5 ? -1 : 1) });
  }
  return s;
}
const ringable = b => !b.free;
function apexDistance(b) { return Math.abs(b.phase - Math.round(b.phase / Math.PI) * Math.PI); }
function halfWindow(s) { return s.window / Math.sqrt(s.difficulty); }
function near(s, b) { return apexDistance(b) <= halfWindow(s) * b.omega * s.difficulty + 1e-10; }
const mod2 = k => ((k % 2) + 2) % 2;
// Which bell the order asks for now, or -1 when any may ring.
export function nextInOrder(s) { return s.order ? s.order[s.orderAt % s.order.length] : -1; }
// The rules of the night allow this bell now (order, handstroke), whatever the timing.
function allowed(s, i) {
  const b = s.bells[i];
  if (!b || b.free) return false;
  if (b.side !== undefined && mod2(Math.round(b.phase / Math.PI)) !== b.side) return false;
  if (s.order && nextInOrder(s) !== i) return false;
  return true;
}
function canHit(s, b, i) { return !s.over && s.t + 1e-10 >= s.nextTap && near(s, b) && b.lastApex !== Math.round(b.phase / Math.PI) && allowed(s, i); }
export function view(s, i) {
  const b = s.bells[i];
  if (!b) return null;
  return { angle: s.amp * Math.sqrt(Math.max(.015, b.energy)) * Math.cos(b.phase),
    ready: canHit(s, b, i), energy: b.energy, hitFlash: b.hitFlash, missFlash: b.missFlash,
    phase: ((b.phase % TAU) + TAU) % TAU,
    period: TAU / (b.omega * s.difficulty), window: halfWindow(s), apex: Math.round(b.phase / Math.PI),
    side: b.side ?? -1, free: !!b.free, next: s.order ? nextInOrder(s) === i : false };
}
// The bell's angular speed now: a high swing is slower (the period grows with amplitude, about 1 + A²/16).
function speed(s, b) {
  if (!s.nonlinear) return b.omega;
  const a = s.amp * Math.sqrt(Math.max(.015, b.energy));
  return b.omega * (1 - a * a / 16);
}
// A horizontal push on a swinging bell: change its velocity, then read amplitude and phase back.
function push(b, dv) {
  const a = Math.sqrt(Math.max(0, b.energy)), x = a * Math.cos(b.phase), y = a * Math.sin(b.phase) + dv;
  const turn = Math.atan2(y, x), was = ((b.phase % TAU) + TAU) % TAU;
  let d = turn - was; d -= TAU * Math.round(d / TAU);
  b.phase += d; b.energy = Math.min(1, x * x + y * y);
}
export function step(s, taps = []) {
  if (s.over) return s;
  s.events.length = 0;
  // Accept one physical action per step. Bad indices and malformed packets are inert.
  const index = Array.isArray(taps) ? taps.find(i => Number.isInteger(i) && i >= 0 && i < s.bells.length && ringable(s.bells[i])) : undefined;
  if (index !== undefined && s.t + 1e-10 >= s.nextTap) {
    const b = s.bells[index], good = canHit(s, b, index);
    s.nextTap = s.t + .14; // one thumb; repeated held input cannot strike every frame
    if (good) {
      const quality = 1 - apexDistance(b) / (halfWindow(s) * b.omega * s.difficulty);
      b.lastApex = Math.round(b.phase / Math.PI); b.lastGood = s.t;
      b.energy = Math.min(1, b.energy + (b.heavy === undefined ? .12 : .12 * b.heavy)); b.hitFlash = .28;
      s.hits++; s.combo++; s.lights++; s.score += 10 + Math.round(quality * 5);
      s.events.push({ type: 'hit', index, quality });
      s.rung.push(index);
      if (s.order) s.orderAt++;
      if (s.chordNeed) chord(s, index);
    } else {
      b.energy = Math.max(0, b.energy - .055); b.missFlash = .18;
      s.misses++; s.combo = 0; s.lights = Math.max(0, s.lights - s.penalty);
      s.events.push({ type: 'miss', index });
    }
    s.accuracy = s.hits / (s.hits + s.misses);
  }
  s.ticks++; s.t = s.ticks * DT;
  s.difficulty = s.endless ? Math.min(1.7, 1 + s.t / 180) : 1;
  s.flash = Math.max(0, s.flash - DT);
  if (s.shorten && !s.shorten.done && s.t >= s.shorten.at) {
    const b = s.bells[s.shorten.bell]; s.shorten.done = true;
    if (b) { b.length *= s.shorten.factor; b.omega = Math.sqrt(470 / b.length); s.events.push({ type: 'rope', index: s.shorten.bell }); }
  }
  while (s.gusts[s.gustAt] && s.t >= s.gusts[s.gustAt].at) {
    const g = s.gusts[s.gustAt++], b = s.bells[g.bell];
    if (b) { push(b, g.push); s.events.push({ type: 'gust', index: g.bell }); }
  }
  for (const b of s.bells) {
    b.phase += (s.nonlinear ? speed(s, b) : b.omega) * s.difficulty * DT;
    const decay = s.decay * (s.endless ? s.difficulty * s.difficulty : 1);
    b.energy = Math.max(0, b.energy * Math.exp(-(b.muffle === undefined ? decay : decay * b.muffle) * DT));
    b.hitFlash = Math.max(0, b.hitFlash - DT);
    b.missFlash = Math.max(0, b.missFlash - DT);
  }
  // A shared beam: neighbours trade energy at a rate that goes with sin(phase difference) (averaged coupled oscillators).
  if (s.couple) for (let i = 0; i + 1 < s.bells.length; i++) {
    const a = s.bells[i], c = s.bells[i + 1];
    const flow = s.couple * Math.sqrt(a.energy * c.energy) * Math.sin(a.phase - c.phase) * DT;
    const moved = Math.max(-c.energy, Math.min(a.energy, flow));
    a.energy -= moved; c.energy = Math.min(1, c.energy + moved);
  }
  // Huygens' beam: bells on one frame pull each other into step.
  if (s.sync) for (const a of s.bells) {
    let pull = 0; for (const c of s.bells) if (c !== a) pull += Math.sin(c.phase - a.phase);
    a.phase += s.sync * pull / (s.bells.length - 1) * DT;
  }
  for (const b of s.bells) if (b.free && b.energy >= s.wake && !s.woke) { s.woke = true; s.flash = .7; s.events.push({ type: 'woke' }); }
  // Three-bell campaign overlaps can be shorter than two cooldowns. Allow a
  // strike from the previous half-swing while still requiring a real overlap.
  const aligned = s.bells.every(b => {
    if (b.free) return true;
    const recent = s.recentLong ? Math.PI / b.omega + halfWindow(s) : .65;
    return near(s, b) && b.energy > .25 && s.t - b.lastGood < recent;
  });
  if (aligned && !s.aligned) {
    s.harmony++; s.flash = .70; s.score += 40 * s.bells.length;
    s.events.push({ type: 'harmony' });
  }
  s.aligned = aligned;
  const full = s.lights >= s.target;
  if (!s.endless && full && s.harmony >= s.need && s.chords >= s.chordNeed && (!s.wake || s.woke)) {
    s.over = true; s.won = true; s.why = 'lit'; s.events.push({ type: 'win' });
  } else if ((s.endless || s.canFade) && s.t > s.grace &&
    (s.bells.some(b => !b.free && b.energy < s.fade) || (s.timeLimit && s.t - s.held >= s.timeLimit))) {
    s.over = true; s.why = s.timeLimit && s.t - s.held >= s.timeLimit ? 'time' : 'faded'; s.events.push({ type: 'lose' });
    s.faded = s.bells.findIndex(b => !b.free && b.energy < s.fade);
  } else if (s.hold && full) s.held += DT; // the bar is full: the clock waits while the bells come together
  return s;
}
// Two or three bells struck at their tops within CHORD seconds ring one chord (a triad night needs every bell).
function chord(s, index) {
  const span = s.triad ? TRIAD : CHORD;
  const with_ = s.bells.map((b, i) => i).filter(i => i !== index && !s.bells[i].free && s.t - s.bells[i].lastGood <= span && s.bells[i].chordAt !== s.bells[i].lastGood);
  const needed = s.triad ? s.bells.filter(ringable).length - 1 : 1;
  if (with_.length < needed) return;
  for (const i of [index, ...with_]) s.bells[i].chordAt = s.bells[i].lastGood;
  s.chords++; s.lights += 2; s.score += 30 * (with_.length + 1); s.flash = .7;
  s.events.push({ type: 'chord', bells: [index, ...with_] });
}
// What the player rang, as places on a ladder of notes: the longest bell is the lowest note.
export function melody(s) {
  const rank = s.bells.map((b, i) => i).sort((a, b) => s.bells[b].length - s.bells[a].length);
  return s.rung.map(i => rank.indexOf(i));
}
export const clone = s => structuredClone(s);
export const digest = s => JSON.stringify(s);
