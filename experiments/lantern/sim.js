// Lantern: pure, seeded simulation. No DOM. One tick is 1/60 s; the only input is a target x in [0, 1].
// Story: a night is one river of length GOAL; each night is harder and every night from 2 to 20 adds one new thing.
// Endless: one river with no dawn; it gets harder every 300 points (10 points a second).
export const DT = 1 / 60;
export const GOAL = 78; // river length; about ninety seconds
export const BOAT = 0.022;
export const NIGHTS = 20;
// Powers are rare pickups: boost (fast and unbreakable for a moment), slow (the river slows, the way to dawn does not), size (a smaller boat four times in five, a bigger one otherwise).
// magnet (embers swim to the boat) and flare (the flame is filled and does not fade) are the lab's own two.
export const POWERS = ['boost', 'slow', 'size', 'magnet', 'flare'];
export const LAST = { boost: 2.5, slow: 5, size: 6, magnet: 7, flare: 6 };
// Stats are bought with embers and kept between runs. Each is a level from 0: hearts (start with more), barrier (hits a shield takes),
// calm (the river runs 4% slower a level), wick (the flame fades 8% slower a level), pull (pickups are taken from further away).
export const STATS = { hearts: 2, barrier: 2, calm: 3, wick: 3, pull: 3 }; // the top level of each

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function score(s) { return Math.floor(s.t * 10 + s.extra); } // a boost on the endless river scores the extra river it covers
// The boat's size, and how far to dawn (0 to 1). Slow water credits the distance it holds back, so the count keeps its speed.
export function boat(s) { return BOAT * (s.size ? (s.big ? 1.4 : 0.6) : 1); }
export function progress(s) { return Math.min(1, (s.y + s.bonus) / GOAL); }
// Difficulty step: the night in story, one step per 300 points in endless.
export function level(s) { return s.endless ? 1 + Math.floor(Math.floor(s.t * 10) / 300) : s.stage; }
// The tower: the river climbs in tight turns that ease as it rises, and runs dead straight for the last stretch before dawn.
export const FLOORS = 10;
export function centre(s, y) {
  if (s.tower) { const a = Math.max(0, Math.min(1, 1 - y / (0.85 * GOAL))); return 0.5 + a * (0.25 * Math.sin(y * 0.55 + s.p1) + 0.06 * Math.sin(y * 1.3 + s.p2)); }
  return 0.5 + 0.17 * Math.sin(y * 0.33 + s.p1) + 0.07 * Math.sin(y * 0.81 + s.p2);
}
// The river narrows all the way down. A story night pinches hard in its last tenth; the endless river keeps narrowing slowly.
export function half(s, y) {
  const k = Math.min(1, y / GOAL);
  if (s.endless) return Math.max(0.16, 0.27 - 0.07 * k - 0.012 * Math.max(0, y / GOAL - 1));
  return 0.27 - 0.07 * k - 0.035 * Math.max(0, (k - 0.88) / 0.12);
}
// The waterfall: a short stretch of fast water, from night 5 at the halfway mark and every 60 units of the endless river.
export function fall(s, y) {
  let d;
  if (s.endless) d = (y + 20) % 60; else if (s.stage >= 16 && y > GOAL * 0.7) d = y - GOAL * 0.8; else if (s.stage >= 5) d = y - GOAL * 0.5; else return 0;
  return d >= 0 && d < 3 ? Math.sin(d / 3 * Math.PI) : 0;
}
function pace(s) { return 1 + (s.endless ? 0.05 : 0.035) * Math.min(24, level(s) - 1); }
export function speed(s) { return (0.62 + 0.62 * Math.min(1, s.y / GOAL)) * pace(s) * (1 + 0.7 * fall(s, s.y)) * (s.boost ? 1.8 : 1) * s.calm; }
export function reach(light) { return 0.17 + 0.6 * light; }
// Stretches of weather, each a fixed length of river that comes round again. Night 7 fog, night 9 wind, night 13 rain.
function zone(s, y, from, period, len, off) { return level(s) >= from && y > 8 && (y + off) % period < len; }
export const fog = (s, y) => zone(s, y, 7, 26, 5, 18); // the first stretch of each starts about a tenth of the way down
export const wind = (s, y) => zone(s, y, 9, 25, 4, 13) ? (Math.floor((y + 13) / 25) % 2 ? 1 : -1) : 0; // -1 blows left, 1 right
export const rain = (s, y) => zone(s, y, 13, 37, 6, 27);
// Night 19 lightning, every nine seconds: -1 during the flash, 1 while the eyes recover, else 0.
export function dazzle(s) { if (level(s) < 19) return 0; const p = (s.t + 2) % 9; return p < 0.35 ? -1 : p < 2.4 ? 1 : 0; }
// How far the boat can see: the flame's reach, cut by fog and by the moments after lightning.
export function sight(s) { return reach(s.light) * (fog(s, s.y) ? 0.6 : 1) * (dazzle(s) > 0 ? 0.6 : 1); }

