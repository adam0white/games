// Checks for the Living look (rig.js, creature.js, living.js), carried over from the lab page ant-creatures. bots.mjs runs
// this first; it also runs alone: node experiments/ant-promotion/rig-bots.mjs [--mutate[=gait|clamp|spine]]
// 1. Every species builds and walks 10,000 steps of random motion (walks, runs, pounces and dives up to the game's top
//    speed, snap turns, jumps, every pose from living.js) without a NaN; spine and chain segments keep their lengths; feet
//    never reach past the leg; the gait alternates.
// 2. Determinism: the same seed and inputs give the same pose, number for number.
// 3. living.js on the real sim: a careful run with the look stepping every animal near the player. The rules come out the
//    same, number for number, as a run without it (the look only reads the sim), and the body language shows up.
// 4. Drawing: every species in every pose draws on a context that rejects a NaN or Infinity, and the book's still picture.
// --mutate breaks one rule in rig.js (a test-only switch): gait (default) lets every leg step when it likes; clamp stops
// holding feet within the leg; spine lets points drift instead of keeping their distance. Each must make a check fail;
// with --mutate this file exits after its own checks, non-zero when a check failed (which is what a mutation should do).
import { FORMS, ANT, create, step, choose, revive, me, level, powerOf, sightOf, SPAWN_WEIGHTS, FAST_CAP, POWER, POUNCE, OLD_SKILL } from './sim.js';
import { update, numbers, mutate } from './rig.js';
import { speciesFor, creature, drawCreature } from './creature.js';
import { living, portraitLiving } from './living.js';

const RIG_MUTATIONS = ['gait', 'clamp', 'spine'], asked = process.argv.find(a => a.startsWith('--mutate'));
const arg = asked && RIG_MUTATIONS.includes(asked.split('=')[1] || 'gait') ? asked : null; // other names (rocks) belong to bots.mjs section 7
if (arg) { const m = arg.split('=')[1] || 'gait'; mutate(m); console.log(`MUTATION ON: ${m}`); }
let failed = 0;
const claim = (ok, text) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) failed++; };
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const DT = 1 / 60, TAU = Math.PI * 2;
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const TOP_SPEED = Math.max(360, Math.max(...FORMS.map(F => F.speed)) * Math.max(FAST_CAP, ...Object.values(POWER).map(P => P.speed || 0))); // the lab's 360, or the fastest anything moves (FAST_CAP and power speeds multiply a form's speed)

// What the rig promises, measured from the outside on its points.
function measure(c, m) {
  const { spec, r } = c;
  for (let i = 1; i < c.spine.length; i++) { const g = spec.gaps[i - 1] * r, d = Math.hypot(c.spine[i].x - c.spine[i - 1].x, c.spine[i].y - c.spine[i - 1].y); m.seg = Math.max(m.seg, Math.abs(d - g) / g); }
  for (const ch of c.chains) for (let k = 1; k < ch.pts.length; k++) { const g = ch.C.seg * r, p = ch.pts[k], q = ch.pts[k - 1]; m.chain = Math.max(m.chain, Math.abs(Math.hypot(p.x - q.x, p.y - q.y) - g) / g); }
  for (const l of c.legs) {
    m.stretch = Math.max(m.stretch, Math.hypot(l.foot.x - l.hip.x, l.foot.y - l.hip.y) / l.len);
    const s = c.spine[l.L.at], reachFromSpine = l.len + spec.pts[l.L.at] * r * l.L.out + Math.abs(l.L.fwd) * r;
    m.spineFoot = Math.max(m.spineFoot, Math.hypot(l.foot.x - s.x, l.foot.y - s.y) / reachFromSpine);
    const kn = Math.hypot(l.knee.x - l.hip.x, l.knee.y - l.hip.y), fk = Math.hypot(l.foot.x - l.knee.x, l.foot.y - l.knee.y);
    m.knee = Math.max(m.knee, Math.abs(kn - l.len / 2) / l.len, Math.abs(fk - l.len / 2) / l.len);
  }
  if (!numbers(c).every(Number.isFinite)) m.nan++;
}

