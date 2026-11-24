const DT = 1 / 30;
const INTERNODE = 11;
const SHADE_TIME = 12;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clampAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

// Each bed specifies its window, productive trellis eyes and neighbouring flowers.
const beds = [
  [[240, 95], [], []],
  [[126, 86], [[222, 249]], []],
  [[273, 105], [], [86]],
  [[235, 81], [[106, 273]], [279]],
  [[133, 87], [[232, 295], [190, 190]], []],
  [[81, 103], [[104, 267], [186, 176]], [275]],
  [[260, 96], [[202, 297], [260, 217]], [76, 300]],
  [[102, 85], [[93, 264], [210, 191]], [63, 286]],
  [[252, 89], [[214, 290], [115, 223], [220, 163]], [84, 291]],
  [[114, 77], [[102, 300], [233, 235], [141, 162]], [68, 278]]
];

function random(s) {
  s.random = (Math.imul(1664525, s.random) + 1013904223) >>> 0;
  return s.random / 4294967296;
}

function node(s, parent, x, y, depth, leaf) {
  const n = { x, y, parent, alive: true, born: s.time, depth, leaf,
    size: (depth ? 12 : 16) + random(s) * 8, phase: random(s) * 2 * Math.PI };
  s.nodes.push(n);
  return s.nodes.length - 1;
}

function shoot(s, i, depth, angle, budget = Infinity) {
  const n = s.nodes[i];
  return { node: i, x: n.x, y: n.y, depth, angle, budget, length: 0,
    count: 0, fork: 3 + Math.floor(random(s) * 3), lean: random(s) < 0.5 ? -1 : 1 };
}

function plant(s) {
  const trunk = [[153,440],[151,429],[153,418],[156,407],[155,396],[151,385],
    [148,374],[149,363],[154,352],[158,341],[158,330]];
  let top = -1;
  for (const [i, [x, y]] of trunk.entries()) {
    top = node(s, top, x, y, 0, i % 2 ? (i % 4 === 1 ? 1 : -1) : 0);
  }
  s.tips.push(shoot(s, top, 0, -Math.PI / 2));
  let fork = 5;
  for (const [x, y, leaf] of [[141,381,-1],[132,378,0],[123,371,1],[118,361,-1]]) {
    fork = node(s, fork, x, y, 1, leaf);
  }
  s.tips.push(shoot(s, fork, 1, -2.2, 3));
  for (const n of s.nodes) n.born = -3;
}

export function createBed(level = 1, seed = 1, endless = false) {
  const s = { level, seed: seed >>> 0, random: seed >>> 0, endless, time: 0, status: 'growing',
    nodes: [], tips: [], lamp: { x: 137, y: 297 }, window: null, arms: [], flowers: [] };
  let layout = beds[clamp(Math.trunc(level) || 1, 1, 10) - 1];
  if (endless) {
    // Add one fruitful eye in the first span, then alternate between two and three.
    const count = level <= 1 ? 1 : 2 + (level % 3 === 0 ? 1 : 0);
    const right = random(s) < 0.5;
    const eyes = Array.from({ length: count }, (_, i) => [
      95 + (((i % 2 === 0) === right) ? 110 : 0) + 38 * random(s),
      300 - (i * 65) + 16 * random(s)
    ]);
    layout = [[94 + 172 * random(s), 77 + 23 * random(s)], eyes, level < 3 ? [right ? 58 : 302] : [55, 300]];
  }
  const [[x, y], eyes, flowers] = layout;
  s.window = { x, y, reached: false };
  s.arms = eyes.map(([x, y]) => ({ x, y, grip: -1, fruit: 0, ripe: false }));
  s.flowers = flowers.map(x => ({ x, y: 426, shade: 0, stress: 0 }));
  plant(s);
  // Three mature beds inherit a bough that already shades a neighbour.
  // The spent wood bears no growing tip until the player prunes it.
  if (!endless && [6, 8, 10].includes(level)) {
    const flower = s.flowers[0];
    const direction = Math.sign(flower.x - s.nodes[4].x);
    const reach = flower.x - direction * 10;
    let parent = 4;
    const joints = Math.round(Math.abs(reach - s.nodes[parent].x) / INTERNODE);
    for (let i = 1; i <= joints; i++) {
      const f = i / joints;
      parent = node(s, parent, 155 + (reach - 155) * f, 396 - 24 * Math.sin(f * 1.6),
        1, i % 2 || i === joints ? direction : -direction);
      s.nodes[parent].born = -3;
    }
    for (let i = 1; i <= 3; i++) {
      parent = node(s, parent, reach + Math.sin(i * 0.9) * 3, 372 - 9 * i, 1, direction);
      s.nodes[parent].born = -3;
    }
    flower.shade = shadeAt(s, flower.x, flower.y);
    flower.stress = 0.35;
  }
  return s;
}

export function aim(s, x, y) {
  if (Number.isFinite(x) && Number.isFinite(y)) {
    s.lamp.x = clamp(x, 12, 348);
    s.lamp.y = clamp(y, 27, 425);
  }
}

// Overlapping leaf silhouettes intercept successive fractions of the overhead light.
export function shadeAt(s, x, y) {
  let sunlight = 1;
  for (const n of s.nodes) {
    if (!n.alive || !n.leaf || n.y >= y - 4) continue;
    const size = n.size * clamp((s.time - n.born) / 0.95, 0, 1);
    if (!size) continue;
    const centre = n.x + n.leaf * size * 0.53;
    const cover = 1 - Math.abs(x - centre) / (size * 0.78);
    if (cover > 0) sunlight *= 1 - 0.72 * cover;
  }
  return 1 - sunlight;
}

