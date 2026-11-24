// Hold Your Breath. Fixed-step, deterministic rules; no browser or wall clock.
export const DT = 1 / 30;
export const ALCOVES = [0, 0.5, 1];
export const LEVELS = [
  [3, 1, 12, 0.2, 16],
  [3, 2, 11.8, 0.23, 24],
  [3, 2, 11.6, 0.26, 28],
  [4, 2, 11.4, 0.28, 30],
  [4, 3, 11.2, 0.3, 32],
  [4, 3, 11, 0.32, 34],
  [4, 3, 10.8, 0.34, 36],
  [4, 3, 10.6, 0.36, 38],
  [5, 4, 10.4, 0.38, 40],
  [5, 4, 10.2, 0.4, 42],
  [5, 4, 10, 0.42, 44],
  [5, 5, 9.8, 0.44, 46],
].map(([floors, count, period, duty, drain], i) => ({
  level: i + 1,
  floors,
  count,
  period,
  duty,
  drain,
  speed: 0.142,
  second: i >= 5,
  permanentFloor: i >= 3 ? 2 : 0,
  refuses: i >= 8,
  cat: i >= 10,
  limit: 240,
  alcoves: ALCOVES,
}));
export function rng(seed) {
  let r = seed | 0;
  return () => {
    r += 0x6d2b79f5;
    let x = r;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mod = (x, n) => ((x % n) + n) % n;
export const GAP = { neighbour: 0.045, elder: 0.1, child: 0.085, cat: 0.035 };
export function create({ level = 1, seed = 1, daily = false } = {}) {
  const config = { ...LEVELS[clamp(level - 1, 0, 11)] };
  if (daily)
    Object.assign(config, {
      floors: 5,
      count: 4,
      period: 10.5,
      duty: 0.36,
      drain: 29,
      second: true,
      permanentFloor: 2,
      refuses: true,
      cat: true,
      limit: Infinity,
    });
  const random = rng(seed),
    turn = config.floors * 1.3;
  const people = Array.from({ length: config.count }, (_, i) => {
    const floor =
      config.count === 1
        ? config.floors
        : 1 + Math.round((i * (config.floors - 1)) / (config.count - 1));
    return {
      id: i,
      kind:
        config.cat && i === config.count - 1
          ? "cat"
          : i === 1
            ? "elder"
            : i === 2
              ? "child"
              : "neighbour",
      floor,
      at: (floor - 1) * 1.3 + 0.8,
      progress: (floor - 1) * 1.3 + 0.8,
      breath: 100,
      joined: false,
      rescued: false,
      refuses: config.refuses && i === config.count - 2,
      waiting: false,
    };
  });
  return {
    level: config.level,
    seed,
    daily,
    config,
    turn,
    length: turn * 2,
    t: 0,
    tick: 0,
    progress: 0,
    returning: false,
    people,
    breath: 100,
    over: null,
    events: [],
    stars: 0,
    rescued: 0,
    held: false,
    floorReached: 0,
    waveHits: 0,
    minimumBreath: 100,
    dailyFloors: 0,
    totalRescued: 0,
    score: 0,
    round: 1,
    phases: Array.from({ length: 16 }, () => random() * 0.35),
  };
}
// The route is .3 stair + 1 corridor per floor. The second half retraces it.
export function position(s, progress = s.progress) {
  const u = clamp(
    progress <= s.turn ? progress : s.length - progress,
    0,
    s.turn,
  );
  if (u < 1e-6) return { x: 0, y: 0, floor: 0, corridor: 0, stair: true };
  const f = Math.min(s.config.floors, Math.floor((u - 1e-8) / 1.3) + 1),
    v = u - (f - 1) * 1.3;
  const left = f % 2 === 1;
  if (v < 0.3)
    return {
      x: left ? 0 : 1,
      y: f - 1 + v / 0.3,
      floor: f,
      corridor: 0,
      stair: true,
    };
  const c = clamp(v - 0.3, 0, 1);
  return { x: left ? c : 1 - c, y: f, floor: f, corridor: c, stair: false };
}
export function wave(s, floor, t = s.t) {
  if (!floor) return { smoke: 0, phase: 0, warning: false };
  const period = s.config.period,
    phase = mod(
      t / period + s.phases[floor % s.phases.length] + floor * 0.19,
      1,
    );
  const pulse = (p) =>
    p < s.config.duty ? Math.min(1, p / 0.055, (s.config.duty - p) / 0.055) : 0;
  let smoke = Math.max(0, pulse(phase));
  const phase2 = mod(t / (period * 1.53) + floor * 0.31, 1);
  if (s.config.second) smoke = Math.max(smoke, 0.48 * pulse(phase2));
  if (s.config.permanentFloor === floor) smoke = Math.max(0.58, smoke);
  return {
    smoke,
    phase,
    phase2: s.config.second ? phase2 : null,
    warning: phase > 0.84 || (s.config.second && phase2 > 0.84),
    permanent: s.config.permanentFloor === floor,
  };
}
export function safe(s, progress = s.progress) {
  const p = position(s, progress);
  return (
    !s.mutateAlcoves &&
    (p.stair || ALCOVES.some((a) => Math.abs(p.corridor - a) < 0.105))
  );
}
function breathe(s, entity, progress, held) {
  const air = safe(s, progress)
    ? 0
    : wave(s, position(s, progress).floor).smoke;
  if (air > 0.08)
    entity.breath = Math.max(
      0,
      entity.breath - air * s.config.drain * (held ? 1 : 0.46) * DT,
    );
  else entity.breath = Math.min(100, entity.breath + 18 * DT);
  return air;
}
function nextTower(s) {
  s.dailyFloors += s.config.floors;
  s.round++;
  s.score += 1000 + Math.round(s.minimumBreath * 5);
  s.events.push({ type: "tower", round: s.round, floors: s.dailyFloors });
  s.config.drain = Math.min(47, s.config.drain + 2);
  s.config.duty = Math.min(0.49, s.config.duty + 0.015);
  s.progress = 0;
  s.returning = false;
  s.breath = 100;
  s.minimumBreath = 100;
  s.rescued = 0;
  for (const p of s.people)
    Object.assign(p, {
      joined: false,
      rescued: false,
      waiting: false,
      progress: p.at,
      breath: 100,
    });
}
export function step(s, held = false) {
  s.events = [];
  if (s.over) return s;
  s.tick++;
  s.t = s.tick * DT;
  s.held = !!held;
  let blocked = false;
  for (const p of s.people)
    if (
      !p.joined &&
      !s.returning &&
      s.progress >= p.at - 0.025 &&
      s.progress <= p.at + 0.11
    ) {
      if (p.refuses && wave(s, p.floor).smoke > 0.2) {
        blocked = true;
        if (!p.waiting) s.events.push({ type: "refuse", id: p.id });
        p.waiting = true;
      } else {
        p.joined = true;
        p.progress = s.progress;
        p.waiting = false;
        s.events.push({ type: "join", id: p.id, kind: p.kind });
      }
    }
  s.blocked = blocked;
  if (held && !blocked)
    s.progress = Math.min(s.length, s.progress + s.config.speed * DT);
  if (s.progress > s.length - 0.01) s.progress = s.length;
  if (!s.returning && s.progress >= s.turn) {
    s.returning = true;
    s.events.push({ type: "turn" });
  }
  const at = position(s);
  s.floorReached = Math.max(s.floorReached, at.floor);
  const smoke = breathe(s, s, s.progress, held);
  if (smoke > 0.65 && !s.exposed) {
    s.waveHits++;
    s.events.push({ type: "smoke" });
  }
  s.exposed = smoke > 0.65;
  const joined = s.people.filter((p) => p.joined && !p.rescued);
  let lineGap = 0;
  joined.forEach((p, i) => {
    lineGap += GAP[p.kind];
    const compact = !held && safe(s);
    const target = Math.max(
      p.at,
      s.progress - (compact ? 0.012 * (i + 1) : lineGap),
    );
    const rate =
      s.config.speed *
      (p.kind === "elder" ? 1.03 : p.kind === "child" ? 1.13 : 1.3);
    p.progress = Math.max(p.progress, Math.min(target, p.progress + rate * DT));
    // A saved neighbour takes the last step out while the firefighter waits outside.
    if (s.progress >= s.length)
      p.progress = Math.min(s.length, p.progress + rate * DT);
    breathe(s, p, p.progress, p.progress < target - 0.001 || held);
    if (p.progress >= s.length - 0.015) {
      p.rescued = true;
      p.breath = Math.max(1, p.breath);
      s.rescued++;
      s.totalRescued++;
      s.events.push({ type: "rescue", id: p.id });
    }
  });
  s.minimumBreath = Math.min(
    s.minimumBreath,
    s.breath,
    ...joined.map((p) => p.breath),
  );
  if (
    s.breath <= 0 ||
    joined.some((p) => p.breath <= 0) ||
    (!s.daily && s.t > s.config.limit)
  ) {
    s.over = "lost";
    s.score += s.rescued * 200 + Math.floor(s.progress * 20);
    s.events.push({ type: "lost" });
  } else if (s.rescued === s.people.length && s.progress >= s.length) {
    if (s.daily) nextTower(s);
    else {
      s.over = "win";
      s.stars = 1 + +(s.minimumBreath >= 35) + +(s.t <= s.config.floors * 38);
      s.score = 1000 + s.stars * 200 + Math.round(s.minimumBreath * 5);
      s.events.push({ type: "win", stars: s.stars });
    }
  }
  return s;
}
// A clock-reading policy. It only presses/releases, waits at real door pockets,
// refills everyone, then forecasts a complete crossing plus the follower tail.
export function careful(s, { refill = 98, maxCost = 72, rest = 0.24 } = {}) {
  if (s.over) return false;
  if (
    s.blocked &&
    s.people.some((p) => p.waiting && wave(s, p.floor).smoke > 0.2)
  )
    return false;
  const pos = position(s),
    moving = s.aiTarget !== undefined && s.progress < s.aiTarget - 0.002;
  if (moving) return true;
  if (s.aiTarget !== undefined) {
    s.aiTarget = undefined;
    s.aiRest = s.t + rest;
  }
  if (s.progress >= s.length - 0.002) return false;
  if (s.aiRest > s.t) return false;
  if (s.aiRetry > s.t) return false;
  const group = s.people.filter((p) => p.joined && !p.rescued);
  if (
    group.some((p) => s.progress - p.progress > 0.085) ||
    s.breath < refill ||
    group.some((p) => p.breath < refill)
  )
    return false;
  const stops = [0, s.turn, s.length];
  for (let f = 1; f <= s.config.floors; f++)
    for (const a of ALCOVES) {
      const u = (f - 1) * 1.3 + 0.3 + a;
      stops.push(u, s.length - u);
    }
  const target = Math.min(...stops.filter((p) => p > s.progress + 0.025));
  if (!Number.isFinite(target)) return true;
  const travel = (target - s.progress) / s.config.speed;
  // Forecast each person at their own position, including the slow line entering
  // the doorway after the leader. A leader-only forecast misses the core risk.
  const future = [s.progress, ...group.map((p) => p.progress)],
    air = [100, ...group.map(() => 100)];
  let cost = 0;
  for (let time = 0; time < travel + 3.5; time += 0.1) {
    const moving = time < travel;
    future[0] = Math.min(target, s.progress + time * s.config.speed);
    let tail = 0;
    group.forEach((p, i) => {
      tail += GAP[p.kind];
      const goal = Math.max(
        p.at,
        future[0] - (moving ? tail : 0.012 * (i + 1)),
      );
      const speed =
        s.config.speed *
        (p.kind === "elder" ? 1.03 : p.kind === "child" ? 1.13 : 1.3);
      future[i + 1] = Math.max(
        future[i + 1],
        Math.min(goal, future[i + 1] + speed * 0.1),
      );
    });
    future.forEach((progress, i) => {
      const smoke = safe(s, progress)
        ? 0
        : wave(s, position(s, progress).floor, s.t + time).smoke;
      air[i] =
        smoke > 0.08
          ? air[i] - smoke * s.config.drain * 0.1
          : Math.min(100, air[i] + 1.8);
      cost = Math.max(cost, 100 - air[i]);
    });
  }
  if (cost > maxCost) {
    s.aiRetry = s.t + 0.2;
    return false;
  }
  s.aiTarget = target;
  return true;
}
