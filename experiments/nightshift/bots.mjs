import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import {
  create, step, targetFor, random, distance, dailyNight, DEFAULT_SEED, REST, FUSE,
  LAST, WINGS, MIRROR, RADIUS, RETRIP, DT,
} from './sim.js';

export function nearest(s, commit = null) {
  const targets = s.actors.flatMap(a => {
    if (a.state !== 'roam' || a.kind === 'shy') return [];
    const aim = targetFor(a);
    return aim ? [{ a, aim }] : [];
  });
  const held = targets.find(({ a }) => a.id === commit);
  if (held) return held;
  return targets.sort((p, q) => distance(p.aim, s.light) - distance(q.aim, s.light))[0];
}

export function policy(name, seed) {
  const rng = random(seed ^ 72809);
  let locked = null;
  let next = 0;
  let aim = REST;
  let biasX = 0;
  let biasY = 0;
  const sweep = [
    { x: 85, y: 230 }, { x: 310, y: 230 }, { x: 302, y: 345 }, { x: 94, y: 345 },
    { x: 93, y: 460 }, { x: 302, y: 464 }, { x: 191, y: 173 },
  ];
  if (name === 'idle') return () => REST;
  // A blind patrol that swaps between the two doorways every 2.3 seconds, as a bored player might.
  if (name === 'doors') {
    const doors = [{ x: 65, y: 190 }, { x: 292, y: 173 }];
    return s => s.fuse && !s.fused && s.time < 2.2 ? FUSE : doors[Math.floor(s.time / 2.3) % 2];
  }
  if (name === 'doorsOnly') {
    const doors = [{ x: 65, y: 190 }, { x: 292, y: 173 }];
    return s => doors[Math.floor(s.time / 2.3) % 2];
  }
  if (name === 'sweep') return s => sweep[Math.floor(s.time / 1.7) % sweep.length];
  if (name === 'nearest') {
    const heard = new Map();
    const listen = s => {
      const active = s.actors[locked];
      const aimAtActive = active?.state === 'roam' && targetFor(active);
      if (aimAtActive) return aimAtActive;
      const recent = [...heard].filter(([id, at]) =>
        s.time - at.time < 1.4 && s.actors[id].state === 'roam');
      recent.sort((a, b) => distance(a[1], s.light) - distance(b[1], s.light));
      for (const [id] of recent) {
        const point = targetFor(s.actors[id]);
        if (point) {
          locked = id;
          return point;
        }
      }
      locked = null;
      return REST;
    };
    listen.observe = s => {
      for (const { type, actor } of s.events) {
        if (type === 'foot' && actor.kind !== 'shy') heard.set(actor.id, { x: actor.x, y: actor.y, time: s.time });
      }
    };
    return listen;
  }
  if (name === 'average') return s => {
    if (s.time >= next) {
      const pick = nearest(s);
      const cat = s.catAt && rng() < 0.28;
      locked = cat ? null : pick?.a.id;
      aim = cat ? { ...s.catAt } : pick?.aim ?? REST;
      biasX = (rng() - 0.5) * 67;
      biasY = (rng() - 0.5) * 67;
      next = s.time + 2.35 + rng() * 1.25;
    }
    const a = s.actors[locked];
    const point = a?.state === 'roam' ? targetFor(a) ?? aim : aim;
    return { x: point.x + biasX, y: point.y + biasY };
  };
  return s => {
    // A tripped breaker is mended between catches, unless an exhibit is close to a door.
    const pressed = s.actors.some(a => a.state === 'roam' && a.kind !== 'shy' && a.progress > 0.58 && !a.frozen);
    if (name === 'competent' && s.fuse && !s.fused && (s.time < 2.2 || (!pressed && !s.actors[locked]?.frozen))) {
      locked = null;
      return FUSE;
    }
    const active = s.actors[locked];
    if (active?.state !== 'roam') locked = null;
    const targets = nearest(s, locked);
    if (name === 'competent' && locked == null) {
      const urgent = s.actors
        .filter(a => a.state === 'roam' && a.kind !== 'shy' && a.progress > 0.58)
        .sort((a, b) => b.progress - a.progress)[0];
      if (urgent) {
        locked = urgent.id;
        return targetFor(urgent) ?? REST;
      }
    }
    locked = targets?.a.id ?? null;
    return targets?.aim ?? REST;
  };
}

