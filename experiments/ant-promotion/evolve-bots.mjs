// Checks for the evolving meadow (meadow.js, the lab page ant-evolve folded in). bots.mjs runs this after cover-bots.mjs; it also runs
// alone: node experiments/ant-promotion/evolve-bots.mjs [--ref=<main's sim.js>] [--mutate=meadow] [--quick]
// 1. Parity. Before GRACE runs, and with no trait set, the page makes the world with no meadow; shape() of a neutral animal is the animal;
//    with --ref (git show origin/main:experiments/ant-promotion/sim.js > /tmp/x/sim.js, with cover.js beside it) the world plays exactly
//    as main's at levels 1, 6, 12 and 18, Classic and Wild, with cover and power presses.
// 2. Rules on staged scenes: each trait does what its words say, and no trait changes who is faster than whom.
// 3. Habits. Four simulated players with one habit each (flee left, creep in grass, use the skill, zigzag) play 30 runs, twice each from
//    different seeds. The meadows they leave must differ by habit more than by seed, and each habit must move its own trait most.
// 4. Clear rate. BAND was stated before any evolved run: a competent bot's levels climbed a minute (sessions where a death costs a level
//    and play goes on) in an evolved meadow (its own after 30 runs, every trait at its hardest bound, and the hunters alone at theirs)
//    stay within BAND times its rate in the plain meadow, and food stays. (A first measure, bar points a minute of single lives,
//    rewarded dying early and was dropped; the band was not changed.)
// 5. 300 runs of the update, fed with the tallies the habits produced and with extreme ones: every trait stays in its bounds, no step
//    is larger than STEP, nothing is NaN. --mutate=meadow removes the step cap and the clamp; this check must then fail.
import { FORMS, ANT, COVER, needFor, create, step, choose, revive, me, level, powerOf, sightOf, optionsFor, SPAWN_WEIGHTS, TIRE, powerReady, catchable, formOf, encounter, chasePace } from './sim.js';
import { patchAt } from './cover.js';
import * as MW from './meadow.js';

