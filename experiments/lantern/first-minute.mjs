// Repeatable, delayed steering trials against the default Gentle Night 1.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dareLink, dareRead } from '../kit/dare.js';
import { readRiver, riverBits } from './dare-river.js';

const SEEDS = 300;
const firstSeed = Number(process.argv.find(arg => /^\d+$/.test(arg)) ?? 1);
const baseline = process.argv.find(arg => arg.startsWith('--baseline='))?.slice('--baseline='.length);
const source = baseline
  ? `data:text/javascript;base64,${execFileSync('git', ['show', `${baseline}:experiments/lantern/sim.js`]).toString('base64')}`
  : './sim.js';
const { create, step, boat, centre, half, sight, speed, DT, NIGHTS, ABILITIES, STATS } = await import(source);
const DELAY = Math.round(0.25 / DT);
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

function night(seed, stage = 1, reborn = 0) {
  // A fresh save is given one ability. Cycle through them so all appear in the sample.
  const s = create(seed, stage, false, [ABILITIES[seed % ABILITIES.length]], {}, 1, reborn);
  s.gentle = true;
  s.hearts = 2;
  return s;
}

function steer(s, noise) {
  let ember, near = Infinity;
  const visible = sight(s);
  for (const e of s.embers) {
    const dy = e.y - s.y;
    const distance = Math.hypot(e.x - s.x, dy);
    if (!e.got && e.kind === 'ember' && dy >= -0.01 && dy <= visible && distance < near) {
      ember = e;
      near = distance;
    }
  }
  const c = centre(s, s.y + 0.18), edge = half(s, s.y + 0.18) - 0.05;
  let target = (ember?.x ?? c) + noise;
  let rock, first = Infinity;
  for (const k of s.rocks) {
    const dy = k.y - s.y, radius = k.rad + boat(s);
    if (!k.on || dy < -radius || dy > Math.max(visible, baseline ? 0 : speed(s) * 0.8 + radius)) continue;
    if (Math.abs(target - k.x) < k.len + radius + 0.055 && dy < first) {
      rock = k;
      first = dy;
    }
  }
  if (rock) {
    const room = rock.rad + rock.len + boat(s) + 0.065;
    const left = clamp(rock.x - room, c - edge, c + edge);
    const right = clamp(rock.x + room, c - edge, c + edge);
    target = Math.abs(left - rock.x) < room - 1e-8 ? right
      : Math.abs(right - rock.x) < room - 1e-8 ? left
      : Math.abs(left - target) < Math.abs(right - target) ? left : right;
  }
  return clamp(target, c - edge, c + edge);
}

function trial(seed, policy) {
  const s = night(seed), initialX = s.x;
  let target = initialX, queued = initialX, firstRock = Infinity, firstHit = Infinity, firstEmber = Infinity;
  let random = seed ^ 0x19de3438;
  for (let tick = 0; !s.over && tick < 180 / DT; tick++) {
    if (policy === 'delayed' && tick % DELAY === 0) {
      target = queued;
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      queued = steer(s, (random / 2 ** 32 - 0.5) * 0.08);
    }
    step(s, policy === 'centre' ? centre(s, s.y) : target);
    if (s.rocks.some(k => k.y - k.rad - boat(s) <= s.y)) firstRock = Math.min(firstRock, s.t);
    if (s.events.includes('hurt') || s.events.includes('hit')) firstHit = Math.min(firstHit, s.t);
    if (s.events.includes('ember')) firstEmber = Math.min(firstEmber, s.t);
  }
  assert.ok(s.over, 'trial reached an ending');
  return { end: s.over, seconds: s.t, firstRock, firstHit, firstEmber, embers: s.taken };
}

const median = rows => rows.sort((a, b) => a - b)[Math.floor(rows.length / 2)];
const round = number => Math.round(100 * number) / 100;
for (const policy of ['passive', 'centre', 'delayed']) {
  const rows = Array.from({ length: SEEDS }, (_, i) => trial(i + firstSeed, policy));
  const dawns = rows.filter(row => row.end === 'dawn').length;
  const outcomes = Object.groupBy(rows, row => row.end);
  const seconds = rows.map(row => row.seconds);
  console.log(policy, {
    dawns,
    endings: Object.fromEntries(Object.entries(outcomes).map(([end, list]) => [end, list.length])),
    minimumSeconds: round(Math.min(...seconds)),
    medianSeconds: round(median(seconds)),
    medianFirstRock: round(median(rows.map(row => row.firstRock))),
    medianFirstHit: round(median(rows.map(row => row.firstHit))),
    medianEmbers: median(rows.map(row => row.embers)),
  });
  if (!baseline && policy === 'passive') assert.ok(seconds.every(t => t >= 20), 'every passive run survives 20 seconds');
  if (!baseline && policy === 'delayed') {
    assert.ok(dawns >= 0.8 * SEEDS, 'the delayed noisy policy reaches dawn on at least 80% of seeds');
    assert.ok(rows.every(row => row.firstEmber < row.firstRock), 'the opening ember is reachable before the first rock');
  }
}

