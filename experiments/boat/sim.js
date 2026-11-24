// Paper Boat: all rules. Pure, seeded, fixed timestep; runs in Node (bots.mjs) and in the page (main.js).
// Units: the gutter is 1 wide (x from 0 to 1). y grows downstream. Speeds are widths per second.
export const DT = 1 / 60;
export const STAR_SOAK = 0.53; // third star requires more than 47% dry paper
export const U = 0.3; // base current
export const BOAT_R = 0.055;
export const CH = 2.2; // length of one generated piece of the daily stream
export const RIPPLE_LIFE = 1.6, STONE_LIFE = 7, MAX_RIPPLES = 4, MAX_STONES = 3;
export const PAW_R = 0.19, PAW_WARN = 1.3, PAW_DOWN = 0.25, BUG_R = 0.125, DRAIN_R = 0.065;

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const D = (x, y) => ({ k: 'drain', x, y });
const L = (x, y, r = 0.1) => ({ k: 'leaf', x, y, r });
const B = (x, y, kind = 'ladybird') => ({ k: 'bug', x, y, kind });
const P = (x, y, period = 3.4, phase = 0) => ({ k: 'paw', x, y, period, phase, side: x < 0.5 ? -1 : 1 });
const G = (y, h, dir) => ({ k: 'gush', y, h, dir });
const R = (y, h) => ({ k: 'rapid', y, h });

// Ten streets, hand-ordered. Each teaches one thing.
const RAW = [
  { name: 'Mill Lane', teach: 'ripple', len: 7, items: [B(0.76, 3.0), B(0.26, 5.0)] },
  { name: 'Grate Street', teach: 'drain', len: 8, items: [D(0.5, 3.4), B(0.76, 5.4)] },
  { name: 'Split Grate', teach: 'pebble', len: 9.5, items: [{ ...D(0.5, 2.8), grate: true }, B(0.74, 4.0), D(0.68, 5.4), B(0.28, 6.5), D(0.46, 7.8)] },
  { name: 'Leaf Fall', teach: 'leaf', len: 9.5, items: [L(0.3, 2.7), L(0.47, 2.8), L(0.63, 2.68), B(0.2, 4.4), L(0.55, 5.0), L(0.72, 5.1), L(0.88, 5.0), D(0.3, 6.7), B(0.74, 7.6)] },
  { name: 'Snail Corner', teach: 'snail', len: 10.5, items: [L(0.72, 3.0, 0.13), B(0.72, 3.0, 'snail'), D(0.4, 4.5), L(0.18, 5.8), L(0.34, 5.9), B(0.76, 6.4), D(0.64, 8.2)] },
  { name: 'Cat Alley', teach: 'paw', len: 10.5, items: [P(0.5, 3.3, 3.4, 0.6), B(0.26, 4.6), P(0.32, 6.2, 3.2, 1.5), D(0.72, 6.3), B(0.6, 8.2, 'snail')] },
  { name: 'Downpipe Row', teach: 'gush', len: 11.5, items: [G(2.5, 1.0, 1), D(0.84, 3.9), B(0.3, 4.8), G(5.6, 1.0, -1), L(0.12, 6.9), L(0.27, 7.0), B(0.74, 8.3, 'snail'), D(0.45, 9.6)] },
  { name: 'Steep Hill', teach: 'rapid', len: 13, items: [R(2.4, 3.8), B(0.72, 2.9), D(0.3, 3.7), D(0.7, 4.9), D(0.4, 6.0), P(0.5, 7.8, 3.2, 0.3), B(0.24, 9.1), L(0.6, 9.9), D(0.62, 10.8), D(0.26, 11.7)] },
  { name: 'Market Slalom', teach: 'mix', len: 13.5, items: [D(0.3, 2.6), L(0.7, 3.2), L(0.84, 3.3), D(0.62, 4.2), B(0.24, 4.6), P(0.4, 5.8, 3.0, 0.9), D(0.78, 6.6), G(7.2, 0.9, 1), D(0.86, 8.5), L(0.3, 8.9), B(0.5, 9.6, 'snail'), D(0.3, 10.6), D(0.7, 11.4), P(0.5, 12.3, 2.8, 0.2)] },
  { name: 'Pond Road', teach: 'all', len: 16, items: [D(0.5, 2.6), B(0.2, 3.3), G(3.8, 0.9, -1), D(0.14, 5.1), L(0.6, 5.5), L(0.76, 5.6), P(0.36, 6.7, 3.0, 0.5), B(0.72, 7.4, 'snail'), R(8.0, 3.0), D(0.3, 8.9), D(0.72, 9.9), D(0.42, 10.9), P(0.6, 12.1, 2.8, 1.1), L(0.2, 12.9), L(0.36, 13.0), B(0.26, 13.7), D(0.5, 14.5), D(0.22, 15.2), D(0.86, 15.1)] },
];
// Rapids come before the cross-current street: speed alone is gentler than a sideways gush.
[RAW[6], RAW[7]] = [RAW[7], RAW[6]];
// Passenger rescue, then timed paws, then the leaf corridor.
[RAW[3], RAW[4], RAW[5]] = [RAW[4], RAW[5], RAW[3]];
export const LEVELS = RAW.map((l, n) => ({
  ...l,
  n: n + 1,
  items: l.items.map((it, i) => ({ ...it, id: String(i) })),
  // A boat that never stalls arrives about 40% soaked; dawdling on leaves or under a paw costs the rest.
  soak: 0.42 / (l.len / (U * 0.92)),
  bugs: l.items.filter((it) => it.k === 'bug').length,
}));

