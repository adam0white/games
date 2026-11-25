import assert from 'node:assert/strict';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import * as original from '../../ant-promotion/sim.js';
import { ANT, FORMS, SPAWN_WEIGHTS, WORLD, create, step, choose, revive, me, level, powerOf, sightOf, clearSight, grassAt, sharesGrass, sightDistance } from './sim.js';

const SEEDS = 10;
const TICKS = 600 * 60;
const LIMITS = { top: 3, deathRatio: 0.8, escapesPerRun: 4, stopped: 3 };
function sameState(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(key => {
    if (key === 'rand' || key === 'nrand') return true;
    if (key === 'chase' || key === 'fear') return Object.is(a[key]?.id ?? a[key], b[key]?.id ?? b[key]);
    return Object.hasOwn(b, key) && sameState(a[key], b[key]);
  });
}

function verifyRules() {
  for (const [cover, wild] of [[false, false], [false, true], [true, false]]) {
    const first = create(693, [ANT], 0, SPAWN_WEIGHTS, wild, null, cover);
    const api = cover ? { step, choose, revive } : original;
    const second = cover ? create(693, [ANT], 0, SPAWN_WEIGHTS, wild) : original.create(693, [ANT], 0, SPAWN_WEIGHTS, wild);
    for (let tick = 0; tick < 4200; tick++) {
      const input = { x: Math.cos(tick / 100), y: Math.sin(tick / 100), power: tick % 30 === 0 };
      step(first, input);
      api.step(second, input);
      if (first.choosing) { choose(first, 1); api.choose(second, 1); }
      if (first.dead) { revive(first, false); api.revive(second, false); }
      assert.ok(sameState(first, second), `cover ${cover}, tick ${tick}`);
    }
  }
  console.log('8,400 ticks of original parity with cover off across Classic and Wild, and 4,200 of determinism with cover on.');

  {
    const s = create(1);
    s.mobs = [];
    s.rocks = [{ x: 1060, y: 1000, r: 20 }];
    s.grass = [{ x: 1000, y: 1100, r: 40 }];
    assert.equal(sightDistance(s, 1000, 1000, 0, 120), 40);
    assert.equal(clearSight(s, 1000, 1000, 1120, 1000), false);
    for (let i = 0; i < 90; i++) step(s, { x: 1, y: 0 });
    assert.ok(Math.abs(s.player.x - (1040 - FORMS[ANT].r)) < 0.001);
    Object.assign(s.player, { x: 1000, y: 1100 });
    step(s, { x: 1, y: 0 });
    assert.ok(Math.abs(s.player.x - 1000 - FORMS[ANT].speed * 0.8 / 60) < 1e-9);
    assert.equal(s.hidden, true);
  }

  {
    const s = create(1);
    s.rocks = [];
    s.grass = [{ x: 1050, y: 1000, r: 30 }];
    s.player.safe = 0;
    const hunter = { id: 1, f: 4, x: 920, y: 1000, a: 0, want: 0, timer: 99, alert: false, walk: false, ph: 0 };
    s.mobs = [hunter];
    step(s, null);
    assert.equal(hunter.seesPlayer, true);
    assert.deepEqual(hunter.lastSeen, { x: 1000, y: 1000 });
    Object.assign(s.player, { x: 1050, y: 1000 });
    step(s, null);
    assert.equal(hunter.seesPlayer, false);
    assert.equal(hunter.search, 3);
    assert.deepEqual(hunter.lastSeen, { x: 1000, y: 1000 });
    while (!hunter.sweeping && s.tick < 180) step(s, null);
    assert.ok(hunter.sweeping && Math.hypot(hunter.x - 1000, hunter.y - 1000) < FORMS[4].r);
    const aimed = hunter.a;
    for (let tick = 0; tick < 170; tick++) step(s, null);
    assert.ok(hunter.sweeping && hunter.a > aimed + 3);
    for (let tick = 0; tick < 12; tick++) step(s, null);
    assert.equal(hunter.search, 0);
    assert.equal(hunter.alert, false);
    assert.equal(hunter.sweeping, false);
    assert.equal(s.escapes, 1);
    assert.ok(hunter.winded > 0.9);
    s.grass = [];
    s.player.x = hunter.x + 80;
    for (let tick = 0; tick < 50; tick++) {
      hunter.a = 0;
      step(s, null);
      assert.equal(hunter.seesPlayer, false);
    }
    for (let tick = 0; tick < 15 && !hunter.seesPlayer; tick++) {
      hunter.a = 0;
      step(s, null);
    }
    assert.equal(hunter.seesPlayer, true);
  }
  {
    const s = create(1);
    s.rocks = [];
    s.grass = [{ x: 1050, y: 1000, r: 24 }];
    s.player.safe = 0;
    const watcher = { id: 2, f: 4, x: 1000, y: 1000, a: 0, want: 0, timer: 99, alert: false, walk: false, ph: 0 };
    Object.assign(s.player, { x: 1050, y: 1000 });
    s.mobs = [watcher];
    step(s, null);
    assert.equal(watcher.seesPlayer, false);
    watcher.x = 1020;
    step(s, null);
    assert.equal(watcher.seesPlayer, true);
    watcher.x = 1015;
    step(s, null);
    assert.equal(watcher.seesPlayer, false);
    s.grass[0].r = 37;
    step(s, null);
    assert.equal(watcher.seesPlayer, true);
  }
  {
    const s = create(1);
    s.rocks = [{ x: 1040, y: 1000, r: 20 }];
    s.grass = [];
    const watcher = { id: 12, f: 4, x: 990, y: 1000, a: 0, want: 0, timer: 99, alert: false, walk: false, ph: 0 };
    const prey = { ...watcher, id: 14, f: ANT, x: 1090 };
    s.mobs = [watcher, prey];
    s.tick = 11;
    step(s, null);
    assert.equal(watcher.chase, null);
    assert.equal(clearSight(s, prey.x, prey.y, watcher.x, watcher.y), false);
    s.rocks = [];
    s.tick = 23;
    step(s, null);
    assert.equal(watcher.chase, prey);
  }
  {
    const s = create(3);
    s.rocks = [{ x: 975, y: 1000, r: 26 }];
    s.grass = [];
    Object.assign(s.player, { x: 1300, y: 1000, safe: 0 });
    const hunter = { id: 1, f: 4, x: 900, y: 1000, a: 0, want: 0, alert: true, search: 3, lostToCover: true, lastSeen: { x: 1050, y: 1000 }, timer: 99, walk: false, ph: 0 };
    s.mobs = [hunter];
    while (!hunter.sweeping && s.tick < 240) {
      step(s, null);
      assert.ok(Math.hypot(hunter.x - 975, hunter.y - 1000) >= 26 + FORMS[4].r - 1e-4);
    }
    assert.ok(hunter.sweeping && Math.hypot(hunter.x - 1050, hunter.y - 1000) < FORMS[4].r);
    assert.equal(hunter.search, 3);
    for (let i = 0; i < 181; i++) step(s, null);
    assert.equal(s.escapes, 1);
  }
  {
    const s = create(1);
    s.rocks = [];
    s.grass = [{ x: 1050, y: 1000, r: 47 }, { x: 1000, y: 1000, r: 40 }];
    Object.assign(s.player, { x: 1023, y: 1000, safe: 0 });
    const hunter = { id: 1, f: 4, x: 980, y: 1000, a: 0, want: 0, timer: 99, alert: false, walk: false, ph: 0 };
    s.mobs = [hunter];
    assert.notEqual(grassAt(s, s.player.x, s.player.y), grassAt(s, hunter.x, hunter.y));
    assert.equal(sharesGrass(s, s.player.x, s.player.y, hunter.x, hunter.y), true);
    step(s, null);
    assert.equal(hunter.seesPlayer, true);
  }
  {
    const s = create(4);
    s.rocks = [];
    s.grass = [];
    s.player.safe = 0;
    const hunter = { id: 1, f: 4, x: 920, y: 1000, a: 0, want: 0, alert: false, timer: 99, walk: false, ph: 0 };
    s.mobs = [hunter];
    step(s, null);
    assert.equal(hunter.seesPlayer, true);
    hunter.a = Math.PI;
    step(s, null);
    assert.ok(hunter.search > 0);
    assert.ok(!hunter.lostToCover && !hunter.coverBlockedSight);
    hunter.a = 0;
    s.rocks = [{ x: 960, y: 1000, r: 18 }];
    step(s, null);
    assert.equal(hunter.seesPlayer, false);
    assert.equal(hunter.coverBlockedSight, true);
    s.player.x = 1350;
    for (let i = 0; i < 400; i++) step(s, null);
    assert.equal(s.escapes, 1);
  }
  console.log('Solid rock, sight clipping, 80% grass pace and three-second last-seen search passed.');
}

