// Integer state. Rendering and wall-clock time stay outside the rules.
export const COLS = 15, ROWS = 20, TPS = 10, LENGTH = 180 * TPS;
export const AREAS = ['open', 'gap', 'tunnel'];
const MID = ROWS / 2, CELLS = COLS * ROWS;
const WAVE = 10, ALARM_WAVE = 8, WOUND = 3;
export const UNSEAL = 120 * TPS;
const CASTES = [{ hp: 144, bite: 1, stride: 4 }, { hp: 432, bite: 2, stride: 7 }];

export const cell = (x, y) => y * COLS + x;
export const col = p => p % COLS;
export const row = p => Math.floor(p / COLS);
const mirror = (p, side) => side ? cell(col(p), ROWS - 1 - row(p)) : p;
const distance = (a, b) => Math.abs(col(a) - col(b)) + Math.abs(row(a) - row(b));
export const areaAt = p => col(p) < 5 ? 0 : col(p) < 11 ? 1 : 2;
const away = (p, side) => side ? row(p) : ROWS - 1 - row(p);
const nearest = (points, p) => points.reduce((best, q, i) => distance(p, q) < distance(p, points[best]) ? i : best, 0);

export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

export function mapFor(seed, arena = null) {
  const rand = random(seed);
  const lanes = [[1, 2, 3, 4], [6 + rand() % 2], [12 + rand() % 2]];
  lanes[1].push(lanes[1][0] + 1);
  const rows = Array.from({ length: CELLS }, (_, p) => {
    const x = col(p), y = row(p), band = Math.min(y, ROWS - 1 - y);
    if (arena !== null) return lanes[arena].includes(x) ? arena + 1 : 0;
    if (band >= 8) return lanes[areaAt(p)].includes(x) ? areaAt(p) + 1 : 0;
    if (band >= 5 && (x === 5 || x === 11)) return 0;
    return 1;
  });
  const base = arena === null ? 7 : lanes[arena][0];
  const queens = [cell(base, ROWS - 1), cell(base, 0)];
  const routes = lanes.map(xs => [cell(xs[0], 12), cell(xs[0], 7)]);
  const links = rows.map((kind, p) => !kind ? [] : [
    col(p) > 0 ? p - 1 : -1, col(p) < COLS - 1 ? p + 1 : -1, p - COLS, p + COLS,
  ].filter(q => rows[q]));
  return { rows, queens, routes, links };
}

export function create(seed, { armies = [[48, 16], [48, 16]], arena = null } = {}) {
  const map = mapFor(seed, arena);
  const sides = armies.map(([minors, majors], side) => ({
    trail: [], alarm: -1, alarmUntil: -1, nextWave: 0, nextAlarm: 0, dead: 0, brokenAt: -1, pressureSince: -1,
    ants: Array.from({ length: minors + majors }, (_, i) => {
      const caste = i * majors % (minors + majors) < majors ? 1 : 0;
      return { id: i, pts: map.queens[side], prev: map.queens[side], moved: -100,
        caste, reserve: arena === null && i >= minors + majors - 8, hp: CASTES[caste].hp, role: 'home', waypoint: 0, ready: 0, scars: 0 };
    }),
  }));
  return { seed: seed >>> 0, map, arena, armies, sides, t: 0, over: null, pins: [], log: [],
    rand: random(seed ^ 0x126b00), fields: new Map() };
}

export function snap(map, p) {
  if (!Number.isInteger(p) || p < 0 || p >= CELLS) return -1;
  if (map.rows[p]) return p;
  let nearest = -1, best = CELLS;
  for (let q = 0; q < CELLS; q++) {
    if (map.rows[q] && distance(p, q) < best) { nearest = q; best = distance(p, q); }
  }
  return nearest;
}

function flow(g, target) {
  if (g.fields.has(target)) return g.fields.get(target);
  const next = new Int16Array(CELLS).fill(-1), queue = [target];
  next[target] = target;
  for (let i = 0; i < queue.length; i++) for (const p of g.map.links[queue[i]]) {
    if (next[p] === -1) { next[p] = queue[i]; queue.push(p); }
  }
  g.fields.set(target, next);
  return next;
}

