import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  at, BASE, cancel, clone, COUNT, create, cueDepth, daily, fret, grab, harmonic, LEFT, MAX_PULL, PARS,
  partials, pitchOf, plates, podX, pull, release, SPACING, tick, TICK,
} from './sim.js';
import { followCue, par, random, solve, wait } from './solve.js';

// node bots.mjs              every claim below
// node bots.mjs --mutate     erases momentum after every tick: the wave claims must fail
// node bots.mjs --mutate=X   breaks one feature (see MUTATIONS): that feature's claim must fail
// node bots.mjs --mutations  runs every mutation and checks that each one fails
// node bots.mjs --report     also prints the clumsy-player table on 16 seeds per plate
const MUTATIONS = ['cliff', 'harmonic', 'heavy', 'bead', 'bridge', 'felt', 'moving', 'double', 'fret', 'pump', 'free', 'parity'];
const argv = process.argv.slice(2);
if (argv.includes('--mutations')) {
  const self = fileURLToPath(import.meta.url);
  let ok = true;
  for (const name of ['', ...MUTATIONS]) {
    const flag = name ? '--mutate=' + name : '--mutate';
    const r = spawnSync(process.execPath, [self, flag], { encoding: 'utf8' });
    const why = (r.stderr.match(/message: '([^']*)'/) || r.stderr.match(/AssertionError[^\n]*/) || [''])[0];
    console.log(flag.padEnd(18), r.status ? 'fails as it should:' : 'PASSED (it should fail)', why.slice(0, 110));
    if (!r.status) ok = false;
  }
  process.exit(ok ? 0 : 1);
}
const mutate = argv.includes('--mutate');
const broken = (argv.find(a => a.startsWith('--mutate=')) || '').slice(9);
assert.ok(!broken || MUTATIONS.includes(broken), 'unknown mutation ' + broken);
const report = argv.includes('--report') || argv.includes('--mutate=cliff');

// A named mutation breaks one feature in the plate data or the state right after create.
const byIdea = idea => plates.find(p => p.idea === idea);
// The plate IV-VI pods as they shipped: the clumsy player's clears fell off a cliff there (12, 4, 2 of 16).
if (broken === 'cliff') { plates[3].buds = [[90, 56], [270, 56]]; plates[4].buds = [[104, 59], [180, 47], [256, 59]]; plates[5].buds = [[83, 62], [142, 48], [218, 48], [277, 62]]; }
if (broken === 'heavy') byIdea('heavy').heavy = null;
if (broken === 'bead') byIdea('bead').beads = [];
if (broken === 'bridge') byIdea('bridge').bridge = null;
if (broken === 'felt') byIdea('felt').felt = null;
if (broken === 'free') byIdea('free').free = false;
const L = idea => plates.findIndex(p => p.idea === idea) + 1; // plate number of an idea
function make(level, seed = level * 417) {
  const s = create(level, seed);
  if (broken === 'harmonic') for (const p of s.pods) if (p.type === 'tuned') p.mode = 1;
  if (broken === 'moving') for (const p of s.pods) if (p.swing) p.swing = [0, p.swing[1], p.swing[2]];
  if (broken === 'double') for (const p of s.pods) if (p.type === 'double') p.type = 'touch';
  if (broken === 'fret') for (const f of s.frets || []) f.i = 0;
  if (broken === 'pump') s.live = false;
  return s;
}

// ---------- plates I-VI: the claims that shipped, unchanged ----------
// Broken coupling: erase velocity after every integrator tick. All assertions
// and input policies below also run against the unmodified integrator.
function advance(s, frames) {
  for (let n = 0; n < frames; n++) {
    tick(s);
    if (mutate) s.v.fill(0);
  }
}
function pluck(s, x, depth) {
  const y = BASE + at(s, x);
  assert.ok(grab(s, x, y));
  pull(s, y + depth - s.grip.start);
  assert.ok(release(s));
}
const quiet = create(1);
advance(quiet, 240 * 60);
assert.ok(!quiet.won && quiet.plucks === 0);
assert.equal(grab(quiet, 1, 250), false);
assert.equal(grab(quiet, 180, 150), false);
const original = quiet.u.slice();
assert.ok(grab(quiet, 180, 250));
pull(quiet, 310);
assert.equal(quiet.u[26], 60);
advance(quiet, 240);
assert.ok(!quiet.won);
cancel(quiet);
assert.deepEqual(quiet.u, original);
assert.equal(quiet.plucks, 0);
assert.ok(grab(quiet, 180, 250));
assert.equal(release(quiet), false);