if (!baseline) {
  for (let stage = 1; stage <= NIGHTS; stage++) {
    for (let seed = 1; seed <= 20; seed++) {
      const s = night(seed, stage, 5);
      for (let tick = 0; tick < Math.round(8 / DT); tick++) {
        s.light = 1; // Isolate the placement check from collecting the opening ember.
        step(s, centre(s, s.y));
        assert.ok(s.rocks.every(k => k.y - k.rad - boat(s) > s.y), `early rock: night ${stage}, seed ${seed}`);
      }
    }
  }
  console.log('No Gentle rock reaches the boat in the first eight seconds across all nights and twenty seeds, at maximum rebirth pace.');

  const bare = () => { const s = night(1); s.next = Infinity; s.warm = 9; return s; };
  const rock = (s, dx = 0) => ({ x: s.x + dx, y: s.y, y0: s.y, len: 0, rad: 0.045, on: true });
  const hit = bare();
  hit.rocks.push(rock(hit));
  step(hit, hit.x);
  assert.deepEqual(hit.events, ['hurt']);
  assert.equal(hit.impact.cause, 'rock');
  assert.ok(Math.abs(Math.hypot(hit.impact.x - hit.rocks[0].x, hit.impact.y - hit.rocks[0].y) - 0.045) < 1e-9);
  for (let i = 0; i < 10; i++) step(hit, hit.x);
  assert.equal(hit.impact, undefined);
  assert.equal(hit.grazes, 0, 'an overlap, even when protected, is never a graze');

  const protectedBoat = bare();
  protectedBoat.safe = 1;
  protectedBoat.rocks.push(rock(protectedBoat));
  for (let i = 0; i < 10; i++) step(protectedBoat, protectedBoat.x);
  assert.equal(protectedBoat.grazes, 0, 'initial contact while protected never gives a graze');

  const clearBoat = bare();
  clearBoat.rocks.push(rock(clearBoat, 0.07));
  step(clearBoat, clearBoat.x);
  assert.deepEqual(clearBoat.events, ['graze'], 'a close pass with positive clearance still scores');

  const wisp = bare();
  wisp.light = 0.02;
  wisp.embers.push({ x: wisp.x, y: wisp.y, kind: 'wisp' });
  step(wisp, wisp.x);
  assert.deepEqual(wisp.events, ['wisp']);
  assert.equal(wisp.light, 0.02);

  const brush = bare();
  brush.light = 0.02;
  brush.x = centre(brush, 0) + half(brush, 0);
  step(brush, brush.x);
  assert.deepEqual(brush.events, ['brush']);
  assert.equal(brush.light, 0.02);

  const ember = bare();
  ember.light = 0.2;
  ember.embers.push({ x: ember.x, y: ember.y, kind: 'ember' });
  step(ember, ember.x);
  assert.deepEqual(ember.emberPickup, { x: ember.x, y: 0, before: 0.2, after: 0.5 });
  step(ember, ember.x);
  assert.equal(ember.emberPickup, undefined);
  console.log('Contact coordinates, pickup deltas, true grazes and non-increasing penalties pass.');

  const home = { href: 'https://example.test/lantern/' };
  const legacy = readRiver(dareRead({ href: home.href + '?dare=k2j9x.412.65.Sam' }));
  assert.deepEqual([legacy.night, legacy.gentle, legacy.abilities], [0, false, ['boost', 'shield']]);
  for (const gentle of [true, false]) {
    const sender = create(123, 50, false, ['slow', 'heart'], STATS, 1, 5);
    sender.gentle = gentle;
    const url = dareLink({ seed: sender.seed, score: 100, extra: riverBits(sender), name: 'Sam' }, home);
    const friend = readRiver(dareRead({ href: url }));
    assert.deepEqual([friend.seed, friend.night, friend.gentle, friend.reborn, friend.stats, friend.abilities],
      [123, 50, gentle, 5, STATS, ['slow', 'heart']]);
    const other = create(friend.seed, friend.night, false, friend.abilities, friend.stats, 1, friend.reborn);
    other.gentle = friend.gentle;
    for (let tick = 0; tick < 600 && !sender.over; tick++) {
      step(sender, centre(sender, sender.y)); step(other, centre(other, other.y));
      assert.deepEqual(other.rocks, sender.rocks);
      assert.deepEqual(other.embers, sender.embers);
      assert.equal(other.light, sender.light);
    }
  }
  assert.equal(readRiver({ ...legacy, extra: 1 << 30 }), null);
  console.log('Legacy and story dare links preserve the seed, abilities, river rules and upgrades.');
}