const chunks = new Map();
export function chunk(seed, i) {
  const key = seed + ':' + i;
  let out = chunks.get(key);
  if (out) return out;
  out = [];
  if (i > 0) {
    const r = rng(Math.imul(seed | 0, 7919) + i * 104729), d = Math.min(1, i / 26), y0 = i * CH;
    const hazard = (y) => {
      const kinds = ['drain', 'leaves'];
      if (d > 0.08) kinds.push('drain2', 'paw');
      if (d > 0.2) kinds.push('gush');
      if (d > 0.3) kinds.push('rapid', 'drain2');
      const kind = kinds[Math.floor(r() * kinds.length)];
      if (kind === 'drain') out.push(D(0.2 + 0.6 * r(), y));
      else if (kind === 'drain2') { const x = 0.14 + 0.28 * r(); out.push(D(x, y), D(x + 0.44 + 0.1 * r(), y + 0.5 * r())); }
      else if (kind === 'leaves') { const left = r() < 0.5, n = 3 + (r() < d ? 1 : 0); for (let j = 0; j < n; j++) out.push(L(left ? 0.1 + j * 0.16 : 0.9 - j * 0.16, y + 0.1 * r())); }
      else if (kind === 'paw') out.push(P(0.25 + 0.5 * r(), y, 3.6 - 1.0 * d, 3 * r()));
      else if (kind === 'gush') { const dir = r() < 0.5 ? -1 : 1; out.push(G(y - 0.5, 0.8, dir), D(dir > 0 ? 0.84 : 0.16, y + 0.75)); }
      else { out.push(R(y - 0.3, 1.6), D(0.2 + 0.6 * r(), y + 0.5)); }
    };
    hazard(y0 + 0.5);
    if (r() < 0.25 + 0.6 * d) hazard(y0 + 1.5);
    if (r() < 0.6) out.push(B(0.18 + 0.64 * r(), y0 + 1.05, r() < 0.3 ? 'snail' : 'ladybird'));
    // Two drains side by side must leave a gap a boat can pass.
    const kept = [];
    for (const it of out) if (it.k !== 'drain' || !kept.some((o) => o.k === 'drain' && Math.abs(o.y - it.y) < 0.45 && Math.abs(o.x - it.x) < 0.42)) kept.push(it);
    out = kept;
    out.forEach((it, j) => (it.id = i + '-' + j));
  }
  chunks.set(key, out);
  if (chunks.size > 4000) chunks.clear();
  return out;
}
let lastKey = '', lastItems = [];
export function items(s, y0, y1) {
  if (!s.daily) return LEVELS[s.level - 1].items;
  const a = Math.max(0, Math.floor(y0 / CH)), b = Math.max(0, Math.floor(y1 / CH)), key = s.seed + ':' + a + ':' + b;
  if (key === lastKey) return lastItems;
  const out = [];
  for (let i = a; i <= b; i++) out.push(...chunk(s.seed, i));
  lastKey = key;
  lastItems = out;
  return out;
}