export function create(seed, stage = 1, mode = false, powers = POWERS, stats = {}) { // mode: false for a story night, true for the endless river, 'tower' for the climb
  const endless = mode === true, tower = mode === 'tower';
  const st = Object.fromEntries(Object.entries(STATS).map(([k, top]) => [k, Math.max(0, Math.min(top, Math.floor(stats[k] || 0)))]));
  const r = rng(seed), q = rng(seed ^ 0x9e3779b9); // powers draw from their own stream, so the rocks and embers of a seed never change
  const s = { seed, stage, endless, tower, q, st, calm: 1 - 0.04 * st.calm, take: 0.05 + 0.012 * st.pull, on: powers, powers: [], nextPower: 6 + q() * 6, boost: 0, slow: 0, size: 0, magnet: 0, flare: 0, big: false, bonus: 0, extra: 0, hearts: 1 + st.hearts, ice: -9, iceSide: 1, isle: -9, warm: 0, shield: 0, safe: 0, nextGift: 9 + r() * 5, r, p1: r() * 6.28, p2: r() * 6.28, t: 0, y: 0, x: 0.5, light: 0.8, rocks: [], embers: [], next: 2.2, events: [], over: null, taken: 0, grazes: 0 };
  s.x = centre(s, 0);
  return s;
}

// True when a pickup at (x, y) can be taken without touching this rock anywhere in the rock's travel.
function clearOf(x, y, k) {
  if (k.vy) return !(Math.abs(x - k.x0) < k.rad + k.a + 0.075 && y > k.y0 - k.rad - 0.08 && y < k.y0 + 3);
  if (k.kind === 'chaser') return Math.abs(y - k.y0) > k.rad + 0.08; // it can be anywhere across the river
  const dx = Math.max(0, Math.abs(x - k.x0) - k.a - k.len), dy = Math.max(0, Math.abs(y - k.y0) - k.b);
  return Math.hypot(dx, dy) > k.rad + 0.048;
}
const clear = (s, x, y) => s.rocks.every(k => Math.abs(k.y0 - y) > 4 || clearOf(x, y, k));
function rock(x, y, rad, kind = '') { return { x, x0: x, y, y0: y, rad, kind, len: 0, on: true, a: 0, w: 0, b: 0, wy: 0, ph: 0, phy: 0, vy: 0, ice: false, grazed: false }; }

