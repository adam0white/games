// Checks and measured play for Ant Promotion: Wilds: node experiments/lab/ant-wilds/bots.mjs [seeds] [minutes]
// 1. the player contact rule is the main game's   2. determinism   3. food and the refill   4. sneaking up on a busy eater
// 5. bots play, next to the main game's careful bot   6. food-chain numbers: hunts in view, kills, leftovers
import assert from 'node:assert/strict';
import { FORMS, ANT, TOP, CONE, WORLD, WILD, encounter, create, step, choose, revive, me, level, catchable, optionsFor } from './sim.js';
import * as Main from '../../ant-promotion/sim.js';
const seeds = Number(process.argv[2] ?? 10), minutes = Number(process.argv[3] ?? 12);

// 1. Rule table. Player: power 50, speed 124. Then every combination against the main game's encounter().
const P = { power: 50, speed: 124 };
const cells = [
  ['weaker, has not noticed, slower', { power: 40, speed: 104, alert: false }, 'eat'],
  ['weaker, has not noticed, faster (sneak-up)', { power: 40, speed: 150, alert: false }, 'eat'],
  ['weaker, noticed, slower', { power: 40, speed: 104, alert: true }, 'eat'],
  ['weaker, noticed, same speed', { power: 40, speed: 124, alert: true }, 'eat'],
  ['weaker, noticed, faster', { power: 40, speed: 150, alert: true }, 'none'],
  ['stronger, noticed, faster', { power: 60, speed: 150, alert: true }, 'die'],
  ['stronger, noticed, slower (contact)', { power: 60, speed: 104, alert: true }, 'die'],
  ['stronger, has not noticed (contact)', { power: 60, speed: 104, alert: false }, 'die'],
  ['same power', { power: 50, speed: 150, alert: true }, 'none'],
];
for (const [name, mob, want] of cells) assert.equal(encounter(P, mob), want, name);
let grid = 0;
for (const a of FORMS) for (const b of FORMS) for (const alert of [false, true]) { assert.equal(encounter(a, { ...b, alert }), Main.encounter(a, { ...b, alert })); grid++; }
console.log(`rule table: ${cells.length} cells pass; ${grid} form pairs give the same answer as the main game`);

// Bots. careful is the main game's careful bot, unchanged, so the comparison is fair.
const ang = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
function danger(s) { // the careful bot's push away from stronger mobs
  const p = s.player, F = me(s); let vx = 0, vy = 0;
  for (const m of s.mobs) {
    const M = FORMS[m.f], dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (M.power > F.power) {
      const reach = M.range * F.stealth + 110, facing = ang(Math.atan2(-dy, -dx), m.a) < CONE + 0.4;
      if (d < reach * (facing || m.alert ? 1.5 : 0.7)) { const w = (m.alert ? 5 : facing ? 3 : 1.5) * reach / d; vx -= dx / d * w; vy -= dy / d * w; }
    }
  }
  return [vx, vy];
}
function preyOf(s) {
  const p = s.player, F = me(s); let best = null, bd = Infinity;
  for (const m of s.mobs) { const M = FORMS[m.f], d = Math.hypot(m.x - p.x, m.y - p.y); if (M.power < F.power && (M.speed <= F.speed || !m.alert) && d < bd) { bd = d; best = m; } }
  return [best, bd];
}
function towards(s, best, bd) {
  const p = s.player, F = me(s), M = FORMS[best.f]; let tx = best.x, ty = best.y;
  if (M.speed > F.speed && bd > 40) { const back = Math.min(bd * 0.7, 70); tx -= Math.cos(best.a) * back; ty -= Math.sin(best.a) * back; } // come from behind
  const d = Math.hypot(tx - p.x, ty - p.y) || 1; return [(tx - p.x) / d, (ty - p.y) / d];
}
function careful(s) {
  let [vx, vy] = danger(s); const [best, bd] = preyOf(s);
  if (best) { const [ux, uy] = towards(s, best, bd); vx += ux; vy += uy; }
  return { x: vx, y: vy };
}
function reckless(s) {
  const p = s.player, F = me(s); let best = null, bd = Infinity;
  for (const m of s.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (FORMS[m.f].power < F.power && d < bd) { bd = d; best = m; } }
  return best ? { x: best.x - p.x, y: best.y - p.y } : { x: 0, y: 0 };
}
// scavenger: careful, but goes for leftovers whenever a pile is within twice the distance of the nearest prey.
function scavenger(s) {
  let [vx, vy] = danger(s); const [best, bd] = preyOf(s), p = s.player;
  let pile = null, ld = Infinity;
  for (const L of s.left) { const d = Math.hypot(L.x - p.x, L.y - p.y); if (d < ld && d < 700) { ld = d; pile = L; } }
  if (pile && ld < bd * 2) { vx += (pile.x - p.x) / (ld || 1); vy += (pile.y - p.y) / (ld || 1); }
  else if (best) { const [ux, uy] = towards(s, best, bd); vx += ux; vy += uy; }
  return { x: vx, y: vy };
}