export function create({ level = 1, seed = 1, daily = false, mut = null } = {}) {
  const r = rng(seed * 2654435761 + level);
  return {
    level: daily ? 0 : level, seed, daily, mut, tick: 0,
    b: { x: 0.5, y: 0.3, vx: 0, vy: U, a: 0, wob: 0 },
    soak: 0, got: {}, riders: [], stones: [], ripples: [], pawHit: {}, over: null, ev: [],
    ph: [r() * 6.28, r() * 6.28], acts: 0,
  };
}
export const length = (s) => (s.daily ? Infinity : LEVELS[s.level - 1].len);
export const speedUp = (s, y) => (s.daily ? 1 + Math.min(0.6, Math.max(0, y) / 150) : 1);
export const soakRate = (s) => (s.daily ? 0.0125 + 0.00013 * s.b.y : LEVELS[s.level - 1].soak);
// A pebble upstream of the broad grate parts its intake into two safe currents.
export const grateParted = (s, it) => s.mut !== 'touch' && s.stones.some(st => Math.abs(st.x - (it.x - 0.08)) < 0.13 && Math.abs(st.y - (it.y - 0.22)) < 0.14);
export function pebbleHint(s) {
  if (s.daily || s.over) return null;
  const it = LEVELS[s.level - 1].items.find(it => it.grate && s.b.y < it.y + 0.15 && it.y - s.b.y < 1.3 && !grateParted(s, it));
  return it ? { k: 'pebble', x: it.x - 0.08, y: it.y - 0.22 } : null;
}
export function pawState(s, it) {
  const t = s.tick * DT + it.phase, c = t % it.period;
  return { cycle: Math.floor(t / it.period), warn: c >= it.period - PAW_WARN, down: c >= it.period - PAW_DOWN, c, left: it.period - c };
}

// The current at a point: base flow, meander, drains, the player's ripples and pebbles.
export function flow(s, x, y) {
  const t = s.tick * DT;
  let vx = 0.035 * Math.sin(y * 1.9 + s.ph[0] + t * 0.5) + 0.02 * Math.sin(y * 4.3 + s.ph[1] - t * 0.8);
  let vy = U * (0.74 + 0.26 * 4 * x * (1 - x)) * speedUp(s, y);
  for (const it of items(s, y - 1, y + 1)) {
    if (it.k === 'gush' || it.k === 'rapid') {
      if (y < it.y || y > it.y + it.h) continue;
      const e = Math.min(1, (y - it.y) / 0.15, (it.y + it.h - y) / 0.15);
      if (it.k === 'gush') vx += it.dir * 0.21 * e;
      else vy *= 1 + 0.75 * e;
      continue;
    }
    if (it.k !== 'drain' && it.k !== 'leaf') continue;
    const dx = x - it.x, dy = y - it.y, d2 = dx * dx + dy * dy;
    if (d2 > 0.3) continue;
    const d = Math.sqrt(d2) || 1e-6;
    if (it.k === 'drain') { const p = (it.grate && grateParted(s, it) ? 0.08 : 0.42) * Math.exp(-d2 / 0.029); vx -= (dx / d) * p; vy -= (dy / d) * p; }
    else { const p = 0.05 * Math.exp(-d2 / 0.02); vx += (dx / d) * p; }
  }
  if (s.mut !== 'touch') {
    for (const st of s.stones) {
      const dx = x - st.x, dy = y - st.y, d2 = dx * dx + dy * dy;
      if (d2 > 0.2) continue;
      const d = Math.sqrt(d2) || 1e-6, p = 0.46 * Math.exp(-d2 / 0.024) * Math.min(1, (STONE_LIFE - st.age) / 0.5);
      vx += (dx / d) * p; vy += (dy / d) * p * 0.6;
    }
    for (const rp of s.ripples) {
      const dx = x - rp.x, dy = y - rp.y, d2 = dx * dx + dy * dy;
      if (d2 > 0.3) continue;
      const p = rp.a * 0.85 * Math.exp(-d2 / 0.05) * (1 - rp.age / RIPPLE_LIFE);
      vx += rp.dx * p; vy += rp.dy * p;
    }
  }
  return [vx, vy];
}