const asked = process.argv.find(a => a.startsWith('--mutate')), MUT = asked && asked.split('=')[1] === 'meadow' ? 'meadow' : null;
if (MUT) { MW.mutate(MUT); console.log(`MUTATION ON: ${MUT}`); }
const ref = process.argv.find(a => a.startsWith('--ref='))?.slice(6), quick = process.argv.includes('--quick');
let failed = 0;
const claim = (ok, text) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`); if (!ok) failed++; };
const stackAt = (L, k = 1) => { const st = [ANT]; while (st.length < L) st.push(optionsFor(st.length)[(k + st.length) % 3].id); return st; };
const snap = s => {
  const mobs = s.mobs;
  return JSON.stringify([s.tick, s.player, mobs, s.events, s.dead, s.nemesis, s.eaten, s.deaths, s.choosing?.map(f => f.id)],
    function (k, v) { if (typeof v === 'function') return undefined; if (v && typeof v === 'object' && this !== mobs && 'f' in v && 'id' in v && 'x' in v) return `mob ${v.id}`; return v; });
};
const input = (i, seed) => ({ x: Math.sin(i / 50 + seed), y: Math.cos(i / 70), power: i % 400 === 0 });
const T = Object.fromEntries(MW.TRAITS.map((t, i) => [t.k, i]));
const fill = (vals, runs = MW.GRACE) => { const M = MW.newMeadow(); M.runs = runs; for (const f of FORMS) if (f.level >= 1) { M.sp[f.name] = MW.TRAITS.map(t => vals[t.k] ?? 0); M.shown[f.name] = MW.TRAITS.map(() => 0); } return M; };
const WORST = { grass: 1, stay: 1, lead: 1, shake: 1, wary: 1, bold: 0 }; // every trait at the bound that is hardest on the player (bold helps the player; wary cuts both ways)
const HUNTERS = { grass: 1, stay: 1, lead: 1, shake: 1 }; // the hunters at their hardest, the prey as it was

// ---- 1. Parity
{
  claim(MW.makeMeadow(fill(WORST, MW.GRACE - 1)) === null, `before ${MW.GRACE} runs the page gets no meadow, whatever has been learned`);
  claim(MW.makeMeadow(fill({}, 50)) === null && MW.makeMeadow(MW.cleanMeadow(null)) === null, 'a meadow with no trait set, or none stored, gives no meadow');
  claim(FORMS.every(F => MW.shape(F, MW.TRAITS.map(() => 0), 'hunt') === F && MW.shape(F, MW.TRAITS.map(() => 0), 'prey') === F), 'a neutral animal is its own form in both roles');
  let n = 0, ok = true;
  for (const seed of [1, 2]) for (const wild of [false, true]) {
    const a = create(seed, stackAt(6), 0, SPAWN_WEIGHTS, wild), b = create(seed, stackAt(6), 0, SPAWN_WEIGHTS, wild, null, [], { meadow: MW.makeMeadow(fill(WORST, 3)) });
    for (let i = 0; i < 3600; i++) { step(a, input(i, seed)); step(b, input(i, seed)); for (const s of [a, b]) { if (s.choosing) choose(s, 1); if (s.dead) revive(s, false); } if (snap(a) !== snap(b)) { ok = false; break; } n++; }
  }
  claim(ok, `the page's world for a player with fewer than ${MW.GRACE} runs plays as one with no meadow: ${n} ticks identical`);
  if (ref) {
    const R = await import(new URL(ref, 'file://' + process.cwd() + '/').href); let k = 0, same = true;
    for (const seed of [1, 2, 3]) for (const L of [1, 6, 12, 18]) for (const wild of [false, true]) {
      const st = stackAt(L), a = R.create(seed, st, 0, R.SPAWN_WEIGHTS, wild), b = create(seed, st, 0, SPAWN_WEIGHTS, wild, null, [], { meadow: MW.makeMeadow(MW.newMeadow()) });
      for (let i = 0; i < 3600; i++) {
        R.step(a, input(i, seed)); step(b, input(i, seed));
        if (a.choosing) R.choose(a, 0); if (a.dead) R.revive(a, false); if (b.choosing) choose(b, 0); if (b.dead) revive(b, false);
        if (snap(a) !== snap(b)) { same = false; console.log(`  first difference: seed ${seed}, level ${L}, ${wild ? 'Wild' : 'Classic'}, tick ${i}`); break; } k++;
      }
    }
    claim(same, `a new player's world plays as the reference sim (${ref}): ${k} ticks identical at levels 1, 6, 12, 18, Classic and Wild, cover on, power presses`);
  } else console.log('     (no --ref given: the check against main was skipped)');
}

