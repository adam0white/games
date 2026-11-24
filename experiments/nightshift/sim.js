// Floor coordinates are shared by the renderer, the touch mapping and the bots.
export const WIDTH = 390;
export const HEIGHT = 660;
export const DT = 1 / 60;
export const RADIUS = 58;
export const LIFT = 42;
export const REST = { x: 195, y: 543 };
export const EXITS = [{ x: 84, y: 123 }, { x: 306, y: 123 }];
export const MIRROR = { x: 235, y: 326 };
export const CASE = { x: 40, y: 253, width: 94, height: 114 };
export const REFLECTION = { x: 83, y: 297 };
export const FUSE = { x: 250, y: 527 };
export const STAIR = { x: 269, y: 201 };
// A floor hatch to the cellar opens on some nights. Lower exhibits can drop through it.
export const HATCH = { x: 195, y: 448 };
// The draped ghost can be stopped only before it has walked this far along its route.
export const GHOST_ZONE = 0.38;
// The mask paces in front of its door. A beam that touches it stops working.
export const MASK_Y = 166;
export const MASK_SWAY = 34;
export const RETRIP = 16;
// After a trip the box buzzes for this long before the lights start to drop, so a catch can finish.
export const GRACE = 1.5;
export const DEFAULT_SEED = 836361;
export const LAST = 18;
export const WINGS = ['Marble', 'Portrait', 'Natural'];
export const POSES = ['statue', 'armor', 'bear', 'dino', 'painting', 'statue'];
const HOMES = [[103, 241], [285, 239], [103, 352], [285, 358], [91, 482], [295, 485]];

// Each entry specifies the opening lesson, the size and cadence of the rounds, and the room's rules.
// Every night from 7 on has its own mix, and each has a rule that pulls the light away from the doors.
export const NIGHTS = [
  ['drag', 1, 9, ''], ['hold', 2, 9, ''], ['painting', 2, 8.5, ''],
  ['twins', 2, 8.3, 'twins'], ['mixed', 3, 8.7, ''], ['mixed', 3, 8.1, 'twins'],
  // Nights that teach a new rule wake fewer exhibits at once, so a player can watch the rule work.
  ['mirror', 3, 7.1, 'mirror'], ['shy', 2, 7.5, 'shy'], ['cat', 2, 7.9, 'cat shy'],
  ['hatch', 3, 8.7, 'hatch mirror'], ['pair', 4, 7.4, 'twins cat hatch'], ['mixed', 2, 7.7, 'mirror cat hatch shy'],
  ['fuse', 2, 8.2, 'fuse cat'], ['stairs', 3, 6.6, 'stairs hatch'], ['ghost', 2, 8.1, 'ghost fuse cat'],
  ['pair', 3, 7.6, 'twins shy fuse stairs hatch'], ['mirror-fuse', 2, 8.3, 'mirror fuse stairs cat ghost'],
  // The last night sends the whole museum in five big, slow waves.
  ['all', 5, 11, 'mirror twins shy cat fuse stairs hatch ghost'],
];
const INTRO = new Set(['drag', 'hold', 'painting', 'twins', 'mirror', 'shy', 'cat', 'fuse', 'stairs', 'hatch', 'ghost']);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= r ** 2;

export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailyKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function dailyNight(day) {
  const serial = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
  return { level: 12 + serial % 7, seed: Math.imul(serial, 2654435761) >>> 0 };
}

export function reflection(point) {
  if (!inside(point, MIRROR, 37)) return null;
  return {
    x: REFLECTION.x - (point.x - MIRROR.x) * 1.5,
    y: REFLECTION.y - (point.y - MIRROR.y) * 1.5,
  };
}

function path(home, upstairs, curve, exit) {
  const hall = { x: clamp(exit.x + curve, 48, 342), y: 167 };
  let points = upstairs ? [home, STAIR, hall, exit] : [home, hall, exit];
  if (exit === HATCH) points = [home, { x: (home.x + HATCH.x) / 2, y: (home.y + HATCH.y) / 2 + curve * 0.4 }, HATCH];
  else if (home.y > 300) {
    const left = home.x < WIDTH / 2;
    const crossesHall = left !== (exit === EXITS[0]);
    const aisle = (crossesHall ? (left ? 164 : 174) : (left ? 43 : 347)) + curve * 0.05;
    points = [home, { x: aisle, y: home.y - 32 }, { x: aisle, y: 163 }, exit];
  }
  return line(points, exit);
}

