// Independent race-layer assertions. --mutate reverses distance ranking: the SAME checks must fail.
// No alternate Lantern rules, artificial lives or disabled collisions are used.
import assert from 'node:assert/strict';
import { create, step, progress } from '../../lantern/sim.js';
import { ranking, interpolate, ghostTrack, position, decode, validMessage, bytes, botControl, botTarget, nightForSeed, NIGHTS, countdown, cleanName, roomCode, makeCode, dailySeed } from './sim.js';
let failures = 0, checks = 0;
const claim = (name, fn) => { checks++; try { fn(); console.log('ok  ' + name); } catch (e) { failures++; console.error('FAIL ' + name + ': ' + e.message); } };
const rank = process.argv.includes('--mutate') ? entries => ranking(entries).reverse() : ranking;
claim('distance first, time second, stable ID last; unfinished time sorts last', () => {
  const input = [{ id: 4, d: 100000, s: 90000 }, { id: 2, d: 70000, s: 15000 }, { id: 3, d: 100000, s: 80000 }, { id: 1, d: 100000, s: 80000 }, { id: 5, d: 100000 }];
  const before = structuredClone(input); assert.deepEqual(rank(input).map(p => p.id), [1, 3, 4, 5, 2]); assert.deepEqual(input, before);
});
claim('interpolation: exact start/mid/end, no extrapolation or distance regression', () => {
  let track = ghostTrack({ x: -.8, d: 1000, a: 1 }, 1000);
  track = ghostTrack({ x: .8, d: 2000, a: 1 }, 1200, track);
  assert.equal(interpolate(track, 1200).d, 1000); assert.equal(interpolate(track, 1300).d, 1500); assert.equal(interpolate(track, 1300).x, 0);
  assert.equal(interpolate(track, 1400).d, 2000); assert.equal(interpolate(track, 9999).d, 2000);
  assert.equal(ghostTrack({ x: 0, d: 900, a: 1 }, 1300, track), track);
  track = ghostTrack({ x: 1, d: 2100, a: 0 }, 1600, track); assert.equal(interpolate(track, 9999).a, 0);
});
claim('all outbound frames <= 200 UTF-8 bytes; coordinates bounded and quantized', () => {
  let max = 0;
  const samples = [{ t: 'hi', n: cleanName('🛶'.repeat(16)) }, { t: 'ready' }, { t: 'done', s: 1000000 }];
  for (let i = -100; i <= 100; i++) samples.push(position(i / 10, i * 2000, i % 2));
  for (const m of samples) { max = Math.max(max, bytes(m)); assert.ok(validMessage(m, 'client')); assert.ok(bytes(m) <= 200); assert.deepEqual(decode(JSON.stringify(m), 'client'), m); }
  console.log('    max outbound frame bytes ' + max + ' / ' + samples.length + ' samples');
});
claim('invalid messages fail closed; malicious names and invalid rooms bounded', () => {
  for (const text of ['{', 'null', '[]', JSON.stringify({ t: 'p', id: 9, x: 0, d: 0, a: 1 }), JSON.stringify({ t: 'p', id: 1, x: 1.1, d: 0, a: 1 }), JSON.stringify({ t: 'round', seed: -1, start: 4 }), JSON.stringify({ t: 'done', id: 1, s: '2' }), JSON.stringify({ t: 'you', id: 1, peers: [{id:1,n:'A'},{id:1,n:'B'}],round:null }), 'x'.repeat(2050)]) assert.equal(decode(text), null);
  assert.equal(cleanName('<script>\n'), 'script'); assert.equal(Array.from(cleanName('🛶'.repeat(30))).length, 16);
  assert.equal(roomCode('abCd'), 'ABCD'); assert.equal(roomCode('open'), 'open'); assert.equal(roomCode('../x'), null);
  assert.match(makeCode(42), /^[A-Z]{4}$/); assert.equal(makeCode(42), makeCode(42));
  assert.equal(dailySeed('2026-11-23'), dailySeed('2026-11-23')); assert.notEqual(dailySeed('2026-11-23'), dailySeed('2026-11-24'));
});
claim('eight-peer roster receive bound handles the contract byte conflict', () => {
  const roster = { t: 'you', id: 1, peers: Array.from({length:8}, (_,i) => ({ id:i+1, n:'abcdefghijklmnop' })), round: { seed: 4294967295, start: 1795000000000 } };
  assert.ok(bytes(roster) > 200); assert.deepEqual(decode(JSON.stringify(roster)), roster);
  console.log('    full eight-peer ASCII roster ' + bytes(roster) + ' bytes (receive-only exception)');
});
claim('start offset clamped to 1..6 seconds; shared seed selects one night', () => {
  assert.equal(countdown(100, 1000), 1000); assert.equal(countdown(10000, 0), 6000); assert.equal(countdown(4000, 0), 4000);
  assert.deepEqual([0,1,2].map(nightForSeed), NIGHTS);
});
function play(seed, night, skill, identity = 0) {
  const s = create(seed, night, false, []), policy = { skill, id: identity, next: 0 }, trace = [];
  while (!s.over && s.t < 180) { const x = botControl(s, policy); assert.ok(x >= 0 && x <= 1); step(s, x); if (Math.round(s.t * 60) % 120 === 0) trace.push([s.x,s.y,s.light,s.taken]); }
  assert.ok(s.over, 'river ends within 180 s');
  return { end: s.over, d: Math.round(progress(s) * 100000), t: s.t, trace };
}
claim('same seed and same bot inputs give identical ghost traces; seeds differ', () => {
  for (const skill of [0,1,2]) assert.deepEqual(play(3,1,skill), play(3,1,skill));
  assert.notDeepEqual(play(3,1,1,0).trace, play(4,1,1,0).trace);
  assert.ok(Number.isFinite(botTarget(create(3),2)));
});
const stats = [];
for (const night of NIGHTS) {
  const row = { night, slow: 0, careful: 0, meanSlow: 0, meanCareful: 0, minTime: Infinity, maxTime: 0 };
  for (const skill of [0, 2]) for (let seed = 1; seed <= (skill === 0 ? 120 : 40); seed++) {
    const result = play(seed, night, skill); const key = skill === 0 ? 'slow' : 'careful';
    if (result.end === 'dawn') row[key]++;
    row[skill === 0 ? 'meanSlow' : 'meanCareful'] += result.d / (skill === 0 ? 120 : 40) / 1000;
    if (skill === 2 && result.end === 'dawn') { row.minTime = Math.min(row.minTime, result.t); row.maxTime = Math.max(row.maxTime, result.t); }
  }
  stats.push(row);
  console.log(`    night ${night}: clumsy ${row.slow}/120 dawn (${row.meanSlow.toFixed(1)}% mean distance); careful ${row.careful}/40 (${row.meanCareful.toFixed(1)}%); wins ${row.minTime.toFixed(1)}–${row.maxTime.toFixed(1)}s`);
}
claim('clumsy bot reaches dawn on night 1; careful bot reaches dawn on every race night', () => {
  assert.ok(stats[0].slow > 0); for (const row of stats) { assert.ok(row.careful > 0); assert.ok(row.careful > row.slow); }
});
claim('difficulty rises: clumsy completion falls at each selected night', () => {
  for (let i = 1; i < stats.length; i++) assert.ok(stats[i].slow < stats[i-1].slow, JSON.stringify(stats.map(r=>r.slow)));
});
console.log(`${checks - failures}/${checks} checks passed${process.argv.includes('--mutate') ? ' (mutation: distance ranking reversed)' : ''}`);
process.exitCode = failures ? 1 : 0;
