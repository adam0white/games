// Checks and measured play: node prototypes/ant-promotion/bots.mjs [seeds] [minutes]
// 1. the contact rule, every cell   2. the form tree   3. food exists for every form   4. bots play
import assert from 'node:assert/strict';
import { FORMS, ANT, TOP, CONE, encounter, create, step, choose, revive, me, level, catchable, optionsFor, article } from './sim.js';
const seeds = Number(process.argv[2] ?? 20), minutes = Number(process.argv[3] ?? 12);

// 1. Rule table. Player: power 50, speed 124.
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
console.log(`rule table: ${cells.length} cells pass`);

// 2. Tree: 3 options at every level, every name unique, level 17 has no dragon, fire ant is offered to the ant.
const names = FORMS.map(f => f.name);
assert.equal(new Set(names).size, names.length, 'form names are unique');
for (let l = 1; l < TOP; l++) assert.equal(optionsFor(l).length, 3, `3 options after level ${l}`);
assert.equal(optionsFor(TOP).length, 0);
assert.ok(optionsFor(1).some(f => f.name === 'Fire Ant'));
assert.ok(!FORMS.some(f => f.level === 17 && /dragon/i.test(f.name)));
assert.equal(article('Ant'), 'an Ant'); assert.equal(article('Porcupine'), 'a Porcupine');
console.log(`tree: ${FORMS.length} forms, ${TOP} levels, 3 options at each`);

// 3. Food: for every playable form, a fresh world holds prey it can catch. The known-bad world (no weaker levels spawn) must fail.
const stackTo = f => { const st = [ANT]; for (let l = 2; l < f.level; l++) st.push(optionsFor(l - 1)[0].id); if (f.level > 1) st.push(f.id); return st; };
let least = Infinity, leastName = '';
for (const f of FORMS.filter(f => f.level >= 1)) for (let seed = 1; seed <= 10; seed++) {
  const n = catchable(create(seed, stackTo(f))).length;
  if (n < least) { least = n; leastName = f.name; }
}
assert.ok(least >= 8, `least prey ${least} (${leastName})`);
const bad = catchable(create(1, [ANT], 0, [[1, 1], [2, 1]])).length;
assert.equal(bad, 0, 'a world with only stronger mobs has no prey');
console.log(`food: fewest catchable mobs in a fresh world ${least} (${leastName}); known-bad world ${bad}`);

// 4. Bots. careful hunts what it can catch and keeps out of stronger mobs' sight; reckless walks at the nearest weaker mob and ignores danger.
const ang = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
function careful(s) {
  const p = s.player, F = me(s); let vx = 0, vy = 0, best = null, bd = Infinity;
  for (const m of s.mobs) {
    const M = FORMS[m.f], dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (M.power > F.power) {
      const reach = M.range * F.stealth + 110, facing = ang(Math.atan2(-dy, -dx), m.a) < CONE + 0.4;
      if (d < reach * (facing || m.alert ? 1.5 : 0.7)) { const w = (m.alert ? 5 : facing ? 3 : 1.5) * reach / d; vx -= dx / d * w; vy -= dy / d * w; }
    } else if (M.power < F.power && (M.speed <= F.speed || !m.alert) && d < bd) { bd = d; best = m; }
  }
  if (best) {
    const M = FORMS[best.f]; let tx = best.x, ty = best.y;
    if (M.speed > F.speed && bd > 40) { const back = Math.min(bd * 0.7, 70); tx -= Math.cos(best.a) * back; ty -= Math.sin(best.a) * back; } // come from behind
    const d = Math.hypot(tx - p.x, ty - p.y) || 1; vx += (tx - p.x) / d; vy += (ty - p.y) / d;
  }
  return { x: vx, y: vy };
}
function reckless(s) {
  const p = s.player, F = me(s); let best = null, bd = Infinity;
  for (const m of s.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (FORMS[m.f].power < F.power && d < bd) { bd = d; best = m; } }
  return best ? { x: best.x - p.x, y: best.y - p.y } : { x: 0, y: 0 };
}
const result = {};
for (const [name, policy] of Object.entries({ careful, reckless })) for (const pick of [0, 1, 2]) {
  const tops = [], deaths = []; let eaten = 0, wins = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = create(seed); let top = 1;
    for (let i = 0; i < minutes * 3600; i++) {
      step(s, policy(s));
      if (s.choosing) choose(s, pick);
      if (s.dead) revive(s, false);
      top = Math.max(top, level(s));
    }
    tops.push(top); deaths.push(s.deaths); eaten += s.eaten; wins += s.won ? 1 : 0;
  }
  tops.sort((a, b) => a - b); deaths.sort((a, b) => a - b);
  const mid = a => a[Math.floor(a.length / 2)];
  result[`${name}/${pick}`] = { top: mid(tops), deaths: mid(deaths) };
  console.log(`${name.padEnd(8)} always picks ${['strong', 'fast', 'sneaky'][pick].padEnd(6)} ${minutes} min: highest level median ${mid(tops)} (min ${tops[0]}, max ${tops.at(-1)}), deaths median ${mid(deaths)}, eaten/run ${(eaten / seeds).toFixed(0)}, reached the top ${wins}/${seeds}`);
}
for (const pick of [0, 1, 2]) {
  assert.ok(result[`careful/${pick}`].top >= 6, `careful bot climbs (pick ${pick})`);
  assert.ok(result[`careful/${pick}`].deaths < result[`reckless/${pick}`].deaths, `care pays (pick ${pick})`);
}
console.log('bots: a careful player climbs and dies less than a reckless one');