function play(options, name) {
  const s = create(options);
  const decide = policy(name, s.seed);
  let aim = REST;
  while (!s.outcome && s.time < 180) {
    if (s.tick % 6 === 0) aim = decide(s);
    step(s, aim);
    decide.observe?.(s);
  }
  return {
    outcome: s.outcome, escaped: s.escapes, returned: s.returned, time: s.time,
    peak: s.closestEscape, route: s.actors.map(a => [a.home, a.state, a.progress]),
  };
}

function mechanics() {
  const opening = (level, aim = REST) => {
    const state = create({ level });
    for (let i = 0; i < 80; i++) step(state, aim);
    return state;
  };
  const first = create();
  const guard = policy('competent', first.seed);
  const firstWakes = [];
  while (firstWakes.length < first.actors.length && !first.outcome) {
    step(first, guard(first));
    firstWakes.push(...first.events.filter(e => e.type === 'wake').map(e => e.actor.id));
  }
  assert.equal(new Set(firstWakes).size, 6, 'all six exhibits get a turn before the first repeats');

  for (const level of [1, 7, 14, 18]) {
    const floor = create({ level });
    for (const runner of floor.actors.filter(a => a.home.y > 300)) {
      const plinths = floor.actors.filter(a => a.home.y < runner.home.y - 70);
      for (const route of runner.routes) for (const { start, end } of route.segments) {
        for (let i = 0; i <= 100; i++) {
          const x = start.x + (end.x - start.x) * i / 100;
          const y = start.y + (end.y - start.y) * i / 100;
          assert.ok(x >= 41 && x <= 349, 'leave room for the full walking silhouette');
          assert.ok(plinths.every(p => Math.abs(x - p.home.x) >= 50 || Math.abs(y - p.home.y) >= 55),
            `night ${level} runner ${runner.id} passes beside occupied exhibits`);
        }
      }
    }
  }
  const twins = opening(4);
  const a = twins.actors[1], b = twins.actors[4];
  for (let i = 0; i < 62; i++) step(twins, a);
  assert.ok(a.lit && !b.lit);
  assert.ok(a.state === 'roam' && b.state === 'roam');
  const frozen = b.progress;
  step(twins, a);
  assert.equal(b.progress, frozen, 'illuminating either twin stops both');

  const mirrored = opening(7);
  const subject = mirrored.actors[2];
  for (let i = 0; i < 65; i++) step(mirrored, subject);
  assert.ok(!subject.lit, 'direct beam cannot reach the case');
  for (let i = 0; i < 65; i++) step(mirrored, MIRROR);
  assert.ok(subject.lit && distance(subject, mirrored.bounce) < RADIUS, 'mirror alone lights the case');

  const shy = opening(8);
  const odd = shy.actors[3];
  assert.equal(odd.progress, 0);
  for (let i = 0; i < 60; i++) step(shy, odd);
  assert.ok(odd.progress > 0);
  for (let i = 0; i < 60; i++) step(shy, REST);
  const darkProgress = odd.progress;
  for (let i = 0; i < 60; i++) step(shy, REST);
  assert.equal(odd.progress, darkProgress, 'shy freezes in darkness');

  const cat = opening(9);
  assert.ok(cat.catAt);
  const initial = cat.catAt.x;
  for (let i = 0; i < 90; i++) step(cat, cat.catAt ?? REST);
  assert.ok(cat.catAt.x > initial && cat.catLit);
  assert.equal(cat.returned + cat.escapes, 0);

  const tripped = opening(13);
  while (!tripped.fused && !tripped.outcome) step(tripped, FUSE);
  const mended = tripped.time;
  let dark = 0;
  // Keep catching exhibits, but never mend the breaker, so the trip can be observed.
  while (!tripped.outcome && tripped.time < mended + RETRIP + 3.8) {
    step(tripped, nearest(tripped)?.aim ?? REST);
    if (tripped.blackout) dark++;
  }
  assert.equal(tripped.outcome, null);
  assert.ok(!tripped.fused && tripped.trips === 1, 'the breaker trips again after it is mended');
  assert.ok(dark * DT > 1, 'a tripped breaker darkens the beam until it is mended again');

  const fuse = opening(13);
  let off = false;
  for (let i = 0; i < 228; i++) { step(fuse); off ||= fuse.blackout; }
  assert.ok(off);
  for (let i = 0; i < 228; i++) {
    step(fuse, FUSE);
    if (fuse.fused) assert.equal(fuse.blackout, false);
  }
  assert.ok(fuse.fused);

  const stair = opening(14).actors[5];
  assert.ok(stair.upstairs);
  assert.equal(stair.route.segments.length, 3);
  const crowded = play({ level: 18, seed: 2 }, 'idle');
  assert.equal(crowded.outcome, 'escaped');
  assert.equal(crowded.escaped, 3, 'four exits in one tick stop at the third');
}