function grow(s, tip) {
  const dx = s.lamp.x - tip.x;
  const dy = s.lamp.y - tip.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 8) return;
  const n = s.nodes[tip.node];
  const lateral = tip.depth ? tip.lean * (0.25 + 0.55 * tip.budget / 7) : 0;
  const heading = Math.atan2(dy, dx) + lateral + Math.sin(n.phase + tip.length / 18) * 0.09;
  const turn = clamp(clampAngle(heading - tip.angle), -0.105, 0.105);
  tip.angle += turn;
  // Light at the tip sustains extension. Old wood stays where it formed.
  const light = (0.7 + 0.3 * Math.exp(-distance / 130)) * (1 - 0.38 * shadeAt(s, tip.x, tip.y));
  const rate = (s.endless ? 19 : 35) * (tip.depth ? 0.62 : 1);
  const step = DT * rate * light * clamp((distance - 6) / 14, 0.14, 1);
  tip.x = clamp(tip.x + step * Math.cos(tip.angle), 10, 350);
  tip.y = clamp(tip.y + step * Math.sin(tip.angle), 25, 435);
  tip.length = dist(tip, n);
  if (tip.length < INTERNODE) return;
  tip.count++;
  const leaf = tip.count % 2 ? (tip.count % 4 === 1 ? 1 : -1) : 0;
  tip.node = node(s, tip.node, tip.x, tip.y, tip.depth, leaf);
  tip.length = 0;
  tip.budget--;
  if (tip.depth === 0 && tip.count >= tip.fork) {
    // Lateral buds inherit the parent's heading, then curve toward the lamp.
    const angle = tip.angle + tip.lean * 1.25;
    const offshoot = shoot(s, tip.node, 1, angle, 4 + Math.floor(random(s) * 4));
    offshoot.lean = tip.lean;
    s.tips.push(offshoot);
    tip.lean *= -1;
    tip.fork = tip.count + 4 + Math.floor(random(s) * 3);
  }
}

function tend(s) {
  for (const arm of s.arms) {
    if (arm.grip === -1) {
      const tip = s.tips.find(t => dist(t, arm) <= 19 && dist(s.nodes[t.node], arm) <= 25);
      if (tip) arm.grip = tip.node;
    }
    if (arm.grip >= 0 && !arm.ripe) {
      const illumination = clamp(1 - dist(s.lamp, arm) / 100, 0, 1);
      arm.fruit = Math.min(1, arm.fruit + illumination * DT / 1.35);
      arm.ripe = arm.fruit === 1;
    }
  }
  for (const flower of s.flowers) {
    flower.shade = shadeAt(s, flower.x, flower.y);
    flower.stress = clamp(flower.stress + DT * (flower.shade - 0.38) / (SHADE_TIME * 0.62), 0, 1);
    if (flower.stress >= 1) s.status = 'wilted';
  }
  if (!s.window.reached && s.tips.some(tip => dist(tip, s.window) < 22)) s.window.reached = true;
  if (s.status === 'growing' && s.window.reached && s.arms.every(arm => arm.ripe)) s.status = 'won';
}

export function tick(s) {
  if (s.status !== 'growing') return;
  s.time += DT;
  const tips = s.tips.slice();
  for (const tip of tips) grow(s, tip);
  s.tips = s.tips.filter(t => t.budget > 0);
  tend(s);
}

function pointDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function crosses(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true;
  return Math.min(pointDistance(c, a, b), pointDistance(d, a, b),
    pointDistance(a, c, d), pointDistance(b, c, d)) <= 4;
}

export function prune(s, x1, y1, x2, y2) {
  const a = { x: x1, y: y1 }, b = { x: x2, y: y2 };
  if (s.status !== 'growing' || dist(a, b) < 15) return 0;
  const buds = new Map();
  let removed = 0;
  // Parents always precede their children. One pass severs every descendant.
  for (const n of s.nodes) {
    if (!n.alive || n.parent < 1) continue;
    const p = s.nodes[n.parent];
    if (p.alive && !crosses(a, b, p, n)) continue;
    n.alive = false;
    removed++;
    if (p.alive) buds.set(n.parent, n.depth);
  }
  // A flick through the unfinished last internode also trims that shoot.
  for (const t of s.tips) {
    const p = s.nodes[t.node];
    if (p.alive && t.length > 1 && crosses(a, b, p, t)) {
      t.budget = 0;
      buds.set(t.node, t.depth);
      removed++;
    }
  }
  s.tips = s.tips.filter(t => s.nodes[t.node].alive && t.budget > 0);
  for (const [i, depth] of buds) {
    const p = s.nodes[i];
    const base = s.nodes[p.parent];
    if (!s.tips.some(t => t.node === i)) {
      const angle = Math.atan2(p.y - base.y, p.x - base.x);
      s.tips.push(shoot(s, i, depth, angle, depth ? 5 : Infinity));
    }
  }
  for (const arm of s.arms) {
    if (arm.grip >= 0 && !s.nodes[arm.grip].alive) Object.assign(arm, { grip: -1, fruit: 0, ripe: false });
  }
  if (removed && s.window.reached) {
    s.window.reached = s.nodes.some(n => n.alive && dist(n, s.window) < 25) ||
      s.tips.some(t => dist(t, s.window) < 22);
  }
  return removed;
}
