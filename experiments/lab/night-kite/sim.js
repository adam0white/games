export const WORLD = Object.freeze({ width: 360, height: 520 });
export const ROOF = Object.freeze({ x: 180, y: 300 });
export const LIMIT_LEVEL = 10;
const TICK = 1 / 60;
const GROUND = 488;
const SQUALL_LIMIT = 10;
const GRAVITY = 112;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Targets are given in world coordinates. A lantern takes two contacts,
// and a squall requires continuous control in its marked pocket.
const LEVELS = [
  [['ring', 245, 293, 24]],
  [['ring', 115, 251, 21], ['ring', 245, 212, 21]],
  [['lantern', 242, 354, 23]],
  [['ring', 87, 226, 19], ['ring', 257, 184, 20], ['ring', 153, 267, 19]],
  [['squall', 217, 224, 32]],
  [['lantern', 96, 349, 20], ['ring', 266, 178, 20]],
  [['ring', 266, 239, 18], ['squall', 128, 190, 29]],
  [['lantern', 267, 347, 19], ['lantern', 92, 356, 19]],
  [['squall', 257, 188, 28], ['ring', 86, 215, 17], ['ring', 229, 292, 17]],
  [['ring', 88, 182, 17], ['lantern', 275, 350, 18], ['squall', 156, 164, 27], ['ring', 245, 262, 17]]
];

function hash(seed) {
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
}

function target(s) {
  const [kind, x, y, r] = s.level ? LEVELS[s.level - 1][s.done] : endlessTarget(s);
  return { kind, x, y, r, carrying: false, progress: 0 };
}

function endlessTarget(s) {
  const id = s.done + 1;
  const type = ['ring', 'lantern', 'ring', 'squall'][(id - 1) % 4];
  return [
    type,
    82 + 196 * hash(s.seed + id * 2197),
    type === 'lantern' ? 345 + 12 * hash(s.seed + id * 1373) : 161 + 134 * hash(s.seed + id * 1373),
    type === 'squall' ? 29 : Math.max(16, 24 - id * 0.38)
  ];
}

export function createFlight(level = 1, seed = 1) {
  level = Number.isFinite(level) ? clamp(Math.trunc(level), 0, LIMIT_LEVEL) : 1;
  seed >>>= 0;
  const s = {
    kite: { x: 180, y: 308, vx: 0, vy: 0, angle: 0, spin: 0 },
    hand: { x: 180, y: GROUND }, line: 180, tension: 0, t: 0,
    level, seed, status: 'play', done: 0, total: level ? LEVELS[level - 1].length : 0,
    score: 0, storm: 0, strain: 0, exposure: 0, age: 0,
    control: { x: 180, y: 520 - 60 / 0.62 },
    phase: hash(seed) * Math.PI * 2
  };
  s.goal = target(s);
  return s;
}

export function windAt(s, x, y) {
  const phase = s.phase;
  const difficulty = s.level || Math.min(12, 3 + s.done * 0.65);
  const gust = Math.sin(s.t * 1.26 + x * 0.017 + phase);
  const lull = Math.sin(s.t * 0.54 + y * 0.012 - phase);
  const thermalX = 180 + 104 * Math.sin(s.t * 0.16 + phase);
  const thermal = Math.exp(-(((x - thermalX) / 49) ** 2 + ((y - 227) / 94) ** 2));
  const stormBand = Math.sin(s.t * 5.2 + y * 0.041 + phase);
  return {
    // The prevailing horizontal wind flows into the screen. The kite
    // stays in the vertical flight plane. Only x and y advect particles.
    x: (5 + difficulty) * (0.66 * gust + 0.34 * lull) + s.storm * 30 * stormBand,
    y: -31 * thermal - s.storm * 22 * Math.cos(s.t * 3.2 + x * 0.037),
    z: 122 + (8 + difficulty) * gust + 12 * lull + s.storm * 17 * stormBand,
    thermal
  };
}

export function flightConditions(s) {
  const wind = windAt(s, s.kite.x, s.kite.y);
  return {
    wind: s.storm > 0.32 ? 'squall' : wind.thermal > 0.55 ? 'thermal' :
      wind.z > 135 ? 'gust' : wind.z < 108 ? 'lull' : 'steady',
    remaining: s.level ? null : Math.max(0, deadline(s) - s.age),
    exposure: clamp(s.exposure / SQUALL_LIMIT, 0, 1)
  };
}

function deadline(s) {
  return Math.max(10, 24 - s.done * 0.53);
}