export function route(g, start, points) {
  const path = [start];
  for (const target of points) {
    const next = flow(g, target);
    while (start !== target && next[start] !== -1) {
      start = next[start];
      path.push(start);
    }
  }
  return path;
}

export function through(g, side, lane, finish = true) {
  const [near, far] = g.map.routes[lane];
  return finish ? [mirror(near, side), mirror(far, side), g.map.queens[1 - side]] : [mirror(near, side)];
}

export function command(g, side, order) {
  if (g.over || !g.sides[side]) return false;
  const s = g.sides[side];
  let data = null;
  if (order.type === 'trail' && Array.isArray(order.points)) {
    const points = order.points.slice(0, 32).map(p => snap(g.map, p)).filter(p => p >= 0).filter((p, i, a) => p !== a[i - 1]);
    if (!points.length) return false;
    s.trail = points;
    s.nextWave = g.t;
    for (const a of s.ants) if (a.role === 'trail' || a.role === 'recall') {
      a.role = 'trail';
      // Join the nearest part of a newly drawn trail.
      a.waypoint = nearest(points, a.pts);
    }
    data = { points };
  } else if (order.type === 'alarm') {
    const spot = snap(g.map, order.spot);
    if (spot < 0 || (s.alarm === spot && s.alarmUntil < 0)) return false;
    s.alarm = spot;
    s.alarmUntil = -1;
    s.nextAlarm = g.t;
    data = { spot };
  } else if (order.type === 'quiet') {
    if (s.alarm < 0 || s.alarmUntil >= 0) return false;
    s.alarmUntil = g.t + 48;
  } else if (order.type === 'recall') {
    s.trail = [];
    dismiss(s);
    for (const a of s.ants) if (a.role === 'trail') a.role = 'recall';
  } else return false;
  g.log.push({ t: g.t, side, type: order.type, ...data });
  return true;
}

function dismiss(s) {
  s.alarm = -1;
  s.alarmUntil = -1;
  for (const a of s.ants) if (a.role === 'guard') {
    a.role = s.trail.length ? 'trail' : 'recall';
    a.waypoint = s.trail.length ? nearest(s.trail, a.pts) : 0;
  }
}

function deploy(g, side) {
  const s = g.sides[side];
  if (s.alarmUntil >= 0 && g.t >= s.alarmUntil) dismiss(s);
  if (s.alarm >= 0 && s.alarmUntil < 0 && g.t >= s.nextAlarm) {
    const candidates = s.ants.filter(a => (a.role === 'home' && !a.reserve && a.ready <= g.t) || a.role === 'trail' || a.role === 'recall');
    candidates.sort((a, b) => b.caste - a.caste || distance(a.pts, s.alarm) - distance(b.pts, s.alarm));
    for (const a of candidates.slice(0, ALARM_WAVE)) a.role = 'guard';
    s.nextAlarm = g.t + 26;
  }
  if (s.trail.length && g.t >= s.nextWave) {
    const ready = s.ants.filter(a => a.role === 'home' && !a.reserve && a.ready <= g.t);
    for (const a of ready.slice(0, WAVE)) { a.role = 'trail'; a.waypoint = 0; }
    s.nextWave = g.t + 18;
  }
}

function move(g, locked) {
  for (const [side, s] of g.sides.entries()) for (const a of s.ants) {
    let goal;
    if (a.role === 'trail') {
      while (a.waypoint < s.trail.length - 1 && a.pts === s.trail[a.waypoint]) a.waypoint++;
      goal = s.trail[a.waypoint];
    } else if (a.role === 'guard') goal = s.alarm;
    else if (a.role === 'limp' || a.role === 'recall') {
      goal = g.map.queens[side];
      if (a.pts === goal) {
        if (a.role === 'limp') {
          a.role = 'rest';
          a.ready = g.t + 270;
        } else a.role = 'home';
        continue;
      }
    } else if (a.role === 'rest' && g.t >= a.ready) {
      a.role = 'home';
      a.hp = CASTES[a.caste].hp;
      continue;
    } else continue;
    if (locked[side].has(a) || goal === a.pts) continue;
    const stride = CASTES[a.caste].stride;
    if (g.t - a.moved < (a.role === 'limp' ? stride * 2 : stride)) continue;
    const next = flow(g, goal)[a.pts];
    if (next < 0) continue;
    a.prev = a.pts;
    a.pts = next;
    a.moved = g.t;
  }
}

