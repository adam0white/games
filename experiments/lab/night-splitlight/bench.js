// The optical bench, rules version 2 (2026-11-24). Runs in Node for the bots and in the page.
// sim.js is the frozen version 1: its Snell's law (`transmit`) is used here unchanged, and bots.mjs proves that a bench
// holding one prism traces exactly the rays sim.js traced. Everything else here is new: mirrors, filters, thin lenses,
// transmission gratings, several sources, sliding parts, and the chord rule (every receiver fed at once).
// Distances are bench units, angles increase clockwise in the plane of the plate.
import { transmit } from './sim.js';

export const CENTER = { x: 180, y: 196 };
export const RAIL = 146;
export const BANDS = [1.47, 1.49, 1.52, 1.55, 1.58, 1.61];
// Wavelengths in nanometres for the grating, red to violet, matched to the six indices above.
export const WAVES = [650, 610, 570, 520, 470, 420];
export const FILL = 1 / .42, DRAIN = 1.65, MAX_RAYS = 48;
// Faults that `node bots.mjs --mutate=<name>` switches on to prove the checks catch them. Always empty in the page.
export const faults = {};
const radians = deg => deg * Math.PI / 180;
const cross = (x, y, u, v) => x * v - y * u;
export const distanceAngle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export const lights = (bands = BANDS) => bands.map((ior, band) => ({ band, ior, wave: WAVES[band] }));
// Lights between the six, for drawing only: band is fractional, index and wavelength are interpolated.
export function denseLights(count = 25, bands = BANDS) {
  return Array.from({ length: count }, (_, i) => {
    const f = i * (bands.length - 1) / (count - 1), lo = Math.floor(f), hi = Math.min(bands.length - 1, lo + 1), w = f - lo;
    return { band: f, ior: bands[lo] * (1 - w) + bands[hi] * w, wave: WAVES[lo] * (1 - w) + WAVES[hi] * w };
  });
}

// ---------- parts and controls ----------
// A part: { kind: 'prism' | 'mirror' | 'filter' | 'lens' | 'grating', at: [x, y], ... }
//   prism   cut: vertex angles in degrees, r: radius (55)
//   others  len: length; filter band; lens f (focal length); grating pitch (nm) and orders
//   angle: fixed angle in degrees, or turn: [from, to] in degrees over the control's travel
//   slide: [x, y], the far end of a straight track from `at`
// A control is [part, 'turn' | 'slide'], in the order the parts list them.
export function controlsOf(level) {
  const list = [];
  level.parts.forEach((part, i) => { if (part.turn) list.push([i, 'turn']); if (part.slide) list.push([i, 'slide']); });
  return list;
}
// Where each part is for a set of control values.
export function pose(level, values) {
  const controls = controlsOf(level);
  return level.parts.map((part, i) => {
    const t = controls.findIndex(([p, d]) => p === i && d === 'turn'), s = controls.findIndex(([p, d]) => p === i && d === 'slide');
    const v = t < 0 ? null : values[t];
    const angle = part.turn ? radians(part.turn[0] + (part.turn[1] - part.turn[0]) * v) : radians(part.angle || 0);
    const u = s < 0 ? 0 : values[s];
    const x = part.slide ? part.at[0] + (part.slide[0] - part.at[0]) * u : part.at[0];
    const y = part.slide ? part.at[1] + (part.slide[1] - part.at[1]) * u : part.at[1];
    return { ...part, angle, x, y };
  });
}
// Prisms become polygons; flat parts become segments.
function build(posed) {
  return posed.map(p => {
    if (p.kind === 'prism') {
      const r = p.r || 55;
      return { ...p, vertices: p.cut.map(deg => ({ x: p.x + r * Math.cos(p.angle + radians(deg)), y: p.y + r * Math.sin(p.angle + radians(deg)) })) };
    }
    const hx = Math.cos(p.angle) * p.len / 2, hy = Math.sin(p.angle) * p.len / 2;
    return { ...p, a: { x: p.x - hx, y: p.y - hy }, b: { x: p.x + hx, y: p.y + hy } };
  });
}

