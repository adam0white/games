// Pass the Flame: one leg of the river. Pure and seeded: no window, no document, no Math.random.
// Units are metres and seconds. The boat goes forward (d grows) at a steady speed; the player steers its offset from
// the river's centre line. Bends push a boat outward, so a boat nobody steers drifts into the banks; rocks wait from
// eight seconds on; embers raise the flame. The leg ends at the buoy (handoff) or when the flame reaches zero (drop).

export const DT = 1 / 60, SPEED = 30, NO_ROCKS = 8 * SPEED, BOAT_R = 2.1;
export const EMBER = 0.085, DRAIN = 0.007, ROCK = 0.2, BUMP = 0.07, SCRAPE = 0.09;
// A guttering flame clings: a blow takes less from a weak flame than from a strong one.
export const cling = f => 0.45 + 0.55 * Math.max(0, Math.min(1, f));
export const radius = flame => 13 + 47 * Math.max(0, Math.min(1, flame)); // metres of light around the lantern

export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// The river for a seed: centre line and half width at any distance, the same everywhere for the same seed.
export function river(seed) {
  const r = rng(seed ^ 0x51f15e);
  const w = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
  const amp = [18 + r() * 10, 7 + r() * 6, 2 + r() * 3], len = [210 + r() * 90, 95 + r() * 40, 41 + r() * 14];
  const ease = d => { const u = Math.max(0, Math.min(1, (d - 130) / 560)); return u * u * (3 - 2 * u); };
  const center = d => ease(d) * (amp[0] * Math.sin(d / len[0] + w[0]) + amp[1] * Math.sin(d / len[1] + w[1]) + amp[2] * Math.sin(d / len[2] + w[2]));
  const half = d => {
    const base = 23 + 5 * Math.sin(d / 170 + w[3]) + 3 * Math.sin(d / 63 + w[4]);
    return d < 200 ? base + (200 - Math.max(0, d)) * 0.03 : base;
  };
  const curve = d => (center(d + 4) - 2 * center(d) + center(d - 4)) / 16; // second derivative, 1/m
  return { center, half, curve };
}

export function leg(seed, { flame = 1, length = null } = {}) {
  const r = rng(seed), rv = river(seed);
  const L = length ?? Math.round(1700 + r() * 260);
  const rocks = [], embers = [];
  // embers: the first one straight ahead and easy, then one every 55 to 95 m, sometimes a short arc of three
  embers.push({ d: 105, o: 0, taken: false });
  if (flame < 0.5) embers.push({ d: 160, o: 0, taken: false }, { d: 205, o: 0, taken: false }, { d: 250, o: 0, taken: false });
  for (let d = 275 + r() * 30; d < L - 40; d += 68 + r() * 45) {
    const hw = rv.half(d) - 5, o = (r() * 2 - 1) * hw;
    if (r() < 0.22) { const s = r() < 0.5 ? -1 : 1; for (let k = 0; k < 3; k++) embers.push({ d: d + k * 9, o: Math.max(-hw, Math.min(hw, o + s * k * 3.5)), taken: false }); d += 18; }
    else embers.push({ d, o, taken: false });
  }
  // rocks: from eight seconds on, groups of one to three with a clear lane of at least 11 m
  for (let d = NO_ROCKS + 20 + r() * 30; d < L - 60; d += (d < 620 ? 44 : 30) + r() * 36 - Math.min(10, d / 180)) {
    const hw = rv.half(d) - 2, early = d < 620, lane = early ? 0 : (r() * 2 - 1) * (hw - 7), n = early ? 1 : 1 + Math.floor(r() * (d > 900 ? 3 : 2));
    for (let k = 0; k < n; k++) {
      for (let tries = 0; tries < 8; tries++) {
        const o = (r() * 2 - 1) * hw, size = 1.5 + r() * 1.8;
        if (Math.abs(o - lane) < (early ? 9 : 5.5) + size) continue;
        if (rocks.some(q => Math.abs(q.d - d) < 12 && Math.abs(q.o - o) < q.r + size + 1)) continue;
        rocks.push({ d: d + (r() * 2 - 1) * 4, o, r: size, spin: r() * 6.28, hit: 0 });
        break;
      }
    }
  }
  rocks.sort((a, b) => a.d - b.d);
  for (const e of embers) for (const q of rocks) if (Math.abs(q.d - e.d) < q.r + 5 && Math.abs(q.o - e.o) < q.r + 5) e.o = q.o + (e.o >= q.o ? 1 : -1) * (q.r + 5.5);
  for (const e of embers) { const hw = rv.half(e.d) - 4; e.o = Math.max(-hw, Math.min(hw, e.o)); }
  return {
    seed, L, river: rv, rocks, embers, t: 0, d: 0, o: 0, vo: 0, target: null,
    flame: Math.max(0.01, Math.min(1, flame)), start: flame, done: false, outcome: null,
    cool: 0, bank: 0, taken: 0, hits: 0, bumps: 0, minFlame: flame, events: [],
    get progress() { return Math.min(1, this.d / this.L); },
    get x() { return this.river.center(this.d) + this.o; },
  };
}

