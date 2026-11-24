// Checks and measured play for Ant Promotion: Evolve: node experiments/lab/ant-evolve/bots.mjs [seeds] [minutes]
// 1. determinism   2. with evolution off the world is the copied game, tick for tick   3. bots play a long session with the gene pool
// carried from seed to seed, next to the same bots with evolution off and with parents picked at random (the drift control).
// Exits non-zero on a failed assertion.
import assert from 'node:assert/strict';
import { FORMS, ANT, SPAWN_WEIGHTS, TRAITS, BOUNDS, NEUTRAL, create, step, choose, revive, me, level, catchable, powerOf, sightFor, mobSpeed,
  newPool, poolSave, poolMeans, meadowLines, generation } from './sim.js';
import * as Main from '../../ant-promotion/sim.js';
const seeds = Number(process.argv[2] ?? 5), minutes = Number(process.argv[3] ?? 30), WINDOW = 5;

// ---------- bots. Both see what the screen shows: the sight wedge at its evolved size, and the » mark at the evolved speed.
const ang = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
// careful: the main game's careful bot. It hunts what it can catch and keeps out of stronger animals' sight.
function careful(s, sim = null) {
  const p = s.player, F = me(s); let vx = 0, vy = 0, best = null, bd = Infinity;
  for (const m of s.mobs) {
    const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, pw = powerOf(m), sp = sim ? FORMS[m.f].speed : mobSpeed(m);
    if (pw > F.power) {
      const [range, half] = sim ? [FORMS[m.f].range * sim.sightOf(FORMS[m.f])[0], sim.sightOf(FORMS[m.f])[1]] : sightFor(m, F);
      const reach = range * F.stealth + 110, facing = ang(Math.atan2(-dy, -dx), m.a) < half + 0.4;
      if (d < reach * (facing || m.alert ? 1.5 : 0.7)) { const w = (m.alert ? 5 : facing ? 3 : 1.5) * reach / d; vx -= dx / d * w; vy -= dy / d * w; }
    } else if (pw < F.power && (sp <= F.speed || !m.alert) && d < bd) { bd = d; best = m; }
  }
  if (best) {
    const sp = sim ? FORMS[best.f].speed : mobSpeed(best); let tx = best.x, ty = best.y;
    if (sp > F.speed && bd > 40) { const back = Math.min(bd * 0.7, 70); tx -= Math.cos(best.a) * back; ty -= Math.sin(best.a) * back; } // come from behind
    const d = Math.hypot(tx - p.x, ty - p.y) || 1; vx += (tx - p.x) / d; vy += (ty - p.y) / d;
  }
  return { x: vx, y: vy };
}
// reckless: walks at the nearest weaker animal and ignores danger.
function reckless(s) {
  const p = s.player, F = me(s); let best = null, bd = Infinity;
  for (const m of s.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (powerOf(m) < F.power && d < bd) { bd = d; best = m; } }
  return best ? { x: best.x - p.x, y: best.y - p.y } : { x: 0, y: 0 };
}
const pickFor = s => level(s) % 3; // promotions rotate through strong, fast and sneaky

// ---------- 1. Determinism: same seed, inputs and starting pool give the same world and the same pool. Each run gets its own copy of the pool.
const fnv = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
const r3 = x => Math.round(x * 1000);
const stateOf = s => [s.player.stack, r3(s.player.x), r3(s.player.y), s.player.xp, s.deaths, s.mobs.map(m => [m.id, m.f, r3(m.x), r3(m.y), r3(m.a), m.alert])];
function run(seed, ticks, pool) {
  const s = create(seed, [ANT], 0, SPAWN_WEIGHTS, false, null, { pool: JSON.parse(JSON.stringify(pool)) });
  for (let i = 0; i < ticks; i++) { step(s, careful(s)); if (s.choosing) choose(s, pickFor(s)); if (s.dead) revive(s, false); }
  return fnv(JSON.stringify([stateOf(s), s.mobs.map(m => m.g && m.g.map(r3)), poolSave(s), s.rand(), s.grand()]));
}
{
  const start = newPool();
  const h1 = run(7, 3600 * 3, start), h2 = run(7, 3600 * 3, start), h3 = run(8, 3600 * 3, start);
  assert.equal(h1, h2, 'same seed, inputs and pool give the same state'); assert.notEqual(h1, h3, 'another seed gives another state');
  assert.deepEqual(start, newPool(), 'create() changes only the pool it is given');
  console.log(`determinism: 3 min with evolution on, seed 7 twice ${h1} = ${h2}; seed 8 ${h3}`);
}