const active = a => a.role === 'trail' || a.role === 'guard' || a.role === 'escort';

function defend(g, side) {
  const queen = g.map.queens[side];
  const invaded = g.sides[1 - side].ants.some(a => active(a) && distance(a.pts, queen) <= 2);
  for (const a of g.sides[side].ants) {
    if (a.reserve && a.role === 'home' && invaded) a.role = 'escort';
    if (a.role === 'escort' && !invaded) a.role = 'home';
  }
}
const strength = a => CASTES[a.caste].bite;
export function score(g) {
  return g.sides.map(s => {
    const health = s.ants.reduce((sum, a) => sum + (a.role === 'dead' ? 0 : Math.max(0, Math.floor(100 * a.hp / CASTES[a.caste].hp))), 0);
    return Math.floor(health / Math.max(1, s.ants.length));
  });
}

function contacts(g) {
  const present = g.sides.map(s => {
    const cells = new Map();
    for (const a of s.ants) if (active(a)) {
      if (!cells.has(a.pts)) cells.set(a.pts, []);
      cells.get(a.pts).push(a);
    }
    return cells;
  });
  const meetings = new Map();
  for (const p of present[0].keys()) for (const q of [p, ...g.map.links[p]]) {
    if (!present[1].has(q)) continue;
    const y = Math.min(row(p), row(q)), lane = areaAt(p);
    const apron = g.arena === null && (y <= 4 ? 'north' : y >= 14 ? 'south' : '');
    const key = apron || lane;
    if (!meetings.has(key)) {
      const narrow = g.arena !== null || y >= MID - 3 && y < MID + 2;
      meetings.set(key, { lane, y, x: col(p), apron, width: narrow && lane > 0 ? 3 - lane : CELLS, cells: [new Set(), new Set()] });
    }
    const meeting = meetings.get(key);
    meeting.cells[0].add(p);
    meeting.cells[1].add(q);
  }
  return [...meetings.values()].map(front => ({
    ...front,
    sides: present.map(cells => [...cells.values()].flat().filter(a => {
      const x = col(a.pts), y = row(a.pts);
      if (front.apron) return Math.abs(front.y - y) <= 4 && Math.abs(front.x - x) <= 5;
      return areaAt(a.pts) === front.lane && Math.abs(front.y - y) <= (front.width === CELLS ? 4 : 2);
    })),
  }));
}

function fight(g, fronts) {
  const locks = [new Set(), new Set()];
  const old = g.pins;
  g.pins = [];
  for (const front of fronts) {
    const { lane } = front;
    const pinned = [0, 1].map(side => new Set(old.filter(p => p.lane === lane).flatMap(p => p.ants[side])));
    const teams = front.sides.map((ants, side) => ants
      .filter(a => !locks[side].has(a))
      .sort((a, b) => Number(!pinned[side].has(a.id)) - Number(!pinned[side].has(b.id)) ||
        (front.width < CELLS ? Number(!front.cells[side].has(a.pts)) - Number(!front.cells[side].has(b.pts)) || b.caste - a.caste : 0) ||
        away(b.pts, side) - away(a.pts, side)));
    const count = Math.min(front.width, teams[0].length, teams[1].length);
    if (!count) continue;
    const damage = [];
    for (let i = 0; i < count; i++) {
      const pair = teams.map(team => front.width < CELLS ? [team[i]] : team.filter((_, j) => j % count === i));
      for (const [side, group] of pair.entries()) {
        // Extra open-ground attackers all bite. Each ant keeps the same grapple
        // but alternates bites among its opponents when several ants pin it.
        const foes = pair[1 - side];
        for (const a of group) if ((g.t + a.id) % 3 === 0) {
          const target = foes[(Math.floor((g.t + a.id) / 3) + i) % foes.length];
          damage.push([target, strength(a), 1 - side]);
        }
      }
      g.pins.push({ lane, y: front.y, ants: pair.map(group => group.map(a => a.id)) });
    }
    // The queue stops at contact. Only the leading pair(s) can trade bites in cover.
    for (const [side, team] of teams.entries()) for (const a of team) locks[side].add(a);
    for (const [a, bite] of damage) a.hp -= bite;
    for (const [a, , side] of damage) {
      if (!active(a) || a.hp > CASTES[a.caste].hp / WOUND) continue;
      if (g.rand() % 5 === 0 || a.scars === 2) {
        a.role = 'dead';
        g.sides[side].dead++;
      } else {
        a.role = 'limp';
        a.scars++;
      }
      locks[side].delete(a);
    }
  }
  return locks;
}