// Relative flow points downwind. Lift uses an orthonormal basis in the
// plane normal to flow. Positive bank tilts lift to the right.
export function aerodynamics(rx, ry, rz, bank) {
  const speed = Math.hypot(rx, ry, rz);
  const horizontal = Math.hypot(rx, rz);
  const dragScale = speed * (0.032 + 0.012 * Math.sin(bank) ** 2);
  const drag = { x: rx * dragScale, y: ry * dragScale, z: rz * dragScale };
  if (horizontal === 0) return { drag, lift: { x: 0, y: 0, z: 0 } };

  const normal = { x: rx * ry / (speed * horizontal), y: -horizontal / speed, z: rz * ry / (speed * horizontal) };
  const side = { x: rz / horizontal, z: -rx / horizontal };
  const liftMagnitude = speed ** 2 * (0.032 - 0.01 * Math.sin(bank) ** 2);
  const uprightLift = liftMagnitude * Math.cos(bank);
  const bankedLift = liftMagnitude * Math.sin(bank);
  const lift = {
    x: normal.x * uprightLift + side.x * bankedLift,
    y: normal.y * uprightLift,
    z: normal.z * uprightLift + side.z * bankedLift
  };
  return { drag, lift };
}

function fly(s) {
  const { kite, hand } = s;
  const wind = windAt(s, kite.x, kite.y);
  const rx = wind.x - kite.vx;
  const ry = wind.y - kite.vy;
  const dx = hand.x - kite.x;
  const dy = hand.y - kite.y;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = dx / distance;
  const ny = dy / distance;

  // The bridle steers the kite toward the pull of the line. Wind
  // produces a competing torque, while rotational drag damps flutter.
  const trim = Math.atan2(rx, wind.z) * 0.42 + nx * 0.85;
  const torque = (trim - kite.angle) * 33 - kite.spin * 9;
  kite.spin += torque * TICK;
  kite.angle += kite.spin * TICK;
  const { drag, lift } = aerodynamics(rx, ry, wind.z, kite.angle);
  const slack = distance - s.line;
  const separation = -(kite.vx * nx + kite.vy * ny);
  s.tension = slack > 0 ? Math.max(0, slack * 58 + separation * 8) : 0;
  kite.vx += (drag.x + lift.x + nx * s.tension) * TICK;
  kite.vy += (drag.y + lift.y + ny * s.tension + GRAVITY + (s.goal.carrying ? 45 : 0)) * TICK;
  kite.x += kite.vx * TICK;
  kite.y += kite.vy * TICK;
}

function advanceGoal(s) {
  const { kite, goal } = s;
  const contact = Math.hypot(kite.x - goal.x, kite.y - goal.y) <= goal.r;
  const speed = Math.hypot(kite.vx, kite.vy);
  if (goal.kind === 'squall') {
    const stable = contact && Math.abs(kite.angle) < 0.50 && speed < 65 && s.tension < 1000;
    goal.progress = clamp(goal.progress + (stable ? 1 : -1.7) * TICK / 2.1, 0, 1);
    if (goal.progress < 1) return;
  } else {
    if (!contact) return;
    if (goal.kind === 'lantern' && !goal.carrying) {
      s.goal = { ...goal, ...ROOF, r: 19, carrying: true, progress: 0.5 };
      return;
    }
    if (goal.carrying && speed > 64) return;
    goal.progress = 1;
  }

  s.done++;
  if (!s.level) s.score += (goal.kind === 'ring' ? 100 : 180) + Math.max(0, 60 - Math.floor(s.age * 5));
  if (s.level && s.done === s.total) {
    s.status = 'won';
    return;
  }
  s.age = 0;
  s.goal = target(s);
}

// Mutates and returns s. Missing input keeps the last hand position.
// Moving upward releases line. Moving downward reels line in.
export function step(s, control) {
  if (s.status !== 'play') return s;
  if (Number.isFinite(control?.x)) s.control.x = clamp(control.x, 0, WORLD.width);
  if (Number.isFinite(control?.y)) s.control.y = clamp(control.y, 0, WORLD.height);
  s.t += TICK;
  s.age += TICK;
  s.hand.x += clamp(clamp(s.control.x, 26, 334) - s.hand.x, -296 * TICK, 296 * TICK);
  const length = 120 + (520 - s.control.y) * 0.62;
  s.line += clamp(length - s.line, -78 * TICK, 108 * TICK);
  const storm = s.goal.kind === 'squall' ? 0.72 + 0.25 * Math.sin(s.t * 2.7 + s.phase) : 0;
  s.storm += (storm - s.storm) * 2.8 * TICK;
  fly(s);

  const { kite } = s;
  if (kite.x < 9 || kite.x > 351 || kite.y < 10 || kite.y > 440) {
    s.status = 'lost';
    return s;
  }
  s.strain = Math.max(0, s.strain + (s.tension > 2000 ? 1 : -2) * TICK);
  const outsideSquall = s.goal.kind === 'squall' &&
    Math.hypot(kite.x - s.goal.x, kite.y - s.goal.y) > s.goal.r * 1.9;
  s.exposure = Math.max(0, s.exposure + (outsideSquall ? 1 : -2) * TICK);
  if (s.strain > 0.65 || s.exposure > SQUALL_LIMIT ||
      (!s.level && s.age > deadline(s))) {
    s.status = 'lost';
    return s;
  }
  advanceGoal(s);
  return s;
}
