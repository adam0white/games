// Paper Boat rules. One fixed step; all variation comes from the stored seed.
export const DT = 1 / 60;
export const LEVELS = [
  { name: 'First rain', duration: 18, speed: 10, soak: 1.8, damage: 22, gates: [[65, 74, 15], [132, 25, 16]] },
  { name: 'Leaf lane', duration: 19, speed: 10, soak: 2.2, damage: 35, gates: [[45, 25, 20], [85, 75, 20], [125, 25, 20], [165, 75, 20]] },
  { name: 'Open drains', duration: 20, speed: 10, soak: 2.5, damage: 35, gates: [[45, 74, 22], [88, 26, 22], [132, 74, 22], [172, 26, 21]] },
  { name: 'Cat crossing', duration: 21, speed: 10.5, soak: 2.7, damage: 35, gates: [[45, 26, 23], [85, 74, 23], [125, 26, 23], [165, 74, 23], [195, 26, 21]] },
  { name: 'Heavy rain', duration: 22, speed: 11, soak: 2.9, damage: 35, gates: [[42, 74, 24], [78, 26, 24], [114, 74, 24], [150, 26, 24], [186, 74, 24], [220, 26, 22]] },
  { name: 'The pond', duration: 23, speed: 11.5, soak: 3, damage: 36, gates: [[42, 26, 25], [77, 74, 25], [112, 26, 25], [147, 74, 25], [182, 26, 25], [217, 74, 25], [246, 26, 22]] },
];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function rand(s) { s.r = (s.r + 0x6d2b79f5) | 0; let t = s.r; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
export function create({ level = 0, seed = 7 } = {}) {
  level = clamp(Math.floor(level), 0, LEVELS.length - 1);
  const s = { level, seed, r: seed | 0, t: 0, tick: 0, progress: 0, boat: { x: 50, y: 0, vx: 0, soak: 0 }, hazards: [], passengers: [], ripples: [], events: [], status: 'play', stars: 0, score: 0, hits: 0, rescued: 0, actions: 0 };
  const L = LEVELS[level];
  s.hazards = L.gates.map(([y, x, r], i) => ({ kind: level === 0 ? 'leaf' : level === 1 ? 'leaf' : level >= 3 && i % 3 === 1 ? 'paw' : i % 2 ? 'leaf' : 'drain', x: x + (rand(s) - .5) * 3, y, r, hit: false, passed: false, phase: rand(s) * Math.PI * 2 }));
  // One easy passenger before the first obstacle. The second is on the final safe bank.
  s.passengers = [{ kind: 'ladybird', x: level === 0 ? 50 : L.gates[0][1] < 50 ? 72 : 28, y: 22, r: 11, collected: false, passed: false }, { kind: 'snail', x: L.gates.at(-1)[1] < 50 ? 72 : 28, y: L.gates.at(-1)[0] + 13, r: 12, collected: false, passed: false }];
  return s;
}
export function ripple(s, { x, y, dx, dy = 0 }) {
  if (s.status !== 'play' || ![x, y, dx, dy].every(Number.isFinite)) return false;
  const length = Math.hypot(dx, dy); if (length < .1) return false;
  const strength = Math.min(1, length / 12);
  s.ripples.push({ kind: 'ripple', x, y, dx: dx / length * strength, dy: dy / length * strength, age: 0, life: .8, r: 30 });
  if (s.ripples.length > 70) s.ripples.shift();
  s.actions++; s.events.push({ type: 'ripple', x, y }); return true;
}
export function pebble(s, { x, y }) {
  if (s.status !== 'play' || ![x, y].every(Number.isFinite)) return false;
  s.ripples.push({ kind: 'pebble', x, y, age: 0, life: 1, r: 34 });
  if (s.ripples.length > 70) s.ripples.shift();
  s.actions++; s.events.push({ type: 'pebble', x, y }); return true;
}
export function flow(s, x, y) {
  let fx = Math.sin(y * .065 + s.t * .7 + s.seed * .2) * 1.5;
  let fy = LEVELS[s.level].speed;
  for (const p of s.ripples) {
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d >= p.r) continue;
    const fade = (1 - d / p.r) * (1 - p.age / p.life);
    if (p.kind === 'pebble') { if (d > .01) { fx += dx / d * 42 * fade; fy += dy / d * 6 * fade; } }
    else { fx += p.dx * 40 * fade; fy += p.dy * 4 * fade; }
  }
  // A drain bends nearby streamlines before the hull touches its mouth.
  for (const h of s.hazards) if (h.kind === 'drain' && !h.passed) {
    const dx = h.x - x, dy = h.y - y, d = Math.hypot(dx, dy);
    if (d > 1 && d < 36) { fx += dx / d * (1 - d / 36) * 6; fy += dy / d * (1 - d / 36) * 3; }
  }
  return { x: clamp(fx, -48, 48), y: fy };
}
export function step(s) {
  if (s.status !== 'play') return s;
  const L = LEVELS[s.level], b = s.boat;
  s.tick++; s.t = s.tick * DT;
  const f = flow(s, b.x, b.y);
  b.vx += (f.x - b.vx) * Math.min(1, 8 * DT);
  b.x = clamp(b.x + b.vx * DT, 7, 93);
  if ((b.x === 7 && b.vx < 0) || (b.x === 93 && b.vx > 0)) b.vx = 0;
  b.y += f.y * DT; b.soak += L.soak * DT;
  s.progress = Math.min(1, b.y / (L.duration * L.speed));
  for (const p of s.ripples) p.age += DT;
  s.ripples = s.ripples.filter(p => p.age < p.life);
  for (const h of s.hazards) {
    if (!h.hit && Math.hypot((b.x - h.x), (b.y - h.y) * 2.6) < h.r + 3) {
      h.hit = true; s.hits++; b.soak += L.damage;
      b.vx += (b.x < h.x ? -1 : 1) * 10;
      s.events.push({ type: 'hit', kind: h.kind, x: b.x, y: b.y });
    }
    if (b.y > h.y + h.r) h.passed = true;
  }
  for (const p of s.passengers) {
    if (!p.collected && Math.hypot(b.x - p.x, b.y - p.y) < p.r) { p.collected = true; s.rescued++; s.events.push({ type: 'rescue', kind: p.kind, x: p.x, y: p.y }); }
    if (b.y > p.y + p.r) p.passed = true;
  }
  if (b.soak >= 100) { b.soak = 100; s.status = 'lost'; s.events.push({ type: 'lost', x: b.x, y: b.y }); }
  else if (s.progress >= 1) {
    s.status = 'won'; s.stars = 1 + (s.rescued === 2 ? 1 : 0) + (s.hits === 0 ? 1 : 0);
    s.score = 100 + s.rescued * 100 + Math.round(100 - b.soak) + s.stars * 50;
    s.events.push({ type: 'won', stars: s.stars, score: s.score, x: b.x, y: b.y });
  }
  return s;
}
// Visible-only reference controller: avoid the next obstacle while its collision band is ahead.
export function guide(s) {
  const b = s.boat;
  const h = s.hazards.find(h => !h.hit && h.y + 5 > b.y && h.y - b.y < 44);
  if (h) return h.x < 50 ? 76 : 24;
  const p = s.passengers.find(p => !p.collected && !p.passed && p.y > b.y - 3 && p.y - b.y < 32);
  return p ? p.x : 50;
}
