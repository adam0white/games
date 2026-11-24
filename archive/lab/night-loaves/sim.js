// Positions are in bench coordinates. Time advances by one 60 Hz tick per step.
const DT = 1 / 60;
const TAU = 2 * Math.PI;
const COUNT = 28;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const start = { x: 164, y: 356 };
// Bench recipes use relative handling and proof rates. The first batch is the reference.
const recipes = [
  ['Country white', 1, 1], ['Milk bread', .88, .90],
  ['Stoneground wheat', 1.14, .95], ['Barley & wheat', 1.08, 1.09],
  ['Oat loaf', .82, .94], ['Brown rye', .72, 1.08],
  ['Spelt boule', .78, 1.16], ['Village sourdough', 1.12, .79]
];
export const GOLD = 0.66;
export const BURNT = 1.13;
export const GUEST_ARRIVAL = 1;
export const inOven = (x, y) => x >= 185 && x <= 306 && y >= 105 && y <= 175;

function random(g) {
  g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0;
  return g.rng / 4294967296;
}

export function createGame(level = 1, seed = 1) {
  const batchSize = 2 + Math.floor(Math.min(7, level - 1) / 3);
  const [recipe, elasticity, yeast] = recipes[level > 8 ? (seed >>> 0) % recipes.length : level - 1];
  const g = {
    level, seed, rng: seed >>> 0, stage: 'knead', age: 0, time: 0, work: 0,
    proof: 0, shaped: false, brown: 0, score: 0, remaining: batchSize, batchSize,
    served: 0, gifts: 0, recipe, elasticity, yeast, started: false, x: start.x, y: start.y,
    nodes: [], grip: null, dust: [], last: '',
  };
  g.fireX = 223 + random(g) * 49;
  g.fire = .95 + random(g) * .1 + Math.min(9, level - 1) * .075;
  g.flour = .93 + random(g) * .14;
  g.temperature = .28;
  for (let i = 0; i < COUNT; i++) {
    const angle = TAU * i / COUNT;
    const uneven = .96 + .08 * random(g);
    const u = Math.cos(angle) * uneven, v = Math.sin(angle) * uneven;
    const x = g.x + 53 * u, y = g.y + 35 * v;
    g.nodes.push({ u, v, x, y, px: x, py: y });
  }
  return g;
}

// Radiant warmth reaches the bench. The ember bed has a hotter, seeded centre.
export function heatAt(g, x, y) {
  const dx = (x - g.fireX) / 108, dy = (y - 151) / 139;
  return .23 + g.fire * 1.1 * Math.exp(-.84 * dx * dx - .77 * dy * dy);
}

function enter(g, stage) {
  g.stage = stage;
  g.age = 0;
}

function translate(g, x, y) {
  const dx = x - g.x, dy = y - g.y;
  for (const n of g.nodes) {
    n.x += dx; n.px += dx;
    n.y += dy; n.py += dy;
  }
  g.x = x; g.y = y;
}

function scatter(g, x, y, count) {
  for (let i = 0; i < count; i++) {
    const life = .32 + .48 * random(g);
    g.dust.push({ x, y, vx: (random(g) - .5) * 86, vy: -12 - 45 * random(g), life });
  }
}

export function down(g, x, y) {
  if (g.grip || ['done', 'burnt'].includes(g.stage)) return false;
  let nearest = 0, distance = Infinity;
  for (let i = 0; i < COUNT; i++) {
    const n = g.nodes[i], d = Math.hypot(x - n.x, y - n.y);
    if (d < distance) { distance = d; nearest = i; }
  }
  if (distance > 24 && Math.hypot((x - g.x) / 63, (y - g.y) / 46) > 1) return false;
  const local = g.stage === 'knead' || (g.stage === 'shape' && !g.shaped);
  g.grip = { x, y, sx: x, sy: y, ox: g.x, oy: g.y, nearest, local, effort: 0, tuck: 0 };
  g.started = true;
  return true;
}

export function move(g, x, y) {
  const h = g.grip;
  if (!h) return;
  const dx = x - h.x, dy = y - h.y;
  h.x = x; h.y = y;
  if (h.local) {
    const dist = Math.hypot(dx, dy);
    // A pull is local. Movement far beyond the reach of the held skin does no more work.
    if (Math.hypot(x - g.x, y - g.y) < 97) {
      h.effort += dist;
      if (g.stage === 'knead') {
        g.work = Math.min(1, g.work + dist / ((151 + 12 * Math.min(8, g.level)) * g.flour));
      }
      const radius = Math.hypot(h.sx - g.x, h.sy - g.y);
      const inward = radius - Math.hypot(x - g.x, y - g.y);
      h.tuck = Math.max(h.tuck, inward, radius < 23 ? Math.min(32, dist + h.effort / 2) : 0);
      if (dist > 1) {
        if (Math.floor(h.effort / 11) !== Math.floor((h.effort - dist) / 11)) scatter(g, x, y, 3);
      }
    }
  } else {
    const tx = h.ox + x - h.sx, ty = h.oy + y - h.sy;
    if (g.stage === 'rise') {
      // Leave room for the risen rim, proof meter and the next fold guide.
      translate(g, clamp(tx, 67, 293), clamp(ty, 243, 416));
      return;
    }
    translate(g, clamp(tx, 44, 316), clamp(ty, 102, 437));
  }
}

