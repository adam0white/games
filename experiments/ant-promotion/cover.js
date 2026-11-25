// Cover for Ant Promotion: a few rocks and patches of tall grass in the meadow (lab page ant-hide, folded in "but less prevalent").
// Pure geometry and the small rules sim.js calls. No drawing here, and no import from sim.js, so the page and the bots share it.
//
// Rules, as sim.js uses them (only while cover is on: a world made with cover, and the player at level COVER.from or above):
//   rock:  blocks sight and movement. Bodies slide round it (pushOut after every move).
//   grass: an animal inside a patch that is creeping (moving slower than COVER.still of its speed, or standing) cannot be seen from
//          outside the patch, unless the looker is very close (COVER.near times the two radii). Moving fast in grass rustles: seen as usual.
//   An alert animal that loses sight of the player to cover goes to the last place it saw the player and gives up after its usual hold
//   time, wherever the player is. Without cover, an alert animal only loses the player by distance.
//
// Density: aim for cover to decide about one chase in four, not every chase (owner: "but less prevalent"). Measured in bots.mjs section 7.
export const COVER = {
  from: 4, // the first level with cover: a new player's first minute is the meadow as it was
  cell: 400, rockP: 0.5, grassP: 0.6, // one chance of each per 400 x 400 cell (a screen is about one to two cells)
  rockR: [30, 50], grassR: [56, 90], clear: 330, // nothing within `clear` of the middle, where the player starts and comes back
  still: 0.45, near: 2.2,
  search: 0.55, // an animal that has lost you to cover walks (this much of its speed) to where it saw you last
  lose: 0.6, // seconds out of sight behind cover before an alert animal gives up (out of reach it is the animal's own hold time)
  rest: 2, // and once it gives up there it does not notice anyone for this many seconds (like a tired hunter), so a break is an escape
};

let MUT = null; // a deliberately broken rule for `node bots.mjs --mutate=rocks`; never set by the page
export const mutate = name => { MUT = name || null; };

function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// The layout for a world. Its own random stream, so the animals and their moves come out as they would without cover.
export function layout(seed, world) {
  const rand = rng((seed ^ 0x92d68ca2) >>> 0), rocks = [], grass = [], n = Math.round(world / COVER.cell), c = COVER.cell;
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
    const rx = (gx + 0.2 + rand() * 0.6) * c, ry = (gy + 0.2 + rand() * 0.6) * c, rr = COVER.rockR[0] + rand() * (COVER.rockR[1] - COVER.rockR[0]);
    const ga = rand() * 6.283, gr = COVER.grassR[0] + rand() * (COVER.grassR[1] - COVER.grassR[0]), roll = rand(), roll2 = rand();
    const gxp = Math.max(gr, Math.min(world - gr, rx + Math.cos(ga) * (rr + gr + 40))), gyp = Math.max(gr, Math.min(world - gr, ry + Math.sin(ga) * (rr + gr + 40)));
    const mid = (x, y, r) => Math.hypot(x - world / 2, y - world / 2) < COVER.clear + r;
    if (roll < COVER.rockP && !mid(rx, ry, rr)) rocks.push({ x: rx, y: ry, r: rr, k: rand() });
    if (roll2 < COVER.grassP && !mid(gxp, gyp, gr)) grass.push({ x: gxp, y: gyp, r: gr, k: rand() });
  }
  return { rocks, grass, taught: false };
}

