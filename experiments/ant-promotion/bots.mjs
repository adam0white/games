// Checks and measured play: node experiments/ant-promotion/bots.mjs [seeds] [minutes] [--mutate[=gait|clamp|spine|rocks]] [--ref=<main's sim.js>]
// 0. the Living look's rig and drawing (rig-bots.mjs, run first; --mutate breaks the rig, runs only those checks and fails)
// 0b. cover: rocks and tall grass (cover-bots.mjs, run second; --mutate=rocks makes rocks see-through, runs only its rule checks and fails)
// 0c. the evolving meadow (evolve-bots.mjs, run third; --mutate=meadow lets traits run past their bounds, runs only its checks and fails)
// 1. the contact rule, every cell   2. the form tree   3. food exists for every form   4. bots play
// 5. the rival: a death makes one, it persists and gains power, no animal eats it, temperaments differ, it can be eaten
import assert from 'node:assert/strict';
import './rig-bots.mjs';
import './cover-bots.mjs';
import './evolve-bots.mjs'; // the evolving meadow (meadow.js); --mutate=meadow breaks its bounds, runs only its checks and fails
import { SPAWN_WEIGHTS, HIDE_S, hideReady, SAME_FAST, FAST_CAP, crown, powerOf, nemesisMob, nemesisSave, cleanKnobs, TEMPERAMENT_NAMES, NEM_STEP, NEM_MAX_BONUS, NEM_PRIZE, MOBS,
  FORMS, ANT, TOP, CONE, encounter, create, step, choose, revive, me, level, catchable, optionsFor, article, chasePace, PACE_UP, PREY, TIRE, POWER, powerFor, powerReady, POUNCE, pounces, sightOf, placeOld, OLD_EVERY, OLD_HUNT, OLD_WEAK, OLD_PRIZE, OLD_SKILL, WORLD } from './sim.js';