// Reflections invert: the finger pulls the wire down (positive), and the crest that comes back
// from a fixed end on the far side stands up (negative).
const remote = create(2, 914);
const gripX = 90, mirrorX = 360 - gripX;
assert.equal(grab(remote, mirrorX, 250), false);
pluck(remote, gripX, 84);
advance(remote, 186); // First reflected peak, as predicted by string length / wave speed.
assert.ok(at(remote, mirrorX) < -58, 'the reflected crest must reach the far side');
assert.ok(at(remote, mirrorX) < at(remote, gripX) - 30, 'the crest travels away from the grip');
assert.ok(remote.won, 'wave opens a pod beyond the playable section');
assert.equal(remote.u[0], 0);
assert.equal(remote.u.at(-1), 0);
assert.equal(remote.pods[0].openedAt > 0.3, true);
const saved = remote.pods[0].openedAt;
advance(remote, 720);
assert.equal(remote.pods[0].openedAt, saved);

function play(level, seed, aimError = 0) {
  const s = create(level, seed);
  for (let turn = 0; turn < 8 && !s.won; turn++) {
    const target = s.pods.find(p => !p.open);
    const mirror = 360 - target.x + aimError;
    const candidates = s.zones.map(([lo, hi]) => Math.max(lo, Math.min(hi, mirror)));
    const grip = candidates.sort((a, b) => Math.abs(mirror - a) - Math.abs(mirror - b))[0];
    pluck(s, grip, MAX_PULL);
    for (let i = 0; i < 290 && !s.won; i++) advance(s, 1);
  }
  return s;
}
assert.deepEqual(play(3, 42), play(3, 42));
assert.notDeepEqual(create(3, 42).pods, create(3, 43).pods);
assert.equal(LEFT + (COUNT - 1) * SPACING, 336);
// The mirror bot below is the shipped one; it plays the six shipped plates (plates VII on need
// frets, timing and harmonics, which the look-ahead player further down handles).
let wins = 0, imprecise = 0;
for (let level = 1; level <= 6; level++) {
  const shown = create(level, level * 417);
  const [left, right] = shown.zones[0];
  pluck(shown, (left + right) / 2, cueDepth(level));
  advance(shown, 290);
  assert.ok(shown.pods.some(p => p.open), 'copying the demonstrated gesture must open at least one pod on plate ' + level);
  const times = [], counts = new Set();
  for (let seed = 1; seed <= 32; seed++) {
    const s = play(level, seed);
    assert.ok(s.won, 'reachable level ' + level + ' seed ' + seed);
    assert.ok(s.pods.every(p => p.open && p.openedAt <= s.time));
    assert.ok(s.u.every(Number.isFinite));
    wins++;
    times.push(s.time);
    counts.add(s.plucks);
    if (play(level, seed, seed % 2 ? -15 : 15).won) imprecise++;
  }
  console.log(level, '32/32', 'seconds', Math.min(...times).toFixed(3), Math.max(...times).toFixed(3), 'plucks', [...counts].join('/'));
}
const shallow = create(1); pluck(shallow, 180, 10); advance(shallow, 720);
assert.equal(shallow.won, false, 'a shallow pluck falls short');
console.log('Solved', wins, 'of 192; with 15 world units of aim error', imprecise, 'of 192.');