// ---------- 2. Evolution off: the same as ../../ant-promotion/sim.js, tick for tick, through promotions and deaths.
// The inputs come from the careful bot on this sim and are replayed into the main game's sim. The bad case (evolution on) must differ.
{
  // The state is compared once a second; the next random draw is compared only at the end, because drawing it changes the run.
  const ticks = 3600 * 4;
  const cmp = evo => {
    const a = create(3, [ANT], 0, SPAWN_WEIGHTS, false, null, evo), b = Main.create(3); let promos = 0, deaths = 0;
    for (let i = 0; i < ticks; i++) {
      const inp = reckless(a); step(a, inp); Main.step(b, inp);
      if (a.choosing) { promos++; choose(a, pickFor(a)); } if (b.choosing) Main.choose(b, Main.level(b) % 3);
      if (a.dead) { deaths++; revive(a, false); } if (b.dead) Main.revive(b, false);
      if ((i % 60 === 0) && JSON.stringify(stateOf(a)) !== JSON.stringify(stateOf(b))) return { same: false, at: i, promos, deaths };
    }
    return { same: a.rand() === b.rand(), at: ticks, promos, deaths };
  };
  const off = cmp(null), on = cmp({ pool: newPool() });
  assert.ok(off.same, `evolution off matches the main game (first difference at tick ${off.at})`);
  assert.ok(!on.same, 'evolution on differs from the main game (the check can fail)');
  console.log(`evolution off = main game for ${ticks} ticks (${off.promos} promotions, ${off.deaths} deaths, reckless inputs); evolution on differs from tick ${on.at}`);
}

// ---------- 3. A long session. The pool is carried from seed to seed, as it is carried from visit to visit in the page.
const mid = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
// How far a genome is from neutral: each trait as a share of the way to its bound, then the length of that vector.
const drift = g => Math.hypot(...g.map((v, i) => (v >= NEUTRAL[i] ? (v - NEUTRAL[i]) / (BOUNDS[i][1] - NEUTRAL[i]) : (NEUTRAL[i] - v) / (NEUTRAL[i] - BOUNDS[i][0] || 1))));
function session(policy, mode) {
  let pool = newPool(); const rows = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const s = create(seed, [ANT], 0, SPAWN_WEIGHTS, false, null, mode === 'off' ? null : { pool, select: mode !== 'random' });
    let top = 1, d0 = 0, m0 = 0, streak = 0, noPrey = 0;
    for (let i = 1; i <= minutes * 3600; i++) {
      step(s, policy(s)); if (s.choosing) choose(s, pickFor(s)); if (s.dead) revive(s, false);
      top = Math.max(top, level(s));
      if (i % 6 === 0) { streak = catchable(s).length ? 0 : streak + 0.1; noPrey = Math.max(noPrey, streak); }
      if (i % (WINDOW * 3600) === 0) {
        const ps = poolSave(s);
        rows.push({ seed, min: i / 3600, deaths: s.deaths - d0, mercies: s.mercies - m0, level: level(s), top, noPrey, hunt: poolMeans(ps, 'hunt'), prey: poolMeans(ps, 'prey'), gen: generation(ps) });
        d0 = s.deaths; m0 = s.mercies; noPrey = 0;
      }
    }
    if (mode !== 'off') pool = poolSave(s);
  }
  return { rows, pool };
}
const f2 = x => x.toFixed(2), pad = (x, n) => String(x).padStart(n);
const results = {};
console.log(`\n${seeds} seeds x ${minutes} simulated minutes each, gene pool carried from seed to seed. Rows are ${WINDOW}-minute windows.`);
console.log('deaths and level: evolution on / off / random parents. Trait means are of the selected pool (evolution on).');
for (const [name, policy] of Object.entries({ reckless, careful })) {
  const on = session(policy, 'on'), off = session(policy, 'off'), rnd = session(policy, 'random');
  results[name] = { on, off, rnd };
  console.log(`\n${name}`);
  console.log('seed min | deaths on/off/rnd | level on/off/rnd | mercy gen | hunters speed sight cone persist herd | prey speed sight cone persist caution herd');
  on.rows.forEach((r, k) => {
    const o = off.rows[k], q = rnd.rows[k];
    console.log(`${pad(r.seed, 4)} ${pad(r.min, 3)} | ${pad(r.deaths, 6)} ${pad(o.deaths, 3)} ${pad(q.deaths, 3)}    | ${pad(r.level, 5)} ${pad(o.level, 3)} ${pad(q.level, 3)}   | ${pad(r.mercies, 5)} ${pad(r.gen, 3)} | ${[0, 1, 2, 3, 5].map(i => f2(r.hunt[i])).join('  ')} | ${[0, 1, 2, 3, 4, 5].map(i => f2(r.prey[i])).join('  ')}`);
  });
  const sum = (rows, k) => rows.reduce((n, r) => n + r[k], 0);
  console.log(`totals: deaths on ${sum(on.rows, 'deaths')}, off ${sum(off.rows, 'deaths')}, random ${sum(rnd.rows, 'deaths')}; mercy rule fired ${sum(on.rows, 'mercies')} times (random ${sum(rnd.rows, 'mercies')})`);
  console.log(`end pool drift from neutral (0 = neutral): selected hunters ${f2(drift(poolMeans(on.pool, 'hunt')))} prey ${f2(drift(poolMeans(on.pool, 'prey')))}; random parents hunters ${f2(drift(poolMeans(rnd.pool, 'hunt')))} prey ${f2(drift(poolMeans(rnd.pool, 'prey')))}`);
  console.log(`end readout: ${meadowLines(on.pool).join(' / ')}   (random parents: ${meadowLines(rnd.pool).join(' / ')})`);
}