const unit = (x, y) => {
  const d = Math.hypot(x, y) || 1;
  return [x / d, y / d];
};
const angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

function route(s, x, y) {
  const p = s.player;
  const [ux, uy] = unit(x, y);
  const allowed = Math.min(70, Math.hypot(x, y));
  const radius = me(s).r;
  let best = null, score = -Infinity;
  const offsets = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, 2.1, -2.1, 2.45, -2.45, Math.PI];
  for (const offset of offsets) {
    const vx = ux * Math.cos(offset) - uy * Math.sin(offset);
    const vy = uy * Math.cos(offset) + ux * Math.sin(offset);
    const tx = p.x + vx * allowed, ty = p.y + vy * allowed;
    if (tx < 30 || tx > WORLD - 30 || ty < 30 || ty > WORLD - 30) continue;
    let room = Infinity;
    for (const r of s.rocks) {
      const d = Math.max(0, Math.min(allowed, (r.x - p.x) * vx + (r.y - p.y) * vy));
      if (Math.abs(r.x - p.x) > allowed + r.r + radius + 8 || Math.abs(r.y - p.y) > allowed + r.r + radius + 8) continue;
      room = Math.min(room, Math.hypot(p.x + vx * d - r.x, p.y + vy * d - r.y) - r.r - me(s).r);
    }
    const value = Math.cos(offset) - Math.max(0, 8 - room) * 0.22;
    if (value > score) { best = { x: vx, y: vy }; score = value; }
  }
  return best || { x: ux, y: uy };
}