// ---------- parity: plates I-VI keep main's wave physics exactly ----------
// A frozen copy of main's rules (commit before this change), driven side by side with sim.js
// on the current plate data (plates IV-VI have lower pods since 2026-11-24; the physics is frozen, the layouts are not)
// by the same random fingers: grabs anywhere, pulls, cancels and releases at random times.
const reference = (() => {
  const DRAG = Math.exp(-0.58 * TICK), SPEED = 67;
  const atR = (s, x) => {
    const n = Math.max(0, Math.min(COUNT - 1, (x - LEFT) / SPACING));
    const i = Math.min(COUNT - 2, Math.floor(n));
    return s.u[i] + (s.u[i + 1] - s.u[i]) * (n - i);
  };
  return {
    create(level, seed) {
      let r = seed >>> 0;
      const rnd = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296;
      const pods = plates[level - 1].buds.map(([x, height]) => ({ x: x + (rnd() - 0.5) * 6, height: height + (rnd() - 0.5) * 3, kind: level - 1, open: false, openedAt: null }));
      return { level, seed, zones: plates[level - 1].zones, pods, u: Array(COUNT).fill(0), v: Array(COUNT).fill(0), time: 0, ticks: 0, grip: null, plucks: 0, won: false, ringing: false };
    },
    grab(s, x, y) {
      if (s.grip || s.won || !Number.isFinite(y) || !s.zones.some(([a, b]) => x >= a && x <= b) || Math.abs(y - BASE - atR(s, x)) > 29) return false;
      const i = Math.round((x - LEFT) / SPACING);
      s.grip = { i, y, start: s.u[i], depth: 0, travel: 0, oldU: s.u.slice(), oldV: s.v.slice() };
      return true;
    },
    pull(s, y) {
      const g = s.grip;
      if (!g || !Number.isFinite(y)) return;
      g.travel = y - g.y;
      g.depth = Math.max(0, Math.min(MAX_PULL, g.travel + g.start));
      for (let i = 0; i < COUNT; i++) { s.u[i] = (i <= g.i ? i / g.i : (COUNT - 1 - i) / (COUNT - 1 - g.i)) * g.depth; s.v[i] = 0; }
    },
    cancel(s) { if (!s.grip) return; s.u = s.grip.oldU; s.v = s.grip.oldV; s.grip = null; },
    release(s) {
      if (!s.grip) return false;
      if (s.grip.depth < 5 || s.grip.travel < 5) { this.cancel(s); return false; }
      s.grip = null; s.plucks++; s.ringing = true; return true;
    },
    tick(s) {
      s.time = ++s.ticks * TICK;
      if (!s.ringing || s.grip) return;
      let movement = 0;
      for (let i = 1; i < COUNT - 1; i++) s.v[i] = DRAG * (s.v[i] + (s.u[i - 1] + s.u[i + 1] - 2 * s.u[i]) * SPEED ** 2 * TICK);
      for (let i = 1; i < COUNT - 1; i++) { s.u[i] += s.v[i] * TICK; movement = Math.max(movement, Math.abs(s.v[i]), Math.abs(s.u[i])); }
      for (const pod of s.pods) if (!pod.open && -atR(s, pod.x) >= pod.height) { pod.open = true; pod.openedAt = s.time; }
      s.won = s.pods.every(p => p.open);
      if (movement < 0.15) { s.u.fill(0); s.v.fill(0); s.ringing = false; }
    },
  };
})();
const live = { create, grab, pull, cancel, release, tick };
if (broken === 'parity') live.tick = s => { tick(s); s.v[26] *= 0.999; };
let parityTicks = 0, parityPlucks = 0;
for (let level = 1; level <= 6; level++) for (let seed = 1; seed <= 12; seed++) {
  const a = reference.create(level, seed), b = live.create(level, seed), rnd = random(level * 1000 + seed);
  for (let t = 0; t < 4800; t++) {
    const r = rnd();
    if (r < .004) {
      const x = 60 + rnd() * 240, y = BASE + at(a, x) + (rnd() - .5) * 70;
      assert.equal(live.grab(b, x, y), reference.grab(a, x, y));
    } else if (r < .03 && a.grip) {
      const y = a.grip.y + (rnd() - .3) * 130;
      reference.pull(a, y); live.pull(b, y);
    } else if (r < .035 && a.grip) {
      if (rnd() < .2) { reference.cancel(a); live.cancel(b); } else {
        const ok = reference.release(a);
        assert.equal(live.release(b), ok);
        parityPlucks += ok;
      }
    }
    reference.tick(a); live.tick(b); parityTicks++;
    if (t % 60 === 0 || a.won) {
      assert.deepEqual([b.u, b.v, b.time, b.plucks, b.won, b.ringing], [a.u, a.v, a.time, a.plucks, a.won, a.ringing], 'parity with main on plate ' + level + ' seed ' + seed + ' tick ' + t);
      assert.deepEqual(b.pods, a.pods);
    }
    if (a.won) break;
  }
}
console.log('Parity with main\'s wave physics on plates I-VI:', parityTicks, 'ticks,', parityPlucks, 'random plucks, identical.');