function line(points, exit) {
  let length = 0;
  const segments = points.slice(1).map((end, i) => {
    const start = points[i];
    const lengthHere = distance(start, end);
    const segment = { start, end, length: lengthHere, offset: length };
    length += lengthHere;
    return segment;
  });
  return { segments, length, exit };
}

export function pointAt(route, progress) {
  const along = progress * route.length;
  const seg = route.segments.findLast(s => along >= s.offset);
  const t = clamp((along - seg.offset) / seg.length, 0, 1);
  return { x: seg.start.x + (seg.end.x - seg.start.x) * t, y: seg.start.y + (seg.end.y - seg.start.y) * t };
}

function locate(actor) {
  const { x, y } = pointAt(actor.route, actor.progress);
  actor.x = x;
  actor.y = y;
}

// The share of its route an exhibit can walk before the light can no longer stop it.
export function deadline(s, a) {
  const guarded = s.shy && a.kind !== 'shy' && s.actors[3].state !== 'gone' && a.route.exit === s.maskExit ? a.route.guarded : 1;
  return a.kind === 'ghost' ? Math.min(GHOST_ZONE, guarded) : guarded;
}

export function create({ level = 1, seed = DEFAULT_SEED, mode = 'story', ...tuning } = {}) {
  level = clamp(Math.trunc(level) || 1, 1, LAST);
  const wing = Math.floor((level - 1) / 6);
  const [lesson, size, base, rules] = mode === 'long' ? NIGHTS[17] : NIGHTS[level - 1];
  const count = tuning.count ?? size;
  const cadence = tuning.cadence ?? base;
  const rng = random((seed ^ Math.imul(level, 0x9e3779b1)) >>> 0);
  // New choices draw from a second stream so the older nights keep their exact floors.
  const extra = random((seed ^ Math.imul(level, 0x85ebca6b) ^ 0x5bd1e995) >>> 0);
  const duration = mode === 'long' ? Infinity : 60 + 3 * wing;
  const has = new Set(rules.split(' '));
  const [mirror, twins, shy, cat, fuse, stairs, hatch, ghost] =
    ['mirror', 'twins', 'shy', 'cat', 'fuse', 'stairs', 'hatch', 'ghost'].map(rule => has.has(rule));
  const maskExit = shy ? Number(extra() < 0.5) : -1;
  const actors = HOMES.map(([x, y], id) => {
    let kind = POSES[id];
    if (id === 0 && lesson === 'painting') kind = 'painting';
    if (id === 0 && ghost) kind = 'ghost';
    if (id === 4 && level < 3) kind = 'bird';
    if (twins && (id === 1 || id === 4)) kind = 'twin';
    if (id === 3 && shy) kind = 'shy';
    // The balcony bust stands clear of the knight so the two never read as one figure.
    if (id === 1 && stairs) x = 290;
    if (id === 5 && stairs) {
      x = 222;
      y = 222;
    }
    let home = { x: x + (rng() - 0.5) * 14, y: y + (rng() - 0.5) * 12 };
    const curve = (rng() - 0.5) * 42;
    if (kind === 'shy') home = { x: EXITS[maskExit].x + (maskExit ? -8 : 8), y: MASK_Y };
    const upstairs = id === 5 && stairs;
    const drops = hatch && home.y > 300 && !upstairs && kind !== 'shy' && !(mirror && id === 2);
    // The mask edges only a short way toward its door, so it stays where the doorway light falls.
    const routes = kind === 'shy' ? [line([home, { x: home.x, y: MASK_Y - 24 }], EXITS[maskExit])]
      : [...EXITS, ...(drops ? [HATCH] : [])].map(exit => path(home, upstairs, curve, exit));
    const route = kind === 'shy' ? routes[0] : drops ? routes[2] : routes[Number(home.x > WIDTH / 2)];
    return {
      id, kind, home, route, routes, outings: 0, x: home.x, y: home.y, prevX: home.x, prevY: home.y,
      progress: 0, hold: 0, motion: 0, oldMotion: 0, stepAt: 0, lit: false,
      mirrored: mirror && id === 2, upstairs, state: 'home',
      speed: 1 / (10.9 - wing * 0.85 + rng() * 2.3 + (id === 5 && stairs ? 1.4 : 0)),
      holdTime: (lesson === 'drag' ? 0.82 : 1.22 + wing * 0.23) + (kind === 'dino' ? 0.15 : 0),
    };
  });

  const tutorialIds = {
    drag: [0], hold: [1], painting: [0], twins: [1, 4], mirror: [2],
    shy: [3], cat: [], fuse: [], stairs: [5], ghost: [0],
    hatch: actors.filter(a => a.route.exit === HATCH).map(a => a.id).slice(0, 1),
  };
  // A runner bound for the mask's door must be caught before it is this far along,
  // the first point where the pacing mask can block every aim that reaches it.
  const mask = actors[3];
  for (const a of actors) for (const route of a.routes) {
    route.guarded = 1;
    if (route.exit !== EXITS[maskExit] || a.kind === 'shy') continue;
    for (let p = 0; p <= 1; p += 0.01) {
      const at = pointAt(route, p);
      const blocked = [-1, -0.5, 0, 0.5, 1].some(side => [0, 24, 40, 52, 60].every(dy => {
        const point = { x: at.x, y: at.y + dy };
        const pacing = { x: mask.home.x + side * MASK_SWAY, y: MASK_Y };
        return !beamTouches(at, point) || beamTouches(pacing, point);
      }));
      if (blocked) { route.guarded = p; break; }
    }
  }
  const practice = mode === 'story' && INTRO.has(lesson) ? (lesson === 'cat' || lesson === 'fuse' ? 8 : 11) : 0;
  return {
    level, wing, mode, seed, rng, duration, lesson, count, cadence, mirror, twins, shy, cat, fuse, stairs, hatch, ghost,
    maskExit: EXITS[maskExit] ?? null, masked: false,
    actors, tick: 0, time: 0, escapes: 0, returned: 0, events: [], outcome: null,
    light: { ...REST }, oldLight: { ...REST }, bounce: null, blackout: false,
    catAt: null, catLit: false, catOff: 0, fused: false, fuseHold: 0, fuseTrip: Infinity, trips: 0, trippedAt: -Infinity,
    practice, hintDone: false, tutorIds: tutorialIds[lesson] ?? [],
    wave: 0, nextWave: practice || 1.15, activity: 0, closestEscape: 0,
  };
}

