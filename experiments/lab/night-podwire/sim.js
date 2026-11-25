// Vertical motion of a string with two fixed ends. A grip sets the static shape
// under a point load. Release lets neighbouring masses exchange momentum.
// Plates I-VI use exactly the wave physics they shipped with (the "plain" path below); IV-VI have lower pods.
// Plates VII on add one real string effect each: harmonics, beads, a bridge,
// felt, frets, a free end, moving pods, two-crest pods and pumping.
export const BASE = 250;
export const LEFT = 24;
export const SPACING = 6;
export const COUNT = 53;
export const TICK = 1 / 240;
export const MAX_PULL = 86;
export const cueDepth = level => level === 1 ? 44 : 84;

// A bud is [x, height] (a pod above the wire that opens when the wire touches it)
// or an object: { x, h, type, mode, swing: [amplitude, period, phase] }.
//   type 'touch'  opens on contact from below (the default)
//   type 'double' needs two separate contacts within DOUBLE_WINDOW seconds
//   type 'tuned'  rings with harmonic `mode` and opens once that harmonic's amplitude stays above h
export const plates = [
  { name: 'Poppy', latin: 'Papaver', zones: [[72, 288]], buds: [[180, 19]] },
  { name: 'Honesty', latin: 'Lunaria', zones: [[73, 125]], buds: [[253, 39]] },
  { name: 'Flax', latin: 'Linum', zones: [[155, 205]], buds: [[126, 34], [234, 34]] },
  { name: 'Milkweed', latin: 'Asclepias', zones: [[72, 114], [246, 288]], buds: [[90, 47.6], [270, 47.6]] },
  { name: 'Love-in-a-mist', latin: 'Nigella', zones: [[93, 130], [156, 204], [230, 267]], buds: [[104, 50.7], [180, 40.4], [256, 50.7]] },
  { name: 'Columbine', latin: 'Aquilegia', zones: [[72, 99], [171, 189], [261, 288]], buds: [[83, 53.3], [142, 41.3], [218, 41.3], [277, 53.3]] },
  // VII. A pluck at the exact middle has no even harmonics, so a pod tuned to the second stays shut.
  { name: 'Bladder campion', latin: 'Silene', idea: 'harmonic2', tension: 1,
    zones: [[96, 264]], buds: [{ x: 180, h: 20.9, type: 'tuned', mode: 2 }], cue: [{ x: 100, depth: 86 }] },
  // VIII. A ring that slides on a stem is a free end: the crest comes back the same way up.
  { name: 'Sweet pea', latin: 'Lathyrus', idea: 'free', kind: 3, tension: 1, free: true,
    zones: [[72, 132]], buds: [[228, 51.5], [300, 51.5]], cue: [{ x: 102, depth: 84 }] },
  // IX. Pods that crack on one crest and burst on a second crest that comes soon after.
  { name: 'Spanish broom', latin: 'Spartium', idea: 'double', kind: 3, tension: 1.15, live: true, maxPull: 70,
    zones: [[72, 156]], buds: [{ x: 246, h: 33, type: 'double' }], cue: [{ x: 102, depth: 70 }, { x: 102, depth: 70, after: .85 }] },
  // X. Plucks in time with the wire add up to a standing wave.
  { name: 'Squirting cucumber', latin: 'Ecballium', idea: 'pump', kind: 4, tension: .85, live: true, maxPull: 36, damping: .25,
    zones: [[150, 210]], buds: [[180, 72]], cue: [{ x: 180, depth: 36 }, { x: 180, depth: 36, after: 1.6 }, { x: 180, depth: 36, after: 1.6 }] },
  // XI. A heavy stretch of wire carries the wave more slowly, so the crest no longer lands at the mirror point.
  { name: 'Hop', latin: 'Humulus', idea: 'heavy', kind: 4, tension: .9,
    zones: [[72, 132]], heavy: [192, 336, 3], buds: [[252, 33.1], [300, 20.7]], cue: [{ x: 102, depth: 84 }] },
  // XII. A pluck a third of the way along has no third harmonic.
  { name: 'Rattlebox', latin: 'Crotalaria', idea: 'harmonic3', kind: 1, tension: 1.25,
    zones: [[72, 288]], buds: [{ x: 120, h: 12.8, type: 'tuned', mode: 3 }, [252, 46.9]], cue: [{ x: 72, depth: 86 }] },
  // XIII. A heavy bead reflects part of the wave early and passes the rest on.
  { name: "Job's tears", latin: 'Coix', idea: 'bead', kind: 2, tension: 1.1,
    zones: [[72, 132]], beads: [[204, 7]], buds: [[168, 34.6], [282, 23.8]], cue: [{ x: 102, depth: 84 }] },
  // XIV. Two spans share a sprung bridge: the plucked span drives the other through it.
  { name: 'Lupin', latin: 'Lupinus', idea: 'bridge', kind: 3, tension: 1.2,
    zones: [[72, 156]], bridge: [180, 5, 900], buds: [[234, 46.1], [276, 46.1]], cue: [{ x: 114, depth: 84 }] },
  // XV. Felt on the wire soaks up the wave: a crest that reaches it dies there.
  { name: 'Cotton', latin: 'Gossypium', idea: 'felt', kind: 4, tension: 1,
    zones: [[72, 144]], felt: [264, 330, 18], buds: [[204, 40.5], [120, 26.2]], cue: [{ x: 108, depth: 84 }] },
  // XVI. A pod that swings: the crest has to arrive when the pod is over it.
  { name: 'Quaking grass', latin: 'Briza', idea: 'moving', kind: 2, tension: 1.05,
    zones: [[72, 144]], buds: [{ x: 252, h: 61.3, swing: [56, 2.6, 0] }], cue: [{ x: 78, depth: 86, phase: .115 }] },
  // XVII. A brass fret clamps the wire: the shorter span rings higher and keeps the wave on one side.
  { name: 'Wallflower', latin: 'Erysimum', idea: 'fret', kind: 2, tension: 1.3,
    zones: [[72, 132]], frets: [180], buds: [[120, 66.3], [264, 60.3]], cue: [{ fret: 0 }, { x: 84, depth: 84 }] },
  // XVIII. Everything at once: a pluck on the middle winding has no second harmonic until the fret
  // halves the wire; then one half rings alone, which sounds the second harmonic and reaches the swinging pod.
  { name: 'Peony', latin: 'Paeonia', idea: 'finale', kind: 0, tension: 1.4,
    zones: [[150, 210]], frets: [180], buds: [{ x: 102, h: 25.7, type: 'tuned', mode: 2 }, { x: 264, h: 65.6, swing: [36, 2.2, 1] }],
    cue: [{ fret: 0 }, { x: 186, depth: 86 }] },
];
// Par for each campaign plate (its stable seed, level * 417): the look-ahead player's pluck count. bots.mjs checks it.
export const PARS = [1, 1, 1, 2, 2, 2, 1, 1, 2, 3, 1, 1, 1, 1, 1, 1, 2, 1];
export const DOUBLE_WINDOW = 1.2;
export const TUNED_HOLD = .25;