const args = process.argv.slice(2).filter(a => !a.startsWith('--')), seeds = Number(args[0] ?? 20), minutes = Number(args[1] ?? 12);

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
    const pw = powerOf(m);
    if (pw > F.power) {
      const [far, half] = sightOf(M), reach = M.range * far * F.stealth + 110, facing = ang(Math.atan2(-dy, -dx), m.a) < half + 0.4;
      if (d < reach * (facing || m.alert ? 1.5 : 0.7)) { const w = (m.alert ? 5 : facing ? 3 : 1.5) * reach / d; vx -= dx / d * w; vy -= dy / d * w; }
    } else if (pw < F.power && (M.speed <= F.speed || !m.alert) && d < bd) { bd = d; best = m; }
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
  for (const m of s.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (powerOf(m) < F.power && d < bd) { bd = d; best = m; } }
  return best ? { x: best.x - p.x, y: best.y - p.y } : { x: 0, y: 0 };
}
const result = {};
for (const wild of [false, true]) for (const [name, policy] of Object.entries({ careful, reckless })) for (const pick of [0, 1, 2]) {
  const tops = [], deaths = []; let eaten = 0, wins = 0, hides = 0, hunts = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = create(seed, [ANT], 0, SPAWN_WEIGHTS, wild); let top = 1;
    for (let i = 0; i < minutes * 3600; i++) {
      step(s, policy(s));
      if (s.choosing) choose(s, pick);
      if (s.dead) revive(s, false);
      top = Math.max(top, level(s));
    }
    tops.push(top); deaths.push(s.deaths); eaten += s.eaten; wins += s.won ? 1 : 0; hides += s.hides; hunts += s.hunts;
    if (!wild) assert.equal(s.hides + s.hunts, 0, 'classic rules have no hide and no hunt');
  }
  tops.sort((a, b) => a - b); deaths.sort((a, b) => a - b);
  const mid = a => a[Math.floor(a.length / 2)];
  result[`${wild ? 'wild ' : ''}${name}/${pick}`] = { top: mid(tops), deaths: mid(deaths), sum: deaths.reduce((a, b) => a + b, 0), hides, hunts };
  console.log(`${wild ? 'WILD   ' : 'classic'} ${name.padEnd(8)} always picks ${['strong', 'fast', 'sneaky'][pick].padEnd(6)} ${minutes} min: highest level median ${mid(tops)} (min ${tops[0]}, max ${tops.at(-1)}), deaths median ${mid(deaths)}, eaten/run ${(eaten / seeds).toFixed(0)}, reached the top ${wins}/${seeds}${wild ? `, hides used/run ${(hides / seeds).toFixed(1)}, hunts/run ${(hunts / seeds).toFixed(0)}` : ''}`);
}
for (const pick of [0, 1, 2]) {
  assert.ok(result[`careful/${pick}`].top >= 6, `careful bot climbs (pick ${pick})`);
  assert.ok(result[`careful/${pick}`].deaths < result[`reckless/${pick}`].deaths, `care pays (pick ${pick})`);
}
console.log('bots: a careful player climbs and dies less than a reckless one');
// Wild rules: the hide is used by strong picks only, the hunt happens, and care still pays.
for (const pick of [0, 1, 2]) {
  assert.ok(result[`wild careful/${pick}`].hunts > 0, 'wild: hunts happen');
  assert.ok(result[`wild careful/${pick}`].top >= 6, `wild: careful bot still climbs (pick ${pick})`);
  assert.ok(result[`wild careful/${pick}`].deaths < result[`wild reckless/${pick}`].deaths, `wild: care pays (pick ${pick})`);
}
assert.ok(result['wild reckless/0'].hides > 0, 'wild: strong picks use the hide');
assert.equal(result['wild reckless/1'].hides + result['wild reckless/2'].hides, 0, 'wild: only strong picks have a hide');
{ // one bite on a hide: alive, thrown clear, hide not ready until HIDE_S has passed
  const brute = optionsFor(1)[0], s = create(1, [ANT, brute.id], 0, SPAWN_WEIGHTS, true), big = FORMS.find(f => f.power > brute.power && f.level === 3);
  s.player.safe = 0; s.mobs.length = 0; s.mobs.push({ id: 1, f: big.id, x: s.player.x + 5, y: s.player.y, a: 0, alert: false, lost: 0, timer: 9, want: 0, walk: false, ph: 0 });
  step(s, null); assert.equal(s.dead, null, 'the hide takes the first bite'); assert.equal(hideReady(s), false);
  s.player.safe = 0; s.mobs[0].x = s.player.x + 5; s.mobs[0].y = s.player.y; step(s, null); assert.ok(s.dead, 'the second bite kills');
  const c = create(1, [ANT, brute.id]); c.player.safe = 0; c.mobs.length = 0; c.mobs.push({ ...s.mobs[0], x: c.player.x + 5, y: c.player.y }); step(c, null); assert.ok(c.dead, 'classic: the first bite kills');
}
{ // a hunter tires: full pace while fresh, slower after, then it gives up and cannot notice the player while it rests
  const s = create(3), big = FORMS.find(f => f.level === 3), p = s.player, m = { id: 1, f: big.id, x: p.x + 90, y: p.y, a: Math.PI, alert: false, lost: 0, timer: 9, want: 0, walk: false, ph: 0 };
  p.safe = 0; s.mobs.length = 0; s.mobs.push(m);
  const paces = []; let gaveUpAt = null, gaveUpTick = 0;
  for (let i = 0; i < 60 * 30 && gaveUpAt === null; i++) {
    m.x = p.x + 90; m.y = p.y; m.a = Math.PI; const before = m.x; step(s, null); // held at 90 units, facing the player, so it always sees and never arrives
    if (s.events.some(e => e.t === 'tired' && e.id === 1)) { gaveUpAt = s.t; gaveUpTick = i; } else if (i % 60 === 30) paces.push(Math.round((before - m.x) * 60));
    assert.equal(s.dead, null);
  }
  assert.ok(gaveUpAt !== null && Math.abs(gaveUpAt - TIRE.spent) < 0.5, `the hunter gives up after about ${TIRE.spent} s of chasing (${gaveUpAt?.toFixed(1)} s)`);
  assert.equal(paces[0], Math.round(big.speed), 'fresh: full speed'); assert.equal(paces[TIRE.fresh - 1], paces[0], 'still full speed at the end of the fresh time');
  assert.ok(paces.at(-1) < paces[0] * (TIRE.slow + 0.12) && paces.every((v, i) => !i || v <= paces[i - 1]), `it slows evenly toward ${TIRE.slow} of its pace: ${paces.join(' ')}`);
  assert.equal(m.alert, false); assert.equal(s.tired, 1);
  let noticedAt = null; const t0 = s.t;
  for (let i = 0; i < 60 * 20 && noticedAt === null; i++) { m.x = p.x + 60; m.y = p.y; m.a = Math.PI; step(s, null); if (s.dead) break; if (m.alert) noticedAt = s.t - t0; }
  assert.ok(noticedAt !== null && Math.abs(noticedAt - TIRE.rest) < 0.2, `it cannot notice the player while it rests, then does (${noticedAt?.toFixed(2)} s, rest is ${TIRE.rest} s)`);
  // breath comes back when it is not chasing
  const r = create(3), q = { ...m, alert: false, tire: 6, winded: 0, x: r.player.x + 900, y: r.player.y }; r.mobs.length = 0; r.mobs.push(q); r.player.safe = 0;
  for (let i = 0; i < 60 * 5; i++) step(r, null); assert.equal(q.tire, 0, 'five seconds without a chase and it is fresh again');
  // the rival does not tire
  const n = create(3, [ANT], 0, SPAWN_WEIGHTS, false, { f: big.id, bonus: 0, kills: 1, knobs: { temperament: 'brute', persistence: 3, territory: 2 } }), nm = nemesisMob(n);
  n.player.safe = 0; for (let i = 0; i < 60 * (TIRE.spent + 3); i++) { nm.x = n.player.x + 90; nm.y = n.player.y; nm.a = Math.PI; step(n, null); }
  assert.equal(n.tired, 0, 'the rival does not tire'); assert.equal(nm.alert, true);
}
console.log('wild rules: hide and hunt checks pass; hunters tire');
{ // 4b. A power for every animal (note #148)
  const named = n => FORMS.find(f => f.name === n), mob = (f, x, y, extra = {}) => ({ id: 1, f: f.id, x, y, a: Math.PI, alert: false, lost: 0, timer: 99, want: Math.PI, walk: false, ph: 0, ...extra });
  assert.equal(powerFor(FORMS[ANT]), null, 'the Ant has no power'); for (const f of FORMS) if (f.level === 0) assert.equal(powerFor(f), null);
  const labels = new Set(); for (const f of FORMS) if (f.level > 1) { const W = powerFor(f); assert.ok(W && POWER[W.kind] && W.cd > 0, `${f.name} has a power`); labels.add(W.kind + '/' + W.label); }
  assert.ok(labels.size >= 30, `${labels.size} different power names`);
  const as = (name, wild = false) => { const s = create(3, [ANT, named(name).id], 0, SPAWN_WEIGHTS, wild); s.player.safe = 0; s.mobs.length = 0; return s; };
  // no input, no power: the sim is unchanged for the other bots
  { const s = as('Wasp'); s.mobs.push(mob(named('Dog'), s.player.x + 60, s.player.y)); step(s, { x: 0, y: 0 }); assert.equal(s.powers, 0); assert.equal(s.player.cd || 0, 0); }
  // sting: a stronger animal in reach is stunned, cannot bite, wakes up; then the wait runs down
  { const s = as('Wasp'), p = s.player, dog = mob(named('Dog'), p.x + 60, p.y); s.mobs.push(dog);
    step(s, { x: 0, y: 0, power: true }); assert.ok(dog.stun > 0 && !dog.alert, 'sting stuns the nearest animal'); assert.equal(s.powers, 1); assert.ok(Math.abs(p.cd - POWER.sting.cd) < 0.05);
    assert.equal(powerReady(s), false); dog.x = p.x + 3; step(s, { x: 0, y: 0, power: true }); assert.equal(s.dead, null, 'a stunned animal cannot bite'); assert.equal(s.powers, 1, 'no second use while waiting');
    for (let i = 0; i < 60 * POWER.sting.stun + 5; i++) { dog.x = p.x + 400; dog.y = p.y; if (!s.mobs.includes(dog)) s.mobs.push(dog); s.mobs.length = 1; step(s, null); } assert.ok(!(dog.stun > 0), 'the stun ends');
    for (let i = 0; i < 60 * POWER.sting.cd; i++) step(s, null); assert.equal(powerReady(s), true, 'ready again after the wait'); }
  { const s = as('Wasp'); step(s, { x: 0, y: 0, power: true }); assert.equal(s.powers, 0, 'a sting with nothing in reach is not spent'); assert.ok(s.player.cd <= 1); }
  // leap: moves at once along the heading, safe in the air
  { const s = as('Frog'), p = s.player; step(s, { x: 1, y: 0 }); const x0 = p.x; step(s, { x: 1, y: 0, power: true }); assert.ok(p.x - x0 > POWER.leap.jump, `a leap covers ${Math.round(p.x - x0)} units at once`); assert.ok(p.safe > 0); }
  // shell: a bite does nothing while it lasts
  { const s = as('Turtle'), p = s.player, big = mob(named('Bear'), p.x + 3, p.y); s.mobs.push(big); step(s, { x: 0, y: 0, power: true }); for (let i = 0; i < 60 * (POWER.shell.time - 0.2); i++) { big.x = p.x + 3; big.y = p.y; step(s, null); } assert.equal(s.dead, null, 'the shell holds');
    for (let i = 0; i < 60 * POWER.shell.daze + 30 && !s.dead; i++) { big.x = p.x + 3; big.y = p.y; step(s, null); } assert.ok(s.dead, 'and then it does not, once the biter wakes'); }
  // roar: weaker animals in reach freeze, stronger and far ones do not
  { const s = as('Lion'), p = s.player; const near = mob(named('Cat'), p.x + 100, p.y), far = mob(named('Cat'), p.x + 600, p.y, { id: 2 }), strong = mob(named('Dragon'), p.x - 100, p.y, { id: 3, a: Math.PI / 2 }); s.mobs.push(near, far, strong);
    step(s, { x: 0, y: 0, power: true }); assert.ok(near.stun > 0 && !(far.stun > 0) && !(strong.stun > 0), 'roar freezes weaker animals in reach only'); }
  // dive and sprint: faster for a while; a dive also goes unseen
  for (const [name, kind] of [['Eagle', 'dive'], ['Cheetah', 'sprint']]) {
    const s = as(name), p = s.player, F = me(s); step(s, { x: 1, y: 0 }); let x0 = p.x; step(s, { x: 1, y: 0 }); const plain = p.x - x0; x0 = p.x; step(s, { x: 1, y: 0, power: true }); x0 = p.x; step(s, { x: 1, y: 0 });
    assert.ok(Math.abs((p.x - x0) / plain - POWER[kind].speed) < 0.01, `${kind}: ${POWER[kind].speed} times the speed`);
    const watcher = mob(named('Dragon'), p.x + 60, p.y); s.mobs.push(watcher); step(s, { x: 0, y: 0 }); assert.equal(watcher.alert, kind !== 'dive', kind === 'dive' ? 'nothing notices a diving bird' : 'a sprinter is still seen');
    for (let i = 0; i < 60 * POWER[kind].time + 2; i++) { s.mobs.length = 0; step(s, null); } x0 = p.x; step(s, { x: 1, y: 0 }); assert.ok(Math.abs(p.x - x0 - plain) < 1e-6, 'and then the plain speed again');
  }
  // hunting uses: a leap pins weaker animals where it lands and no others; a sprint catches prey that is faster and has noticed; a bitten shell dazes the biter
  { const s = as('Frog'), p = s.player; step(s, { x: 1, y: 0 }); const d = POWER.leap.jump + me(s).r * 3, prey = mob(named('Beetle'), p.x + d + 20, p.y, { alert: true }), far = mob(named('Beetle'), p.x + d + 200, p.y, { id: 2 }), big = mob(named('Bear'), p.x + d + 20, p.y + 30, { id: 3, a: 0 }); s.mobs.push(prey, far, big);
    step(s, { x: 1, y: 0, power: true }); assert.ok(prey.stun > 0 && !(far.stun > 0) && !(big.stun > 0), 'a leap pins weaker animals by the landing only'); }
  for (const boosted of [false, true]) { const s = as('Panther'), p = s.player, F = me(s), quick = FORMS.filter(f => f.power < F.power && f.speed > F.speed && f.speed < F.speed * POWER.sprint.speed).pop(); assert.ok(quick, 'there is prey faster than a Panther');
    const m = mob(quick, p.x + 2, p.y, { alert: true, timer: 99 }); s.mobs.push(m); const n = s.eaten; step(s, { x: 0, y: 0, power: boosted }); m.x = p.x + 2; m.y = p.y; if (s.mobs.includes(m)) step(s, { x: 0, y: 0 });
    assert.equal(s.eaten - n, boosted ? 1 : 0, boosted ? 'a sprinting Panther catches faster prey' : 'a plain Panther does not'); }
  { const s = as('Turtle'), p = s.player, big = mob(named('Bear'), p.x + 3, p.y, { alert: true }); s.mobs.push(big); step(s, { x: 0, y: 0, power: true }); big.x = p.x + 3; big.y = p.y; step(s, null); assert.ok(big.stun > 0 && !s.dead, 'biting a shell dazes the biter'); }
  // found by a second reviewer: a leap pressed with a new direction goes that way; a stunned hunter does not eat its prey; a promotion ends the old animal's sprint
  { const s = as('Frog'), p = s.player; step(s, { x: 1, y: 0 }); const x0 = p.x, y0 = p.y; step(s, { x: 0, y: 1, power: true }); assert.ok(p.y - y0 > POWER.leap.jump && Math.abs(p.x - x0) < 1, 'the leap follows the stick of the same step'); }
  { const s = as('Wasp'), p = s.player, hunter = mob(named('Dog'), p.x + 60, p.y), prey = mob(named('Beetle'), p.x + 62, p.y, { id: 2 }); hunter.chase = prey; s.mobs.push(hunter, prey); const n = s.mobEats;
    step(s, { x: 0, y: 0, power: true }); for (let i = 0; i < 30; i++) { hunter.chase = prey; step(s, null); } assert.ok(hunter.stun > 0); assert.equal(s.mobEats, n, 'a stunned hunter does not eat'); }
  { const s = as('Cheetah'), p = s.player; step(s, { x: 1, y: 0, power: true }); s.choosing = optionsFor(3); choose(s, 0); assert.ok(!(p.boost > 0) && !(p.veil > 0), 'a promotion ends the old sprint'); }
  // a promotion and a revive both reset the wait
  { const s = as('Wasp'); s.mobs.push(mob(named('Dog'), s.player.x + 60, s.player.y)); step(s, { x: 0, y: 0, power: true }); s.choosing = optionsFor(3); choose(s, 0); assert.equal(s.player.cd, 0); }
  // a bot that uses its power when a hunter has noticed it, or (roar) when two weaker animals are close
  const withPower = s => { const inp = careful(s); if (powerReady(s)) { const p = s.player, F = me(s), W = powerFor(F); let danger = false, prey = 0;
      for (const m of s.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (powerOf(m) > F.power && m.alert && d < 130) danger = true; if (powerOf(m) < F.power && d < 200) prey++; }
      inp.power = W.kind === 'roar' ? prey >= 2 : danger; } return inp; };
  for (const wild of [false, true]) for (const pick of [0, 1, 2]) { const tops = [], deaths = []; let used = 0;
    for (let seed = 1; seed <= seeds; seed++) { const s = create(seed, [ANT], 0, SPAWN_WEIGHTS, wild); let top = 1, dead = 0;
      for (let i = 0; i < minutes * 3600; i++) { step(s, withPower(s)); if (s.choosing) choose(s, pick); if (s.dead) { dead++; revive(s, false); } top = Math.max(top, level(s)); if (s.won) break; }
      tops.push(top); deaths.push(dead); used += s.powers; }
    const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    console.log(`${wild ? 'WILD   ' : 'classic'} careful with powers, always picks ${['strong', 'fast', 'sneaky'][pick]}: highest level median ${med(tops)}, deaths median ${med(deaths)}, powers used/run ${Math.round(used / seeds)}`);
    assert.ok(used > 0, 'the bot used its power'); }
}
console.log('powers: every promoted animal has one; sting, leap, shell, roar, dive and sprint checks pass');
{ // picking the same kind again builds on it
  const fast = l => optionsFor(l)[1].id, sneak = l => optionsFor(l)[2].id;
  const one = me(create(1, [ANT, optionsFor(1)[0].id, fast(2)])), three = me(create(1, [ANT, fast(1), fast(2)])), sn = me(create(1, [ANT, sneak(1), sneak(2)]));
  assert.equal(one.speed, FORMS[fast(2)].speed, 'a first fast pick has the plain speed');
  assert.ok(Math.abs(three.speed / one.speed - SAME_FAST) < 1e-9, `a second fast pick is ${Math.round((SAME_FAST - 1) * 100)}% faster`);
  assert.ok(SAME_FAST >= 1.1, 'each fast pick is a visible step: the view zooms out about 2.5% a level, and 5% a pick looked the same');
  { let st = [ANT], prev = 0; for (let l = 1; l < TOP; l++) { st = [...st, fast(l)]; const v = me(create(1, st)).speed; assert.ok(v > prev || v === FORMS[fast(l)].speed * FAST_CAP, `fast pick ${l} is faster, or capped`); prev = v; }
    assert.equal(prev, FORMS[fast(TOP - 1)].speed * FAST_CAP, `all fast picks reach the cap of ${FAST_CAP} times`); }
  assert.ok(Math.abs(sn.stealth / FORMS[sneak(2)].stealth - 0.95) < 1e-9, 'a second sneaky pick is seen from 5% less far');
  // animals hunt each other, and never the food bugs
  const s = create(3); let eats = 0, food = 0; for (let i = 0; i < 3600 * 3; i++) { step(s, null); if (s.dead) revive(s, false); for (const e of s.events) if (e.t === 'mobeat') { eats++; if (FORMS.find(f => f.name === e.name).level < 1) food++; } }
  assert.ok(eats > 0, 'animals eat each other'); assert.equal(food, 0, 'food bugs are never hunted by animals');
  console.log(`same-kind picks and animal hunts pass (${eats} animal-on-animal eats in 3 minutes)`);
}
{ // stronger animals keep up with a fast-boosted player (note #101); a player without a boost meets the old speeds
  const fast = l => optionsFor(l)[1].id; let st = [ANT];
  for (let l = 1; l < TOP; l++) {
    st = [...st, fast(l)]; const F = me(create(1, st)), stronger = FORMS.filter(M => M.level > F.level && M.level <= F.level + 2);
    if (F.again > 1 && F.level < TOP) assert.ok(stronger.some(M => chasePace(M, F) > F.speed), `a boosted runner at level ${F.level} meets stronger animals faster than itself`);
    for (const M of stronger) assert.equal(chasePace(M, F) > F.speed, M.pace === 'fast' && F.again > 1, `${M.name} against a level ${F.level} runner: only fast animals outrun a boosted runner`);
  }
  for (const pick of [0, 2]) { st = [ANT]; for (let l = 1; l < TOP; l++) { st = [...st, optionsFor(l)[pick].id]; const F = me(create(1, st)); for (const M of FORMS) assert.equal(chasePace(M, F), M.speed, 'no boost: plain speeds'); } }
  const first = me(create(1, [ANT, fast(1)])); for (const M of FORMS) assert.equal(chasePace(M, first), M.speed, 'a first fast pick: plain speeds');
  // a hunting animal runs at full speed, and faster when it is close (note #106)
  const s = create(1, [ANT, fast(1), fast(2), fast(3), fast(4), fast(5), fast(6), fast(7), fast(8)]), hunter = s.mobs.find(m => FORMS[m.f].level >= 3), prey = s.mobs.find(m => m !== hunter && FORMS[m.f].level === FORMS[hunter.f].level - 1);
  assert.ok(prey, 'a hunter and its prey');
  {
    s.player.x = 100; s.player.y = 100; s.player.safe = 99; s.mobs = [hunter, prey]; for (const m of s.mobs) { m.alert = false; m.fed = 0; }
    hunter.x = 1000; hunter.y = 1000; hunter.a = 0; prey.x = 1000 + FORMS[hunter.f].range * 0.9; prey.y = 1000; prey.a = 0; s.tick = (12 - hunter.id % 12) % 12;
    let moved = 0; for (let i = 0; i < 60; i++) { const x = hunter.x, y = hunter.y; step(s, null); if (hunter.chase === prey && Math.hypot(prey.x - x, prey.y - y) > (FORMS[hunter.f].r + FORMS[prey.f].r) * 3) moved = Math.max(moved, Math.hypot(hunter.x - x, hunter.y - y) * 60); } // before the lunge
    assert.ok(moved >= FORMS[hunter.f].speed - 1, `a hunter runs at full speed (${moved.toFixed(0)} against ${FORMS[hunter.f].speed})`);
  }
  console.log(`stronger animals keep up with a boosted runner (fast ones ${Math.round((PACE_UP - 1) * 100)}% faster); hunters run at full speed`);
}