function awaken(s, actor) {
  if (actor.state !== 'home') return;
  actor.outings++;
  actor.state = 'roam';
  actor.stepAt = actor.motion + actor.id * 0.103;
  s.events.push({ type: 'wake', actor });
}

function wave(s) {
  const long = s.mode === 'long';
  const intensity = long ? Math.floor(s.time / 18) : 0;
  const count = long ? Math.min(6, 2 + intensity) : s.count;
  const candidates = s.actors.filter(a => a.state === 'home' && a.kind !== 'shy');
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(s.rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  // Give each exhibit a turn. The seeded shuffle breaks ties within a round.
  candidates.sort((a, b) => a.outings - b.outings);
  for (const actor of candidates.slice(0, count)) awaken(s, actor);
  if (s.twins && candidates.slice(0, count).some(a => a.kind === 'twin')) {
    s.actors.filter(a => a.kind === 'twin').forEach(a => awaken(s, a));
  }
  if (s.shy) awaken(s, s.actors[3]);
  if (s.cat && s.wave % 2 === 0) s.catOff = s.time + 4.4;
  s.wave++;
  s.nextWave = s.time + (long ? Math.max(2.6, 9 - intensity * 1.3) : s.cadence);
}

export function targetFor(actor) {
  if (actor.mirrored && actor.y >= CASE.y) {
    const aim = {
      x: MIRROR.x + (REFLECTION.x - actor.x) / 1.5,
      y: MIRROR.y + (REFLECTION.y - actor.y) / 1.5,
    };
    const d = distance(aim, MIRROR);
    if (d <= 32) return aim;
    const near = {
      x: MIRROR.x + (aim.x - MIRROR.x) * 32 / d,
      y: MIRROR.y + (aim.y - MIRROR.y) * 32 / d,
    };
    if (inside(reflection(near), actor, 51)) return near;
    return null;
  }
  return { x: actor.x, y: actor.y };
}

// Where to put the beam to stop an exhibit: on it, or just below it when that keeps the mask dark.
export function aimFor(s, a) {
  const direct = targetFor(a);
  if (!direct) return null;
  if (a.kind === 'ghost' && a.state === 'roam' && a.progress >= GHOST_ZONE) return null;
  const mask = s.shy && s.actors[3].state !== 'gone' ? s.actors[3] : null;
  if (!mask || a.mirrored && a.y >= CASE.y) return mask && beamTouches(mask, direct) ? null : direct;
  for (const dy of [0, 24, 40, 52, 60]) {
    const point = { x: direct.x, y: direct.y + dy };
    if (beamTouches(a, point) && !beamTouches(mask, point)) return point;
  }
  return null;
}

// Where to draw each figure so overlapping exhibits stay readable and tappable.
// The offsets are for drawing only; the light still acts on the real positions.
export const SPREAD = 24;
export function spread(actors) {
  const shown = actors.filter(a => a.state !== 'gone' && a.state !== 'home');
  const offset = new Map(shown.map(a => [a.id, { x: 0, y: 0 }]));
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
      const a = shown[i], b = shown[j];
      const oa = offset.get(a.id), ob = offset.get(b.id);
      const dx = b.x + ob.x - a.x - oa.x;
      const dy = b.y + ob.y - a.y - oa.y;
      if (Math.abs(dx) >= 36 || Math.abs(dy) >= 40) continue;
      const side = dx > 0 || (dx === 0 && a.id < b.id) ? 1 : -1;
      // The mask stays where it blocks the light; anything beside it moves the whole way.
      const push = (36 - Math.abs(dx)) / (a.kind === 'shy' || b.kind === 'shy' ? 1 : 2);
      if (a.kind !== 'shy') oa.x = clamp(oa.x - side * push, -SPREAD, SPREAD);
      if (b.kind !== 'shy') ob.x = clamp(ob.x + side * push, -SPREAD, SPREAD);
    }
  }
  return offset;
}