// The new thing of each later night. A row of the river is sometimes given over to one of these.
// log 6: a trunk lying out from one bank. pool 8: a whirlpool that pulls the boat in. gate 11: trunks from both banks with one gap.
// chaser 12: a rock that drifts toward the boat. hidden 15: a rock under the water that shows only when close.
// spinner 17: two rocks turning about a point. geyser 18: a spout that is deadly only while it blows. isle 20: rocks down the middle.
const SPECIAL = [[6, 'log'], [8, 'pool'], [11, 'gate'], [12, 'chaser'], [15, 'hidden'], [17, 'spinner'], [18, 'geyser'], [20, 'isle']];
function open(s, y, kind, chance) {
  // A pickup in open water beside this row.
  if (s.r() >= chance) return;
  for (let tries = 0; tries < 6; tries++) {
    const ey = y + 0.45, ec = centre(s, ey), ex = ec + (s.r() * 2 - 1) * (half(s, ey) - 0.05);
    if (clear(s, ex, ey)) { s.embers.push({ x: ex, y: ey, got: false, kind }); return; }
  }
}
// No pickup may sit where a rock is or will be: drop any earlier one this row would cover.
function cover(s, row) { const free = e => e.got || row.every(q => clearOf(e.x, e.y, q)); s.embers = s.embers.filter(free); s.powers = s.powers.filter(free); }
// A power in open water, every so often. Which one, and whether a size power grows the boat, is settled here and not when it is taken.
function power(s, y) {
  if (y < s.nextPower || !s.on.length) return;
  for (let tries = 0; tries < 4; tries++) {
    const py = y + 0.5, pc = centre(s, py), px = pc + (s.q() * 2 - 1) * (half(s, py) - 0.07);
    if (clear(s, px, py) && s.embers.every(e => Math.hypot(e.x - px, e.y - py) > 0.11)) { s.powers.push({ x: px, y: py, got: false, kind: s.on[Math.floor(s.q() * s.on.length)], big: s.q() < 0.2 }); s.nextPower = y + 14 + s.q() * 10; return; }
  }
}
function special(s, y, c, h, k, lv) {
  if (y - s.ice < 1.5) return false; // the row after ice keeps its own rule
  const row = [];
  if (y < s.isle) row.push(rock(c, y, 0.035, 'isle'));
  else {
    const kinds = SPECIAL.filter(q => lv >= q[0]);
    if (s.r() > Math.min(0.34, 0.1 + 0.03 * kinds.length)) return false;
    let kind = kinds[Math.floor(s.r() * kinds.length)][1];
    const tonight = SPECIAL.find(q => q[0] === s.stage);
    if (!s.endless && tonight && s.r() < 0.5) kind = tonight[1]; // tonight's new thing shows up most
    const u = s.r() * 2 - 1, side = u < 0 ? -1 : 1, tight = !s.endless && k > 0.85; // not in a story night's last pinch
    if (kind === 'log') { const q = rock(0, y, 0.018, 'log'); q.len = 0.05 + s.r() * 0.05; q.x = q.x0 = c + side * (h - q.len - 0.02); row.push(q); }
    else if (kind === 'pool') row.push(rock(c + u * (h - 0.09), y, 0.022, 'pool'));
    else if (kind === 'gate') {
      if (tight) return false;
      const m = c + u * (h - 0.11);
      for (const [lo, hi] of [[c - h, m - 0.075], [m + 0.075, c + h]]) { const len = (hi - lo) / 2 - 0.018; if (len > 0.005) { const q = rock((lo + hi) / 2, y, 0.018, 'log'); q.len = len; row.push(q); } }
    }
    else if (kind === 'chaser') row.push(rock(c + u * (h - 0.06), y, 0.035, 'chaser'));
    else if (kind === 'hidden') row.push(rock(c + u * (h - 0.06), y, 0.03 + s.r() * 0.02, 'hidden'));
    else if (kind === 'spinner') {
      if (tight) return false;
      const w = (1.3 + s.r() * 0.8) * side, ph = s.r() * 6.28, x = c + side * (h - 0.115);
      for (const turn of [0, Math.PI]) { const q = rock(x, y, 0.028, 'spinner'); q.a = q.b = 0.075; q.w = q.wy = w; q.ph = ph + turn; q.phy = Math.PI / 2; row.push(q); }
    }
    else if (kind === 'geyser') { const q = rock(c + u * (h - 0.07), y, 0.05, 'geyser'); q.ph = s.r() * 6.28; row.push(q); }
    else { if (!s.endless && k > 0.75) return false; s.isle = y + 2.4; row.push(rock(c, y, 0.035, 'isle')); }
  }
  s.rocks.push(...row);
  cover(s, row);
  open(s, y, 'ember', 0.55);
  if (lv >= 10) open(s, y, 'wisp', 0.12);
  power(s, y);
  return true;
}