function policy(s, hider) {
  const p = s.player, F = me(s);
  let x = 0, y = 0, food = null, foodDist = Infinity, hunter = null, hunterDist = Infinity;
  const threats = [];
  for (const m of s.mobs) {
    const M = FORMS[m.f], dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1;
    const power = powerOf(m);
    if (power > F.power) {
      const [far, half] = sightOf(M);
      const facing = angleGap(Math.atan2(-dy, -dx), m.a) < half + 0.3;
      if (hider && d < 225) threats.push({ mob: m, distance: d });
      if (m.alert && !m.search && d < hunterDist) { hunter = m; hunterDist = d; }
      const reach = M.range * far * F.stealth + 65;
      if (d < reach * (facing || m.alert ? 1.15 : 0.62)) {
        const weight = (m.alert ? 3.5 : facing ? 1.7 : 0.85) * reach / d;
        x -= dx / d * weight;
        y -= dy / d * weight;
      }
    } else if (power < F.power && (M.speed <= F.speed || !m.alert) && d < foodDist) {
      foodDist = d;
      food = m;
    }
  }
  if (food) {
    const back = FORMS[food.f].speed > F.speed && foodDist > 40 ? Math.min(foodDist * 0.7, 70) : 0;
    const [fx, fy] = unit(food.x - Math.cos(food.a) * back - p.x, food.y - Math.sin(food.a) * back - p.y);
    x += fx; y += fy;
  }
  const ordinary = route(s, x * 90, y * 90);
  if (!hider) return ordinary;
  if (!hunter) {
    const ahead = { x: p.x + ordinary.x * 60, y: p.y + ordinary.y * 60 };
    for (const { mob, distance } of threats) {
      if (mob.search > 0 || distance >= hunterDist) continue;
      const dx = ahead.x - mob.x, dy = ahead.y - mob.y;
      const aheadDistance = Math.hypot(dx, dy);
      if (aheadDistance >= distance - 10) continue;
      const M = FORMS[mob.f], [far, half] = sightOf(M);
      if (aheadDistance >= M.range * far * F.stealth + F.r || angleGap(Math.atan2(dy, dx), mob.a) >= half + 0.2) continue;
      if (!clearSight(s, mob.x, mob.y, ahead.x, ahead.y)) continue;
      const grass = grassAt(s, ahead.x, ahead.y);
      if (grass && !sharesGrass(s, ahead.x, ahead.y, mob.x, mob.y) && aheadDistance > 3 * M.r) continue;
      hunter = mob;
      hunterDist = distance;
    }
  }
  if (hunter && !hunter.alert && hunterDist >= 65) {
    const grass = grassAt(s, p.x, p.y);
    if ((grass && hunterDist > 3 * FORMS[hunter.f].r && !sharesGrass(s, p.x, p.y, hunter.x, hunter.y)) || !clearSight(s, hunter.x, hunter.y, p.x, p.y)) {
      // Stay concealed if the ordinary route would cross into the hunter's sight.
      return { x: 0, y: 0 };
    }
  }
  if (!hunter) {
    // Hold cover while the hunter is still looking around and walking on would expose the player.
    const nearby = threats.filter(({ distance }) => distance < 75);
    if (nearby.length) return ordinary;
    const patch = grassAt(s, p.x, p.y);
    const tx = p.x + ordinary.x * 52, ty = p.y + ordinary.y * 52;
    const emerging = threats.some(({ mob }) => {
      if (!(mob.search > 0) || !mob.lostToCover) return false;
      if (patch && !sharesGrass(s, p.x, p.y, mob.x, mob.y) && !sharesGrass(s, p.x, p.y, tx, ty)) return true;
      return !clearSight(s, mob.x, mob.y, p.x, p.y) && clearSight(s, mob.x, mob.y, tx, ty);
    });
    return emerging ? { x: 0, y: 0 } : ordinary;
  }
  if (hunterDist < 38) return ordinary;

  const covers = [];
  for (const patch of s.grass) {
    const [a, b] = unit(p.x - patch.x, p.y - patch.y);
    const x = patch.x + a * (patch.r - 16), y = patch.y + b * (patch.r - 16);
    if (!sharesGrass(s, x, y, hunter.x, hunter.y)) covers.push({ x, y, grass: patch });
  }
  for (const rock of s.rocks) {
    const [a, b] = unit(rock.x - hunter.x, rock.y - hunter.y);
    const distance = rock.r + F.r + 10;
    for (const side of [0, -0.65, 0.65]) {
      const heading = Math.atan2(b, a) + side;
      covers.push({ x: rock.x + Math.cos(heading) * distance, y: rock.y + Math.sin(heading) * distance });
    }
  }
  let safest = ordinary, bestDistance = 165;
  for (const cover of covers) {
    const dx = cover.x - p.x, dy = cover.y - p.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= bestDistance || distance < 10) continue;
    if (!cover.grass && clearSight(s, hunter.x, hunter.y, cover.x, cover.y)) continue;
    if (threats.some(({ mob, distance: gap }) => {
      const back = (dx * (p.x - mob.x) + dy * (p.y - mob.y)) / (distance * gap);
      return back < (mob === hunter ? -0.03 : -0.3) && gap < distance + 65;
    })) continue;
    const target = route(s, dx, dy);
    const progress = (target.x * dx + target.y * dy) / distance;
    const away = (target.x * (p.x - hunter.x) + target.y * (p.y - hunter.y)) / hunterDist;
    const ordinaryAway = (ordinary.x * (p.x - hunter.x) + ordinary.y * (p.y - hunter.y)) / hunterDist;
    if (progress < 0.6 || away < Math.max(0.06, ordinaryAway - 0.27)) continue;
    if (Math.hypot(cover.x - hunter.x, cover.y - hunter.y) < distance + 48) continue;
    safest = target;
    bestDistance = distance;
  }
  return safest;
}