// ---- 2. Rules on staged scenes
function scene(L, vals, extra = {}) {
  const M = fill(vals), s = create(5, stackAt(L), 0, SPAWN_WEIGHTS, false, null, [], { cover: true, meadow: MW.makeMeadow(M) }), p = s.player;
  s.mobs = []; s.cover.rocks = []; s.cover.grass = []; s.cover.taught = true; p.x = 1000; p.y = 1000; p.a = 0; p.safe = 0;
  return { s, p, F: me(s) };
}
const hunterFor = F => FORMS.find(f => f.level === F.level + 1 && f.power > F.power && f.speed <= F.speed) || FORMS.find(f => f.level === F.level + 1 && f.power > F.power);
const put = (s, f, x, y, a = Math.PI) => { const m = { id: s.nextId++, f: f.id, x, y, a, alert: false, lost: 0, timer: 9, want: a, walk: false, ph: 0 }; s.mobs.push(m); return m; };
{ // grass: a creeper in a patch 2.6 radii from a hunter's eye is hidden from a plain hunter and seen by one that looks into grass
  const seenBy = g => { const { s, p, F } = scene(7, { grass: g }), H = hunterFor(F); s.cover.grass.push({ x: 1000, y: 1000, r: 80, k: 0 }); const m = put(s, H, 1000 + (H.r + F.r) * 3.2, 1000); for (let i = 0; i < 30; i++) step(s, { x: 0.1, y: 0 }); return m.alert; };
  claim(!seenBy(0) && seenBy(1), 'grass: a creeper in grass at 3.2 radii is hidden from a plain hunter and seen by one that looks into grass');
}
{ // stay: seconds of chase before it tires
  const tiredAt = v => { const { s, p, F } = scene(7, { stay: v }); const m = put(s, hunterFor(F), 1100, 1000); m.alert = true; let t = 0; for (; t < 40 * 60 && !s.events.some(e => e.t === 'tired'); t++) { m.x = 1100; m.y = 1000; m.a = Math.PI; step(s, {}); } return t / 60; };
  const a = tiredAt(0), b = tiredAt(1), c = tiredAt(-1);
  claim(Math.abs(a - TIRE.spent) < 0.2 && b > a * 1.4 && c < a * 0.7, `stay: a plain hunter tires after ${a.toFixed(1)} s, a persistent one after ${b.toFixed(1)} s, a quitter after ${c.toFixed(1)} s`);
}
{ // lead: a hunter facing a player who runs across its path turns to where the player is going
  const aimOf = v => { const { s, p, F } = scene(7, { lead: v }); const m = put(s, hunterFor(F), 1000, 1300, -Math.PI / 2); m.alert = true; for (let i = 0; i < 20; i++) step(s, { x: 1, y: 0 }); return m.want; };
  claim(Math.cos(aimOf(1)) > Math.cos(aimOf(0)) + 0.1, 'lead: a leading hunter aims ahead of a player running across it; a plain one aims at the player');
}
{ // shake: a stun wears off sooner
  const left = v => { const { s, F } = scene(7, { shake: v }); const m = put(s, hunterFor(F), 1500, 1500); m.stun = 2; for (let i = 0; i < 60; i++) step(s, {}); return m.stun; };
  claim(left(0) > 0.95 && left(1) < 0.2, `shake: after 1 s of a 2 s stun a plain animal has ${left(0).toFixed(2)} s left, one that shakes it off ${left(1).toFixed(2)} s`);
}
{ // wary and bold, and speed never crosses a class: for every player form and every animal, at the slowest corner, who is faster stays
  const L = FORMS.find(f => f.name === 'Mouse'), wary = MW.shape(L, MW.TRAITS.map((_, i) => (i === T.wary ? 1 : 0)), 'prey'), bold = MW.shape(L, MW.TRAITS.map((_, i) => (i === T.bold ? 1 : 0)), 'prey');
  claim(wary.range > L.range * 1.35 && wary.r > L.r * 1.1 && wary.speed < L.speed && bold.range < L.range * 0.8, 'wary prey sees further, is bigger and slower; bold prey lets you closer');
  let bad = 0; const slow = MW.TRAITS.map((_, i) => (i === T.wary || i === T.shake ? 1 : 0));
  for (const P of FORMS.filter(f => f.level >= 1)) for (const boost of [1, 1.12, 1.8]) {
    const Pl = { ...P, speed: P.role === 'runner' ? P.speed * boost : P.speed };
    for (const M of FORMS.filter(f => f.level >= 1)) {
      const E = MW.shape(M, slow, M.power > P.power ? 'hunt' : 'prey');
      const a = M.power > P.power ? chasePace(M, Pl) : M.speed, b = M.power > P.power ? chasePace(E, Pl) : E.speed;
      if ((a > Pl.speed) !== (b > Pl.speed) || encounter(Pl, { power: M.power, speed: M.speed, alert: true }) !== encounter(Pl, { power: M.power, speed: E.speed, alert: true })) bad++;
    }
  }
  claim(bad === 0, `the slowest an evolved animal gets (x${MW.SPEED_FLOOR.toFixed(3)}) never changes who is faster or who can eat whom: ${bad} pairs differ`);
  claim(FORMS.every(F => MW.shape(F, Object.values(WORST), 'hunt').power === F.power), 'no trait changes power');
}
{ // the rival, the old animals and the teaching hunter keep their own form
  const { s, F } = scene(7, WORST), f = hunterFor(F), a = put(s, f, 1500, 1500), b = put(s, f, 1600, 1500), c = put(s, f, 1700, 1500); b.old = true; c.teach = true;
  claim(formOf(s, a) !== FORMS[f.id] && formOf(s, b) === FORMS[f.id] && formOf(s, c) === FORMS[f.id], 'old and teaching animals are never evolved (the rival is excluded the same way)');
}

