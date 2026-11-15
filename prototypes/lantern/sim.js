// Lantern: pure, seeded simulation. No DOM. One tick is 1/60 s; the only input is a target x in [0, 1].
export const DT = 1 / 60;
export const GOAL = 78; // river length; about ninety seconds
const BOAT = 0.022;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function centre(s, y) { return 0.5 + 0.17 * Math.sin(y * 0.33 + s.p1) + 0.07 * Math.sin(y * 0.81 + s.p2); }
export function half(y) { return 0.27 - 0.07 * Math.min(1, y / GOAL); }
export function speed(y) { return 0.62 + 0.5 * Math.min(1, y / GOAL); }
export function reach(light) { return 0.2 + 0.5 * light; }

export function create(seed) {
  const r = rng(seed);
  const s = { seed, r, p1: r() * 6.28, p2: r() * 6.28, t: 0, y: 0, x: 0.5, light: 0.8, rocks: [], embers: [], next: 2.2, events: [], over: null, taken: 0, grazes: 0 };
  s.x = centre(s, 0);
  return s;
}

function spawn(s) {
  // One row at a time, well ahead of the light, so the same seed always gives the same river.
  while (s.next < s.y + 2.4) {
    const y = s.next, c = centre(s, y), h = half(y), k = Math.min(1, y / GOAL);
    const rad = 0.03 + s.r() * 0.03;
    const off = (s.r() * 2 - 1) * (h - rad - 0.01);
    s.rocks.push({ x: c + off, y, rad, grazed: false });
    if (s.r() < 0.3 + 0.3 * k) {
      // A second rock on the far side leaves one clear channel.
      const rad2 = 0.028 + s.r() * 0.02, side = off > 0 ? -1 : 1;
      const off2 = side * (0.08 + s.r() * (h - rad2 - 0.09));
      if (Math.abs(off2 - off) > rad + rad2 + 0.11) s.rocks.push({ x: c + off2, y: y + (s.r() - 0.5) * 0.2, rad: rad2, grazed: false });
    }
    if (s.r() < 0.62) {
      // Embers sit beside the rock more often than in open water: light costs nerve.
      const near = s.r() < 0.55, ey = y + (near ? 0 : 0.45), ec = centre(s, ey), eh = half(ey);
      let ex = near ? c + off + (off > 0 ? -1 : 1) * (rad + 0.05) : ec + (s.r() * 2 - 1) * (eh - 0.05);
      ex = Math.max(ec - eh + 0.04, Math.min(ec + eh - 0.04, ex));
      s.embers.push({ x: ex, y: ey, got: false });
    }
    s.next += 0.95 - 0.3 * k + s.r() * 0.35;
  }
}

export function step(s, target) {
  s.events.length = 0;
  if (s.over) return s;
  spawn(s);
  s.t += DT;
  s.y += speed(s.y) * DT;
  const max = 0.95 * DT, dx = Math.max(0, Math.min(1, target)) - s.x;
  s.x += Math.max(-max, Math.min(max, dx));
  s.light -= (0.042 + 0.028 * Math.min(1, s.y / GOAL)) * DT;
  for (const e of s.embers) if (!e.got && Math.hypot(e.x - s.x, e.y - s.y) < 0.05) {
    e.got = true; s.taken++; s.light = Math.min(1, s.light + 0.2); s.events.push('ember');
  }
  for (const k of s.rocks) {
    const d = Math.hypot(k.x - s.x, k.y - s.y) - k.rad - BOAT;
    if (d < 0) { s.over = 'rock'; s.events.push('hit'); return s; }
    if (!k.grazed && d < 0.022 && k.y < s.y) { k.grazed = true; s.grazes++; s.light = Math.min(1, s.light + 0.05); s.events.push('graze'); }
  }
  if (Math.abs(s.x - centre(s, s.y)) > half(s.y) - BOAT) { s.over = 'bank'; s.events.push('hit'); return s; }
  if (s.light <= 0) { s.light = 0; s.over = 'dark'; s.events.push('out'); return s; }
  if (s.y >= GOAL) { s.over = 'dawn'; s.events.push('dawn'); }
  while (s.rocks.length && s.rocks[0].y < s.y - 1) s.rocks.shift();
  while (s.embers.length && s.embers[0].y < s.y - 1) s.embers.shift();
  return s;
}