export function beamTouches(actor, point) {
  const body = { x: actor.x, y: clamp(point.y, actor.y - 27, actor.y) };
  return inside(body, point, RADIUS + 7);
}

function lit(s, actor) {
  if (s.blackout) return false;
  // Light passes through the ghost once it has left its ring.
  if (actor.kind === 'ghost' && actor.state === 'roam' && actor.progress >= GHOST_ZONE) return false;
  if (s.masked && actor.kind !== 'shy') return false;
  if (s.bounce && beamTouches(actor, s.bounce)) return true;
  return (!actor.mirrored || actor.y < CASE.y) && beamTouches(actor, s.light);
}

function updateCat(s) {
  if (!s.cat || s.time >= s.catOff) {
    s.catAt = null;
    s.catLit = false;
    return;
  }
  const t = 1 - (s.catOff - s.time) / 4.4;
  s.catAt = { x: 32 + 322 * t, y: 399 + Math.sin(t * Math.PI * 2) * 31 };
  const litNow = !s.blackout && !s.masked && inside(s.catAt, s.light, RADIUS);
  if (litNow && !s.catLit) {
    // A startled cat yowls and wakes the nearest exhibit that is still on its plinth.
    const sleeper = s.actors.filter(a => a.state === 'home' && a.kind !== 'shy')
      .sort((a, b) => distance(a.home, s.catAt) - distance(b.home, s.catAt))[0];
    if (sleeper) awaken(s, sleeper);
    s.events.push({ type: 'cat', x: s.catAt.x, y: s.catAt.y, woke: sleeper ?? null });
  }
  s.catLit = litNow;
}

function updateFuse(s) {
  if (!s.fuse) return;
  if (!s.fused && inside(s.light, FUSE, 34)) {
    s.fuseHold += DT;
    if (s.fuseHold >= 0.56) {
      s.fused = true;
      s.fuseHold = 0;
      s.fuseTrip = s.time + RETRIP;
      if (s.lesson === 'fuse') s.hintDone = true;
      s.events.push({ type: 'fuse', x: FUSE.x });
    }
  } else if (!s.fused) s.fuseHold = 0;
  // The breaker trips again while the night is busy, so the doors cannot be guarded forever.
  if (s.fused && s.time >= s.fuseTrip) {
    s.fused = false;
    s.fuseTrip = Infinity;
    s.trippedAt = s.time;
    s.trips++;
    s.events.push({ type: 'trip', x: FUSE.x });
  }
  const cycle = (s.time + 0.8) % 3.8;
  // A breaker left broken past the opening, or tripped again, keeps the lights out longer.
  s.blackout = !s.fused && s.time >= s.trippedAt + GRACE &&
    (cycle > 3.18 && cycle < 3.32 || cycle > (s.trips || s.time > 10 ? 2.6 : 3.49));
}