// ---- 3. Habits
const ang = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
function bot(habit, s) {
  const p = s.player, F = me(s); let vx = 0, vy = 0, best = null, bd = Infinity, danger = false, close = Infinity;
  for (const m of s.mobs) {
    const M = formOf(s, m), dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, pw = powerOf(m);
    if (pw > F.power) {
      const [far, half] = sightOf(M), reach = M.range * far * F.stealth + 110, facing = ang(Math.atan2(-dy, -dx), m.a) < half + 0.4;
      if (d < reach * (facing || m.alert ? 1.5 : 0.7)) { const w = (m.alert ? 5 : facing ? 3 : 1.5) * reach / d; vx -= dx / d * w; vy -= dy / d * w; if (m.alert) { danger = true; close = Math.min(close, d); } }
    } else if (pw < F.power && (M.speed <= F.speed || !m.alert) && d < bd) { bd = d; best = m; }
  }
  if (danger) {
    if (habit === 'left') return { x: -1, y: p.x < 120 ? (p.y < 1000 ? 1 : -1) : 0 };
    if (habit === 'zig') { const a = Math.atan2(vy, vx) + (Math.floor(s.tick / 30) % 2 ? 1.1 : -1.1); return { x: Math.cos(a), y: Math.sin(a) }; }
    if (habit === 'creep' && s.cover) {
      const here = patchAt(s.cover, p.x, p.y); if (here) { const d = Math.hypot(here.x - p.x, here.y - p.y) || 1; return { x: (here.x - p.x) / d * 0.3, y: (here.y - p.y) / d * 0.3 }; }
      let g = null, gd = 450; for (const q of s.cover.grass) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < gd) { gd = d; g = q; } }
      if (g) return { x: (g.x - p.x) / gd, y: (g.y - p.y) / gd };
    }
    return { x: vx, y: vy, power: habit === 'power' && close < 320 && powerReady(s) };
  }
  if (best) { const d = Math.hypot(best.x - p.x, best.y - p.y) || 1; vx += (best.x - p.x) / d; vy += (best.y - p.y) / d; }
  return { x: vx, y: vy };
}
const RUN_S = quick ? 60 : 90;
function playRun(habit, seed, L, pick, M, tally) {
  const s = create(seed, stackAt(L, pick), 0, SPAWN_WEIGHTS, true, null, [], { meadow: M ? MW.makeMeadow(M) : null }); let ups = 0, pts = 0;
  for (let i = 0; i < RUN_S * 60 && !s.dead; i++) { step(s, bot(habit, s)); for (const e of s.events) if (e.t === 'eat') pts += e.gain; if (tally) MW.observe(s, tally); if (s.choosing) { choose(s, pick); ups++; } }
  return { ups, pts, died: !!s.dead, secs: s.t };
}
const HABITS = ['left', 'creep', 'power', 'zig'], RUNS = 30, tallies = [], series = {};
// for each trait, the mean over the species that have learned anything on it (|v| > 0.01): how far the animals that changed have moved
const traitMeans = M => MW.TRAITS.map((_, i) => { const l = Object.values(M.sp).map(v => v[i]).filter(v => Math.abs(v) > 0.01); return l.reduce((a, v) => a + v, 0) / (l.length || 1); });
const dist = (a, b) => Math.hypot(...[T.grass, T.stay, T.lead, T.shake].map(i => a[i] - b[i])); // the hunter traits: what habits teach (prey traits follow what you eat)
const t0 = Date.now();
for (const habit of HABITS) for (const rep of [0, 1]) {
  let M = MW.newMeadow(); const hist = [];
  for (let r = 0; r < RUNS; r++) {
    const tally = MW.newTally(); playRun(habit, 7000 + rep * 500 + r + HABITS.indexOf(habit) * 97, 5 + (r % 5), r % 3, M, tally);
    if (tally.time < MW.MIN_RUN) tally.time = MW.MIN_RUN; // a short life still counts here, so every series has 30 generations
    tallies.push(tally); M = MW.advance(M, tally).meadow; hist.push(traitMeans(M));
  }
  series[`${habit}/${rep}`] = { M, hist };
}
console.log(`     habits: ${HABITS.length} habits x 2 series x ${RUNS} runs of up to ${RUN_S} s in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const show = v => MW.TRAITS.map((t, i) => `${t.k} ${v[i].toFixed(2)}`).join(', ');
for (const k in series) console.log(`     ${k.padEnd(8)} after ${RUNS}: ${show(series[k].hist.at(-1))} (${MW.changed(series[k].M).length} species)`);
const mean = h => series[`${h}/0`].hist.at(-1).map((v, i) => (v + series[`${h}/1`].hist.at(-1)[i]) / 2);
const top = (i, h) => HABITS.every(o => o === h || mean(h)[i] > mean(o)[i]);
claim(top(T.grass, 'creep'), 'the player who creeps in grass leaves the meadow that looks into grass most');
claim(top(T.lead, 'left'), 'the player who always flees left leaves the meadow that leads most');
claim(top(T.shake, 'power') || top(T.stay, 'power'), 'the player who always uses the skill leaves the meadow that shakes off stuns, or chases longer, most');
claim(mean('zig')[T.lead] < mean('left')[T.lead] * 0.5, 'a zigzagging player leaves a meadow that leads at most half as much as one who always flees left');
const within = HABITS.map(h => dist(series[`${h}/0`].hist.at(-1), series[`${h}/1`].hist.at(-1))), between = [];
for (const a of HABITS) for (const b of HABITS) if (a < b) between.push(dist(mean(a), mean(b)));
console.log('     distances: ' + HABITS.map((h, i) => `${h} ${within[i].toFixed(2)}`).join(', ') + ' within; ' + HABITS.flatMap(a => HABITS.filter(b => a < b).map(b => `${a}-${b} ${dist(mean(a), mean(b)).toFixed(2)}`)).join(', '));
// Two habits leave measurably different meadows when some trait puts both series of one above both series of the other by MARGIN:
// a split that seed noise did not make. (Overall distance is not used: stay wanders with the few chases a run has, see the NOTES.)
const MARGIN = 0.05;
const apart = (r, a, b) => { // the trait with the widest such gap, or -1
  const at = (h, k) => series[`${h}/${k}`].hist[r], gap = i => Math.max(Math.min(at(a, 0)[i], at(a, 1)[i]) - Math.max(at(b, 0)[i], at(b, 1)[i]), Math.min(at(b, 0)[i], at(b, 1)[i]) - Math.max(at(a, 0)[i], at(a, 1)[i]));
  let best = -1; MW.TRAITS.forEach((_, i) => { if (gap(i) > MARGIN && (best < 0 || gap(i) > gap(best))) best = i; }); return best;
};
const pairs = HABITS.flatMap(a => HABITS.filter(b => a < b).map(b => [a, b])), split = pairs.map(([a, b]) => apart(RUNS - 1, a, b));
claim(split.every(i => i >= 0), `after ${RUNS} runs every two habits leave meadows apart on some trait, both series of one beyond both of the other by ${MARGIN}: ` + pairs.map(([a, b], k) => `${a}/${b} ${split[k] >= 0 ? MW.TRAITS[split[k]].k : 'none'}`).join(', '));
for (let r = 0; r < RUNS; r++) if (pairs.every(([a, b]) => apart(r, a, b) >= 0)) { console.log(`     every two habits first stand apart after run ${r + 1} (GRACE is ${MW.GRACE}: before it the world does not change)`); break; }

// ---- 4. Clear rate
const BAND = [0.75, 1.15]; // stated before any evolved run was measured
{
  // levels climbed a minute in sessions played as the game is played: a death costs a level and play goes on (as bots.mjs section 4)
  const SESSION = quick ? 3 : 5, N = quick ? 6 : 16;
  const rate = (M, from = 9100) => {
    let lv = 0, died = 0;
    for (let k = 0; k < N; k++) {
      const L = 4 + (k % 6), s = create(from + k, stackAt(L, k % 3), 0, SPAWN_WEIGHTS, true, null, [], { meadow: M ? MW.makeMeadow(M) : null });
      for (let i = 0; i < SESSION * 3600 && !s.won; i++) { step(s, bot('plain', s)); if (s.choosing) choose(s, k % 3); if (s.dead) { died++; revive(s, false); } }
      lv += level(s) + s.player.xp / needFor(level(s)) - L;
    }
    return { per: lv / (N * SESSION), died };
  };
  let ownM = MW.newMeadow(); // the competent bot's own meadow: 30 runs of its own play
  for (let r = 0; r < RUNS; r++) { const t = MW.newTally(); playRun('plain', 8000 + r, 5 + (r % 5), r % 3, ownM, t); t.time = Math.max(t.time, MW.MIN_RUN); ownM = MW.advance(ownM, t).meadow; }
  const base = rate(null), own = rate(ownM), worst = rate(fill(WORST, 99)), hunters = rate(fill(HUNTERS, 99)), other = rate(null, 9500);
  console.log(`     seed noise: the plain meadow on other seeds gives ${(other.per / base.per).toFixed(2)} of the first`);
  console.log(`     competent bot, levels climbed a minute over ${N} sessions of ${SESSION} min (a death costs a level): plain ${base.per.toFixed(2)} (${base.died} deaths), its own meadow after ${RUNS} runs ${own.per.toFixed(2)} (${own.died}), every trait at its bound ${worst.per.toFixed(2)} (${worst.died}), hunters' traits at their bounds ${hunters.per.toFixed(2)} (${hunters.died})`);
  const k = r => r.per / base.per, inBand = r => k(r) >= BAND[0] && k(r) <= BAND[1];
  claim([own, worst, hunters].every(inBand), `clear rate stays within ${BAND[0]} to ${BAND[1]} of the plain meadow's (own: ${k(own).toFixed(2)}, every trait at its bound: ${k(worst).toFixed(2)}, hunters at their bounds: ${k(hunters).toFixed(2)})`);
  let least = Infinity; for (const L of [2, 6, 10, 14, 18]) for (let seed = 1; seed <= 5; seed++) least = Math.min(least, catchable(create(seed, stackAt(L), 0, SPAWN_WEIGHTS, false, null, [], { meadow: MW.makeMeadow(fill(WORST, 99)) })).length);
  claim(least >= 8, `food at the strongest corner: at least ${least} catchable animals in a fresh world (bots.mjs asks for 8)`);
}