const node = x => Math.round((x - LEFT) / SPACING);
function budSpec(b) {
  return Array.isArray(b) ? { x: b[0], h: b[1], type: 'touch' } : { type: 'touch', ...b };
}
// The plain plates keep their shipped pod list (and its random draws) exactly.
export function create(level = 1, seed = level, { spread = 1 } = {}) {
  const spec = plates[level - 1];
  let randomState = seed >>> 0;
  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }
  const plain = level <= 6;
  const pods = spec.buds.map(raw => {
    const b = budSpec(raw);
    const pod = {
      x: b.x + (random() - 0.5) * 6 * spread,
      height: b.h + (random() - 0.5) * 3 * (b.type === 'tuned' ? .3 : spread),
      kind: plain ? level - 1 : b.type === 'tuned' ? 6 : spec.kind ?? 2, open: false, openedAt: null,
    };
    if (plain) return pod;
    return Object.assign(pod, { type: b.type, mode: b.mode || 0, swing: b.swing || null, x0: pod.x,
      crackedAt: null, touching: false, ring: 0, held: 0, best: 0 });
  });
  const s = { level, seed, zones: spec.zones, pods, u: Array(COUNT).fill(0), v: Array(COUNT).fill(0),
    time: 0, ticks: 0, grip: null, plucks: 0, won: false, ringing: false };
  if (plain) return s;
  const mass = Array(COUNT).fill(1), spring = Array(COUNT).fill(0);
  const drag = Array(COUNT).fill(spec.damping ? Math.exp(-spec.damping * TICK) : DRAG);
  if (spec.heavy) { const [a, b, m] = spec.heavy; for (let i = node(a); i <= node(b); i++) mass[i] = m; }
  for (const [x, m] of spec.beads || []) mass[node(x)] = m;
  if (spec.bridge) { const [x, m, k] = spec.bridge; mass[node(x)] = m; spring[node(x)] = k; }
  if (spec.felt) {
    const [a, b, rate] = spec.felt;
    for (let i = node(a); i <= node(b); i++) drag[i] = Math.exp(-rate * TICK);
  }
  return Object.assign(s, { rich: true, live: !!spec.live, free: !!spec.free, maxPull: spec.maxPull || MAX_PULL,
    mass, spring, drag, frets: (spec.frets || []).map(x => ({ x, i: node(x), on: false })), peak: 0 });
}