function run(seed, hider) {
  const s = create(seed), tracks = new Map();
  let top = 1, longest = 0, stalled = null, active = new Set(), input;
  for (let tick = 0; tick < TICKS; tick++) {
    if (tick % 4 === 0) input = policy(s, hider);
    step(s, input);
    if (s.choosing) choose(s, 1);
    if (s.dead) revive(s, false);
    top = Math.max(top, level(s));
    // Only count bodies trying to move. Sweeping and waiting are intentional.
    if (tick % 15 !== 0) continue;
    const bodies = [[0, s.player, Boolean(input.x || input.y), me(s).r], ...s.mobs.map(m => [m.id, m, m.movingIntent, FORMS[m.f].r])];
    active.clear();
    for (const [id, body, moving, radius] of bodies) {
      assert.ok(!s.rocks.some(r => Math.hypot(body.x - r.x, body.y - r.y) < r.r + radius - 1e-4), `seed ${seed} tick ${tick}: body ${id} inside rock`);
      if (!moving) continue;
      // The bottleneck measured here is stalling at a rock.
      if (!s.rocks.some(r => Math.hypot(body.x - r.x, body.y - r.y) <= r.r + radius + 4)) continue;
      active.add(id);
      const old = tracks.get(id);
      if (!old || Math.hypot(body.x - old.x, body.y - old.y) > 5) tracks.set(id, { x: body.x, y: body.y, tick });
      else if ((tick - old.tick) / 60 > longest) {
        longest = (tick - old.tick) / 60;
        stalled = { id, tick, x: Math.round(body.x), y: Math.round(body.y) };
      }
    }
    for (const id of tracks.keys()) if (!active.has(id)) tracks.delete(id);
  }
  return { deaths: s.deaths, top, escapes: s.escapes, cover: Math.round(s.coverSeconds), longest, ...(longest > LIMITS.stopped && { stalled }) };
}