// A random walker: rest, walk, run and pounce phases; mob-style turns and player-style snap turns; now and then a jump;
// the pose living.js gives (quick steps when fleeing or sprinting, slow when stalking or tired) changes with the phase.
function walk(F, seed, steps = 10000, onStep = null) {
  const R = rng(seed), c = creature(F, 0, 0, 0), m = { seg: 0, chain: 0, stretch: 0, spineFoot: 0, knee: 0, nan: 0, drag: { walk: [0, 0], run: [0, 0], pounce: [0, 0] } };
  let x = 0, y = 0, a = 0, want = 0, v = 0, mode = 'rest', left = 0, snap = false;
  for (let i = 0; i < steps; i++) {
    if ((left -= DT) <= 0) {
      const roll = R(); mode = roll < 0.15 ? 'rest' : roll < 0.6 ? 'walk' : roll < 0.9 ? 'run' : 'pounce'; left = 0.3 + R() * 2.2;
      v = { rest: 0, walk: 0.38 * F.speed, run: F.speed, pounce: Math.min(2.5 * F.speed, TOP_SPEED) }[mode];
      want = a + (R() - 0.5) * 4; snap = R() < 0.25;
      c.hurry = [1, 1.7, 1.8, 0.75, 0.7][Math.floor(R() * 5)];
      if (R() < 0.03) { x += (R() - 0.5) * 1200; y += (R() - 0.5) * 1200; } // a jump: spawn, revive, thrown clear
    }
    if (snap) a = want; else a += Math.max(-7 * DT, Math.min(7 * DT, wrap(want - a)));
    x += Math.cos(a) * v * DT; y += Math.sin(a) * v * DT;
    const d0 = c.stat.drag, f0 = c.stat.legFrames;
    update(c, x, y, a, DT, R() < 0.5 ? { x: x + 100, y: y - 40 } : null);
    if (mode !== 'rest') { const b = m.drag[mode]; b[0] += c.stat.drag - d0; b[1] += c.stat.legFrames - f0; }
    measure(c, m); onStep?.(c, i);
  }
  return { c, m };
}