// The gestures the drawn finger shows on a plate. Plain plates show one pull at the middle of the first winding.
// `after`: seconds after the previous release; `phase`: release when the swinging pod is at that fraction of its swing;
// `fret`: clamp that fret (skipped when it is already clamped).
export function cueOf(s) {
  const spec = plates[s.level - 1];
  if (spec.cue) return spec.cue;
  const [a, b] = s.zones[0];
  return [{ x: (a + b) / 2, depth: cueDepth(s.level) }];
}
// Seconds from now until the drawn finger lets go for gesture g.
export function cueWait(s, g) {
  if (g.phase === undefined) return g.after || 0;
  const pod = s.pods.find(p => p.swing), period = pod.swing[1];
  return ((g.phase - (s.time / period) % 1) % 1 + 1) % 1 * period;
}

export function podX(s, pod) {
  if (!pod.swing) return pod.x;
  const [amp, period, phase] = pod.swing;
  return pod.x0 + amp * Math.sin(2 * Math.PI * s.time / period + phase);
}

export function at(s, x) {
  const n = Math.max(0, Math.min(COUNT - 1, (x - LEFT) / SPACING));
  const i = Math.min(COUNT - 2, Math.floor(n));
  return s.u[i] + (s.u[i + 1] - s.u[i]) * (n - i);
}

// The fixed nodes either side of node i: the two ends and any clamped fret.
export function span(s, i) {
  let lo = 0, hi = s.free ? COUNT : COUNT - 1;
  for (const f of s.frets || []) {
    if (!f.on) continue;
    if (f.i < i && f.i > lo) lo = f.i;
    if (f.i > i && f.i < hi) hi = f.i;
  }
  return [lo, hi];
}
// Static shape of a taut string under a point load at node g, between fixed nodes lo and hi.
// With a free end (hi === COUNT) the far part of the wire stays level with the finger.
function shape(s, g, k) {
  const [lo, hi] = span(s, g);
  if (k <= lo || (k >= hi && hi < COUNT)) return 0;
  if (k <= g) return (k - lo) / (g - lo);
  if (hi === COUNT) return 1;
  return (hi - k) / (hi - g);
}

export function grab(s, x, y) {
  if (s.grip || s.won || !Number.isFinite(y) ||
      !s.zones.some(([a, b]) => x >= a && x <= b)) return false;
  // Plain plates need the finger on the wire; the newer plates take the column,
  // so a finger can catch a moving wire in rhythm.
  if (Math.abs(y - BASE - at(s, x)) > (s.rich ? 60 : 29)) return false;
  const i = Math.round((x - LEFT) / SPACING);
  if (s.frets?.some(f => f.on && f.i === i)) return false;
  s.grip = { i, y, start: s.live ? 0 : s.u[i], depth: 0, travel: 0, oldU: s.u.slice(), oldV: s.v.slice() };
  return true;
}