if (isMainThread) {
  const requested = Number(process.env.ANT_HIDE_BOT_WORKERS || 4);
  assert.ok(Number.isInteger(requested) && requested >= 1, 'ANT_HIDE_BOT_WORKERS is a positive integer');
  const workerCount = Math.min(requested, SEEDS);
  const seedGroups = Array.from({ length: workerCount }, () => []);
  for (let seed = 1; seed <= SEEDS; seed++) seedGroups[(seed - 1) % workerCount].push(seed);
  const jobs = seedGroups.map(seeds => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: seeds });
    const results = [];
    worker.on('message', row => {
      results.push(row);
      console.error(`Completed seed ${row.seed}: careful ${row.careful.deaths} deaths / ${row.careful.escapes} escapes, hider ${row.hider.deaths} deaths / ${row.hider.escapes} escapes`);
    });
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code) reject(new Error(`Bot worker exited with code ${code}`));
      else resolve(results);
    });
  }));
  verifyRules();
  const rows = (await Promise.all(jobs)).flat().sort((a, b) => a.seed - b.seed);
  assert.equal(rows.length, SEEDS);
  const results = { careful: [], hider: [] };
  for (const row of rows) for (const [name, runs] of Object.entries(results)) {
    runs.push(row[name]);
    console.log(row.seed, name, row[name]);
  }
  for (const [name, runs] of Object.entries(results)) {
    assert.ok(runs.every(v => v.top >= LIMITS.top), `${name} reaches level ${LIMITS.top} on every seed`);
    assert.ok(runs.every(v => v.longest <= LIMITS.stopped), `${name}: bodies stall at rocks for no more than ${LIMITS.stopped}s`);
  }
  const sum = (name, key) => results[name].reduce((n, v) => n + v[key], 0);
  console.log('Totals', Object.fromEntries(Object.keys(results).map(name => [name, { deaths: sum(name, 'deaths'), escapes: sum(name, 'escapes'), cover: sum(name, 'cover') }])));
  assert.ok(sum('careful', 'deaths') > 0 && sum('hider', 'deaths') <= sum('careful', 'deaths') * LIMITS.deathRatio, 'hider has at least 20% fewer deaths');
  // The brief asks that escapes by breaking line of sight are common. Measured over all runs, not per seed:
  // a seed where few hunters chase gives few chances to escape.
  assert.ok(sum('hider', 'escapes') / results.hider.length >= LIMITS.escapesPerRun, 'cover escapes are common for the hider');
} else {
  for (const seed of workerData) parentPort.postMessage({ seed, careful: run(seed, false), hider: run(seed, true) });
}
