// Distances are bench units. Angles increase clockwise in the plane of the plate.
export const CENTER = { x: 180, y: 196 };
export const RAIL = 146;
export const BANDS = [1.47, 1.49, 1.52, 1.55, 1.58, 1.61];
export const PLATES = [
  { name: 'First light', cut: [0, 120, 240], offset: 0, exposures: [[-1, .79]], width: .20 },
  { name: 'Chromatic pair', cut: [0, 120, 240], offset: -9, exposures: [[0, .55], [5, .16]], width: .092 },
  { name: 'Return path', cut: [-5, 92, 224], offset: 8, exposures: [[1, .64], [3, .26]], width: .088 },
  { name: 'Violet edge', cut: [8, 132, 240], offset: -11, exposures: [[5, .69], [2, .20], [0, .84]], width: .08 },
  { name: 'Twin facets', cut: [0, 26, 120, 240], offset: 14, exposures: [[0, .2], [4, .85], [2, .5]], width: .073 },
  { name: 'Full spectrum', cut: [-11, 105, 228], offset: 2, exposures: [[0, .19], [1, .68], [2, .43], [3, .85], [4, .58], [5, .3]], width: .065 },
];
const radians = deg => deg * Math.PI / 180;
export const turnAngle = (position, level) => radians(-57 + 128 * (level === 1 ? .66 + .23 * position : position));
export const distanceAngle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const cross = (x, y, u, v) => x * v - y * u;

// The normal points back into the incident medium. A negative discriminant
// leaves the ray on the incident side of the facet (total internal reflection).
export function transmit(dx, dy, nx, ny, ratio) {
  const cosine = -(nx * dx + ny * dy);
  const discriminant = 1 - ratio * ratio * (1 - cosine * cosine);
  if (discriminant < 0) return { dx: dx + 2 * cosine * nx, dy: dy + 2 * cosine * ny, reflected: true };
  const correction = ratio * cosine - Math.sqrt(discriminant);
  return { dx: ratio * dx + correction * nx, dy: ratio * dy + correction * ny, reflected: false };
}

export function optics(state, indices = BANDS) {
  const plate = PLATES[state.level - 1];
  const source = { x: 13, y: CENTER.y + plate.offset };
  const vertices = plate.cut.map(deg => ({
    x: CENTER.x + 55 * Math.cos(state.angle + radians(deg)),
    y: CENTER.y + 55 * Math.sin(state.angle + radians(deg)),
  }));
  const rays = indices.map((ior, band) => {
    let x = source.x, y = source.y, dx = 1, dy = 0, inside = false, last = -1;
    const points = [source];
    for (let bounce = 0; bounce < 16; bounce++) {
      let nearest = Infinity, facet = -1, nx = 0, ny = 0;
      for (let i = 0; i < vertices.length; i++) {
        if (i === last) continue;
        const a = vertices[i], b = vertices[(i + 1) % vertices.length];
        const ex = b.x - a.x, ey = b.y - a.y;
        const denominator = cross(dx, dy, ex, ey);
        if (Math.abs(denominator) < 1e-9) continue;
        const u = cross(a.x - x, a.y - y, dx, dy) / denominator;
        const t = cross(a.x - x, a.y - y, ex, ey) / denominator;
        if (u < 0 || u > 1 || t < 1e-7 || t >= nearest) continue;
        nearest = t;
        facet = i;
        const normal = (inside ? -1 : 1) / Math.hypot(ex, ey);
        nx = ey * normal;
        ny = -ex * normal;
      }
      if (facet < 0) break;
      x += nearest * dx;
      y += nearest * dy;
      points.push({ x, y });
      const exit = transmit(dx, dy, nx, ny, inside ? ior : 1 / ior);
      dx = exit.dx;
      dy = exit.dy;
      if (!exit.reflected) inside = !inside;
      last = facet;
      if (!inside) break;
    }
    if (inside) return { points, angle: null, band };
    const ox = x - CENTER.x, oy = y - CENTER.y;
    const projection = ox * dx + oy * dy;
    const t = -projection + Math.sqrt(projection ** 2 + RAIL ** 2 - ox ** 2 - oy ** 2);
    const end = { x: x + t * dx, y: y + t * dy };
    points.push(end);
    return { points, angle: Math.atan2(end.y - CENTER.y, end.x - CENTER.x), band };
  });
  return { source, vertices, rays };
}

export function makePlate(level, seed) {
  const plate = PLATES[level - 1];
  let bits = seed >>> 0;
  const random = () => {
    bits = (Math.imul(bits, 1664525) + 1013904223) >>> 0;
    return bits / 2 ** 32;
  };
  const state = { level, seed, position: .08, angle: turnAngle(.08, level), started: false, targets: [], elapsed: 0, won: false };
  for (const [band, dial] of plate.exposures) {
    const position = dial + (random() - .5) * .024;
    const { rays } = optics({ level, angle: turnAngle(position, level) });
    const angle = band < 0 ? Math.atan2(
      rays.reduce((n, ray) => n + Math.sin(ray.angle), 0),
      rays.reduce((n, ray) => n + Math.cos(ray.angle), 0),
    ) : rays[band].angle;
    state.targets.push({ band, angle, width: plate.width, charge: 0, lit: false });
  }
  return state;
}

export function turn(state, position) {
  if (state.won || !Number.isFinite(position)) return;
  state.position = Math.max(0, Math.min(1, position));
  state.angle = turnAngle(state.position, state.level);
  state.started = true;
}

export function expose(state, field, dt) {
  if (!state.started || state.won || dt <= 0) return;
  state.elapsed += dt;
  for (const target of state.targets) {
    if (target.lit) continue;
    const caught = field.rays.every(ray => {
      if (target.band >= 0 && ray.band !== target.band) return true;
      return ray.angle !== null && distanceAngle(ray.angle, target.angle) <= target.width;
    });
    target.charge = Math.max(0, Math.min(1, target.charge + dt * (caught ? 1 / .42 : -1.65)));
    if (target.charge >= 1) target.lit = true;
  }
  state.won = state.targets.every(target => target.lit);
}