function main() {
  // Touching (194,154) on the small phone parked the beam by the original door.
  // Recheck the current doors too, including their touch-offset approaches.
  for (const x of [84, 194, 306]) {
    for (const y of [112, 123, 150]) {
      for (const level of [1, 2, 3, 4, 5, 6, 7, 8, LAST]) {
        const mode = level === LAST ? 'long' : 'story';
        const state = create({ level, mode });
        while (!state.outcome && state.time < 120) step(state, { x, y });
        assert.equal(state.outcome, 'escaped', `camping at (${x},${y}) loses ${mode} night ${level}`);
      }
    }
  }
  mechanics();
  const seeds = [DEFAULT_SEED, ...Array.from({ length: 11 }, (_, i) => Math.imul(i + 1, 95768963) >>> 0)];
  const names = ['idle', 'sweep', 'nearest', 'average', 'competent'];
  const totals = WINGS.map(() => Object.fromEntries(names.map(k => [k, 0])));
  const margins = WINGS.map(() => ({ escapes: 0, peak: 0 }));
  const rows = [];
  for (let level = 1; level <= LAST; level++) {
    const wing = Math.floor((level - 1) / 6);
    const row = { night: level, ...Object.fromEntries(names.map(k => [k, 0])), escapes: 0, peak: 0 };
    for (const seed of seeds) for (const name of names) {
      const result = play({ level, seed }, name);
      if (result.outcome === 'dawn') row[name]++;
      if (name === 'idle') {
        assert.equal(result.outcome, 'escaped');
        assert.equal(result.escaped, 3);
      }
      if (name === 'competent') {
        row.escapes = Math.max(row.escapes, result.escaped);
        row.peak = Math.max(row.peak, result.peak);
      }
    }
    for (const name of names) totals[wing][name] += row[name];
    margins[wing].escapes = Math.max(margins[wing].escapes, row.escapes);
    margins[wing].peak = Math.max(margins[wing].peak, row.peak);
    rows.push({ ...row, peak: row.peak.toFixed(3) });
  }
  console.table(rows);
  console.table(totals.map((row, i) => ({
    wing: WINGS[i], trials: seeds.length * 6, ...row,
    maxEscapes: margins[i].escapes, furthestProgress: margins[i].peak.toFixed(3),
  })));
  const long = seeds.map(seed => play({ seed, level: 18, mode: 'long' }, 'competent'));
  console.log('Long night seconds:', long.map(r => r.time.toFixed(1)).join(', '));
  for (const row of rows) {
    assert.equal(row.idle, 0, 'idle loses every trial');
    assert.equal(row.competent, seeds.length, 'competent wins every ordered night');
    assert.ok(row.escapes <= 1 && Number(row.peak) <= 0.95, 'competent leaves at least two escape slots and 5% of the route');
  }
  assert.ok(totals.reduce((n, t) => n + t.nearest - t.sweep, 0) >= 36, 'local evidence beats blind sweep');
  assert.ok(totals[0].average > totals[1].average && totals[1].average > totals[2].average, 'average win rate falls each wing');
  for (const level of [13, 15, 17, 18]) {
    const wins = Math.max(...['doors', 'doorsOnly'].map(name =>
      seeds.filter(seed => play({ level, seed }, name).outcome === 'dawn').length));
    assert.ok(wins <= 2, `night ${level}: a blind two-door patrol cannot replace reading the room (${wins} wins)`);
  }
  assert.ok(long.every(r => r.outcome === 'escaped' && r.time >= 60 && r.time <= 150), 'long-night window');
  const daily = dailyNight('2026-11-24');
  for (const options of [{ level: 4, seed: 217 }, { level: 18, seed: 353 }, { ...daily, mode: 'daily' }, { level: 18, seed: 777, mode: 'long' }]) {
    const result = play(options, 'competent');
    assert.deepEqual(result, play(options, 'competent'), 'same seed, same route and result');
    assert.notDeepEqual(result.route, play({ ...options, seed: options.seed + 1 }, 'competent').route, 'seed changes the floor');
  }
  for (let day = 1; day <= 31; day++) {
    const options = dailyNight(`2026-01-${String(day).padStart(2, '0')}`);
    assert.equal(play({ ...options, mode: 'daily' }, 'competent').outcome, 'dawn');
  }
  console.log('Mechanics, seeded replay, and 31 daily dates passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