{ // each species has its own sight (note #148): who notices the player at a given angle and share of the plain sight distance
  const notices = (name, angle, share, f = FORMS.find(f => f.name === name)) => {
    const s = create(1, stackTo(FORMS.find(f => f.level === Math.max(1, FORMS.find(f => f.name === name).level - 1)))), p = s.player, F = me(s), d = (f.range * F.stealth) * share; p.safe = 0;
    s.mobs = [{ id: 1, f: f.id, x: p.x + d, y: p.y, a: Math.PI + angle, alert: false, lost: 0, timer: 99, want: Math.PI + angle, walk: false, ph: 0 }]; step(s, null); return s.mobs[0].alert || !!s.dead;
  };
  assert.ok(notices('Snake', 0, 1.5) && !notices('Wolf', 0, 1.5), 'a snake sees far ahead'); assert.ok(!notices('Snake', 0.7, 0.8) && notices('Wolf', 0.7, 0.8), 'and only straight ahead');
  assert.ok(notices('Eagle', 2.1, 0.6) && !notices('Wolf', 2.1, 0.6), 'a bird sees to its sides and back'); assert.ok(!notices('Thunderbird', 0, 0.9) && notices('Wolf', 0, 0.9), 'but not far');
  assert.ok(!notices('Thunderbird', 3.1, 0.5), 'a bird has a blind spot right behind it');
  const shapes = new Set(FORMS.filter(f => f.level >= 1).map(f => sightOf(f).join())); assert.ok(shapes.size >= 20, `${shapes.size} sight shapes`);
  for (const f of FORMS) { const [far, half] = sightOf(f); assert.ok(half <= Math.PI && far > 0); if (f.level < 1) assert.deepEqual([far, half], [1, CONE], 'food bugs see as before'); }
  console.log(`sight: ${shapes.size} shapes; snakes far and narrow, birds close and almost all round`);
}
{ // a hunter pounces on a fast animal (note #149). A hunter sees the player at a share of its sight; the player runs straight away.
  const run = (pick, H, share) => {
    const st = [ANT]; for (let l = 1; l < 8; l++) st.push(optionsFor(l)[pick].id);
    const s = create(1, st), p = s.player, F = me(s); p.safe = 0; p.x = 400; p.y = 1000;
    s.mobs = [{ id: 1, f: H.id, x: p.x - (H.range * F.stealth + F.r) * share, y: 1000, a: 0, alert: false, lost: 0, timer: 99, want: 0, walk: false, ph: 0 }]; const m = s.mobs[0];
    for (let i = 0; i < 660 && !s.dead && p.x < 1900; i++) { s.mobs = [m]; step(s, { x: 1, y: 0 }); }
    return { caught: !!s.dead, pounced: s.pounced || 0 };
  };
  const [slow, fast, medium] = optionsFor(8);
  assert.deepEqual([slow.pace, fast.pace, medium.pace], ['slow', 'fast', 'medium']);
  assert.ok(run(1, medium, 0.4).caught, 'a medium hunter that is close catches a fast player'); assert.ok(run(1, fast, 0.6).caught, 'a fast one from farther');
  assert.ok(!run(1, medium, 0.8).caught, 'seen from far, it does not');
  for (const share of [0.35, 0.6, 0.8]) assert.deepEqual(run(1, slow, share), { caught: false, pounced: 0 }, 'a slow hunter never pounces');
  for (const pick of [0, 2]) for (const H of [slow, fast, medium]) assert.equal(run(pick, H, 0.5).pounced, 0, 'no pounce on a strong or sneaky animal');
  assert.ok(POUNCE.secs < TIRE.fresh); assert.equal(pounces(slow, { role: 'runner' }), false);
  console.log('pounce: a close medium or fast hunter catches a fast player; a far or a slow one does not');
}