// ---------- the new plates, one claim per idea ----------
const after = (s, seconds) => { for (let n = Math.round(seconds / TICK); n > 0; n--) tick(s); return s; };
const pullAt = (s, x, depth) => { const y = BASE + at(s, x); assert.ok(grab(s, x, y), 'grab at ' + x); pull(s, y + depth - s.grip.start); assert.ok(release(s)); return s; };
const peakAt = (s, x, seconds, sign = -1) => { let m = 0; for (let n = Math.round(seconds / TICK); n > 0; n--) { tick(s); m = Math.max(m, sign * at(s, x)); } return m; };
const firstTime = (s, x, level, seconds) => { for (let n = Math.round(seconds / TICK); n > 0; n--) { tick(s); if (-at(s, x) >= level) return s.time; } return Infinity; };
const energy = s => s.u.reduce((e, y, i) => e + y * y + (s.v[i] / 67) ** 2, 0);

// Harmonics: a pluck at fraction p has partial n proportional to sin(n pi p) / n^2.
assert.ok(Math.abs(partials(.5)[1]) < 1e-12 && Math.abs(partials(.5)[3]) < 1e-12, 'a middle pluck has no even partials');
assert.ok(Math.abs(partials(1 / 3)[2]) < 1e-12, 'a pluck a third along has no third partial');
// VII. A middle pluck leaves the second-harmonic pod shut; the drawn grip opens it.
{
  const mid = pullAt(make(L('harmonic2')), 180, 84);
  assert.ok(harmonic(mid, 2) < 0.5, 'a middle pluck has (almost) no second harmonic');
  after(mid, 4);
  assert.ok(!mid.pods[0].open, 'harmonic: a middle pluck must leave the second-harmonic pod shut');
  const good = make(L('harmonic2')); followCue(good);
  assert.ok(good.pods[0].open, 'harmonic: the drawn grip opens the second-harmonic pod');
}
// XII. A pluck a third along leaves the third-harmonic pod shut.
{
  const third = pullAt(make(L('harmonic3')), LEFT + 52 / 3 * SPACING, 84);
  after(third, 4);
  assert.ok(!third.pods[0].open, 'harmonic: a pluck a third along has no third harmonic');
}
// XI. A heavy stretch slows the wave: the crest reaches the far pod later than on a light wire.
{
  const heavy = pullAt(make(L('heavy')), 102, 84), light = pullAt(make(L('heavy')), 102, 84);
  light.mass.fill(1);
  const tHeavy = firstTime(heavy, 258, 30, 2), tLight = firstTime(light, 258, 30, 2);
  assert.ok(tHeavy > tLight + .2, 'heavy: the crest arrives later on the heavy stretch (' + tHeavy.toFixed(2) + ' vs ' + tLight.toFixed(2) + ')');
}
// XIII. A heavy bead sends part of the wave back early: the near side rises less while the crest is at the bead.
{
  const bead = pullAt(make(L('bead')), 102, 84), plain = pullAt(make(L('bead')), 102, 84);
  plain.mass.fill(1);
  after(bead, .45); after(plain, .45);
  const a = peakAt(bead, 150, .2), b = peakAt(plain, 150, .2);
  assert.ok(a < b - 6, 'bead: part of the wave comes back from the bead (' + a.toFixed(1) + ' vs ' + b.toFixed(1) + ')');
}
// XIV. A sprung bridge sends much of the wave back into the plucked span, yet the far span still rings through it.
{
  const run = plain => {
    const s = make(L('bridge'));
    if (plain) { s.mass.fill(1); s.spring.fill(0); }
    pullAt(s, 114, 84);
    let near = 0, far = 0;
    for (let n = 0; n < 720; n++) { tick(s); near = Math.max(near, -at(s, 114)); far = Math.max(far, -at(s, 255)); }
    return { near, far };
  };
  const bridge = run(false), plain = run(true);
  assert.ok(bridge.near > plain.near * 1.5, 'bridge: the bridge throws the wave back (' + bridge.near.toFixed(1) + ' vs ' + plain.near.toFixed(1) + ')');
  assert.ok(bridge.far > 30, 'bridge: the far span is driven through it (' + bridge.far.toFixed(1) + ')');
}
// XV. Felt soaks up the wave.
{
  const felt = pullAt(make(L('felt')), 108, 84), bare = pullAt(make(L('felt')), 108, 84);
  bare.drag = bare.drag.map(() => bare.drag[1]);
  after(felt, 3); after(bare, 3);
  assert.ok(energy(felt) < energy(bare) * .5, 'felt: the felt takes most of the energy within 3 seconds');
}
// XVI. A swinging pod opens only when the crest arrives as it passes: the drawn timing works, the opposite one does not.
{
  const good = make(L('moving')); followCue(good);
  assert.ok(good.won, 'moving: the drawn timing opens the swinging pod');
  const bad = make(L('moving'));
  let misses = 0;
  for (const phase of [.1, .25, .4]) {
    const s = clone(bad); s.grip = null;
    const period = s.pods[0].swing[1];
    after(s, ((phase - (s.time / period) % 1) + 1) % 1 * period);
    pullAt(s, 108, 84); after(s, 4);
    misses += !s.won;
  }
  assert.ok(misses >= 2, 'moving: most other release times miss the swinging pod (' + misses + ' of 3)');
}
// IX. A two-crest pod cracks on one crest and needs a second one soon after.
{
  const once = pullAt(make(L('double')), 114, 70); after(once, 4);
  assert.ok(!once.won, 'double: one crest alone must not open a two-crest pod');
  const twice = make(L('double')); followCue(twice);
  assert.ok(twice.won, 'double: the drawn two plucks open it');
}
// XVII. The fret clamps the wire: the far side stays still and the short span rings an octave up.
{
  const s = make(L('fret'));
  const open = pitchOf(s, 10).freq;
  assert.ok(fret(s, 0));
  assert.ok(Math.abs(pitchOf(s, 10).freq / open - 52 / 26) < 1e-9, 'fret: half the wire rings an octave higher');
  pullAt(s, 84, 84);
  let far = 0;
  for (let n = 0; n < 720; n++) { tick(s); for (let i = 27; i < COUNT - 1; i++) far = Math.max(far, Math.abs(s.u[i])); }
  assert.ok(far < 1, 'fret: the wire beyond a clamped fret stays still (' + far.toFixed(2) + ')');
}
// X. Plucks in time with the wire build a standing wave; one pluck, or plucks out of time, do not.
{
  const peak = gaps => {
    const s = make(L('pump'));
    let m = 0;
    for (const g of gaps) { for (let n = Math.round(g / TICK); n > 0; n--) { tick(s); m = Math.max(m, -at(s, 180)); } pullAt(s, 180, 30); }
    for (let n = 0; n < 480; n++) { tick(s); m = Math.max(m, -at(s, 180)); }
    return m;
  };
  const one = peak([0]), inTime = peak([0, 1.55, 1.55]), offTime = peak([0, .78, .78]);
  assert.ok(inTime > one * 2, 'pump: three plucks in time more than double the swing (' + inTime.toFixed(1) + ' vs ' + one.toFixed(1) + ')');
  assert.ok(inTime > offTime * 1.5, 'pump: plucks out of time cancel (' + offTime.toFixed(1) + ')');
  // The beat ring (art.js) swells when the wire under the winding swings to its lowest point.
  // Letting go each time it swells clears the plate at par; letting go at the top of the swing does not.
  const byBeat = atBottom => {
    const s = make(L('pump')), mid = Math.round((180 - LEFT) / SPACING);
    let last = 0, prev = 0, rising = false;
    pullAt(s, 180, 36);
    for (let n = 0; n < 240 * 8 && !s.won; n++) {
      tick(s);
      const u = s.u[mid], was = rising; rising = u > prev; prev = u;
      const turn = atBottom ? was && !rising && u > 3 : !was && rising && u < -3;
      if (turn && s.time - last > .8) { last = s.time; pullAt(s, 180, 36); }
    }
    return s;
  };
  const beat = byBeat(true);
  assert.ok(beat.won && beat.plucks <= PARS[L('pump') - 1], 'pump: letting go as the beat ring swells clears at par (' + beat.plucks + ' plucks)');
  assert.ok(!byBeat(false).won, 'pump: letting go at the top of the swing does not clear');
}
// VIII. A free end on a sliding ring: the far end follows the finger, and its crest comes back the same way up.
{
  const s = make(L('free'));
  const y = BASE + at(s, 102); assert.ok(grab(s, 102, y)); pull(s, y + 84);
  assert.ok(s.u[COUNT - 1] > 80, 'free: a held free end sits level with the finger');
  release(s);
  let up = 0;
  for (let n = 0; n < 480; n++) { tick(s); up = Math.max(up, -s.u[COUNT - 1]); }
  assert.ok(up > 40, 'free: the free end swings right up (' + up.toFixed(1) + ')');
}