// ---------- 1. every species
const t0 = Date.now(), worst = { seg: 0, chain: 0, stretch: 0, spineFoot: 0, knee: 0, nan: 0 }, drag = { walk: [0, 0], run: [0, 0], pounce: [0, 0] };
let overlap = 0, waves = 0, alts = 0, walkers = 0, legless = 0, resets = 0;
const perAlt = [];
for (const F of FORMS) {
  const { spec } = speciesFor(F);
  const { c, m } = walk(F, 1000 + F.id);
  for (const k of Object.keys(worst)) worst[k] = k === 'nan' ? worst[k] + m.nan : Math.max(worst[k], m[k]);
  for (const k of Object.keys(drag)) { drag[k][0] += m.drag[k][0]; drag[k][1] += m.drag[k][1]; }
  if (m.nan) console.log(`     NaN in ${F.name}`);
  if (spec.gait === 'walk' && c.legs.length) { walkers++; overlap += c.stat.overlap; waves += c.stat.waves; alts += c.stat.alts; perAlt.push([F.name, c.stat.alts / Math.max(1, c.stat.waves), c.stat.waves]); }
  if (!c.legs.length) legless++;
  resets += c.stat.resets;
}
const pct = ([a, b]) => (100 * a / Math.max(1, b)).toFixed(2) + '%';
console.log(`rig: ${FORMS.length} species built and walked 10,000 steps each in ${((Date.now() - t0) / 1000).toFixed(1)} s, top speed ${TOP_SPEED} (${walkers} walk on legs, ${legless} without legs, ${resets} jumps re-laid)`);
claim(worst.nan === 0, `no NaN or Infinity in any rig number (${worst.nan} bad steps)`);
claim(worst.seg < 1e-6, `spine segments keep their length: worst error ${(worst.seg * 100).toExponential(2)}%`);
claim(worst.chain < 1e-6, `chain segments (antennae, tails, necks, trunks, stings) keep their length: worst error ${(worst.chain * 100).toExponential(2)}%`);
claim(worst.stretch <= 0.98 + 1e-9, `no foot is ever further from its hip than the leg: worst ${(worst.stretch * 100).toFixed(2)}% of leg length`);
claim(worst.spineFoot <= 1 + 1e-9, `no foot is further from its body point than leg plus hip offset: worst ${(worst.spineFoot * 100).toFixed(1)}%`);
claim(worst.knee < 1e-6, `IK: hip-knee and knee-foot are each half the leg (worst error ${(worst.knee * 100).toExponential(2)}% of the leg)`);
claim(overlap === 0, `gait: the two leg groups never step at the same time (${overlap} frames where both did)`);
const altRate = alts / Math.max(1, waves), worstAlt = perAlt.reduce((w, p) => (p[1] < w[1] ? p : w), ['', 1, 0]);
claim(altRate > 0.9 && worstAlt[1] > 0.8, `gait: consecutive steps alternate groups ${(altRate * 100).toFixed(1)}% of ${waves} waves (lowest: ${worstAlt[0]} ${(worstAlt[1] * 100).toFixed(0)}% of ${worstAlt[2]})`);
console.log(`     feet dragged (the leg reached its end before a step came): walking ${pct(drag.walk)}, running ${pct(drag.run)}, pouncing ${pct(drag.pounce)} of leg-frames`);
{ // steady driving on a curving path: the feet must step, not slide
  let wd = [0, 0], rd = [0, 0], worstName = '', worst = 0;
  for (const F of FORMS) {
    if (speciesFor(F).spec.gait !== 'walk' || !speciesFor(F).spec.legs.length) continue;
    for (const [mul, acc] of [[0.38, wd], [1, rd]]) {
      const c = creature(F, 0, 0, 0); let x = 0, y = 0, a = 0;
      for (let i = 0; i < 1200; i++) { a += Math.sin(i / 90) * 0.02; x += Math.cos(a) * F.speed * mul * DT; y += Math.sin(a) * F.speed * mul * DT; update(c, x, y, a, DT); }
      acc[0] += c.stat.drag; acc[1] += c.stat.legFrames; const k = c.stat.drag / c.stat.legFrames; if (k > worst) { worst = k; worstName = `${F.name} at ${mul === 1 ? 'a run' : 'a walk'}`; }
    }
  }
  claim(wd[0] / wd[1] < 0.01 && rd[0] / rd[1] < 0.02, `steady walking feet step rather than slide: dragged ${pct(wd)} of leg-frames at a walk, ${pct(rd)} at a run (worst ${worstName} ${(worst * 100).toFixed(1)}%)`);
}
{ // a snap turn: the player reverses in one tick (the sim sets p.a straight from the stick)
  const F = FORMS.find(f => f.name === 'Lizard'), c = creature(F, 0, 0, 0); let x = 0, flips = 0, maxJump = 0;
  for (let i = 0; i < 600; i++) {
    const a = Math.floor(i / 40) % 2 ? Math.PI : 0; if (i % 40 === 0) flips++;
    x += Math.cos(a) * F.speed * DT; const before = c.spine.map(p => ({ ...p }));
    update(c, x, 0, a, DT);
    for (let k = 0; k < c.spine.length; k++) maxJump = Math.max(maxJump, Math.hypot(c.spine[k].x - before[k].x, c.spine[k].y - before[k].y));
  }
  claim(maxJump < F.r * 1.2, `a snap reversal (${flips} flips) moves no body point more than ${(maxJump / F.r).toFixed(2)} r in one frame (limit 1.2 r)`);
}
{ // a fleeing animal takes quicker steps than a calm one at the same speed (living.js sets hurry; rig.js shortens the step)
  const quick = name => { const F = FORMS.find(f => f.name === name), steps = hurry => { const c = creature(F, 0, 0, 0); c.hurry = hurry; let x = 0; for (let i = 0; i < 600; i++) { x += F.speed * 0.6 * DT; update(c, x, 0, 0, DT); } return c.stat.waves; }; return [steps(1), steps(1.8)]; };
  const [dc, df] = quick('Dog'), [mc, mf] = quick('Mouse');
  claim(df > dc * 1.4 && mf > mc * 1.1, `hurry: a fleeing Dog steps ${df} times in 10 s against ${dc} calm at the same speed; a Mouse ${mf} against ${mc} (its steps are already near the shortest)`);
}