// ---------- assertions. Thresholds were fixed before the first run.
const ends = Object.values(results).flatMap(r => [r.on.pool, r.rnd.pool]);
for (const pool of ends) for (const role of ['hunt', 'prey']) poolMeans(pool, role).forEach((v, i) => assert.ok(v >= BOUNDS[i][0] && v <= BOUNDS[i][1], `${role} ${TRAITS[i]} mean ${v} inside its bounds`));
const tops = rows => { const t = []; for (let seed = 1; seed <= seeds; seed++) t.push(Math.max(...rows.filter(r => r.seed === seed).map(r => r.top))); return t; };
const cOn = mid(tops(results.careful.on.rows)), cOff = mid(tops(results.careful.off.rows));
assert.ok(cOn >= 6 && cOn >= cOff - 3, `the careful bot still climbs with evolution on: median top level ${cOn} (off ${cOff})`);
for (const [name, r] of Object.entries(results)) {
  const late = rows => rows.filter(x => x.seed > seeds - 2).reduce((n, x) => n + x.deaths, 0);
  assert.ok(late(r.on.rows) <= 2 * late(r.off.rows) + 5, `${name}: deaths in the last two seeds stay bounded (on ${late(r.on.rows)}, off ${late(r.off.rows)})`);
  const most = Math.max(...r.on.rows.map(x => x.noPrey)), offMost = Math.max(...r.off.rows.map(x => x.noPrey));
  assert.ok(most <= Math.max(10, offMost + 5), `${name}: longest time with nothing catchable ${most.toFixed(1)} s (off ${offMost.toFixed(1)} s)`);
}
const moved = Object.values(results).some(r => ['hunt', 'prey'].some(role => { const a = drift(poolMeans(r.on.pool, role)), b = drift(poolMeans(r.rnd.pool, role)); return a > 0.1 && a > 1.5 * b; }));
assert.ok(moved, 'selection moves at least one pool further than random parents do');
const dir = role => poolMeans(results.reckless.on.pool, role).map((v, i) => f2(v - poolMeans(results.careful.on.pool, role)[i]));
console.log(`\nreckless minus careful, end pool means: hunters [${dir('hunt').join(', ')}], prey [${dir('prey').join(', ')}] (${TRAITS.join(', ')})`);
console.log(`careful bot median top level: on ${cOn}, off ${cOff}. All assertions pass.`);