// ---------- tracing ----------
// sources: [{ at: [x, y], dir: degrees, band: -1 (white) or one band }]
export function trace(level, values, spectrum = lights(), maxRays = MAX_RAYS) {
  const parts = build(pose(level, values));
  const rays = [];
  const queue = [];
  level.sources.forEach((src, s) => {
    for (const light of spectrum) {
      if (src.band >= 0 && Math.round(light.band) !== src.band) continue;
      const d = radians(src.dir || 0);
      const start = { x: src.at[0], y: src.at[1] };
      queue.push({ ...light, src: s, order: 0, x: start.x, y: start.y, dx: src.dir ? Math.cos(d) : 1, dy: src.dir ? Math.sin(d) : 0, points: [start], route: '', medium: -1, lastPart: -1, lastEdge: -1, events: 0, bounces: 0 });
    }
  });
  while (queue.length) {
    const ray = queue.shift();
    finish(ray, parts, queue, rays.length, maxRays);
    rays.push(ray);
  }
  return { source: level.sources[0] && { x: level.sources[0].at[0], y: level.sources[0].at[1] }, sources: level.sources, parts, vertices: parts.find(p => p.kind === 'prism')?.vertices || [], rays };
}

function hitSegment(ray, a, b) {
  const ex = b.x - a.x, ey = b.y - a.y;
  const denominator = cross(ray.dx, ray.dy, ex, ey);
  if (Math.abs(denominator) < 1e-9) return null;
  const u = cross(a.x - ray.x, a.y - ray.y, ray.dx, ray.dy) / denominator;
  const t = cross(a.x - ray.x, a.y - ray.y, ex, ey) / denominator;
  if (u < 0 || u > 1 || t < 1e-7) return null;
  return { t, u, ex, ey };
}

function finish(ray, parts, queue, done, maxRays) {
  let { x, y, dx, dy } = ray;
  const ior = ray.ior;
  for (; ray.events < 40; ray.events++) {
    let nearest = Infinity, hit = null;
    const inside = ray.medium >= 0;
    for (let p = 0; p < parts.length; p++) {
      if (inside && p !== ray.medium) continue;
      const part = parts[p];
      if (part.vertices) {
        const v = part.vertices;
        for (let i = 0; i < v.length; i++) {
          if (p === ray.lastPart && i === ray.lastEdge) continue;
          const h = hitSegment({ x, y, dx, dy }, v[i], v[(i + 1) % v.length]);
          if (!h || h.t >= nearest) continue;
          nearest = h.t; hit = { p, i, ...h };
        }
      } else if (p !== ray.lastPart) {
        const h = hitSegment({ x, y, dx, dy }, part.a, part.b);
        if (!h || h.t >= nearest) continue;
        nearest = h.t; hit = { p, i: 0, ...h };
      }
    }
    if (!hit) break;
    x += nearest * dx;
    y += nearest * dy;
    ray.points.push({ x, y });
    const part = parts[hit.p];
    ray.lastPart = hit.p; ray.lastEdge = hit.i; ray.route += hit.p + '.' + hit.i + ' ';
    if (part.vertices) {
      // Same arithmetic as sim.js: the normal points back into the incident medium.
      const normal = (inside ? -1 : 1) / Math.hypot(hit.ex, hit.ey);
      const nx = hit.ey * normal, ny = -hit.ex * normal;
      const exit = transmit(dx, dy, nx, ny, inside ? ior : 1 / ior);
      dx = exit.dx; dy = exit.dy;
      if (!exit.reflected) { ray.medium = inside ? -1 : hit.p; ray.bounces = 0; }
      ray.bounces++;
      if (ray.medium >= 0 && ray.bounces >= 16) break;
      continue;
    }
    const len = Math.hypot(hit.ex, hit.ey), tx = hit.ex / len, ty = hit.ey / len;
    let nx = ty, ny = -tx;
    if (nx * dx + ny * dy > 0) { nx = -nx; ny = -ny; } // n faces the incoming ray
    if (part.kind === 'mirror') {
      const c = dx * nx + dy * ny;
      const k = faults.mirror ? 1 : 2;
      dx -= k * c * nx; dy -= k * c * ny;
    } else if (part.kind === 'filter') {
      if (!faults.filter && Math.abs(ray.band - part.band) > .5) { ray.blocked = hit.p; break; }
    } else if (part.kind === 'lens') {
      // Ideal thin lens: slope along the axis changes by -h / f, h measured from the lens centre.
      const h = (x - part.x) * tx + (y - part.y) * ty;
      const along = -(dx * nx + dy * ny), side = dx * tx + dy * ty;
      const slope = side / along - (faults.lens ? -h : h) / part.f;
      const m = Math.hypot(1, slope);
      dx = (-nx + slope * tx) / m; dy = (-ny + slope * ty) / m;
    } else if (part.kind === 'grating') {
      // Transmission grating: sin θm = sin θi + m λ / d, θ measured from the normal along the grating.
      const along = -(dx * nx + dy * ny), sinIn = dx * tx + dy * ty;
      const orders = part.orders || [-1, 0, 1];
      let kept = false;
      for (const m of orders) {
        const s = sinIn + (faults.grating ? -m : m) * ray.wave / part.pitch;
        if (Math.abs(s) >= 1) continue;
        const c = Math.sqrt(1 - s * s) * Math.sign(along || 1);
        const ndx = -nx * c + tx * s, ndy = -ny * c + ty * s;
        if (m === 0) { dx = ndx; dy = ndy; kept = true; continue; }
        if (done + queue.length + 1 >= maxRays) continue;
        queue.push({ ...ray, route: ray.route + m, order: ray.order + m, x, y, dx: ndx, dy: ndy, points: ray.points.slice(), events: ray.events + 1 });
      }
      if (!kept) { ray.blocked = hit.p; break; }
    }
  }
  ray.x = x; ray.y = y; ray.dx = dx; ray.dy = dy;
  if (ray.medium >= 0 || ray.blocked !== undefined || ray.events >= 40) { ray.angle = null; return; }
  const ox = x - CENTER.x, oy = y - CENTER.y;
  const projection = ox * dx + oy * dy;
  const t = -projection + Math.sqrt(projection ** 2 + RAIL ** 2 - ox ** 2 - oy ** 2);
  const end = { x: x + t * dx, y: y + t * dy };
  ray.points.push(end);
  ray.angle = Math.atan2(end.y - CENTER.y, end.x - CENTER.x);
}