// Distance along a ray from (x, y) in direction (ux, uy) to the first rock, up to max.
export function rayRock(rocks, x, y, ux, uy, max) {
  let best = max;
  for (const k of rocks) {
    const rx = k.x - x, ry = k.y - y, along = rx * ux + ry * uy;
    if (along <= 0 || along - k.r >= best) continue;
    const side = rx * uy - ry * ux; if (Math.abs(side) >= k.r) continue;
    if (rx * rx + ry * ry <= k.r * k.r) return 0; // inside a rock: sees nothing
    best = Math.min(best, along - Math.sqrt(k.r * k.r - side * side));
  }
  return best;
}
// Is the straight line between two points cut by a rock?
export function rockBetween(rocks, x, y, tx, ty) {
  if (MUT === 'rocks') return false;
  const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy); if (d < 1e-9) return false;
  return rayRock(rocks, x, y, dx / d, dy / d, d) < d;
}
export const patchAt = (C, x, y) => { for (const g of C.grass) if ((x - g.x) ** 2 + (y - g.y) ** 2 < g.r * g.r) return g; return null; };
// A creeping body in grass, seen from (vx, vy): hidden unless the looker shares its patch or is very close.
export function grassHides(C, b, v, bothR) {
  const g = patchAt(C, b.x, b.y); if (!g) return false;
  if (!(b.v <= b.speed * COVER.still)) return false; // moving fast rustles the grass
  if ((v.x - g.x) ** 2 + (v.y - g.y) ** 2 < g.r * g.r) return false; // the looker is in the same patch
  return Math.hypot(v.x - b.x, v.y - b.y) > COVER.near * bothR;
}
// Can a looker at v not see body b? b: { x, y, v (speed now), speed (its own top speed) }.
export const hidden = (C, v, b, bothR) => rockBetween(C.rocks, v.x, v.y, b.x, b.y) || grassHides(C, b, v, bothR);

// Rocks are solid: move a body of radius r out of any rock it is inside, and turn the part of its step that went into the rock
// into a slide round it, on the side it is heading for (b.a), so running into a rock costs little speed and never pins you.
export function pushOut(C, b, r) {
  for (const k of C.rocks) {
    const dx = b.x - k.x, dy = b.y - k.y, R = k.r + r; if (dx > R || dx < -R || dy > R || dy < -R) continue;
    const d = Math.hypot(dx, dy); if (d >= R) continue;
    const ux = d < 1e-6 ? 1 : dx / d, uy = d < 1e-6 ? 0 : dy / d, tx = -uy, ty = ux, hx = Math.cos(b.a || 0), hy = Math.sin(b.a || 0);
    const side = hx * tx + hy * ty >= 0 ? 1 : -1, a = (R - d) / R * side; // slide along the edge by the depth it went in
    const c = Math.cos(a), s = Math.sin(a), rx = ux * c - uy * s, ry = ux * s + uy * c;
    b.x = k.x + rx * R; b.y = k.y + ry * R;
  }
}

// The outline of what a looker at (x, y) sees, cut by rocks: from angle a0 to a1 out to R, and (when near > 0) the rest of the
// circle out to `near`. Returns [x0, y0, x1, y1, ...] in world units, in angle order; for a wedge (near = 0) put (x, y) first yourself.
// Extra rays just inside and outside each rock's edges make the shadow edges straight. null when no rock is in reach (draw the plain shape).
export function sightCut(rocks, x, y, a0, a1, R, near = 0) {
  const reach = Math.max(R, near), close = rocks.filter(k => Math.hypot(k.x - x, k.y - y) - k.r < reach);
  if (!close.length) return null;
  const full = near > 0 || a1 - a0 >= 2 * Math.PI - 1e-9, span = full ? 2 * Math.PI : a1 - a0, start = full ? a0 : a0;
  const wrapIn = a => { let t = (a - start) % (2 * Math.PI); if (t < 0) t += 2 * Math.PI; return t; };
  const ts = [], n = Math.max(12, Math.ceil(span * 14));
  for (let i = 0; i <= n; i++) ts.push(span * i / n);
  if (near > 0) ts.push(a1 - a0); // the corner where the wide part meets the near part
  for (const k of close) {
    const d = Math.hypot(k.x - x, k.y - y); if (d <= k.r) continue;
    const c = Math.atan2(k.y - y, k.x - x), o = Math.asin(k.r / d);
    for (const e of [c - o - 1e-4, c - o + 1e-4, c + o - 1e-4, c + o + 1e-4, c]) { const t = wrapIn(e); if (t <= span) ts.push(t); }
  }
  ts.sort((p, q) => p - q);
  const out = [], inWide = t => !full || near <= 0 || t <= a1 - a0 + 1e-9;
  for (const t of ts) {
    const a = start + t, ux = Math.cos(a), uy = Math.sin(a), far = inWide(t) ? R : near, d = rayRock(close, x, y, ux, uy, far);
    out.push(x + ux * d, y + uy * d);
  }
  return out;
}