export function cancel(g) {
  const h = g.grip;
  if (h && !h.local) translate(g, h.ox, h.oy);
  g.grip = null;
}

export function up(g) {
  const h = g.grip;
  if (!h) return;
  g.grip = null;
  if (g.stage === 'knead' && g.work >= 1) {
    enter(g, 'rise');
  } else if (g.stage === 'shape') {
    if (h.local && h.tuck >= 16) {
      g.shaped = true;
      scatter(g, g.x, g.y, 9);
    } else if (!h.local && inOven(g.x, g.y)) {
      enter(g, 'bake');
    } else if (!h.local) translate(g, h.ox, h.oy);
  } else if (g.stage === 'bake') {
    if (g.y < 240) {
      if (!inOven(g.x, g.y)) translate(g, h.ox, h.oy);
      return;
    }
    translate(g, start.x, start.y);
    if (g.brown < GOLD) {
      g.last = 'pale';
      enter(g, 'shape');
    } else {
      g.last = 'baked';
      enter(g, 'serve');
    }
  } else if (g.stage === 'serve') {
    const hit = (x, y) => Math.hypot(g.x - x, g.y - y) < 38;
    const gift = g.remaining === 1 && g.age >= GUEST_ARRIVAL && hit(136, 216);
    if (gift || hit(67, 214)) {
      g.last = gift ? 'gift' : 'sale';
      const crust = Math.abs(g.brown - .82) < .13 ? 2 : 0;
      g.score += (gift ? 8 : 3) + crust;
      g.gifts += Number(gift);
      g.served++;
      g.remaining--;
      enter(g, g.remaining ? 'serve' : 'done');
    }
    translate(g, start.x, start.y);
  }
}

function solve(g) {
  // A soft shape-memory spring at each particle keeps the mass on the bench.
  // Neighbour and second-neighbour distance constraints transmit a pinch along the skin.
  const small = g.stage === 'bake' ? .65 : g.stage === 'serve' ? .84 : 1;
  const rx = small * (53 + 10 * g.proof - (g.shaped ? 5 : 0));
  const ry = small * (35 + 12 * g.proof - (g.shaped ? 10 : 0));
  const grip = g.grip?.local ? g.grip : null;
  let nx = 0, ny = 0, axial = 0, shear = 0;
  if (grip) {
    const held = g.nodes[grip.nearest];
    const radius = Math.hypot(held.u * rx, held.v * ry);
    nx = held.u * rx / radius;
    ny = held.v * ry / radius;
    const dx = grip.x - grip.sx, dy = grip.y - grip.sy;
    // Skin entering the folded centre piles up; a thumb can travel past that point.
    axial = clamp(dx * nx + dy * ny, -radius * .83, radius * .86);
    shear = clamp(-dx * ny + dy * nx, -25, 25);
  }
  for (let i = 0; i < COUNT; i++) {
    const n = g.nodes[i];
    const tx = g.x + n.u * rx, ty = g.y + n.v * ry;
    const vx = (n.x - n.px) * .85, vy = (n.y - n.py) * .85;
    n.px = n.x; n.py = n.y;
    n.x += vx + (tx - n.x) * .018 * g.elasticity;
    n.y += vy + (ty - n.y) * .018 * g.elasticity;
    if (grip) {
      const alignment = n.u * g.nodes[grip.nearest].u + n.v * g.nodes[grip.nearest].v;
      const weight = clamp((1 + alignment) / 2, 0, 1) ** 1.8;
      // Transverse spread displaces the dough under a press. The far rim stays grounded.
      const across = -ny * n.u * rx + nx * n.v * ry;
      const bulge = Math.max(0, -axial) * .014 * across * (.35 + .65 * weight);
      const side = shear * weight + bulge;
      n.x += (tx + nx * axial * weight - ny * side - n.x) * .21;
      n.y += (ty + ny * axial * weight + nx * side - n.y) * .21;
    }
  }
  for (const span of [1, 2]) {
    for (let i = 0; i < COUNT; i++) {
      const a = g.nodes[i], b = g.nodes[(i + span) % COUNT];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || .001;
      const rest = Math.hypot((b.u - a.u) * rx, (b.v - a.v) * ry);
      const k = .17 * (len - rest) / len;
      a.x += dx * k; a.y += dy * k;
      b.x -= dx * k; b.y -= dy * k;
    }
  }
}

export function step(g) {
  if (!g.started || g.stage === 'done' || g.stage === 'burnt') return;
  g.time += DT; g.age += DT;
  for (const p of g.dust) {
    p.x += p.vx * DT; p.y += p.vy * DT; p.vy += 90 * DT; p.life -= DT;
  }
  g.dust = g.dust.filter(p => p.life > 0);
  // During a pull the oven keeps cooking until the loaf crosses the sill.
  const warmth = heatAt(g, g.x, g.y);
  g.temperature += (warmth - g.temperature) * .022;
  if (g.stage === 'rise') {
    g.proof = Math.min(1, g.proof + DT * (.07 + .61 * g.temperature) * (.75 + .45 * g.proof) * g.yeast / g.flour);
    if (g.proof >= 1) {
      g.grip = null;
      enter(g, 'shape');
    }
  } else if (g.stage === 'bake') {
    if (inOven(g.x, g.y)) g.brown += DT * warmth * (.088 + .004 * Math.min(g.level, 9));
    if (g.brown >= BURNT) {
      g.grip = null;
      enter(g, 'burnt');
    }
  }
  solve(g);
}