function spawn(s) {
  // One row at a time, well ahead of the light, so the same seed always gives the same river.
  while (s.next < s.y + 2.4) {
    const y = s.next, c = centre(s, y), h = half(s, y), k = Math.min(1, y / GOAL), lv = level(s);
    s.next += (0.95 - 0.3 * k + s.r() * 0.35) / (1 + 0.012 * Math.min(24, lv - 1));
    if (fall(s, y) > 0 || fall(s, y + 0.8) > 0) continue; // the waterfall itself is the hazard
    if (lv >= 6 && special(s, y, c, h, k, lv)) continue;
    const rad = 0.03 + s.r() * 0.03;
    const off = (s.r() * 2 - 1) * (h - rad - 0.01);
    const first = rock(c + off, y, rad), row = [first];
    // Ice drifts into the row ahead of it, so that row keeps one small rock on the ice's side and the far side stays open.
    const iced = y - s.ice < 1.5;
    if (iced) { first.rad = Math.min(rad, 0.035); first.x0 = first.x = c + s.iceSide * Math.abs(off); s.r(); s.r(); }
    else if (lv >= 2 && s.r() < 0.3) { first.ice = true; first.rad = 0.05 + s.r() * 0.025; first.vy = 0.22; first.x0 = first.x = c + (s.r() * 2 - 1) * (h - first.rad - 0.01); s.ice = y; s.iceSide = first.x < c ? -1 : 1;
      if (lv >= 14 && s.r() < 0.4) { first.a = Math.min(0.07, Math.max(0, h - Math.abs(first.x0 - c) - first.rad - 0.01)); first.w = 1 + s.r(); first.ph = s.r() * 6.28; } // night 14: ice that slides from side to side
    }
    else if (s.r() < Math.min(0.7, Math.max(0, (k - 0.5) * 1.1) + (lv >= 3 ? 0.3 : 0.12 * (lv - 1)))) {
      // Rocks that swing from side to side: past halfway on night 1, more of them every night after.
      first.a = Math.min(0.09, Math.max(0, h - Math.abs(off) - rad - 0.01)); first.w = 1.4 + s.r() * 1.2; first.ph = s.r() * 6.28;
    } else if (lv >= 4 && s.r() < 0.3) { first.b = 0.22; first.wy = 1.6 + s.r(); first.ph = s.r() * 6.28; } // rocks that ride up and down the current
    if (s.r() < 0.3 + 0.3 * k) {
      // A second rock on the far side leaves one clear channel.
      const rad2 = 0.028 + s.r() * 0.02, side = off > 0 ? -1 : 1;
      const off2 = side * (0.08 + s.r() * (h - rad2 - 0.09));
      if (!iced && !first.ice && !first.a && !first.b && Math.abs(off2 - off) > rad + rad2 + 0.11) row.push(rock(c + off2, y + (s.r() - 0.5) * 0.2, rad2));
    }
    s.rocks.push(...row);
    cover(s, row);
    if (s.r() < 0.62) {
      // Embers sit beside the rock more often than in open water: light costs nerve.
      const near = s.r() < 0.55 && !iced && !first.ice && !first.a && !first.b;
      for (let tries = 0; tries < 6; tries++) {
        const ey = y + (near && !tries ? 0 : 0.45), ec = centre(s, ey), eh = half(s, ey);
        let ex = near && !tries ? c + off + (off > 0 ? -1 : 1) * (rad + 0.05) : ec + (s.r() * 2 - 1) * (eh - 0.05);
        ex = Math.max(ec - eh + 0.04, Math.min(ec + eh - 0.04, ex));
        if (clear(s, ex, ey)) { s.embers.push({ x: ex, y: ey, got: false, kind: 'ember' }); break; }
      }
    }
    if (y > s.nextGift) {
      // Gifts are rare and sit in open water. Blue is a shield that takes one hit; red is a heart, a spare life.
      const gy = y + 0.5, gc = centre(s, gy), gx = gc + (s.r() * 2 - 1) * (half(s, gy) - 0.07), kind = s.r() < 0.4 ? 'heart' : 'shield';
      if (clear(s, gx, gy)) { s.embers.push({ x: gx, y: gy, got: false, kind }); s.nextGift = y + 16 + s.r() * 8; }
    }
    if (lv >= 10) open(s, y, 'wisp', 0.1); // night 10: false embers that steal light
    power(s, y);
  }
}

// A blow: the shield takes it, else a spare heart does, else the run ends. Returns true when the run ended.
function blow(s, cause) {
  if (s.shield) { s.shield--; s.safe = 1.2; s.events.push('break'); return false; }
  if (s.hearts > 1) { s.hearts--; s.safe = 1.6; s.events.push('hurt'); return false; }
  s.hearts = 0; s.over = cause; s.events.push('hit'); return true;
}