// 2. Determinism: same seed and inputs give the same state twice; another seed gives another state.
const fnv = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
function run(seed, ticks) {
  const s = create(seed);
  for (let i = 0; i < ticks; i++) { step(s, careful(s)); if (s.choosing) choose(s, i % 3); if (s.dead) revive(s, false); }
  const r = x => Math.round(x * 1000);
  return fnv(JSON.stringify([s.player.stack, r(s.player.x), r(s.player.y), s.player.xp, s.kills, s.scavenged, s.mobs.map(m => [m.id, m.f, r(m.x), r(m.y), r(m.a), m.prey, m.fear, r(m.busy)]), s.left.map(L => [L.id, r(L.x), r(L.y), r(L.t)]), s.rand()]));
}
const h1 = run(7, 3600 * 3), h2 = run(7, 3600 * 3), h3 = run(8, 3600 * 3);
assert.equal(h1, h2, 'same seed and inputs give the same state'); assert.notEqual(h1, h3, 'another seed gives another state');
console.log(`determinism: 3 min, seed 7 twice ${h1} = ${h2}; seed 8 ${h3}`);

// 3. Food: a fresh world holds prey for every form (as in the main game); the known-bad world has none.
const stackTo = f => { const st = [ANT]; for (let l = 2; l < f.level; l++) st.push(optionsFor(l - 1)[0].id); if (f.level > 1) st.push(f.id); return st; };
let least = Infinity, leastName = '';
for (const f of FORMS.filter(f => f.level >= 1)) for (let seed = 1; seed <= 10; seed++) {
  const n = catchable(create(seed, stackTo(f))).length;
  if (n < least) { least = n; leastName = f.name; }
}
assert.ok(least >= 8, `least prey ${least} (${leastName})`);
assert.equal(catchable(create(1, [ANT], 0, [[1, 1], [2, 1]])).length, 0, 'a world with only stronger mobs has no prey');
// Drift: an unseen player stands still for 5 minutes at levels 4, 9 and 14. Hunters eat the weak; the refill must keep them.
for (const L of [4, 9, 14]) {
  const f = optionsFor(L - 1)[1], out = [];
  for (const sim of [Main, { create, step, me }]) {
    const s = sim.create(3, stackTo(f)); let lo = Infinity;
    for (let i = 0; i < 3600 * 5; i++) { s.player.safe = 99; sim.step(s, { x: 0, y: 0 }); if (i > 600) lo = Math.min(lo, s.mobs.filter(m => FORMS[m.f].power < me(s).power).length); }
    const F = me(s); out.push(`${s.mobs.filter(m => FORMS[m.f].power < F.power).length} weaker / ${s.mobs.filter(m => FORMS[m.f].power > F.power).length} stronger (fewest weaker ${lo})`);
  }
  console.log(`food after 5 idle minutes at level ${L}: main ${out[0]}; wilds ${out[1]}`);
}
// The no-prey timer used below can read above zero: in the known-bad world it runs the whole 30 s.
{ const s = create(1, [ANT], 0, [[1, 1], [2, 1]]); let streak = 0;
  for (let i = 0; i < 1800; i++) { s.player.safe = 99; step(s, { x: 0, y: 0 }); streak = catchable(s).length ? 0 : streak + 1 / 60; }
  assert.ok(streak > 25, `known-bad world has no prey for the whole run (${streak.toFixed(1)} s)`); }
console.log(`food: fewest catchable mobs in a fresh world ${least} (${leastName}); known-bad world 0, and it stays at 0 for 30 s`);

// 4. Sneaking in: a stronger animal is busy eating next to its leftovers; the player walks onto the pile from the far side, eats it, and lives.
{
  const s = create(5, stackTo(optionsFor(4)[0])), F = me(s), p = s.player; p.safe = 0;
  const bigF = FORMS.find(f => f.level === F.level + 2), preyF = FORMS.find(f => f.level === F.level - 1);
  s.mobs = []; s.left = [];
  const eater = { id: 999, f: bigF.id, x: 600, y: 600, a: 0, alert: false, lost: 0, timer: 9, want: 0, wander: 0, walk: false, ph: 0, prey: 0, huntT: 0, lostT: 0, onPlayer: false, busy: 3, rest: 9, fear: 0, fearT: 0, hx: 0, hy: 0, mates: 0, dead: false };
  const prey = { ...eater, id: 998, f: preyF.id, x: 600 + (bigF.r + preyF.r) * 0.8, busy: 0, rest: 9 };
  s.mobs.push(eater, prey); eater.prey = prey.id; eater.busy = 0;
  step(s, { x: 0, y: 0 }); // the eater reaches its prey: a kill, then it is busy
  assert.ok(s.kills === 1 && eater.busy > 0 && s.left.length === 1, 'the hunter kills and is busy');
  const L = s.left[0]; p.x = L.x + 120; p.y = L.y; const xp = p.xp; let got = false;
  for (let i = 0; i < 120 && !got; i++) { step(s, { x: -1, y: 0 }); got = s.events.some(e => e.t === 'scavenge'); }
  assert.ok(got && !s.dead && p.xp === xp + WILD.scavenge, 'the player takes the leftovers beside a busy stronger eater and lives');
  // and a busy eater ignores a player in front of it, but touching it still kills
  assert.ok(!eater.alert, 'a busy eater has not noticed the player');
  for (let i = 0; i < 60 && !s.dead; i++) step(s, { x: (eater.x - p.x), y: (eater.y - p.y) });
  assert.ok(s.dead, 'touching a stronger busy eater still kills');
  console.log(`sneak-in: leftovers taken beside a busy ${bigF.name} for +${WILD.scavenge}; touching it still kills`);
}

