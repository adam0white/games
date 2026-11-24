// Sling's rules. World units are pixels in a 360 x 560 garden, y down.
// All motion uses one fixed tick. Time, seeds and gust phase come from the caller.
export const DT = 1 / 60;
export const WIDTH = 360, HEIGHT = 560, LEVELS = 15;
export const GRAVITY = 650, GAIN = 5.2, MAX_PULL = 100, RADIUS = 4;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const soil = (x, y, w, target = true) => ({ x, y, w, type: 'soil', target });
const names = ['First flower', 'One more', 'Choose a flower', 'Up the garden', 'Stone skip', 'Over water', 'Lily stop', 'A little wind', 'The gust', 'Mind the thorns', 'Bee lift', 'Two banks', 'Crosswind', 'High garden', 'Full bloom'];
const hints = ['Pull down. Let go.', 'Every flower can throw.', 'Tap an earlier flower to throw from it.', 'Grow every glowing patch.', 'Stone bounces. Soil grows.', 'Water takes a seed. Try again.', 'A lily keeps your seed safe.', 'Watch the wind before you throw.', 'The gust changes direction.', 'Keep clear of the thorns.', 'A bee carries a seed along its arrow.', 'Choose which flower to throw from.', 'Aim into the wind.', 'Use your flowers as steps.', 'Fill the whole garden.'];

// Each lesson is a small connected garden, rather than an increasingly tiny copy.
// The lowest soil is the starting plant. Glowing targets are counted separately.
export function level(index = 0) {
  index = clamp(Math.floor(Number(index) || 0), 0, LEVELS - 1);
  const layouts = [
    [[130, 386, 215]],
    [[180, 397, 122], [40, 280, 115]],
    [[184, 392, 112], [38, 376, 96]],
    [[202, 403, 110], [42, 287, 106], [218, 175, 102]],
    [[220, 394, 98], [45, 275, 92]],
    [[208, 387, 96], [50, 269, 90]],
    [[225, 335, 88], [57, 218, 87]],
    [[194, 397, 86], [51, 280, 82], [222, 166, 80]],
    [[215, 390, 78], [43, 275, 76], [216, 154, 76]],
    [[220, 403, 72], [42, 288, 70], [224, 172, 68]],
    [[219, 371, 72], [49, 250, 67], [231, 135, 67]],
    [[213, 402, 65], [43, 290, 64], [230, 175, 63], [73, 153, 62]],
    [[223, 394, 60], [40, 277, 60], [232, 164, 59]],
    [[232, 408, 57], [45, 292, 56], [237, 176, 55], [70, 120, 54]],
    [[226, 405, 52], [40, 289, 51], [238, 174, 50], [72, 118, 49]],
  ];
  const platforms = [soil(20, 510, 95, false), ...layouts[index].map(p => soil(...p))];
  // Later lessons reduce landing tolerance even when a new rule uses fewer
  // patches. Flower selection itself still has the page's generous hit radius.
  const tolerance = [1, 1, 0.65, 1, 0.9, 0.8, 0.5, 0.85, 0.9, 0.84, 1, 0.8, 0.75, 0.63, 0.62][index];
  for (const p of platforms) if (p.target) { const w = p.w; p.w = Math.round(w * tolerance); p.x += (w - p.w) / 2; }
  if (index >= 4) platforms.push({ x: 139, y: 464, w: 58, type: 'rock' });
  if (index >= 5) platforms.push({ x: 120, y: 522, w: 225, type: 'water' });
  if (index === 6) platforms.push({ x: 178, y: 423, w: 72, type: 'lily' }, { x: 155, y: 423, w: 120, type: 'water' });
  if (index >= 9) platforms.push({ x: 142, y: 339, w: 52, type: 'thorn' });
  if (index >= 11) platforms.push({ x: 10, y: 456, w: 22, type: 'thorn' }, { x: 305, y: 250, w: 40, type: 'water' });
  const bees = index >= 10 ? [{ x: 169, y: 363, r: 16, vx: 125, vy: -150 }] : [];
  return { id: index, name: names[index], hint: hints[index], platforms, bees,
    wind: index >= 7 ? 25 + (index - 7) * 6 : 0, windPeriod: 240,
    par: layouts[index].length + (index === 6 ? 1 : 0), start: { x: 65, y: 510 }, daily: null };
}