export function pull(s, y) {
  const g = s.grip;
  if (!g || !Number.isFinite(y)) return;
  g.travel = y - g.y;
  g.depth = Math.max(0, Math.min(s.maxPull ?? MAX_PULL, g.travel + g.start));
  if (s.live) return; // The live wire keeps ringing under the finger; the pull is added on release.
  if (s.rich) {
    for (let i = 0; i < COUNT; i++) { s.u[i] = shape(s, g.i, i) * g.depth; s.v[i] = 0; }
    return;
  }
  for (let i = 0; i < COUNT; i++) {
    const slope = i <= g.i ? i / g.i : (COUNT - 1 - i) / (COUNT - 1 - g.i);
    s.u[i] = slope * g.depth;
    s.v[i] = 0;
  }
}
// What the drawing shows while a live wire is held: the ringing wire plus the pull.
export function heldShape(s) {
  const g = s.grip;
  if (!g || !s.live) return s.u;
  return s.u.map((y, i) => y + shape(s, g.i, i) * g.depth);
}

export function cancel(s) {
  if (!s.grip) return;
  if (!s.live) { s.u = s.grip.oldU; s.v = s.grip.oldV; }
  s.grip = null;
}

export function release(s) {
  if (!s.grip) return false;
  if (s.grip.depth < 5 || s.grip.travel < 5) { cancel(s); return false; }
  if (s.live) for (let i = 0; i < COUNT; i++) s.u[i] += shape(s, s.grip.i, i) * s.grip.depth;
  s.grip = null;
  s.plucks++;
  s.ringing = true;
  return true;
}

// Tap a brass fret to clamp the wire there, tap again to free it.
export function fret(s, k) {
  const f = s.frets?.[k];
  if (!f || s.grip || s.won) return false;
  f.on = !f.on;
  if (f.on) { s.u[f.i] = 0; s.v[f.i] = 0; }
  return true;
}

// Amplitude of harmonic n, from the wire's shape and velocity (sine projection).
const sines = [];
function sine(n) {
  if (!sines[n]) sines[n] = Array.from({ length: COUNT }, (_, i) => Math.sin(n * Math.PI * i / (COUNT - 1)));
  return sines[n];
}
export function harmonic(s, n) {
  const table = sine(n), w = SPEED * n * Math.PI / (COUNT - 1);
  let q = 0, dq = 0;
  for (let i = 1; i < COUNT - 1; i++) { q += s.u[i] * table[i]; dq += s.v[i] * table[i]; }
  q *= 2 / (COUNT - 1); dq *= 2 / (COUNT - 1);
  return Math.hypot(q, dq / w);
}
// Harmonic n of a pluck at fraction p of a string's length: proportional to sin(n pi p) / n^2.
export function partials(p, count = 6) {
  return Array.from({ length: count }, (_, k) => Math.sin((k + 1) * Math.PI * p) / (k + 1) ** 2);
}

const SPEED = 67; // Nodes per second; a pulse crosses the wire in 0.78 seconds.
const DRAG = Math.exp(-0.58 * TICK);
export function tick(s) {
  s.time = ++s.ticks * TICK;
  if (s.rich) return richTick(s);
  if (!s.ringing || s.grip) return;
  let movement = 0;
  for (let i = 1; i < COUNT - 1; i++) {
    const curvature = s.u[i - 1] + s.u[i + 1] - 2 * s.u[i];
    s.v[i] = DRAG * (s.v[i] + curvature * SPEED ** 2 * TICK);
  }
  for (let i = 1; i < COUNT - 1; i++) {
    s.u[i] += s.v[i] * TICK;
    movement = Math.max(movement, Math.abs(s.v[i]), Math.abs(s.u[i]));
  }
  for (const pod of s.pods) {
    if (!pod.open && -at(s, pod.x) >= pod.height) {
      pod.open = true;
      pod.openedAt = s.time;
    }
  }
  s.won = s.pods.every(p => p.open);
  if (movement < 0.15) {
    s.u.fill(0);
    s.v.fill(0);
    s.ringing = false;
  }
}