export function step(s, target) {
  s.events.length = 0;
  if (s.over) return s;
  spawn(s);
  s.t += DT;
  const sl = s.slow ? 0.5 : 1, flow = sl * (s.boost ? 1.8 : 1) * s.calm, v = speed(s) * DT; // flow: how fast the river passes, against its usual pace
  s.y += v * sl; s.bonus += v * (1 - sl); if (s.boost) s.extra += 8 * DT;
  const max = 0.95 * pace(s) * DT, dx = Math.max(0, Math.min(1, target)) - s.x;
  s.x += Math.max(-max, Math.min(max, dx)) + wind(s, s.y) * 0.22 * DT;
  // An ember holds the flame steady for a moment before it starts to fade again.
  s.warm = Math.max(0, s.warm - DT); s.safe = Math.max(0, s.safe - DT);
  s.boost = Math.max(0, s.boost - DT); s.slow = Math.max(0, s.slow - DT); s.magnet = Math.max(0, s.magnet - DT); s.flare = Math.max(0, s.flare - DT);
  if (s.flare) { s.light = 1; s.warm = Math.max(s.warm, DT); }
  if (s.magnet) for (const e of s.embers) if (!e.got && e.kind === 'ember') { const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy); if (d < 0.32 && d > 0.001) { const m = Math.min(d, 0.9 * DT); e.x += dx / d * m; e.y += dy / d * m; e.pulled = true; } }
  if (s.size) { s.size = Math.max(0, s.size - DT); if (!s.size && !s.big) s.safe = Math.max(s.safe, 0.5); } // growing back beside a rock is not a blow
  for (const e of s.powers) if (!e.got && Math.hypot(e.x - s.x, e.y - s.y) < s.take) {
    e.got = true; s[e.kind] = LAST[e.kind];
    if (e.kind === 'boost') s.safe = Math.max(s.safe, LAST.boost + 0.6); // nothing breaks the boat while it flies, or just after
    if (e.kind === 'size') { s.big = e.big; if (e.big) s.safe = Math.max(s.safe, 0.8); }
    s.events.push(e.kind === 'size' ? (e.big ? 'big' : 'small') : e.kind);
  }
  if (!s.warm) s.light -= (0.04 + 0.025 * Math.min(1, s.y / GOAL)) * pace(s) * (rain(s, s.y) ? 1.6 : 1) * sl * s.calm * (1 - 0.08 * s.st.wick) * DT; // the same light per stretch of river on every night; rain costs more
  for (const e of s.embers) if (!e.got && Math.hypot(e.x - s.x, e.y - s.y) < (e.kind === 'wisp' ? 0.05 : s.take)) {
    e.got = true;
    if (e.kind === 'wisp') { s.light = Math.max(0.05, s.light - 0.2); s.events.push('wisp'); }
    else if (e.kind === 'shield') { s.shield = 1 + s.st.barrier; s.events.push('shield'); }
    else if (e.kind === 'heart') { s.hearts = Math.min(3, s.hearts + 1); s.events.push('heart'); }
    else { s.taken++; s.light = Math.min(1, s.light + 0.3); s.warm = 2.5; s.events.push('ember'); }
  }
  for (const k of s.rocks) {
    if (k.vy) k.y0 += k.vy * DT * flow; // ice drifts by the stretch of river passed, so the river laid down ahead never depends on powers taken
    if (k.a) k.x = k.x0 + k.a * Math.sin(s.t * k.w + k.ph);
    k.y = k.b ? k.y0 + k.b * Math.sin(s.t * k.wy + k.ph + k.phy) : k.y0;
    if (k.kind) {
      const near = k.y0 > s.y - 0.2 && k.y0 < s.y + 1.6;
      if (k.kind === 'chaser' && near) { k.x0 += Math.max(-0.08 * DT, Math.min(0.08 * DT, s.x - k.x0)); k.x = k.x0; }
      if (k.kind === 'geyser') k.on = Math.sin(s.t * 2.4 + k.ph) > -0.2;
      if (k.kind === 'pool' && Math.hypot(k.x - s.x, k.y - s.y) < 0.16) s.x += Math.sign(k.x - s.x) * 0.3 * DT;
    }
    const d = Math.hypot(Math.max(0, Math.abs(k.x - s.x) - k.len), k.y - s.y) - k.rad - boat(s);
    if (!k.on) continue;
    if (d < 0 && !s.safe) { if (blow(s, k.ice ? 'ice' : k.kind || 'rock')) return s; continue; }
    if (!k.grazed && d < 0.022 && k.y < s.y) { k.grazed = true; s.grazes++; s.light = Math.min(1, s.light + 0.05); s.events.push('graze'); }
  }
  const c = centre(s, s.y), edge = half(s, s.y) - boat(s);
  if (Math.abs(s.x - c) > edge) {
    // Just after a blow the bank only holds the boat in; otherwise it is a blow, and the boat is set back inside.
    if (s.safe) s.x = c + Math.sign(s.x - c) * edge;
    else { if (blow(s, 'bank')) return s; s.x = c + Math.sign(s.x - c) * (edge - 0.03); }
  }
  if (s.light <= 0) { s.light = 0; s.over = 'dark'; s.events.push('out'); return s; }
  if (!s.endless && s.y + s.bonus >= GOAL) { s.over = 'dawn'; s.events.push('dawn'); }
  if (s.rocks.length && s.rocks[0].y0 < s.y - 1.5) s.rocks = s.rocks.filter(k => k.y0 >= s.y - 1.5);
  while (s.embers.length && s.embers[0].y < s.y - 1) s.embers.shift();
  while (s.powers.length && s.powers[0].y < s.y - 1) s.powers.shift();
  return s;
}