// 5. The rival. With none passed to create() and nobody crowned, every line above is a world without a rival.
const mid = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const KNOBS = t => ({ temperament: t, persistence: 2, territory: 2 });
const snap = s => [s.tick, s.player.x.toFixed(6), s.player.y.toFixed(6), s.player.xp, s.deaths, s.eaten, s.mobs.length, s.mobs.map(m => m.x.toFixed(3) + ',' + m.y.toFixed(3)).join(';')].join('|');
const levelStack = (lv, pick = 0) => { const st = [ANT]; for (let l = 2; l <= lv; l++) st.push(optionsFor(l - 1)[pick].id); return st; };
// A run where a death to a stronger animal crowns the killer if no rival is alive, as the page does.
function play(seed, policy, { ticks, knobs = KNOBS('stalker'), stack, nemesis = null, pick = 0, wild = false, onEvent } = {}) {
  const s = create(seed, stack, 0, SPAWN_WEIGHTS, wild, nemesis);
  const log = { rise: 0, kills: 0, escapes: 0, eaten: 0, notices: 0, chases: [], chase: 0, idleMoves: [], closing: [], top: 1 };
  for (let i = 0; i < ticks; i++) {
    const nm = nemesisMob(s), before = nm ? { x: nm.x, y: nm.y, alert: nm.alert, d: Math.hypot(nm.x - s.player.x, nm.y - s.player.y) } : null;
    step(s, policy(s));
    for (const e of s.events) { // crown() adds a 'nemRise' to this list while it is being read
      if (e.t === 'die' && !s.nemesis && crown(s, e.killer, knobs)) log.rise++;
      if (e.t === 'nemKill') log.kills++;
      if (e.t === 'nemEscape') log.escapes++;
      if (e.t === 'nemEaten') log.eaten++;
      if (e.t === 'notice' && e.nem) log.notices++;
      if (e.t === 'mobeat') assert.ok(!s.nemesis || nemesisMob(s), 'no animal eats the rival');
      onEvent?.(e, s);
    }
    const after = nemesisMob(s);
    if (s.nemesis) assert.ok(after && !after.gone, 'a living rival is always in the world');
    if (nm && after) {
      if (after.alert) { log.chase += 1 / 60; if (powerOf(after) > me(s).power && powerOf(after) - me(s).power <= 12) log.closing.push(Math.hypot(after.x - s.player.x, after.y - s.player.y) < before.d ? 1 : 0); } else if (log.chase) { log.chases.push(log.chase); log.chase = 0; }
      if (!before.alert && !after.alert) log.idleMoves.push(Math.hypot(after.x - before.x, after.y - before.y) < 1e-9 ? 1 : 0);
    }
    if (s.choosing) choose(s, pick);
    if (s.dead) revive(s, false);
    log.top = Math.max(log.top, level(s));
  }
  return { s, log };
}
{ // the numbers, and bad saved knobs fall back to the defaults
  assert.equal(NEM_STEP, 10); assert.equal(NEM_MAX_BONUS, 30); assert.equal(NEM_PRIZE, 6);
  assert.deepEqual(TEMPERAMENT_NAMES, ['ambusher', 'stalker', 'brute', 'coward']);
  assert.deepEqual(cleanKnobs({ temperament: 'nope', persistence: 9, territory: 'x' }), { temperament: 'stalker', persistence: 3, territory: 2 });
  assert.deepEqual(cleanKnobs(null), { temperament: 'stalker', persistence: 2, territory: 2 });
  const plain = create(5); assert.equal(plain.nemesis, null); assert.equal(plain.mobs.length, MOBS); assert.ok(plain.mobs.every(m => !m.nem && powerOf(m) === FORMS[m.f].power), 'a world made without a rival has none');
  assert.equal(create(5, [ANT], 0, SPAWN_WEIGHTS, false, { f: 9999 }).nemesis, null, 'a saved rival with an unknown animal is ignored');
}
{ // determinism: the same seed, inputs and knobs give the same world; other knobs give another
  const a = play(7, reckless, { ticks: 4 * 3600 }), b = play(7, reckless, { ticks: 4 * 3600 });
  assert.equal(snap(a.s), snap(b.s)); assert.deepEqual(nemesisSave(a.s), nemesisSave(b.s));
  assert.ok(a.log.rise > 0, 'the reckless bot made a rival');
  // the rival is present from the start here, so the two temperaments have time to act (a rival crowned late in a short run may never meet the player)
  const from = t => play(7, reckless, { ticks: 4 * 3600, stack: levelStack(3), nemesis: { f: optionsFor(4)[0].id, bonus: 0, kills: 1, knobs: KNOBS(t) } });
  const c = from('stalker'), d = from('brute'), e = from('brute');
  assert.equal(snap(d.s), snap(e.s)); assert.ok(c.log.notices > 0 && d.log.notices > 0, 'the rival met the player in both runs');
  assert.notEqual(snap(c.s), snap(d.s), 'different knobs give a different world');
}
{ // a bot that dies creates a rival; it stays through deaths and promotions, and gains power on a repeat kill
  let first = null, repeat = null, promoted = false, survivedPromotion = false;
  const { s, log } = play(3, reckless, {
    ticks: 12 * 3600, knobs: KNOBS('brute'),
    onEvent: (e, s) => {
      // the bot may eat a rival before it wins again, so follow each rival until one has a repeat win
      if (e.t === 'nemRise' && !repeat) { first = { f: e.f, power: powerOf(nemesisMob(s)), id: s.nemesis.id }; promoted = false; }
      if (e.t === 'nemKill' && !repeat && s.nemesis.id === first.id) repeat = { kills: e.kills, bonus: e.bonus, power: powerOf(nemesisMob(s)) };
      if (e.t === 'full' && first && s.nemesis?.id === first.id) promoted = true; // the bot picks a new form right after this event
      if (promoted && first && ['nemKill', 'nemEscape', 'notice'].includes(e.t) && (e.t !== 'notice' || e.nem) && s.nemesis?.id === first.id) survivedPromotion = true;
    },
  });
  assert.ok(first, 'a death made a rival');
  assert.ok(repeat, 'the rival killed the player again');
  assert.equal(repeat.kills, 2); assert.equal(repeat.bonus, NEM_STEP); assert.equal(repeat.power, first.power + NEM_STEP);
  assert.ok(survivedPromotion, 'the rival stayed through a promotion');
  // saving and loading keeps it, away from the player, under both rule sets
  const saved = nemesisSave(s) ?? { f: first.f, bonus: 10, kills: 2, escapes: 0, kin: 0, knobs: KNOBS('brute') };
  for (const wild of [false, true]) {
    const again = create(99, [ANT], 0, SPAWN_WEIGHTS, wild, JSON.parse(JSON.stringify(saved)));
    assert.equal(nemesisMob(again).f, saved.f); assert.equal(powerOf(nemesisMob(again)), FORMS[saved.f].power + saved.bonus); assert.equal(again.mobs.length, MOBS + 1);
    assert.ok(Math.hypot(nemesisMob(again).x - 1000, nemesisMob(again).y - 1000) > 600, 'a loaded rival starts away from the player');
  }
  console.log(`rival: rose as ${FORMS[first.f].name} (power ${first.power}); repeat kill -> power ${repeat.power}; stayed through promotions; reloads from a save. Run: ${log.rise} rise, ${log.kills} repeat kills, ${log.escapes} escapes, ${log.eaten} eaten`);
}
{ // the power gain stops at the cap; eating the rival pays the prize, clears it, and the next death makes a new one
  const spider = FORMS.find(f => f.name === 'Spider'), s = create(11, [ANT], 0, SPAWN_WEIGHTS, false, { f: spider.id, bonus: 0, kills: 1, knobs: KNOBS('brute') });
  const bite = () => { const m = nemesisMob(s); s.player.safe = 0; m.x = s.player.x + 3; m.y = s.player.y; step(s, null); };
  for (let k = 1; k <= 5; k++) { bite(); assert.ok(s.dead?.nem, 'the rival kills an ant'); assert.equal(powerOf(nemesisMob(s)), spider.power + Math.min(NEM_MAX_BONUS, k * NEM_STEP)); revive(s, false); assert.ok(nemesisMob(s), 'the rival is still there after the player comes back'); }
  assert.equal(nemesisSave(s).bonus, NEM_MAX_BONUS); assert.equal(nemesisSave(s).kills, 6);
  s.player.stack = levelStack(7, 1); s.player.xp = 0; assert.ok(me(s).power > powerOf(nemesisMob(s))); // a fast form: a slow one cannot eat a faster animal that has noticed it
  const id = s.nemesis.id; bite();
  const eat = s.events.find(e => e.t === 'eat');
  assert.ok(s.events.some(e => e.t === 'nemEaten') && eat?.nem, 'the player ate the rival'); assert.equal(eat.gain, 1 + NEM_PRIZE, 'normal gain for a far smaller animal plus the prize');
  assert.equal(s.player.xp, 1 + NEM_PRIZE); assert.equal(s.nemesis, null); assert.equal(nemesisSave(s), null); assert.ok(!s.mobs.some(m => m.id === id || m.nem), 'the eaten rival is gone');
  s.player.stack = [ANT]; s.player.safe = 0; const big = s.mobs.find(m => powerOf(m) > 10); big.x = s.player.x + 3; big.y = s.player.y; step(s, null);
  const die = s.events.find(e => e.t === 'die'); assert.ok(die && !die.nem && crown(s, die.killer, KNOBS('coward')), 'the next death makes a new rival'); assert.equal(s.nemesis.kills, 1); assert.equal(crown(s, die.killer, KNOBS('coward')), false, 'only one rival at a time');
  console.log(`rival numbers: +${NEM_STEP} power per repeat kill, at most +${NEM_MAX_BONUS}; eating it adds ${NEM_PRIZE} to the bar and clears it`);
}
{ // the gained power decides: a Spider (20) with +30 against a level 4 player (44), who would eat a plain Spider
  const spider = FORMS.find(f => f.name === 'Spider'), saved = { f: spider.id, bonus: NEM_MAX_BONUS, kills: 4, knobs: KNOBS('brute') };
  const only = (wild, dx, facing) => { // a world with only the rival in it, dx to the right of the player
    const s = create(2, levelStack(4), 0, SPAWN_WEIGHTS, wild, saved), m = nemesisMob(s);
    s.mobs = [m]; s.player.safe = 0; m.x = s.player.x + dx; m.y = s.player.y; m.a = facing; m.timer = 99; s.nemesis.home = { x: m.x, y: m.y }; s.nemesis.hunt = 999;
    return { s, m };
  };
  assert.ok(spider.power < me(only(false, 0, 0).s).power && me(only(false, 0, 0).s).power < spider.power + NEM_MAX_BONUS, 'the player is between the plain power and the gained power');
  { const { s, m } = only(false, 60, Math.PI); assert.ok(!catchable(s).includes(m), 'a rival that has outgrown the player is not food'); step(s, null);
    const e = s.events.find(e => e.t === 'notice'); assert.ok(e?.nem && e.strong, 'it notices as a stronger animal'); }
  { const { s } = only(false, 3, 0); step(s, null); assert.ok(s.dead?.nem, 'its touch kills'); assert.equal(s.nemesis.kills, 5); assert.equal(s.nemesis.bonus, NEM_MAX_BONUS); }
  { const { s, m } = only(false, 3, 0); m.bonus = s.nemesis.bonus = 0; step(s, null); assert.ok(!s.dead && s.events.some(e => e.t === 'nemEaten'), 'without the gains the same touch is a meal'); }
  { const { s, m } = only(true, 400, 0); s.huntAt = 0; step(s, null); // wild: facing away, far outside its sight, and the hunt still picks it
    const e = s.events.find(e => e.t === 'hunt'); assert.ok(e && e.id === m.id && m.hunt > 0 && m.alert, 'wild: the hunt picks a rival that is stronger only by its gains'); }
  { const { s, m } = only(true, 3, 0); assert.ok(hideReady(s), 'a level 4 strong pick has its hide'); step(s, null); // wild: the hide takes the rival's bite
    assert.ok(!s.dead && s.events.some(e => e.t === 'hide'), 'wild: the thick hide takes the rival\'s bite'); assert.equal(s.nemesis.kills, 4, 'a bite on the hide is not a kill'); assert.equal(powerOf(m), spider.power + NEM_MAX_BONUS);
    s.player.safe = 0; m.x = s.player.x + 3; m.y = s.player.y; step(s, null); assert.ok(s.dead?.nem, 'wild: its second bite kills'); assert.equal(s.nemesis.kills, 5); }
  console.log('rival power: its gains decide the touch, the notice, what counts as food, the Wild hunt and the Wild hide');
}
{ // animals hunt each other, but no animal eats the rival and upkeep never clears it away
  for (const wild of [false, true]) for (const seed of [1, 2, 3]) { // a weak rival among much stronger animals, far from a player that stands still
    const s = create(seed, levelStack(9), 0, SPAWN_WEIGHTS, wild, { f: optionsFor(1)[1].id, bonus: 0, kills: 1, knobs: KNOBS('ambusher') }); let eats = 0;
    for (let i = 0; i < 4 * 3600; i++) { step(s, null); if (s.dead) revive(s, false); eats += s.events.filter(e => e.t === 'mobeat').length; assert.ok(nemesisMob(s), `the rival is still in the world (seed ${seed}, tick ${i}, ${wild ? 'wild' : 'classic'})`); assert.ok(!s.mobs.some(m => m.chase?.nem || m.fear?.nem), 'no animal chases or fears the rival'); }
    if (seed === 3 && !wild) assert.ok(eats > 0, 'animals still eat each other with a rival in the world');
  }
  // crown an animal that another animal is chasing: the chaser lets go and the new rival lives
  let found = false;
  for (let seed = 1; seed <= 20 && !found; seed++) {
    const s = create(seed);
    for (let i = 0; i < 3 * 3600 && !found; i++) {
      step(s, null); if (s.dead) revive(s, false);
      const hunter = s.mobs.find(m => m.chase && !m.chase.gone); if (!hunter || s.dead) continue;
      const prey = hunter.chase; found = true;
      assert.ok(crown(s, prey.id, KNOBS('brute'))); assert.equal(hunter.chase, null, 'the chaser lets go of the new rival');
      for (let k = 0; k < 20 * 60; k++) { step(s, null); if (s.dead) revive(s, false); assert.ok(nemesisMob(s) && !prey.gone, 'a crowned animal that was being chased is not eaten'); }
    }
  }
  assert.ok(found, 'found an animal chasing another to crown');
  console.log('rival: no animal chases or eats it, and upkeep leaves it in the world (classic and wild)');
}
{ // a small coward rival (power 20) chases the Ant (power 10) it has just eaten; it does not run from it
  const spider = FORMS.find(f => f.name === 'Spider'), s = create(7, [ANT], 0, SPAWN_WEIGHTS, false, { f: spider.id, bonus: 0, kills: 1, escapes: 0, kin: 0, knobs: KNOBS('coward') });
  const m = nemesisMob(s); m.x = s.player.x + spider.range * 0.5; m.y = s.player.y; m.a = Math.PI; s.player.safe = 0;
  const d0 = Math.hypot(m.x - s.player.x, m.y - s.player.y);
  for (let i = 0; i < 30 && !s.dead; i++) step(s, { x: 0, y: 0 });
  assert.ok(Math.hypot(m.x - s.player.x, m.y - s.player.y) < d0 - 20, 'a coward Spider comes at an Ant');
}
// Temperaments. Same seeds and rival form; only the temperament changes. Two test subjects: the reckless bot ignores danger
// (catches per minute), and the wary bot eats like the reckless one but runs straight away from the rival once it has noticed.
function wary(s) {
  const n = nemesisMob(s), p = s.player;
  if (n && n.alert && powerOf(n) > me(s).power) return { x: p.x - n.x, y: p.y - n.y };
  return reckless(s);
}
{
  const nemForm = optionsFor(4)[0].id, rows = {}, mins = 4;
  const measure = (policy, t, stack) => {
    const chases = [], idle = [], closing = [], per = { kills: 0, escapes: 0, notices: 0 };
    for (let seed = 1; seed <= seeds; seed++) {
      const { log } = play(seed, policy, { ticks: mins * 3600, stack, nemesis: { f: nemForm, bonus: 0, knobs: KNOBS(t) } });
      chases.push(...log.chases); idle.push(...log.idleMoves); closing.push(...log.closing);
      per.kills += log.kills; per.escapes += log.escapes; per.notices += log.notices;
    }
    return { chase: mean(chases), closing: mean(closing), idle: mean(idle), kpm: per.kills / (seeds * mins), epm: per.escapes / (seeds * mins), npm: per.notices / (seeds * mins) };
  };
  for (const t of TEMPERAMENT_NAMES) rows[t] = { r: measure(reckless, t, levelStack(3)), w: measure(wary, t, levelStack(3, 1)), close: measure(wary, t, levelStack(4)) };
  console.log(`\nrival temperaments, ${seeds} seeds x ${mins} min each. Rival: ${FORMS[nemForm].name}, level 5, power ${FORMS[nemForm].power}, slow.`);
  console.log(`  A: wary bot as a level 3 ${FORMS[levelStack(3, 1).at(-1)].name} (fast). B: reckless bot as a level 3 ${FORMS[levelStack(3).at(-1)].name}. C: wary bot as a level 4 ${FORMS[levelStack(4).at(-1)].name} (power ${FORMS[levelStack(4).at(-1)].power}); "closing in" counts alert ticks while the rival is stronger by 12 or less.`);
  console.log('temperament  A: still while   A: notices  A: mean     A: escapes  B: catches  C: closing in   C: catches');
  console.log('             unalerted        per min     chase s     per min     per min     while alert    per min');
  for (const [t, { r, w, close }] of Object.entries(rows)) console.log(`${t.padEnd(12)} ${(w.idle * 100).toFixed(0).padStart(9)}%     ${w.npm.toFixed(2).padStart(10)} ${w.chase.toFixed(2).padStart(10)} ${w.epm.toFixed(2).padStart(11)} ${r.kpm.toFixed(2).padStart(11)} ${(close.closing * 100).toFixed(0).padStart(11)}%   ${close.kpm.toFixed(2).padStart(10)}`);
  assert.ok(rows.ambusher.w.idle > rows.stalker.w.idle + 0.2, 'an ambusher stands still more while waiting');
  // The lab also asserted, from this table, that a brute's mean chase is longer than a coward's and that an ambusher notices
  // more often than a brute. With animals hunting each other those two columns rest on a handful of meetings per run and
  // do not hold at every seed count (see NOTES.md, 2026-11-23). The two rules behind them are checked directly below.
  // "Closing in" (column C) went the same way on 2026-11-23, when hunters began chasing at full speed (note #106): brute 100% -> 0%,
  // ambusher 0% -> 71%, on a few alert ticks each. The rule is checked directly below instead.
}
{ // the rules behind the temperaments, one at a time, in a world with only the rival in it
  const porcupine = FORMS.find(f => f.name === 'Porcupine'); assert.deepEqual(sightOf(porcupine), [1, CONE], 'the test animal has the plain wedge'); // a Mole sees all round and near since note #148
  const mole = optionsFor(4)[0], alone = (t, dx, dy, f = porcupine) => {
    const s = create(1, levelStack(3), 0, SPAWN_WEIGHTS, false, { f: f.id, bonus: 0, kills: 1, knobs: KNOBS(t) }), m = nemesisMob(s);
    s.mobs = [m]; s.player.safe = 0; m.x = s.player.x + dx; m.y = s.player.y + dy; m.a = Math.PI; m.timer = 99; s.nemesis.home = { x: m.x, y: m.y }; s.nemesis.hunt = 999;
    return { s, m };
  };
  const reach = me(alone('brute', 0, 0).s).r + porcupine.range; // how far a plain Porcupine sees this player, straight ahead
  // sight: just past a plain animal's range, straight ahead. Only the temperaments that see farther notice.
  const far = Object.fromEntries(TEMPERAMENT_NAMES.map(t => { const { s, m } = alone(t, reach * 1.05, 0); step(s, null); return [t, m.alert]; }));
  assert.deepEqual(far, { ambusher: true, stalker: true, brute: false, coward: true }, 'who sees past a plain animal\'s range');
  // wedge: well inside range, 1.3 radians off its facing (a plain wedge is 1.13 wide each side). Only the ambusher's wider wedge covers it.
  const side = Object.fromEntries(TEMPERAMENT_NAMES.map(t => { const { s, m } = alone(t, Math.cos(1.3) * reach * 0.6, Math.sin(1.3) * reach * 0.6); step(s, null); return [t, m.alert]; }));
  assert.deepEqual(side, { ambusher: true, stalker: false, brute: false, coward: false }, 'only the ambusher has a wider wedge');
  // hold: once it has noticed, the player is moved far out of sight. Seconds until it gives up, and whether that counts as an escape.
  const hold = Object.fromEntries(TEMPERAMENT_NAMES.map(t => {
    const { s, m } = alone(t, reach * 0.5, 0); s.player.stack = levelStack(3, 1); for (let i = 0; i < 120; i++) step(s, { x: -1, y: 0 }); assert.ok(m.alert && !s.dead, `${t} noticed, and the fast player ran for 2 seconds`);
    s.player.x = m.x < 1000 ? 1900 : 100; s.player.y = m.y < 1000 ? 1900 : 100; let n = 0, escaped = false;
    while (m.alert && n < 3600) { step(s, null); n++; escaped ||= s.events.some(e => e.t === 'nemEscape'); }
    assert.ok(escaped, `${t}: getting away after a chase counts as an escape`); assert.equal(s.nemesis.escapes, 1);
    return [t, n / 60];
  }));
  assert.ok(hold.brute > hold.stalker && hold.stalker > hold.ambusher && hold.ambusher > hold.coward, 'a brute keeps a lost chase longest, a coward shortest');
  // an ambusher that has not noticed stands still inside its territory; the others wander
  const moved = Object.fromEntries(TEMPERAMENT_NAMES.map(t => { const { s, m } = alone(t, 600, 600); m.timer = 0; const x = m.x, y = m.y; let far = 0; for (let i = 0; i < 1200; i++) { step(s, null); far = Math.max(far, Math.hypot(m.x - x, m.y - y)); } return [t, far]; }));
  // a coward runs from a player close to its power; a brute closes in (the player: a level 4 Crab, power 44, against the Mole's 54)
  const gap = Object.fromEntries(['brute', 'coward'].map(t => { const { s, m } = alone(t, reach * 0.45, 0, mole); s.player.stack = levelStack(4); m.alert = true; // safe stays 0: a player who is safe is not seen
    const d0 = Math.hypot(m.x - s.player.x, m.y - s.player.y); for (let i = 0; i < 30; i++) step(s, null); return [t, Math.hypot(m.x - s.player.x, m.y - s.player.y) - d0]; }));
  assert.ok(gap.brute < -10 && gap.coward > 10, `a coward runs from a player close to its power; a brute closes in (${gap.brute.toFixed(0)}, ${gap.coward.toFixed(0)})`);
  assert.equal(moved.ambusher, 0, 'an ambusher waits'); assert.ok(moved.stalker > 20 && moved.brute > 20 && moved.coward > 20, 'the others wander');
  console.log(`temperament rules: sees past plain range ${TEMPERAMENT_NAMES.filter(t => far[t]).join(', ')}; wider wedge ${TEMPERAMENT_NAMES.filter(t => side[t]).join(', ')}; seconds it keeps a lost chase ${TEMPERAMENT_NAMES.map(t => `${t} ${hold[t].toFixed(2)}`).join(', ')}`);
}
{ // the careful bot still climbs with a rival in the world, next to the numbers measured above without one
  console.log(`\ncareful bot, ${seeds} seeds x ${minutes} min, classic rules, a level 3 rival present from the start (median highest level / median deaths):`);
  console.log(['pick', 'no rival', ...TEMPERAMENT_NAMES].map(h => h.padEnd(12)).join(''));
  for (const pick of [0, 1, 2]) {
    const cells = [`${result[`careful/${pick}`].top} / ${result[`careful/${pick}`].deaths}`];
    for (const t of TEMPERAMENT_NAMES) {
      const tops = [], deaths = [];
      for (let seed = 1; seed <= seeds; seed++) { const { s, log } = play(seed, careful, { ticks: minutes * 3600, pick, nemesis: { f: optionsFor(2)[pick].id, bonus: 0, knobs: KNOBS(t) } }); tops.push(log.top); deaths.push(s.deaths); }
      cells.push(`${mid(tops)} / ${mid(deaths)}`);
      assert.ok(mid(tops) >= 6, `careful bot climbs with a ${t} rival (pick ${pick})`);
    }
    console.log([['strong', 'fast', 'sneaky'][pick], ...cells].map(h => h.padEnd(12)).join(''));
  }
}
{ // the payoff can happen in play: a bot that is reckless until its first death, then careful, grows past and eats the rival
  for (const wild of [false, true]) {
    let eaten = 0; const when = [];
    for (let seed = 1; seed <= seeds; seed++) {
      let died = false, at = null;
      const { log } = play(seed, x => (died ? careful(x) : reckless(x)), { ticks: minutes * 3600, wild, knobs: KNOBS(TEMPERAMENT_NAMES[seed % 4]), onEvent: (e, s) => { if (e.t === 'die') died = true; if (e.t === 'nemEaten' && at === null) at = s.t / 60; } });
      if (log.eaten) { eaten++; when.push(at); }
    }
    console.log(`${wild ? 'WILD   ' : '\nclassic'} payoff: reckless-then-careful bot ate its rival in ${eaten}/${seeds} runs (median at ${mid(when)?.toFixed(1) ?? '-'} min)`);
    if (!wild) assert.ok(eaten >= Math.ceil(seeds / 2), 'the rival can be eaten in play');
  }
}
console.log('rival checks pass');