// ---------- every plate: the look-ahead player, the drawn finger, par and the daily ----------
const t0 = Date.now();
for (let level = 1; level <= plates.length; level++) {
  const counts = [];
  for (let seed = 1; seed <= 8; seed++) {
    const r = solve(make(level, seed));
    assert.ok(r.won, 'the aiming player clears plate ' + level + ' seed ' + seed);
    counts.push(r.plucks);
  }
  const shown = make(level);
  const opened = followCue(shown);
  assert.ok(opened >= 1, 'copying the drawn finger opens a pod on plate ' + level);
  console.log(String(level).padStart(2), plates[level - 1].name.padEnd(19), 'aiming 8/8 plucks', counts.join(','), ' drawn finger opens', opened + '/' + shown.pods.length);
}
const pars = plates.map((_, i) => par(i + 1, (i + 1) * 417));
assert.deepEqual(pars, PARS, 'PARS in sim.js match the look-ahead player');
console.log('Pars', pars.join(' '), 'in', Date.now() - t0, 'ms for all of the above');
let worst = 0;
for (let d = 0; d < 30; d++) {
  const iso = new Date(Date.UTC(2026, 10, 24) + d * 864e5).toISOString().slice(0, 10);
  const day = daily(iso);
  assert.deepEqual(daily(iso), day, 'the daily plate is the same for everyone');
  const t = Date.now();
  assert.ok(par(day.level, day.seed, { spread: day.spread }) !== null, 'the daily plate on ' + iso + ' can be cleared');
  worst = Math.max(worst, Date.now() - t);
}
console.log('Daily: 30 days from 2026-11-24 all clearable; slowest par', worst, 'ms');