export function windAt(l, tick) {
  return (l.wind || 0) * Math.sin(2 * Math.PI * tick / (l.windPeriod || 240));
}

export function create(l = level(0)) {
  const start = l.start || { x: 65, y: 510 };
  return { level: l, flowers: [{ ...start, seed: 0, platform: 0 }], selected: 0,
    seed: null, seeds: 0, tick: 0, status: 'play', events: [] };
}

export function select(s, index) {
  if (s.status !== 'play' || s.seed || !Number.isInteger(index) || !s.flowers[index]) return false;
  s.selected = index;
  s.events.push({ e: 'select', index });
  return true;
}

export function launch(s, dx, dy) {
  if (s.status !== 'play' || s.seed || !Number.isFinite(dx) || !Number.isFinite(dy)) return false;
  const d = Math.hypot(dx, dy);
  if (d < 7) return false;
  const factor = d > MAX_PULL ? MAX_PULL / d : 1;
  const f = s.flowers[s.selected];
  s.seeds++;
  s.seed = { x: f.x, y: f.y - 9, vx: -dx * factor * GAIN, vy: -dy * factor * GAIN,
    age: 0, bounces: 0, carried: 0, bee: -1 };
  s.events.push({ e: 'launch', from: s.selected, dx: dx * factor, dy: dy * factor });
  return true;
}

function lose(s, reason) {
  if (!s.seed) return;
  s.events.push({ e: 'lost', reason, x: s.seed.x, y: s.seed.y });
  s.seed = null;
}

function land(s, p, index, x) {
  s.seed = null;
  // One flower per patch: revisiting a filled patch selects the existing plant.
  let f = s.flowers.findIndex(f => f.platform === index);
  if (f < 0) {
    f = s.flowers.length;
    s.flowers.push({ x: clamp(x, p.x + RADIUS, p.x + p.w - RADIUS), y: p.y, seed: s.seeds, platform: index });
    s.events.push({ e: 'flower', index: f, platform: index, target: !!p.target });
  } else s.events.push({ e: 'land', index: f, platform: index });
  s.selected = f;
  const left = s.level.platforms.some((p, i) => p.target && !s.flowers.some(f => f.platform === i));
  if (!left) { s.status = 'won'; s.events.push({ e: 'won', seeds: s.seeds, seconds: s.tick * DT }); }
}