// 6. Old animals (note #201): the top three of the last climb hunt the player in the next one.
{
  const chain = k => { const st = [ANT]; while (st.length < TOP) st.push(optionsFor(st.length)[k].id); return st; };
  for (const k of [0, 1, 2]) {
    const ids = chain(k).slice(-3), s = create(7 + k, [ANT], 0, SPAWN_WEIGHTS, false, null, ids);
    assert.deepEqual(s.mobs.filter(m => m.old).map(m => m.f), ids, 'all three are there');
    for (let i = 0; i < (OLD_EVERY + 2) * 60 && !s.oldHunts; i++) { s.player.safe = i < 200 ? s.player.safe : 0; s.mobs = s.mobs.filter(m => m.old); step(s, { x: 0, y: 0 }); if (s.dead) revive(s, false); }
    assert.ok(s.oldHunts >= 1 || s.deaths, 'one comes hunting');
    for (const id of ids) assert.ok(FORMS[id].power - OLD_WEAK < FORMS[chain(k).at(-1)].power, 'every old animal can be eaten at the top');
  }
  { // a hunting old animal is no faster than the player: running straight away from it keeps the gap
    const s = create(3, [ANT], 0, SPAWN_WEIGHTS, false, null, [chain(1).at(-1)]), m = s.mobs.find(x => x.old); s.mobs = [m]; s.player.safe = 0; s.player.x = 300; s.player.y = 1000; m.x = 120; m.y = 1000; m.a = 0; m.hunt = OLD_HUNT;
    const g0 = s.player.x - m.x; let pounced = 0; for (let i = 0; i < 240; i++) { s.mobs = [m]; step(s, { x: 1, y: 0 }); pounced += s.events.some(e => e.t === 'pounce') ? 1 : 0; }
    assert.ok(!s.dead && s.player.x - m.x >= g0 && pounced === 0, 'it does not catch a player who runs, and never pounces');
  }
  { // its skill (note #225): every species with one, hunting every kind of player. Shown before it lands, never a catch of a player who runs straight on.
    const kinds = new Map(); let tight = Infinity;
    for (const M of FORMS.filter(f => f.level >= 2 && powerFor(f) && f.power - OLD_WEAK > FORMS[ANT].power)) for (const role of [0, 1, 2]) for (const dist of [60, 90, 130, 180, 240]) {
      const stack = [ANT, optionsFor(1)[role].id]; if (M.power - OLD_WEAK <= FORMS[stack[1]].power) continue;
      const s = create(3, stack, 0, SPAWN_WEIGHTS, false, null, [M.id]), m = s.mobs[s.mobs.length - 1], p = s.player; p.safe = 0; p.x = 300; p.y = 1000;
      m.x = 300 - dist - M.r - FORMS[stack[1]].r; m.y = 1000; m.a = 0; m.hunt = OLD_HUNT; m.skillCd = 0; let wound = -1, used = -1;
      for (let i = 0; i < 420; i++) { s.mobs = [m]; if (p.x > WORLD - 200) { p.x -= 800; m.x -= 800; } step(s, { x: 1, y: 0 }); for (const e of s.events) { if (e.t === 'oldWind' && wound < 0) wound = i; if (e.t === 'oldSkill' && used < 0) used = i; } assert.ok(!s.dead, `${M.name} at ${dist} does not catch a player who keeps running`); tight = Math.min(tight, p.x - m.x - M.r - FORMS[stack[1]].r); }
      if (used >= 0) { assert.ok(wound >= 0 && used - wound >= 38, 'it is shown for 0.6 s or more before it lands'); kinds.set(powerFor(M).kind, (kinds.get(powerFor(M).kind) || 0) + 1); }
    }
    assert.ok(tight >= 40, `a player who runs straight keeps a gap (${tight.toFixed(0)})`);
    assert.deepEqual([...kinds.keys()].sort(), ['dive', 'leap', 'roar', 'shell', 'sprint', 'sting'], 'all six kinds are used');
    console.log(`old animals' skills: used ${[...kinds].map(k => k.join(' ')).join(', ')}; tightest gap to a player who runs straight ${tight.toFixed(0)}`);
    const one = kind => { const M = FORMS.find(f => f.level >= 6 && powerFor(f)?.kind === kind), s = create(3, [ANT], 0, SPAWN_WEIGHTS, false, null, [M.id]), m = s.mobs.at(-1), p = s.player; p.safe = 0; m.x = p.x - 80 - M.r - FORMS[ANT].r; m.y = p.y; m.a = 0; m.hunt = OLD_HUNT; m.skillCd = 0; return { s, m, p, run(n, fn, inp = { x: 0, y: 0 }) { for (let i = 0; i < n; i++) { s.mobs = [m]; step(s, inp); if (fn?.()) return true; } return false; } }; };
    for (const kind of ['sting', 'roar']) {
      const a = one(kind); assert.ok(a.run(120, () => a.p.slow > 0), `${kind} slows a player who stays`); const x0 = a.p.x; a.run(30, null, { x: 1, y: 0 }); assert.ok(a.p.x > x0 + 5, 'slowed, not stopped'); a.s.dead = {}; revive(a.s, false); assert.equal(a.p.slow, 0, 'a revive ends it');
      for (const block of ['shell', 'veil', 'safe']) { const b = one(kind); assert.ok(b.run(60, () => b.s.events.some(e => e.t === 'oldWind')), 'it starts'); b.p[block] = 2; let hit = false; b.run(60, () => { hit ||= b.p.slow > 0; }); assert.ok(!hit, `${block} blocks a ${kind}`); }
    }
    { const a = one('dive'); assert.ok(a.run(60, () => a.s.events.some(e => e.t === 'oldWind'))); const aim = a.m.aim; let bent = 0; a.run(150, () => { if (a.m.burst > 0) bent = Math.max(bent, Math.abs(ang(a.m.a, aim))); return a.s.dead; }, { x: 0, y: 1 }); assert.ok(bent < 0.05, 'it keeps to the line it showed'); assert.ok(!a.s.dead, 'a step aside makes a dive miss'); }
    { const a = one('dive'); a.run(120, () => a.s.dead); assert.ok(a.s.dead, 'a dive catches a player who stands still in its line'); }
    { const a = one('sprint'); a.run(60, () => a.m.wind > 0); a.m.stun = 1; a.run(2); assert.ok(!(a.m.wind > 0) && !a.s.events.some(e => e.t === 'oldSkill'), 'stopping it stops the skill'); }
  }
  { // grown past it, the player eats it: a prize, and one fewer
    const st = chain(0), s = create(3, st, 0, SPAWN_WEIGHTS, false, null, [st.at(-3), st.at(-2)]), m = s.mobs.find(x => x.old); s.mobs = s.mobs.filter(x => x.old); m.x = s.player.x + 5; m.y = s.player.y; m.alert = false; m.a = 0; s.player.safe = 1;
    step(s, { x: 0, y: 0 }); const e = s.events.find(x => x.t === 'oldEaten'); assert.ok(e && e.left === 1, 'eaten, one left'); assert.equal(s.events.find(x => x.t === 'eat').gain, 2 + OLD_PRIZE, 'two levels below pays 2, plus the prize');
  }
  { // it stays through upkeep and a revive, and a death to it does not make it the rival
    const s = create(3, [ANT], 0, SPAWN_WEIGHTS, false, null, chain(2).slice(-3)); for (let i = 0; i < 600; i++) { s.player.safe = 9; step(s, { x: 0, y: 0 }); }
    assert.equal(s.mobs.filter(m => m.old).length, 3, 'upkeep keeps them'); s.dead = {}; revive(s, false); assert.equal(s.mobs.filter(m => m.old).length, 3, 'a revive keeps them');
    assert.equal(crown(s, s.mobs.find(m => m.old).id), false, 'never crowned');
  }
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  for (const wild of [false, true]) for (const pick of [0, 1, 2]) for (const old of [[], chain(0).slice(-3)]) {
    const tops = [], deaths = []; let hunts = 0, got = 0, byOld = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const s = create(seed, [ANT], 0, SPAWN_WEIGHTS, wild, null, old); let top = 1;
      for (let i = 0; i < minutes * 3600; i++) { step(s, careful(s)); for (const e of s.events) if (e.t === 'oldEaten') got++; if (s.choosing) choose(s, pick); if (s.dead) { if (s.mobs.find(m => m.id === s.dead.killer)?.old) byOld++; revive(s, false); } top = Math.max(top, level(s)); if (s.won) break; }
      tops.push(top); deaths.push(s.deaths); hunts += s.oldHunts || 0;
    }
    console.log(`${wild ? 'WILD   ' : 'classic'} careful, ${['strong', 'fast', 'sneaky'][pick]}, ${old.length ? 'old animals' : 'none       '}: level median ${med(tops)}, deaths median ${med(deaths)}, hunts/run ${(hunts / seeds).toFixed(1)}, deaths to them/run ${(byOld / seeds).toFixed(1)}, eaten ${got}`);
  }
}
console.log('old animals: checks pass');