function richTick(s) {
  for (const pod of s.pods) if (pod.crackedAt !== null && s.time - pod.crackedAt > DOUBLE_WINDOW) pod.crackedAt = null;
  if (!s.ringing || (s.grip && !s.live)) return;
  const { u, v, mass, spring, drag } = s, last = s.free ? COUNT - 1 : COUNT - 2;
  const fixed = s.frets.filter(f => f.on).map(f => f.i);
  const c2 = SPEED ** 2;
  for (let i = 1; i <= last; i++) {
    const right = i === COUNT - 1 ? u[i - 1] : u[i + 1];
    const force = (u[i - 1] + right - 2 * u[i]) * c2 - spring[i] * u[i];
    v[i] = drag[i] * (v[i] + force / mass[i] * TICK);
  }
  for (const i of fixed) v[i] = 0;
  let movement = 0;
  for (let i = 1; i <= last; i++) {
    u[i] += v[i] * TICK;
    movement = Math.max(movement, Math.abs(v[i]), Math.abs(u[i]));
  }
  for (const pod of s.pods) {
    if (pod.open) continue;
    if (pod.type === 'tuned') {
      pod.ring = harmonic(s, pod.mode);
      pod.best = Math.max(pod.best, pod.ring / pod.height);
      pod.held = pod.ring >= pod.height ? pod.held + TICK : 0;
      if (pod.held >= TUNED_HOLD) { pod.open = true; pod.openedAt = s.time; }
      continue;
    }
    const reach = -at(s, podX(s, pod));
    pod.best = Math.max(pod.best, reach / pod.height);
    // A crest counts once: the wire must fall well clear of the pod before the next one counts.
    const touching = reach >= pod.height || (pod.touching && reach > pod.height * .6);
    if (touching && !pod.touching) {
      if (pod.type !== 'double' || (pod.crackedAt !== null && s.time - pod.crackedAt <= DOUBLE_WINDOW)) {
        pod.open = true; pod.openedAt = s.time;
      } else pod.crackedAt = s.time;
    }
    pod.touching = touching;
  }
  s.peak = movement;
  s.won = s.pods.every(p => p.open);
  if (movement < 0.15 && !s.grip) {
    u.fill(0);
    v.fill(0);
    s.ringing = false;
  }
}

// Pitch of the plucked span: shorter, tighter or lighter wires ring higher (f = sqrt(T / mu) / 2L).
export function pitchOf(s, i) {
  const spec = plates[s.level - 1];
  const [lo, hi] = s.rich ? span(s, i) : [0, COUNT - 1];
  const length = (hi === COUNT ? 2 * (hi - 1 - lo) : hi - lo) / (COUNT - 1);
  const p = hi === COUNT ? (i - lo) / (2 * (hi - 1 - lo)) : (i - lo) / (hi - lo);
  const heavy = s.rich ? s.mass.reduce((sum, m) => sum + m - 1, 0) : 0;
  const base = 98 * Math.sqrt(spec.tension ?? (1 + (s.level - 1) * .06)) / Math.sqrt(1 + heavy / (COUNT - 1));
  return { freq: base / length, position: Math.max(.02, Math.min(.98, p)) };
}

// A copy of the state for look-ahead (the solver and the daily par).
export function clone(s) {
  const c = { ...s, u: s.u.slice(), v: s.v.slice(), grip: null, pods: s.pods.map(p => ({ ...p })) };
  if (s.frets) c.frets = s.frets.map(f => ({ ...f }));
  return c;
}

// ---------- daily plate ----------
// One plate for everyone each UTC day: a plate from II to XVIII, with its pods moved by that day's seed.
export function dayNumber(iso) { return Math.floor(Date.parse(iso + 'T00:00:00Z') / 864e5); }
export function daily(iso) {
  const day = dayNumber(iso);
  let h = (day * 2654435761) >>> 0;
  h = (h ^ h >>> 15) >>> 0; h = Math.imul(h, 2246822519) >>> 0; h = (h ^ h >>> 13) >>> 0;
  const pool = plates.length - 1; // plates II-XVIII
  return { level: 2 + (h % pool), seed: (h ^ 0x9e3779b9) >>> 0, spread: 2.2 };
}