// acts: [{k:'ripple', x, y, dx, dy, a}] (dx,dy a unit vector, a from 0.3 to 1) or [{k:'pebble', x, y}]
export function step(s, acts = []) {
  s.ev.length = 0;
  if (s.over) return s;
  const b = s.b;
  for (const a of acts) {
    s.acts++;
    if (a.k === 'ripple') {
      // Splash costs paper even on a fast run; distant ripples do not wet the boat.
      s.soak += 0.02 * Math.max(0.3, Math.min(1, a.a ?? 1)) * Math.exp(-((a.x - b.x) ** 2 + (a.y - b.y) ** 2) / 0.06);
      const m = Math.hypot(a.dx, a.dy) || 1;
      s.ripples.push({ x: a.x, y: a.y, dx: a.dx / m, dy: a.dy / m, a: Math.max(0.3, Math.min(1, a.a ?? 1)), age: 0 });
      if (s.ripples.length > MAX_RIPPLES) s.ripples.shift();
      s.ev.push({ type: 'ripple', x: a.x, y: a.y });
    } else if (a.k === 'pebble') {
      let x = Math.max(0.04, Math.min(0.96, a.x)), y = a.y;
      const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy);
      if (d < 0.11) { const ux = d ? dx / d : 0, uy = d ? dy / d : 1; x = b.x + ux * 0.11; y = b.y + uy * 0.11; }
      s.stones.push({ x, y, age: 0 });
      if (s.stones.length > MAX_STONES) s.stones.shift();
      s.ev.push({ type: 'pebble', x, y });
    }
  }
  s.tick++;
  for (const rp of s.ripples) { rp.age += DT; rp.x += rp.dx * 0.5 * DT; rp.y += rp.dy * 0.5 * DT; }
  s.ripples = s.ripples.filter((rp) => rp.age < RIPPLE_LIFE);
  for (const st of s.stones) st.age += DT;
  s.stones = s.stones.filter((st) => st.age < STONE_LIFE);

  const [fx, fy] = flow(s, b.x, b.y);
  let drag = 1, rate = soakRate(s) * (s.riders.includes('snail') ? 0.5 : 1);
  const near = items(s, b.y - 1, b.y + 1);
  for (const it of near) {
    if (it.k === 'gush' || it.k === 'rapid') continue;
    const d = Math.hypot(b.x - it.x, b.y - it.y);
    if (it.k === 'leaf' && d < it.r + BOAT_R * 0.6) {
      drag = 0.3; rate += 0.085;
      if (!b.inLeaf) s.ev.push({ type: 'leaf', x: it.x, y: it.y });
      b.inLeaf = 2;
    } else if (it.k === 'drain' && (it.grate ? Math.abs(b.y - it.y) < DRAIN_R && (!grateParted(s, it) || d < DRAIN_R) : d < DRAIN_R) && s.mut !== 'drain') {
      s.over = 'drain'; s.ev.push({ type: 'drain', x: it.x, y: it.y });
    } else if (it.k === 'bug' && !s.got[it.id] && d < BUG_R) {
      s.got[it.id] = 1; s.riders.push(it.kind); s.soak = Math.max(0, s.soak - (s.daily ? 0.16 : 0.08));
      b.wob = 1; s.ev.push({ type: 'pickup', kind: it.kind, x: it.x, y: it.y, id: it.id });
    } else if (it.k === 'paw') {
      const p = pawState(s, it);
      if (p.down && s.pawHit[it.id] !== p.cycle) {
        s.pawHit[it.id] = p.cycle;
        const hit = d < PAW_R;
        s.ev.push({ type: hit ? 'swat' : 'paw', x: it.x, y: it.y });
        if (hit) { s.soak += 0.3; b.vy += 0.5; b.vx += (b.x - it.x >= 0 ? 1 : -1) * 0.35; b.wob = 1.6; }
      }
    }
  }
  if (b.inLeaf) b.inLeaf--;
  b.vx += (fx * drag - b.vx) * 5 * DT;
  b.vy += (fy * drag - b.vy) * 5 * DT;
  b.x += b.vx * DT; b.y += b.vy * DT;
  for (const st of s.stones) {
    const dx = b.x - st.x, dy = b.y - st.y, d = Math.hypot(dx, dy), min = BOAT_R + 0.035;
    if (d < min && d > 0) { b.x = st.x + (dx / d) * min; b.y = st.y + (dy / d) * min; if (b.wob < 0.4) { b.wob = 0.6; s.ev.push({ type: 'knock', x: st.x, y: st.y }); } }
  }
  const lo = BOAT_R + 0.01, hi = 1 - lo;
  if (b.x < lo || b.x > hi) {
    if (Math.abs(b.vx) > 0.12) { s.ev.push({ type: 'bump', x: b.x < lo ? 0 : 1, y: b.y }); s.soak += 0.015; b.wob = 1; }
    b.x = b.x < lo ? lo : hi; b.vx *= -0.35;
  }
  // Heading follows travel; wobble dies away.
  const want = Math.atan2(b.vx, Math.max(0.05, b.vy));
  b.a += (want - b.a) * 6 * DT;
  b.wob *= 1 - 2.2 * DT;
  s.soak += rate * DT;
  if (!s.over && b.y >= length(s)) { s.over = 'win'; s.ev.push({ type: 'win', x: b.x, y: b.y }); }
  if (!s.over && s.soak >= 1) { s.soak = 1; s.over = 'soak'; s.ev.push({ type: 'sink', x: b.x, y: b.y }); }
  return s;
}