// ---- 5. 300 runs
{
  let M = MW.newMeadow(), worstStep = 0, out = 0, nan = 0, rnd = 12345; const rand = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
  const extreme = (k) => { const t = MW.newTally(); t.time = 99; for (const f of FORMS.filter(f => f.level >= 2)) { t.hunt[f.name] = { chase: 5, grass: k ? 5 : 0, rock: k ? 0 : 5, tired: k ? 5 : 0, dash: k ? 5 : 0 }; t.prey[f.name] = { met: 9, eaten: k ? 9 : 0 }; t.stun[f.name] = k ? 9 : 0; } t.hx = k ? 99 : 0; t.hy = 0; t.runs = 99; return t; };
  for (let r = 0; r < 300; r++) {
    const t = r % 50 < 10 ? extreme(r % 2) : tallies[Math.floor(rand() * tallies.length)], next = MW.advance(M, t).meadow;
    for (const n in next.sp) next.sp[n].forEach((v, i) => { if (!Number.isFinite(v)) nan++; if (v < MW.TRAITS[i].lo || v > MW.TRAITS[i].hi) out++; worstStep = Math.max(worstStep, Math.abs(v - (M.sp[n]?.[i] ?? 0))); });
    M = next;
  }
  claim(nan === 0 && out === 0 && worstStep <= MW.STEP + 1e-9, `300 runs (real tallies, with bursts of the most extreme possible): no NaN, ${out} values outside bounds, largest step ${worstStep.toFixed(3)} (cap ${MW.STEP})`);
  const again = MW.cleanMeadow(JSON.parse(JSON.stringify(M)));
  claim(JSON.stringify(again.sp) === JSON.stringify(M.sp) && again.runs === 300, 'the meadow survives being stored and read back');
  const junk = MW.cleanMeadow({ v: 1, runs: -3, sp: { Wolf: [9, -9, NaN, 1, 1, 1], Nope: [0, 0, 0, 0, 0, 0], Fox: 'x' }, shown: { Wolf: [99] } });
  claim(junk.runs === 0 && !junk.sp.Nope && !junk.sp.Fox && !junk.sp.Wolf && MW.cleanMeadow({ v: 1, runs: 7, sp: { Wolf: [9, -9, 0, 1, 1, 1] } }).sp.Wolf.join() === '1,-1,0,1,1,1', 'a broken stored meadow is cleaned: bad species and values dropped, the rest clamped');
}
const W = await import('./meadow-words.js');
claim(W.complete(), 'every trait has its words, up and down, in English and Turkish');

console.log(failed ? `evolving meadow: ${failed} check(s) FAILED${MUT ? ' (the mutation was caught, as it should be)' : ''}` : 'evolving meadow: checks pass');
if (MUT || failed) process.exit(failed ? 1 : 0); // as cover-bots.mjs: with a mutation (or a failure) bots.mjs stops here