export function areas(g) {
  const powers = AREAS.map(() => [0, 0]);
  for (const [side, s] of g.sides.entries()) for (const a of s.ants) {
    if (active(a)) powers[areaAt(a.pts)][side] += strength(a);
  }
  return AREAS.map((lane, i) => ({ lane, power: powers[i] }));
}

function settle(g) {
  const mobile = g.sides.map(s => s.ants.filter(a => a.role !== 'dead' && a.role !== 'limp' && a.role !== 'rest').length);
  const reasons = g.sides.map((s, side) => {
    const queen = g.map.queens[side];
    const enemy = g.sides[1 - side].ants.filter(a => active(a) && distance(a.pts, queen) <= 1).length;
    const guard = s.ants.some(a => active(a) && distance(a.pts, queen) <= 1);
    if (enemy >= 4 && !guard) {
      if (s.pressureSince < 0) s.pressureSince = g.t;
    } else s.pressureSince = -1;
    if (mobile[side] * 4 <= s.ants.length) {
      if (s.brokenAt < 0) s.brokenAt = g.t;
    } else s.brokenAt = -1;
    if (g.arena !== null || g.t < UNSEAL) return null;
    if (s.pressureSince >= 0 && g.t - s.pressureSince >= 120) return 'queen';
    if (s.brokenAt >= 0 && g.t - s.brokenAt >= 180) return 'break';
    return null;
  });
  if (reasons.some(Boolean)) {
    if (!reasons[0] || !reasons[1]) return { winner: reasons[0] ? 1 : 0, reason: reasons.find(Boolean) };
    const started = g.sides.map((s, side) => reasons[side] === 'queen' ? s.pressureSince + 120 : s.brokenAt + 180);
    const winner = started[0] === started[1] ? -1 : started[0] < started[1] ? 1 : 0;
    return { winner, reason: reasons[winner === 0 ? 1 : 0] };
  }
  if (g.t < LENGTH) return null;
  const [a, b] = score(g);
  const lead = a - b;
  return { winner: Math.abs(lead) < 3 ? -1 : lead > 0 ? 0 : 1, reason: 'time' };
}

export function step(g) {
  if (g.over) return g.over;
  for (const side of [0, 1]) {
    deploy(g, side);
    if (g.arena === null) defend(g, side);
  }
  move(g, fight(g, contacts(g)));
  g.t++;
  return g.over = settle(g);
}

export function play(seed, minds, options) {
  const g = create(seed, options);
  while (!g.over) {
    if (g.t % 10 === 0) for (const [side, mind] of minds.entries()) {
      const order = mind(g, side);
      if (order) command(g, side, order);
    }
    step(g);
  }
  return g;
}

export function replay(seed, log, ticks = LENGTH, options) {
  const g = create(seed, options);
  let i = 0;
  while (!g.over && g.t < ticks) {
    while (log[i]?.t === g.t) {
      const entry = log[i++];
      command(g, entry.side, entry);
    }
    step(g);
  }
  return g;
}