// ---------- receivers and the chord rule ----------
// A receiver wants one band, or white (-1): all six bands at once. It is fed when some ray of its band (for white,
// some ray of every band) ends inside its window. A moving receiver swings by `swing` radians every `period` seconds.
// It starts at the far end of its swing and passes the answer a quarter period after play starts.
export const receiverAngle = (target, elapsed) => target.swing && !faults.moving ? target.angle + target.swing * Math.cos(2 * Math.PI * elapsed / target.period) : target.angle;
export function fed(target, rays, elapsed = 0) {
  const at = receiverAngle(target, elapsed);
  const inside = ray => ray.angle !== null && distanceAngle(ray.angle, at) <= target.width;
  if (target.band >= 0) return rays.some(ray => ray.band === target.band && inside(ray));
  return BANDS.every((_, b) => rays.some(ray => ray.band === b && inside(ray)));
}

export function seeded(seed) {
  let bits = seed >>> 0;
  return () => (bits = (Math.imul(bits, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}
// Receivers are placed by the tracer at the level's hidden answer, so every level is solvable by construction.
// receivers: [[band, { src, order, swing, period }]...]; band -1 sits at the mean of that source's rays.
export function placeReceivers(level, answer) {
  const { rays } = trace(level, answer);
  return level.receivers.map(([band, opt = {}]) => {
    const pick = rays.filter(ray => ray.angle !== null && (opt.src === undefined || ray.src === opt.src) && (opt.order === undefined || ray.order === opt.order) && (band < 0 || ray.band === band));
    if (!pick.length) throw new Error(`level ${level.id}: no ray for receiver ${band}`);
    const angle = band < 0 ? Math.atan2(pick.reduce((n, r) => n + Math.sin(r.angle), 0), pick.reduce((n, r) => n + Math.cos(r.angle), 0)) : pick[0].angle;
    const target = { band, angle, width: opt.width || level.width, fed: false, lit: false, charge: 0 };
    if (opt.swing) { target.swing = opt.swing; target.period = opt.period || 7; }
    return target;
  });
}

export function makeBench(level, { values } = {}) {
  const controls = controlsOf(level);
  const start = values || level.start || controls.map(() => .08);
  const state = {
    id: level.id, values: start.slice(), start: start.slice(), selected: 0, started: false, elapsed: 0, charge: 0, won: false, turns: 0,
    targets: placeReceivers(level, level.answer),
  };
  return state;
}

export function setValue(state, control, value) {
  if (state.won || !Number.isFinite(value)) return false;
  const v = Math.max(0, Math.min(1, value));
  if (state.values[control] === v) { state.started = true; return false; }
  state.values[control] = v;
  state.started = true;
  return true;
}

// Advance the bench clock by dt with the rays standing still. Returns the receivers fed now.
export function expose(state, field, dt) {
  if (!state.started || state.won || dt <= 0) return;
  state.elapsed += dt;
  let all = true;
  for (const target of state.targets) {
    target.fed = fed(target, field.rays, state.elapsed);
    target.lit = target.fed;
    if (!target.fed) all = false;
  }
  if (faults.chord) all = state.targets.some(target => target.fed);
  state.charge = Math.max(0, Math.min(1, state.charge + dt * (all ? FILL : -DRAIN)));
  for (const target of state.targets) target.charge = target.fed ? state.charge : 0;
  if (state.charge >= 1) {
    state.won = true;
    for (const target of state.targets) target.lit = true;
  }
}