export function step(s) {
  if (s.status !== 'play') return;
  s.tick++;
  const b = s.seed;
  if (!b) return;
  b.age++;
  const oldX = b.x, oldY = b.y;
  if (b.carried > 0) {
    b.carried--;
    b.x += b.vx * DT; b.y += b.vy * DT;
    if (!b.carried) s.events.push({ e: 'bee-release', x: b.x, y: b.y });
  } else {
    b.vx += windAt(s.level, s.tick) * DT;
    b.vy += GRAVITY * DT;
    b.x += b.vx * DT; b.y += b.vy * DT;
  }
  for (let i = 0; i < (s.level.bees || []).length; i++) {
    const bee = s.level.bees[i];
    if (b.bee === i || b.carried || Math.hypot(b.x - bee.x, b.y - bee.y) > bee.r + RADIUS) continue;
    b.bee = i; b.carried = 24; b.vx = bee.vx; b.vy = bee.vy;
    s.events.push({ e: 'bee', index: i, x: b.x, y: b.y });
  }
  // Swept top-surface crossing prevents fast seeds passing through narrow ledges.
  // Thorns also hurt when crossed upward; other surfaces only act on descent.
  const hits = [];
  for (let i = 0; i < s.level.platforms.length; i++) {
    const p = s.level.platforms[i];
    const top = p.y - RADIUS;
    const descending = oldY <= top && b.y >= top;
    const thornUp = p.type === 'thorn' && oldY >= p.y + RADIUS && b.y <= p.y + RADIUS;
    if (!descending && !thornUp) continue;
    const edge = thornUp ? p.y + RADIUS : top;
    const t = (edge - oldY) / (b.y - oldY || 1);
    const x = oldX + (b.x - oldX) * t;
    if (x >= p.x - RADIUS && x <= p.x + p.w + RADIUS) hits.push({ p, i, x, t });
  }
  hits.sort((a, b) => a.t - b.t);
  if (hits.length) {
    const { p, i, x } = hits[0];
    if (p.type === 'water' || p.type === 'thorn') { lose(s, p.type); return; }
    if (p.type === 'rock') {
      b.y = p.y - RADIUS - 0.1; b.x = x; b.vy = -Math.abs(b.vy) * 0.78; b.bounces++;
      s.events.push({ e: 'bounce', x: b.x, y: b.y });
      if (b.bounces > 5 || Math.abs(b.vy) < 38) lose(s, 'rest');
    } else { land(s, p, i, x); return; }
  }
  if (b.x < -20 || b.x > WIDTH + 20 || b.y > HEIGHT + 20 || b.age >= 480) lose(s, 'away');
}

export function resolve(s, max = 480) {
  for (let i = 0; i < max && s.seed && s.status === 'play'; i++) step(s);
  return s;
}

export function preview(s, dx, dy) {
  const c = copy(s), points = [];
  if (!launch(c, dx, dy)) return points;
  for (let i = 0; i < 180 && c.seed; i++) {
    if (!(i % 4)) points.push({ x: c.seed.x, y: c.seed.y });
    step(c);
  }
  return points;
}

function copy(s) {
  return { ...s, flowers: s.flowers.map(f => ({ ...f })), seed: s.seed ? { ...s.seed } : null, events: [] };
}

// Inverse ballistics proposes gestures, then the actual collision simulation
// accepts them. Targets require one seed each, so a no-miss solution proves par.
function nextShot(s) {
  const missing = s.level.platforms.map((p, i) => ({ p, i })).filter(({ p, i }) => (p.target || p.type === 'lily') && !s.flowers.some(f => f.platform === i));
  missing.sort((a, b) => Number(!!b.p.target) - Number(!!a.p.target) || b.p.y - a.p.y || a.i - b.i);
  const gdt = GRAVITY * DT * DT;
  const drift = [0]; let windVelocity = 0, windPosition = 0;
  for (let k = 1; k <= 118; k++) {
    windVelocity += windAt(s.level, s.tick + k) * DT;
    windPosition += windVelocity * DT; drift[k] = windPosition;
  }
  for (const { p, i } of missing) {
    for (let from = s.flowers.length - 1; from >= 0; from--) {
      const f = s.flowers[from];
      for (const fraction of [0.5, 0.25, 0.75]) for (let n = s.level.id === 0 ? 60 : 48; n <= 118; n += 2) {
        const t = n * DT;
        const vy = (p.y - RADIUS - (f.y - 9) - gdt * n * (n + 1) / 2) / t;
        if (vy + GRAVITY * t < 40) continue;
        const vx = (p.x + p.w * fraction - f.x - drift[n]) / t;
        const dx = -vx / GAIN, dy = -vy / GAIN;
        if (Math.hypot(dx, dy) > MAX_PULL - 0.5) continue;
        const c = copy(s); c.selected = from;
        launch(c, dx, dy); resolve(c);
        if (c.flowers.some(q => q.platform === i) && c.flowers.length > s.flowers.length) {
          return { from, dx, dy, wait: 0, phase: s.tick % (s.level.windPeriod || 240), platform: i };
        }
      }
    }
  }
  return null;
}

