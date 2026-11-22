// Lantern: pure, seeded simulation. No DOM. One tick is 1/60 s; the only input is a target x in [0, 1].
// A stage is one river. Later stages are faster and add ice floes and swinging rocks.
export const DT = 1 / 60;
export const GOAL = 78; // river length; about ninety seconds
export const BOAT = 0.022;

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
// The river narrows all the way down and pinches hard in the last tenth.
export function half(y) { const k = Math.min(1, y / GOAL); return 0.27 - 0.07 * k - 0.035 * Math.max(0, (k - 0.88) / 0.12); }
export function speed(s) { return (0.62 + 0.62 * Math.min(1, s.y / GOAL)) * (1 + 0.08 * (s.stage - 1)); }
export function reach(light) { return 0.17 + 0.6 * light; }

export function create(seed, stage = 1) {
  const r = rng(seed);
  const s = { seed, stage, warm: 0, shield: 0, safe: 0, nextBlue: 9 + r() * 5, r, p1: r() * 6.28, p2: r() * 6.28, t: 0, y: 0, x: 0.5, light: 0.8, rocks: [], embers: [], next: 2.2, events: [], over: null, taken: 0, grazes: 0 };
  s.x = centre(s, 0);
  return s;
}

function spawn(s) {
  // One row at a time, well ahead of the light, so the same seed always gives the same river.
  while (s.next < s.y + 2.4) {
    const y = s.next, c = centre(s, y), h = half(y), k = Math.min(1, y / GOAL);
    const rad = 0.03 + s.r() * 0.03;
    const off = (s.r() * 2 - 1) * (h - rad - 0.01);
    const rock = { x: c + off, x0: c + off, y, rad, a: 0, w: 0, ph: 0, vy: 0, ice: false, grazed: false };
    // Difficulty rises inside a stage as well as between stages: rocks start to swing past the halfway mark.
    if (s.stage >= 2 && s.r() < 0.3) { rock.ice = true; rock.rad = 0.05 + s.r() * 0.025; rock.vy = 0.22; rock.x0 = rock.x = c + (s.r() * 2 - 1) * (h - rock.rad - 0.01); }
    else if (s.r() < Math.min(0.7, Math.max(0, (k - 0.5) * 1.1) + 0.3 * (s.stage - 1) * (s.stage >= 3 ? 1 : 0.4))) {
      rock.a = Math.min(0.09, Math.max(0, h - Math.abs(off) - rad - 0.01)); rock.w = 1.4 + s.r() * 1.2; rock.ph = s.r() * 6.28;
    }
    s.rocks.push(rock);
    if (s.r() < 0.3 + 0.3 * k) {
      // A second rock on the far side leaves one clear channel.
      const rad2 = 0.028 + s.r() * 0.02, side = off > 0 ? -1 : 1;
      const off2 = side * (0.08 + s.r() * (h - rad2 - 0.09));
      if (!rock.ice && !rock.a && Math.abs(off2 - off) > rad + rad2 + 0.11) s.rocks.push({ x: c + off2, x0: c + off2, y: y + (s.r() - 0.5) * 0.2, rad: rad2, a: 0, w: 0, ph: 0, vy: 0, ice: false, grazed: false });
    }
    if (s.r() < 0.62) {
      // Embers sit beside the rock more often than in open water: light costs nerve.
      const near = s.r() < 0.55, ey = y + (near ? 0 : 0.45), ec = centre(s, ey), eh = half(ey);
      let ex = near ? c + off + (off > 0 ? -1 : 1) * (rad + 0.05) : ec + (s.r() * 2 - 1) * (eh - 0.05);
      ex = Math.max(ec - eh + 0.04, Math.min(ec + eh - 0.04, ex));
      s.embers.push({ x: ex, y: ey, got: false, blue: false });
    }
    if (y > s.nextBlue) {
      // A blue ember is a shield: it takes one hit for you. Rare, and always in open water.
      const by = y + 0.5, bc = centre(s, by);
      s.embers.push({ x: bc + (s.r() * 2 - 1) * (half(by) - 0.07), y: by, got: false, blue: true });
      s.nextBlue = y + 16 + s.r() * 8;
    }
    s.next += 0.95 - 0.3 * k + s.r() * 0.35;
  }
}

export function step(s, target) {
  s.events.length = 0;
  if (s.over) return s;
  spawn(s);
  s.t += DT;
  s.y += speed(s) * DT;
  const max = 0.95 * DT, dx = Math.max(0, Math.min(1, target)) - s.x;
  s.x += Math.max(-max, Math.min(max, dx));
  // An ember holds the flame steady for a moment before it starts to fade again.
  s.warm = Math.max(0, s.warm - DT); s.safe = Math.max(0, s.safe - DT);
  if (!s.warm) s.light -= (0.04 + 0.025 * Math.min(1, s.y / GOAL)) * DT;
  for (const e of s.embers) if (!e.got && Math.hypot(e.x - s.x, e.y - s.y) < 0.05) {
    e.got = true;
    if (e.blue) { s.shield = 1; s.events.push('shield'); }
    else { s.taken++; s.light = Math.min(1, s.light + 0.3); s.warm = 2.5; s.events.push('ember'); }
  }
  for (const k of s.rocks) {
    if (k.a) k.x = k.x0 + k.a * Math.sin(s.t * k.w + k.ph);
    k.y += k.vy * DT;
    const d = Math.hypot(k.x - s.x, k.y - s.y) - k.rad - BOAT;
    if (d < 0 && !s.safe) {
      if (s.shield) { s.shield = 0; s.safe = 1.2; s.events.push('break'); continue; }
      s.over = k.ice ? 'ice' : 'rock'; s.events.push('hit'); return s;
    }
    if (!k.grazed && d < 0.022 && k.y < s.y) { k.grazed = true; s.grazes++; s.light = Math.min(1, s.light + 0.05); s.events.push('graze'); }
  }
  const c = centre(s, s.y), edge = half(s.y) - BOAT;
  if (Math.abs(s.x - c) > edge) {
    if (s.shield) { s.shield = 0; s.safe = 1.2; s.x = c + Math.sign(s.x - c) * (edge - 0.03); s.events.push('break'); }
    else { s.over = 'bank'; s.events.push('hit'); return s; }
  }
  if (s.light <= 0) { s.light = 0; s.over = 'dark'; s.events.push('out'); return s; }
  if (s.y >= GOAL) { s.over = 'dawn'; s.events.push('dawn'); }
  if (s.rocks.length && s.rocks[0].y < s.y - 1) s.rocks = s.rocks.filter(k => k.y >= s.y - 1);
  while (s.embers.length && s.embers[0].y < s.y - 1) s.embers.shift();
  return s;
}