// ---------- 2. determinism
{
  const F = FORMS.find(f => f.name === 'Fire Ant'), run = seed => JSON.stringify(numbers(walk(F, seed, 3000).c));
  claim(run(7) === run(7), 'determinism: the same seed and inputs give the same pose, every number');
  claim(run(7) !== run(8), 'a different seed gives a different pose');
}

// ---------- 3. living.js on the real sim
const ang = (a, b) => Math.abs(wrap(a - b));
function careful(s) { // from bots.mjs: hunt what it can catch, keep out of stronger animals' sight
  const p = s.player, F = me(s); let vx = 0, vy = 0, best = null, bd = Infinity;
  for (const m of s.mobs) {
    const M = FORMS[m.f], dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, pw = powerOf(m);
    if (pw > F.power) {
      const [far, half] = sightOf(M), reach = M.range * far * F.stealth + 110, facing = ang(Math.atan2(-dy, -dx), m.a) < half + 0.4;
      if (d < reach * (facing || m.alert ? 1.5 : 0.7)) { const w = (m.alert ? 5 : facing ? 3 : 1.5) * reach / d; vx -= dx / d * w; vy -= dy / d * w; }
    } else if (pw < F.power && (M.speed <= F.speed || !m.alert) && d < bd) { bd = d; best = m; }
  }
  if (best) {
    const M = FORMS[best.f]; let tx = best.x, ty = best.y;
    if (M.speed > F.speed && bd > 40) { const back = Math.min(bd * 0.7, 70); tx -= Math.cos(best.a) * back; ty -= Math.sin(best.a) * back; }
    const d = Math.hypot(tx - p.x, ty - p.y) || 1; vx += (tx - p.x) / d; vy += (ty - p.y) / d;
  }
  return { x: vx, y: vy, power: (s.t % 7) < DT * 2 };
}
// the whole sim state as text: non-finite numbers spelled out, and a hunt or a flight (an animal pointing at another) written as that animal's id
const strip = s => JSON.stringify(s, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : (k === 'chase' || k === 'fear') && v && typeof v === 'object' ? `->${v.id ?? 'player'}` : v));
function ride(seed, secs, L, stack = [ANT], nem = null, old = []) { // a run as the page plays it (death drops a form, the run goes on); L steps after every tick
  const s = create(seed, stack, 0, SPAWN_WEIGHTS, true, nem, old), m = { seg: 0, chain: 0, stretch: 0, spineFoot: 0, knee: 0, nan: 0 }, seen = {};
  let most = 0;
  for (let i = 0; i < secs * 60; i++) {
    step(s, careful(s));
    if (L) {
      for (const e of s.events) L.event(e, s);
      L.step(s, 900, 1600);
      for (const c of L.rigs.values()) { measure(c, m); for (const [k, v] of Object.entries(c.mood)) if (v) seen[k] = (seen[k] || 0) + 1; if (c.hurry > 1) seen.quick = (seen.quick || 0) + 1; }
      const you = L.rig(null); if (you) { measure(you, m); for (const [k, v] of Object.entries(you.mood)) if (v) seen['you.' + k] = (seen['you.' + k] || 0) + 1; }
      most = Math.max(most, L.stat.rigs);
    }
    if (s.choosing) choose(s, i % 3);
    if (s.dead) { L?.clear(); revive(s, false); }
    if (s.won) break;
  }
  return { s, m, seen, most };
}
{
  const secs = 240, L = living(), t1 = Date.now(), a = ride(42, secs, L), took = (Date.now() - t1) / 1000, b = ride(42, secs, null);
  claim(strip(a.s) === strip(b.s), `the look does not touch the rules: ${secs} s on seed 42 with living.js stepping end in the same state as without it (level ${level(a.s)}, ${a.s.deaths} deaths, ${a.s.mobs.length} animals)`);
  claim(a.m.nan === 0 && a.m.seg < 1e-6 && a.m.chain < 1e-6 && a.m.stretch <= 0.98 + 1e-9, `on the real sim: up to ${a.most} rigs at once near the player, ${took.toFixed(1)} s for ${secs * 60} ticks; no NaN, worst segment error ${(a.m.seg * 100).toExponential(1)}%, worst foot ${(a.m.stretch * 100).toFixed(1)}% of leg`);
  const count = k => a.seen[k] || 0;
  console.log(`     body language seen (rig-ticks): ${Object.entries(a.seen).sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
  claim(count('crouch') > 0 && count('quick') > 0 && count('stretch') > 0 && count('pant') > 0, `in a real run animals crouch (${count('crouch')}), stretch out (${count('stretch')}), take quick steps (${count('quick')}) and pant (${count('pant')})`);
}
{ // the same with a rival and old animals: pounces, wind-ups, skills and a temperament on rigs against the real sim, rules unchanged
  const at = (level, role) => FORMS.find(f => f.level === level && f.role === role).id; // a fast animal is what gets pounced on
  const stack = [ANT, 2, 3, 4, 5, 6, 7].map((l, i) => (i ? at(l, 'runner') : l)), old = [16, 17, 18].map(l => at(l, 'brute'));
  const nem = { f: at(9, 'brute'), bonus: 1, kills: 3, escapes: 0, kin: 0, knobs: { temperament: 'brute', persistence: 2, territory: 2 } };
  let same = 0, runs = 0; const seen = {}, worst = { nan: 0, seg: 0, stretch: 0 };
  for (const [seed, secs] of [[3, 300], [17, 200], [29, 240]]) {
    const a = ride(seed, secs, living(), stack, nem, old), b = ride(seed, secs, null, stack, nem, old); runs++;
    if (strip(a.s) === strip(b.s)) same++;
    for (const [k, v] of Object.entries(a.seen)) seen[k] = (seen[k] || 0) + v;
    worst.nan += a.m.nan; worst.seg = Math.max(worst.seg, a.m.seg); worst.stretch = Math.max(worst.stretch, a.m.stretch);
  }
  const n = k => seen[k] || 0;
  console.log(`     with a rival and old animals (rig-ticks): ${Object.entries(seen).sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
  claim(same === runs && worst.nan === 0 && worst.seg < 1e-6 && worst.stretch <= 0.98 + 1e-9, `with a rival and old animals: ${same}/${runs} runs end in the same state as without the look; no NaN, worst foot ${(worst.stretch * 100).toFixed(1)}% of leg`);
  claim(n('lift') > 0 && n('crouch') > n('sleep') && n('size') > 0, `and the body shows it: off the ground ${n('lift')}, crouched ${n('crouch')} (stunned ${n('sleep')}), the brute rival bigger ${n('size')} rig-ticks`);
}
{ // the body follows the rules: set one piece of sim state on an animal next to the player and read the pose living.js gives it
  const s = create(9, [ANT], 0, SPAWN_WEIGHTS, true), p = s.player, m = s.mobs[0], fresh = () => { for (const k of ['pounce', 'wind', 'burst', 'puff', 'winded', 'stun']) m[k] = 0; m.fear = m.chase = null; m.alert = false; m.nem = false; m.old = false; };
  m.x = p.x + 60; m.y = p.y;
  const pose = (set, wild = null) => { fresh(); set(m); const L = living(); for (let i = 0; i < 3; i++) L.step(s, 400, 400); return L.rig(m).mood; };
  const cases = [
    ['a pounce crouches first', m => { m.alert = true; m.pounce = POUNCE.secs * 0.95; }, o => o.crouch > 0.2 && !o.lift],
    ['then leaps, body stretched', m => { m.alert = true; m.pounce = POUNCE.secs * 0.5; }, o => o.lift > 0.3 && o.stretch > 0.05],
    ['an old animal winding up crouches deeper as it waits', m => { m.wind = OLD_SKILL.wind * 0.2; }, o => o.crouch > 0.7],
    ['a puffed-out hunter pants', m => { m.puff = 0.5; }, o => o.pant === 1],
    ['a winded hunter pants', m => { m.winded = 1; }, o => o.pant === 1],
    ['fleeing prey hurries, stretched', m => { m.fear = s.mobs[1]; }, o => o.hurry > 1.5 && o.stretch > 0],
    ['a stunned animal shuts its eyes and keeps still', m => { m.stun = 1; m.pounce = POUNCE.secs * 0.5; }, o => o.sleep && !o.lift],
  ];
  for (const T of ['ambusher', 'stalker', 'brute', 'coward']) cases.push([`a ${T} rival shows it`, m => { m.nem = true; m.alert = T === 'coward'; s.nemesis = { knobs: { temperament: T } }; }, { ambusher: o => o.crouch >= 0.6, stalker: o => o.hurry < 1 && o.stretch > 0, brute: o => o.size > 1, coward: o => o.size < 1 && o.tremble }[T]]);
  const missed = cases.filter(([, set, ok]) => !ok(pose(set)));
  s.nemesis = null; fresh();
  claim(!missed.length && !Object.keys(pose(() => {})).length, `body language follows the sim: ${cases.length - missed.length}/${cases.length} states show in the pose, a calm animal has none${missed.length ? ` (missing: ${missed.map(c => c[0]).join('; ')})` : ''}`);
}

// ---------- 4. drawing: no NaN reaches the canvas in any pose, for any species, near or far
function strictCtx() {
  let calls = 0, bad = null;
  const check = (name, args) => { calls++; for (const v of args) if (typeof v === 'number' && !Number.isFinite(v)) bad ??= `${name}(${args.join(', ')})`; };
  const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' ? (...args) => check(k, args) : undefined), set: (o, k, v) => { if (typeof v === 'number') check(k, [v]); o[k] = v; return true; } });
  return { g, get calls() { return calls; }, get bad() { return bad; } };
}
{
  const ctx = strictCtx(), poses = [{}, { crouch: 1 }, { lift: 0.7, stretch: 0.22 }, { pant: 1 }, { sleep: 1, crouch: 0.3 }, { tremble: 1, size: 0.93 }, { size: 1.1, stretch: 0.1 }, { shell: 1 }, { scuff: 1 }, { scars: 3 }, { low: true, pant: 1, lift: 0.5 }];
  let drawn = 0;
  for (const F of FORMS) {
    const c = creature(F, 0, 0, 0.4); let x = 0;
    for (let i = 0; i < 90; i++) { x += F.speed * DT; update(c, x, 0, 0.4, DT); if (i === 45) c.squash = 1; }
    for (const o of poses) { drawCreature(ctx.g, c, { px: F.r / 12, ...o, skin: F.id === ANT ? { c: '#3a2a20', p: 'crown' } : null }); drawn++; }
    portraitLiving(ctx.g, F, 120, 96, F.id === ANT ? { c: '#b03a2e', p: 'stripes' } : null);
  }
  claim(!ctx.bad && ctx.calls > drawn * 20, `drawing: ${FORMS.length} species x ${poses.length} poses and the book picture make ${ctx.calls} canvas calls, no NaN or Infinity${ctx.bad ? ` (first bad: ${ctx.bad})` : ''}`);
}

console.log(failed ? `rig: ${failed} check(s) FAILED` : 'rig: all checks pass');
if (arg || failed) process.exit(failed ? 1 : 0);
