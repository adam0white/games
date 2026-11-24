import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import {
  create, step, targetFor, aimFor, random, distance, dailyNight, deadline, DEFAULT_SEED, REST, FUSE,
  LAST, WINGS, MIRROR, RADIUS, RETRIP, GRACE, DT, NIGHTS,
} from './sim.js';
import * as sim from './sim.js';

export function nearest(s, commit = null) {
  const targets = s.actors.flatMap(a => {
    if (a.state !== 'roam' || a.kind === 'shy') return [];
    const aim = aimFor(s, a);
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
  let switched = -Infinity;
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
    const pressed = s.actors.some(a => a.state === 'roam' && a.kind !== 'shy' && a.progress / deadline(s, a) > 0.8 && !a.frozen);
    if (name === 'competent' && s.fuse && !s.fused && (s.time < 2.2 || s.fuseHold > 0 || (!pressed && !s.actors[locked]?.frozen))) {
      locked = null;
      return FUSE;
    }
    const active = s.actors[locked];
    if (active?.state !== 'roam') locked = null;
    const targets = nearest(s, locked);
    if (name === 'competent') {
      // Urgency is measured against the point where the exhibit can no longer be stopped.
      // The ghost is worth chasing early: once it leaves its ring it cannot be stopped.
      const urgency = a => a.progress / deadline(s, a) * (a.kind === 'ghost' ? 1.6 : 1);
      const urgent = s.actors
        .filter(a => a.state === 'roam' && a.kind !== 'shy' && urgency(a) > 0.58)
        .filter(a => aimFor(s, a))
        .sort((a, b) => urgency(b) - urgency(a))[0];
      const held = s.actors[locked];
      // Drop a catch that has barely started when another exhibit is about to get away.
      const switching = held && urgent && urgent !== held && urgency(urgent) > 0.78 &&
        urgency(urgent) > urgency(held) + 0.15 && held.hold < held.holdTime * 0.4 && s.time > switched + 1.2;
      if (urgent && (locked == null || switching)) {
        if (switching) switched = s.time;
        locked = urgent.id;
        return aimFor(s, urgent);
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
      // The mask paces in a doorway rather than standing on a plinth, so runners may pass it.
      const plinths = floor.actors.filter(a => a.home.y < runner.home.y - 70 && a.kind !== 'shy');
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
  // The window includes the buzzing grace period before the lights start to drop.
  while (!tripped.outcome && tripped.time < mended + RETRIP + GRACE + 3.8) {
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

// Rules added for the late nights. Each takes the simulator module so it can also be run against an older copy.
export const rules = {
  maskDarkensBeam({ create, step }) {
    const s = create({ level: 8 });
    const mask = s.actors[3];
    while (mask.state !== 'roam') step(s, mask);
    for (let i = 0; i < 30; i++) step(s, mask);
    const runner = s.actors.find(a => a.kind !== 'shy');
    const near = () => {
      runner.state = 'roam';
      runner.x = mask.x;
      runner.y = mask.y + 40;
      runner.progress = 0.2;
    };
    for (let i = 0; i < 60; i++) { near(); step(s, { x: mask.x, y: mask.y + 30 }); }
    assert.ok(mask.lit && !runner.lit, 'a lit mask stops the light holding anything else');
    for (let i = 0; i < 60; i++) { near(); step(s, { x: mask.x, y: mask.y + 100 }); }
    assert.ok(!mask.lit && runner.lit, 'with the mask dark the same runner is caught');
  },
  catWakes({ create, step }) {
    const s = create({ level: 9 });
    while (!s.catAt) step(s, REST);
    const asleep = () => s.actors.filter(a => a.state === 'home').length;
    const before = asleep();
    let woke = null;
    for (let i = 0; i < 120 && !woke; i++) {
      step(s, s.catAt ?? REST);
      woke = s.events.find(e => e.type === 'cat')?.woke;
    }
    assert.ok(woke && woke.state === 'roam' && asleep() === before - 1, 'lighting the cat wakes a sleeping exhibit');
  },
  hatchEscape({ create, step, HATCH }) {
    const s = create({ level: 10 });
    let out = null;
    while (!out && !s.outcome) {
      step(s, REST);
      out = s.events.find(e => e.type === 'escape')?.actor;
    }
    assert.ok(out && out.home.y > 300 && distance(out, HATCH ?? { x: 195, y: 448 }) < 2, 'a lower exhibit can leave by the floor hatch');
    assert.equal(s.escapes, 1, 'the hatch counts as an escape');
  },
  ghostZone({ create, step, GHOST_ZONE = 0.38 }) {
    const reach = progress => {
      const s = create({ level: 15 });
      const ghost = s.actors[0];
      while (!(ghost.state === 'roam' && ghost.progress >= progress)) step(s, REST);
      let caught = false;
      for (let i = 0; i < 90; i++) { step(s, ghost); caught ||= ghost.lit; }
      return { caught, ghost };
    };
    assert.ok(reach(0.05).caught, 'the ghost is caught near its plinth');
    const late = reach(GHOST_ZONE + 0.02);
    assert.ok(!late.caught && late.ghost.state === 'roam', 'light passes through the ghost once it leaves its ring');
  },
  tripGrace({ create, step, FUSE }) {
    // No waves, so the breaker can be watched without exhibits ending the night.
    const s = create({ level: 13, count: 0 });
    while (!s.fused && s.time < 10) step(s, FUSE);
    while (s.fused && s.time < 40) step(s, REST);
    assert.ok(!s.fused && !s.outcome, 'the breaker trips again');
    const tripped = s.time;
    let dark = false;
    while (s.time < tripped + 1.45) {
      step(s, REST);
      dark ||= s.blackout;
    }
    assert.ok(!dark, 'a tripped breaker buzzes for a moment before the lights drop');
    while (!s.blackout && s.time < tripped + 6) step(s, REST);
    assert.ok(s.blackout, 'then the lights do drop');
  },
  spreadFigures({ create, step, spread, beamTouches }, seeds) {
    let crowded = 0;
    let drawn = 0;
    for (const seed of seeds.slice(0, 4)) for (const name of ['competent', 'average']) {
      const s = create({ level: 18, seed });
      const decide = policy(name, s.seed);
      let aim = REST;
      while (!s.outcome) {
        if (s.tick % 6 === 0) aim = decide(s);
        step(s, aim);
        const shown = s.actors.filter(a => a.state !== 'gone' && a.state !== 'home');
        const offset = spread(s.actors);
        for (const a of shown) {
          const o = offset.get(a.id);
          assert.ok(Math.abs(o.x) <= 24 && o.y === 0, 'figures shift at most 24 px sideways');
          if (a.kind === 'shy') assert.equal(o.x, 0, 'the mask is drawn where it blocks the light');
          assert.ok(beamTouches(a, { x: a.x + o.x, y: a.y - 14 }), 'a tap on the drawn figure still reaches the exhibit');
        }
        for (const a of shown) for (const b of shown) if (a.id < b.id && Math.abs(a.y - b.y) < 30) {
          if (Math.abs(a.x - b.x) < 20) crowded++;
          if (Math.abs(a.x + offset.get(a.id).x - b.x - offset.get(b.id).x) < 20) drawn++;
        }
      }
    }
    // Three figures at the mask's door can still touch for a moment, since the mask itself does not move.
    assert.ok(crowded > 0 && drawn * 50 <= crowded, `overlapping figures are drawn apart (${drawn} of ${crowded} pair-ticks still touch)`);
  },
  blindPatrol({ create, step }, seeds) {
    const doors = [{ x: 65, y: 190 }, { x: 292, y: 173 }];
    for (let level = 8; level <= LAST; level++) for (const mend of [true, false]) {
      const wins = seeds.filter(seed => {
        const s = create({ level, seed });
        while (!s.outcome) step(s, mend && s.fuse && !s.fused && s.time < 2.2 ? FUSE : doors[Math.floor(s.time / 2.3) % 2]);
        return s.outcome === 'dawn';
      }).length;
      assert.equal(wins, 0, `night ${level}: a blind two-door patrol cannot replace reading the room (${wins} wins)`);
    }
  },
  // Wider blind loops (below the doors, through the hatch, across the hall) win at most half the seeds on nights 8–18.
  blindLoops({ create, step }, seeds) {
    const loops = {
      low: [{ x: 84, y: 226 }, { x: 306, y: 226 }], lower: [{ x: 84, y: 240 }, { x: 306, y: 240 }],
      three: [{ x: 65, y: 190 }, { x: 292, y: 173 }, { x: 195, y: 440 }], threeLow: [{ x: 84, y: 226 }, { x: 306, y: 226 }, { x: 195, y: 440 }],
      hall: [{ x: 120, y: 200 }, { x: 270, y: 200 }],
    };
    for (let level = 8; level <= LAST; level++) for (const [name, points] of Object.entries(loops)) for (const period of [1.2, 2.3, 3.5]) {
      const wins = seeds.filter(seed => {
        const s = create({ level, seed });
        while (!s.outcome) step(s, s.fuse && !s.fused && (s.time < 2.2 || Math.floor(s.time / period) % 4 === 3) ? FUSE : points[Math.floor(s.time / period) % points.length]);
        return s.outcome === 'dawn';
      }).length;
      assert.ok(wins <= 6, `night ${level}: the blind ${name} loop every ${period}s wins ${wins} of 12`);
    }
  },
};

// The late nights keep their margin when the wave interval moves 0.3 seconds either way.
function tuningRange(seeds) {
  for (let level = 13; level <= LAST; level++) {
    const base = NIGHTS[level - 1][2];
    for (let shift = -3; shift <= 3; shift++) {
      const cadence = Math.round((base + shift / 10) * 10) / 10;
      for (const seed of seeds) {
        const r = play({ level, seed, cadence }, 'competent');
        assert.ok(r.outcome === 'dawn' && r.escaped <= 1 && r.peak <= 0.95,
          `night ${level} at a ${cadence}s interval, seed ${seed}: competent keeps its margin`);
      }
    }
  }
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
  // An ordinary player should get through the nights that teach a rule, and sometimes through the rest.
  for (const row of rows) {
    if ([8, 9, 10, 15].includes(row.night)) assert.ok(row.average >= 9, `night ${row.night} teaches a rule: average wins ${row.average} of 12`);
    else if (row.night >= 11) assert.ok(row.average >= 4, `night ${row.night}: average wins ${row.average} of 12`);
  }
  assert.ok(totals.reduce((n, t) => n + t.nearest - t.sweep, 0) >= 36, 'local evidence beats blind sweep');
  assert.ok(totals[0].average > totals[1].average && totals[1].average > totals[2].average, 'average win rate falls each wing');
  for (const level of [13, 15, 17, 18]) {
    const wins = Math.max(...['doors', 'doorsOnly'].map(name =>
      seeds.filter(seed => play({ level, seed }, name).outcome === 'dawn').length));
    assert.ok(wins <= 2, `night ${level}: a blind two-door patrol cannot replace reading the room (${wins} wins)`);
  }
  for (const check of Object.values(rules)) check(sim, seeds);
  tuningRange(seeds);
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