export function step(s, aim = REST) {
  if (s.outcome) return;
  s.tick++;
  s.time = s.tick * DT;
  s.events.length = 0;
  s.oldLight.x = s.light.x;
  s.oldLight.y = s.light.y;
  // Cap the beam's travel so a touch cannot sample the entire floor in one tick.
  const dx = clamp(aim.x, 22, WIDTH - 22) - s.light.x;
  const dy = clamp(aim.y, 84, HEIGHT - 35) - s.light.y;
  const amount = Math.max(1, Math.hypot(dx, dy) / (530 * DT));
  s.light.x += dx / amount;
  s.light.y += dy / amount;
  s.bounce = s.mirror ? reflection(s.light) : null;
  updateFuse(s);
  const mask = s.shy ? s.actors[3] : null;
  if (mask && mask.state !== 'gone') {
    // The mask paces across its doorway whether or not it is lit.
    const sway = mask.state === 'roam' ? Math.sin(s.time * 0.95) * MASK_SWAY : 0;
    mask.prevX = mask.x;
    mask.prevY = mask.y;
    const at = pointAt(mask.route, mask.progress);
    mask.x = at.x + sway;
    mask.y = at.y;
  }
  s.masked = !!mask && mask.state === 'roam' && !s.blackout &&
    (beamTouches(mask, s.light) || (!!s.bounce && beamTouches(mask, s.bounce)));
  updateCat(s);

  if (s.practice && s.tick === 61) {
    for (const id of s.tutorIds) awaken(s, s.actors[id]);
    if (s.lesson === 'cat') s.catOff = s.time + 4.4;
  }
  if (s.time >= s.nextWave) wave(s);

  for (const actor of s.actors) actor.lit = lit(s, actor);
  const twinHeld = s.twins && s.actors.some(a => a.kind === 'twin' && a.state !== 'gone' && a.lit);
  const force = s.mode === 'long' ? 1 + Math.max(0, s.time - 54) / 12 : 1;

  for (const a of s.actors) {
    if (a.kind !== 'shy') {
      a.prevX = a.x;
      a.prevY = a.y;
    }
    a.oldMotion = a.motion;
    a.frozen = false;
    if (a.state === 'return') {
      a.progress = Math.max(0, a.progress - DT * 0.81);
      a.motion += DT * 1.4;
      locate(a);
      if (a.progress === 0) {
        a.state = 'home';
        // Each outing takes the next way out: the other door, then the hatch where there is one.
        a.route = a.routes[(a.routes.indexOf(a.route) + 1) % a.routes.length];
      }
      continue;
    }
    if (a.state !== 'roam') continue;

    if (a.kind === 'shy') {
      if (!a.lit) continue;
    } else if (a.lit || (a.kind === 'twin' && twinHeld)) {
      a.frozen = true;
      if (a.hold === 0) s.events.push({ type: 'catch', actor: a });
      a.hold += DT;
      if (a.hold >= a.holdTime) {
        a.state = 'return';
        a.hold = 0;
        s.returned++;
        s.events.push({ type: 'return', actor: a });
        if (s.tutorIds.includes(a.id)) s.hintDone = true;
      }
      continue;
    }

    a.hold = Math.max(0, a.hold - DT * 2.1);
    // The ghost creeps while it can still be caught, then hurries.
    const pace = a.kind === 'shy' ? 0.7 : a.kind === 'ghost' ? (a.progress < GHOST_ZONE ? 0.5 : 1.3) : 1;
    a.progress += DT * a.speed * force * pace;
    if (a.kind === 'shy' && a.progress >= 0.06) s.hintDone = true;
    a.motion += DT * force * (a.kind === 'shy' ? 1.5 : 1);
    // The pacing mask is placed at the start of each step.
    if (a.kind !== 'shy') locate(a);
    if (a.motion >= a.stepAt) {
      a.stepAt = a.motion + (a.kind === 'dino' ? 0.55 : 0.62);
      s.events.push({ type: 'foot', actor: a });
    }
    if (a.progress >= 1) {
      a.state = 'gone';
      s.escapes++;
      s.events.push({ type: 'escape', actor: a });
      if (s.escapes === 3) {
        s.outcome = 'escaped';
        return;
      }
    } else s.closestEscape = Math.max(s.closestEscape, a.progress);
  }
  if (s.wave === 0 && s.hintDone) s.nextWave = Math.min(s.nextWave, s.time + 2.05);
  if (s.time >= s.duration) s.outcome = 'dawn';
}
