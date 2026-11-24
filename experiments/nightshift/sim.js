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
export const DEFAULT_SEED = 836361;
export const LAST = 18;
export const WINGS = ['Marble', 'Portrait', 'Natural'];
export const POSES = ['statue', 'armor', 'bear', 'dino', 'painting', 'statue'];
const HOMES = [[103, 241], [285, 239], [103, 352], [285, 358], [91, 482], [295, 485]];

// Each entry specifies the opening lesson, then the size and cadence of the rounds.
const NIGHTS = [
  ['drag', 1, 9], ['hold', 2, 9], ['painting', 2, 8.5],
  ['twins', 2, 8.3], ['mixed', 3, 8.7], ['mixed', 3, 8.1],
  ['mirror', 3, 7.1], ['shy', 3, 7], ['cat', 3, 6.9],
  ['mirrors', 4, 7.7], ['pair', 4, 7.4], ['mixed', 4, 7.2],
  ['fuse', 4, 6.7], ['stairs', 4, 6.5], ['upper', 5, 7.6],
  ['pair', 5, 7.1], ['mirror-fuse', 5, 6.7], ['all', 6, 7.5],
];
const INTRO = new Set(['drag', 'hold', 'painting', 'twins', 'mirror', 'shy', 'cat', 'fuse', 'stairs']);
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
  if (home.y > 300) {
    const left = home.x < WIDTH / 2;
    const crossesHall = left !== (exit === EXITS[0]);
    const aisle = (crossesHall ? (left ? 164 : 174) : (left ? 43 : 347)) + curve * 0.05;
    points = [home, { x: aisle, y: home.y - 32 }, { x: aisle, y: 163 }, exit];
  }
  let length = 0;
  const segments = points.slice(1).map((end, i) => {
    const start = points[i];
    const lengthHere = distance(start, end);
    const segment = { start, end, length: lengthHere, offset: length };
    length += lengthHere;
    return segment;
  });
  return { segments, length };
}

function locate(actor) {
  const along = actor.progress * actor.route.length;
  const seg = actor.route.segments.findLast(s => along >= s.offset);
  const t = clamp((along - seg.offset) / seg.length, 0, 1);
  actor.x = seg.start.x + (seg.end.x - seg.start.x) * t;
  actor.y = seg.start.y + (seg.end.y - seg.start.y) * t;
}

export function create({ level = 1, seed = DEFAULT_SEED, mode = 'story' } = {}) {
  level = clamp(Math.trunc(level) || 1, 1, LAST);
  const wing = Math.floor((level - 1) / 6);
  const [lesson, count, cadence] = mode === 'long' ? NIGHTS[17] : NIGHTS[level - 1];
  const rng = random((seed ^ Math.imul(level, 0x9e3779b1)) >>> 0);
  const duration = mode === 'long' ? Infinity : 60 + 3 * wing;
  const mirror = ['mirror', 'mirrors', 'mirror-fuse', 'all'].includes(lesson) || level === 12;
  const twins = ['twins', 'pair', 'all'].includes(lesson) || level === 6;
  const shy = lesson === 'shy' || level === 10 || level === 16;
  const cat = lesson === 'cat' || (level >= 11 && (level % 2 || level === 18));
  const fuse = ['fuse', 'upper', 'mirror-fuse', 'all'].includes(lesson);
  const stairs = ['stairs', 'upper', 'all'].includes(lesson) || level === 16 || level === 17;
  const actors = HOMES.map(([x, y], id) => {
    let kind = POSES[id];
    if (id === 0 && lesson === 'painting') kind = 'painting';
    if (id === 4 && level < 3) kind = 'bird';
    if (twins && (id === 1 || id === 4)) kind = 'twin';
    if (id === 3 && shy) kind = 'shy';
    if (id === 5 && stairs) {
      x = 238;
      y = 236;
    }
    const home = { x: x + (rng() - 0.5) * 14, y: y + (rng() - 0.5) * 12 };
    const curve = (rng() - 0.5) * 42;
    const routes = EXITS.map(exit => path(home, id === 5 && stairs, curve, exit));
    const route = routes[Number(home.x > WIDTH / 2)];
    return {
      id, kind, home, route, routes, outings: 0, x: home.x, y: home.y, prevX: home.x, prevY: home.y,
      progress: 0, hold: 0, motion: 0, oldMotion: 0, stepAt: 0, lit: false,
      mirrored: mirror && id === 2, upstairs: stairs && id === 5, state: 'home',
      speed: 1 / (10.9 - wing * 0.85 + rng() * 2.3 + (id === 5 && stairs ? 1.4 : 0)),
      holdTime: (lesson === 'drag' ? 0.82 : 1.22 + wing * 0.23) + (kind === 'dino' ? 0.15 : 0),
    };
  });

  const tutorialIds = {
    drag: [0], hold: [1], painting: [0], twins: [1, 4], mirror: [2],
    shy: [3], cat: [], fuse: [], stairs: [5],
  };
  const practice = mode === 'story' && INTRO.has(lesson) ? (lesson === 'cat' || lesson === 'fuse' ? 8 : 11) : 0;
  return {
    level, wing, mode, seed, rng, duration, lesson, count, cadence, mirror, twins, shy, cat, fuse, stairs,
    actors, tick: 0, time: 0, escapes: 0, returned: 0, events: [], outcome: null,
    light: { ...REST }, oldLight: { ...REST }, bounce: null, blackout: false,
    catAt: null, catLit: false, catOff: 0, fused: false, fuseHold: 0,
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

function beamTouches(actor, point) {
  const body = { x: actor.x, y: clamp(point.y, actor.y - 27, actor.y) };
  return inside(body, point, RADIUS + 7);
}

function lit(s, actor) {
  if (s.blackout) return false;
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
  const litNow = !s.blackout && inside(s.catAt, s.light, RADIUS);
  if (litNow && !s.catLit) s.events.push({ type: 'cat', x: s.catAt.x });
  s.catLit = litNow;
}

function updateFuse(s) {
  if (!s.fuse) return;
  if (!s.fused && inside(s.light, FUSE, 34)) {
    s.fuseHold += DT;
    if (s.fuseHold >= 0.56) {
      s.fused = true;
      if (s.lesson === 'fuse') s.hintDone = true;
      s.events.push({ type: 'fuse', x: FUSE.x });
    }
  } else if (!s.fused) s.fuseHold = 0;
  const cycle = (s.time + 0.8) % 3.8;
  s.blackout = !s.fused && (cycle > 3.18 && cycle < 3.32 || cycle > 3.49);
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
    a.prevX = a.x;
    a.prevY = a.y;
    a.oldMotion = a.motion;
    a.frozen = false;
    if (a.state === 'return') {
      a.progress = Math.max(0, a.progress - DT * 0.81);
      a.motion += DT * 1.4;
      locate(a);
      if (a.progress === 0) {
        a.state = 'home';
        a.route = a.route === a.routes[0] ? a.routes[1] : a.routes[0];
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
    a.progress += DT * a.speed * force * (a.kind === 'shy' ? 1.28 : 1);
    if (a.kind === 'shy' && a.progress >= 0.06) s.hintDone = true;
    a.motion += DT * force * (a.kind === 'shy' ? 1.5 : 1);
    locate(a);
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