export function stars(s) {
  if (s.over !== 'win') return 0;
  const all = s.riders.length >= LEVELS[s.level - 1].bugs;
  return 1 + (all ? 1 : 0) + (all && s.soak < STAR_SOAK ? 1 : 0);
}
export const score = (s) => Math.max(0, Math.floor((s.b.y - 0.3) * 10)) + s.riders.length * 25;
export function dailySeed(date = new Date()) {
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

// ---- The careful policy: tries each move on a copy of the stream and keeps the one that ends best. ----
function value(c) {
  if (c.over === 'win') return 1e5 + c.riders.length * 300 - c.soak * 100;
  if (c.over) return -1e5 + c.tick;
  const b = c.b;
  let v = c.riders.length * 300 - c.soak * 260 + b.y * 30, bug = null;
  for (const it of items(c, b.y - 1, b.y + 3.2)) {
    const dy = it.y - b.y;
    if (it.k === 'bug') { if (!c.got[it.id] && dy > 0.02 && (!bug || it.y < bug.y)) bug = it; continue; }
    if (it.k === 'gush' || it.k === 'rapid' || dy < -0.05 || dy > 1.3) continue;
    const w = it.k === 'drain' ? 0.3 : it.k === 'paw' ? 0.26 : 0.2, dx = Math.abs(b.x - it.x);
    if (dx < w) v -= (w - dx) * (it.k === 'leaf' ? 90 : 200);
  }
  if (bug) v -= Math.abs(b.x - bug.x) * 90 * Math.max(0.25, 1 - (bug.y - b.y) / 3.2);
  else v -= Math.abs(b.x - 0.5) * 10;
  return v;
}
export function candidates(s) {
  const b = s.b, out = [null];
  const tap = pebbleHint(s);
  if (tap) out.push(tap);
  for (const dir of [-1, 1]) {
    out.push({ k: 'ripple', x: b.x - dir * 0.1, y: b.y + 0.03, dx: dir, dy: 0, a: 1 });
    out.push({ k: 'ripple', x: b.x - dir * 0.1, y: b.y + 0.03, dx: dir, dy: 0, a: 0.5 });
    out.push({ k: 'pebble', x: b.x + dir * 0.1, y: b.y + 0.15 });
  }
  out.push({ k: 'ripple', x: b.x, y: b.y + 0.14, dx: 0, dy: -1, a: 1 });
  out.push({ k: 'ripple', x: b.x, y: b.y - 0.12, dx: 0, dy: 1, a: 1 });
  return out;
}
export function advise(s, horizon = 190) {
  let best = null, top = -Infinity;
  for (const cand of candidates(s)) {
    const c = structuredClone(s);
    step(c, cand ? [cand] : []);
    for (let i = 0; i < horizon && !c.over; i++) step(c);
    const v = value(c) - (cand ? 3 : 0);
    if (v > top) { top = v; best = cand; }
  }
  return best;
}
// Plays a whole run with a policy. policy(s) gives an action or null; `every` ticks between decisions, `rest` after acting.
export function play(s, policy, { every = 10, rest = 26, limit = 60 * 600 } = {}) {
  let wait = 0;
  while (!s.over && s.tick < limit) {
    let acts = [];
    if (wait <= 0) { const a = policy(s); if (a) { acts = [a]; wait = rest; } else wait = every; }
    wait--;
    step(s, acts);
  }
  return s;
}