export function guide(s) {
  if (s.seed || s.status !== 'play') return null;
  const direct = nextShot(s);
  if (direct) return direct;
  if (s.level.wind) for (const wait of [30, 60, 90, 120, 180]) {
    const c = copy(s); c.tick += wait;
    const shot = nextShot(c);
    if (shot) return { ...shot, wait };
  }
  return null;
}

const solutions = new Map();
export function solve(l) {
  const key = JSON.stringify(l);
  if (solutions.has(key)) return structuredClone(solutions.get(key));
  const s = create(l), shots = [];
  for (let k = 0; k < 12 && s.status === 'play'; k++) {
    const period = l.windPeriod || 240;
    const wait = l.wind ? (period - s.tick % period) % period : 0;
    for (let j = 0; j < wait; j++) step(s);
    const shot = nextShot(s);
    if (!shot) return null;
    shot.wait = wait;
    select(s, shot.from); launch(s, shot.dx, shot.dy); resolve(s); shots.push(shot);
  }
  if (s.status !== 'won') return null;
  const result = { shots, par: shots.length };
  solutions.set(key, result);
  return structuredClone(result);
}

function random(seed) {
  let r = seed >>> 0;
  return () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; };
}

// The caller supplies a UTC YYYY-MM-DD. A deterministic retry discards a garden
// if inverse ballistics cannot actually finish it through the collision rules.
export function daily(date) {
  const key = date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(Date.parse(key + 'T00:00:00Z')) || new Date(key + 'T00:00:00Z').toISOString().slice(0, 10) !== key) throw new Error('daily needs a valid UTC date');
  const hash = [...key].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const rng = random(hash);
  for (let attempt = 0; attempt < 40; attempt++) {
    const l = { ...level(14), id: 'daily', daily: key, name: 'Daily garden', hint: 'Nine glowing patches. Choose your route.' };
    l.platforms = [soil(20, 510, 95, false)];
    for (const y of [422, 309, 196]) for (const x of [24, 143, 260]) {
      l.platforms.push(soil(x + Math.round((rng() - 0.5) * 16), y + Math.round((rng() - 0.5) * 16), 52 + Math.floor(rng() * 17)));
    }
    l.platforms.push({ x: 130, y: 522, w: 215, type: 'water' }, { x: 146, y: 471, w: 55, type: 'rock' });
    if (rng() < 0.5) l.platforms.push({ x: 111, y: 356, w: 34, type: 'thorn' });
    l.bees = [{ x: 217, y: 368, r: 14, vx: 110, vy: -130 }];
    l.wind = Math.round(35 + rng() * 45); l.windPeriod = [210, 240, 270][Math.floor(rng() * 3)];
    l.attempt = attempt;
    const answer = solve(l);
    if (answer) { l.par = answer.par; return l; }
  }
  // The fallback is also checked; no unsolved daily can escape the generator.
  const l = { ...level(8), id: 'daily', daily: key, name: 'Daily garden', attempt: 40 };
  l.platforms = [soil(20, 510, 95, false)];
  for (const y of [422, 309, 196]) for (const x of [24, 143, 260]) l.platforms.push(soil(x, y, 64));
  l.par = 9;
  if (!solve(l)) throw new Error('daily fallback has no solution');
  return l;
}

// Higher is better, within the board's 1..1,000,000 range. A ranked run accepts
// 0..999 seeds; the secondary time term is always less than one seed.
export function score(seeds, seconds) {
  if (typeof seeds === 'object') { seconds = seeds.tick * DT; seeds = seeds.seeds; }
  return 1000000 - clamp(Math.floor(Number(seeds) || 0), 0, 999) * 1000 - Math.min(999, Math.max(0, Math.floor(Number(seconds) || 0)));
}