// Clumsy players: aim, depth and timing errors. The rate should fall gently along the plates.
const levels = [[8, 10, .1], [16, 20, .2], [24, 30, .3]];
const seeds = report ? 16 : 6;
const table = [];
for (let level = 1; level <= plates.length; level++) {
  const row = levels.map(([aim, depth, time]) => {
    let w = 0;
    for (let seed = 1; seed <= seeds; seed++) w += solve(make(level, seed), { noise: { aim, depth, time, random: random(seed * 7919 + aim) } }).won;
    return w;
  });
  table.push(row);
  assert.ok(row[1] >= seeds / 4, 'a clumsy player still clears plate ' + level + ' a quarter of the time');
}
// The owner's curve, on 16 seeds: the middle row never drops by more than 3 from one plate to the next, and never below 5.
if (report) table.forEach((row, i) => {
  assert.ok(row[1] >= 5, 'plate ' + (i + 1) + ': at least 5 of 16 clumsy clears');
  if (i) assert.ok(Math.abs(row[1] - table[i - 1][1]) <= 3, 'plate ' + (i + 1) + ': no step larger than 3 of 16');
});
console.log('Clumsy clears of', seeds, 'seeds (aim ±8/±16/±24, depth -10/-20/-30, timing ±.1/.2/.3 s):');
console.log(table.map((r, i) => String(i + 1).padStart(2) + ' ' + r.map(n => String(n).padStart(2)).join(' ')).join('\n'));