// One fixed step. target: the offset the player asks for, or null for a boat nobody steers. Returns this step's events.
export function step(s, target = s.target) {
  if (s.done) return [];
  const ev = [], rv = s.river;
  s.target = target;
  s.t += DT; s.d += SPEED * DT;
  const hw = rv.half(s.d), drift = Math.max(-12, Math.min(12, -rv.curve(s.d) * SPEED * SPEED * 5));
  if (target === null) s.vo += ((drift - s.o * 0.06) - s.vo) * Math.min(1, DT * 3);
  else s.vo += ((Math.max(-26, Math.min(26, (target - s.o) * 6)) + drift * 0.35) - s.vo) * Math.min(1, DT * 14);
  s.o += s.vo * DT;
  s.cool = Math.max(0, s.cool - DT);
  // banks
  const edge = hw - BOAT_R;
  if (Math.abs(s.o) > edge) {
    const side = Math.sign(s.o);
    s.o = side * (edge - 0.3); s.vo = -side * 6;
    if (s.bank <= 0) { s.flame -= BUMP * cling(s.flame); s.bumps++; ev.push({ type: 'hit', what: 'bank', side }); }
    s.bank = 0.5; s.flame -= SCRAPE * DT;
  } else s.bank = Math.max(0, s.bank - DT);
  // rocks
  for (const q of s.rocks) {
    if (q.d < s.d - 8) continue; if (q.d > s.d + 8) break;
    const dd = q.d - s.d, dx = q.o - s.o, gap = Math.hypot(dd * 0.55, dx) - q.r - BOAT_R;
    if (gap < 0 && s.cool <= 0) {
      const side = dx >= 0 ? -1 : 1;
      s.flame -= ROCK * cling(s.flame); s.hits++; s.cool = 0.9; q.hit = s.t;
      s.vo = side * 16; s.o += side * Math.min(2, -gap);
      ev.push({ type: 'hit', what: 'rock', side });
    }
  }
  // embers
  for (const e of s.embers) {
    if (e.taken || e.d < s.d - 5) continue; if (e.d > s.d + 5) break;
    if (Math.hypot((e.d - s.d) * 0.7, e.o - s.o) < 4.2) { e.taken = true; s.taken++; s.flame = Math.min(1, s.flame + EMBER); ev.push({ type: 'ember', n: s.taken }); }
  }
  s.flame -= DRAIN * DT;
  s.minFlame = Math.min(s.minFlame, s.flame);
  if (s.flame <= 0) { s.flame = 0; s.done = true; s.outcome = 'drop'; ev.push({ type: 'drop', d: s.d }); }
  else if (s.d >= s.L) { s.d = s.L; s.done = true; s.outcome = 'handoff'; ev.push({ type: 'handoff', d: s.d }); }
  for (const e of ev) s.events.push(e);
  if (s.events.length > 200) s.events.splice(0, s.events.length - 200);
  return ev;
}

// The scripted policy check.mjs uses: steer for the next ember that is safe, keep clear of rocks ahead.
export function seeker(s, { look = 75, react = 0 } = {}) {
  const rv = s.river, hw = rv.half(s.d) - BOAT_R - 1.5;
  const next = s.embers.find(e => !e.taken && e.d > s.d + 2 && e.d < s.d + look);
  let want = next ? next.o : 0;
  const ahead = s.rocks.filter(q => q.d > s.d - 4 && q.d < s.d + 34);
  let best = want, bestCost = Infinity;
  for (let c = -hw; c <= hw; c += 0.75) {
    let cost = Math.abs(c - want) * 0.4 + Math.abs(c - s.o) * 0.08;
    for (const q of ahead) { const clear = Math.abs(q.o - c) - q.r - BOAT_R - 1.6; if (clear < 0) cost += 60 - clear * 10; }
    if (cost < bestCost) { bestCost = cost; best = c; }
  }
  return best + react;
}

export function run(seed, policy, opts = {}) {
  const s = leg(seed, opts);
  while (!s.done && s.t < 200) step(s, policy ? policy(s) : null);
  return s;
}