// 5 and 6. Bots for `minutes` over `seeds` seeds.
const view = (s, x, y) => { const L = level(s); return Math.abs(x - s.player.x) < 170 + 5 * L && Math.abs(y - s.player.y) < 360 + 10 * L; }; // a 390 by 844 phone screen
const mid = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const result = {};
const rows = [];
for (const [name, policy] of Object.entries({ careful, reckless, scavenger })) for (const pick of [0, 1, 2]) {
  const tops = [], deaths = []; let eaten = 0, wins = 0, kills = 0, left = 0, seen = 0, ticks = 0, zero = 0, gotLeft = 0, gotAll = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = create(seed); let top = 1, run0 = 0;
    for (let i = 0; i < minutes * 3600; i++) {
      const xp = s.player.xp;
      step(s, policy(s));
      for (const e of s.events) { if (e.t === 'scavenge') gotLeft += e.gain; if (e.t === 'eat') gotAll += e.gain; }
      if (s.choosing) choose(s, pick);
      if (s.dead) revive(s, false);
      top = Math.max(top, level(s));
      if (i % 6 === 0) {
        ticks++;
        if (s.mobs.some(m => (m.prey || m.busy > 0) && view(s, m.x, m.y))) seen++;
        if (catchable(s).length === 0) { run0 += 0.1; zero = Math.max(zero, run0); } else run0 = 0;
      }
    }
    tops.push(top); deaths.push(s.deaths); eaten += s.eaten; wins += s.won ? 1 : 0; kills += s.kills; left += s.scavenged;
  }
  gotAll += gotLeft;
  result[`${name}/${pick}`] = { top: mid(tops), deaths: mid(deaths), zero };
  rows.push(`${name.padEnd(9)} picks ${['strong', 'fast', 'sneaky'][pick].padEnd(6)}: level median ${String(mid(tops)).padStart(2)} (${tops.sort((a, b) => a - b)[0]}-${tops.at(-1)}), deaths median ${String(mid(deaths)).padStart(2)}, top ${wins}/${seeds}, eaten/run ${(eaten / seeds).toFixed(0)}, leftovers/run ${(left / seeds).toFixed(1)} (${(100 * gotLeft / (gotAll || 1)).toFixed(0)}% of bar), kills/min ${(kills / seeds / minutes).toFixed(1)}, hunt on screen ${(100 * seen / ticks).toFixed(0)}% of time, longest time with no prey ${zero.toFixed(1)} s`);
}
// the main game's careful bot over the same seeds and minutes
const mainRows = [];
for (const pick of [0, 1, 2]) {
  const tops = [], deaths = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const s = Main.create(seed); let top = 1;
    for (let i = 0; i < minutes * 3600; i++) { Main.step(s, careful(s)); if (s.choosing) Main.choose(s, pick); if (s.dead) Main.revive(s, false); top = Math.max(top, Main.level(s)); }
    tops.push(top); deaths.push(s.deaths);
  }
  mainRows.push(`main game careful picks ${['strong', 'fast', 'sneaky'][pick].padEnd(6)}: level median ${mid(tops)}, deaths median ${mid(deaths)}`);
}
console.log(`\n${seeds} seeds, ${minutes} simulated minutes each`);
for (const r of [...mainRows, ...rows]) console.log(r);
for (const pick of [0, 1, 2]) {
  assert.ok(result[`careful/${pick}`].top >= 6, `careful bot climbs (pick ${pick})`);
  assert.ok(result[`careful/${pick}`].deaths < result[`reckless/${pick}`].deaths, `care pays (pick ${pick})`);
  for (const b of ['careful', 'scavenger']) assert.ok(result[`${b}/${pick}`].zero <= 5, `${b} never waits more than 5 s with no prey (pick ${pick}): ${result[`${b}/${pick}`].zero}`);
}
console.log('bots: a careful player climbs and dies less than a reckless one; prey is never gone for more than 5 s');
