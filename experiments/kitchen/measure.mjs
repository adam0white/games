// Scripted players for the Rush shift. node experiments/kitchen/measure.mjs <question> [seeds] [--off] [--tier=N]
// Questions (--who=<plan> picks the catching plan for the wheel question, default impatient):
//   order   whose dish to build: a tray that never moves (in the middle, or parked at one side), anything anyone wants, most impatient, best payer, nearest done, and a mixed rule. --off lets the tray hold everything.
//   wheel   each wheel action used when it should help, against never using the wheel. --off uses it on a random guest
//           at a random moment instead, which shows whether the moment matters.
//   seats   the same cook with 3, 4 and 5 seats (the page uses 3).
//   targets coins a shift by rank for a new and a good cook (TARGETS in shift.js was set from this).
// The players use the page's own calls (shift.js) and the real catch (sim.js). Cooking time is a model: see cookSecs.
import * as sim from './sim.js';
import * as sh from './shift.js';

const args = process.argv.slice(2), question = args.find(a => !a.startsWith('-') && isNaN(a)) ?? 'order';
const seeds = Number(args.find(a => !isNaN(a))) || 40, off = args.includes('--off');
const tierArg = args.find(a => a.startsWith('--tier=')), TIER = tierArg ? Number(tierArg.slice(7)) : 0;
const whoArg = args.find(a => a.startsWith('--who=')), WHO = whoArg ? whoArg.slice(6) : 'impatient';   // the catching plan under the wheel question
const nightArg = args.find(a => a.startsWith('--night=')), NIGHT = nightArg ? nightArg.slice(8) : 'rush';   // which night (order question)

export const COOKS = { new: { react: 0.45, skill: 0.6, q: 0.74, slow: 1.45, fight: 0.6 }, good: { react: 0.25, skill: 0.9, q: 0.93, slow: 1, fight: 0.85 } };
export const OVERHEAD = 0.5; // seconds a dish costs besides its cooking steps. Checked against the page: ten dishes timed in a browser came within 1.2 s of cookSecs.

export function saveAt(tier, tables = null) {
  const s = sim.newSave(); s.tutorial = true; s.tier = tier;
  for (let t = 1; t <= tier; t++) for (const [k, v] of Object.entries(sim.TIERS[t].needs)) s.built[k] = Math.max(s.built[k], v);
  s.built.tray = Math.max(s.built.tray, Math.min(9, tier + 1));
  if (tables != null) s.built.tables = tables;
  return s;
}
export function cookSecs(save, recipe, cook) {
  const r = sim.RECIPES[recipe]; let t = 0;
  for (const s of r.steps) {
    if (s === 'chop') t += sim.chopsFor(recipe) * sim.chopCuts(save) * 0.52 + 0.8;
    if (s === 'fry') t += 0.62 / sim.FRY_RATE + 1.2;
    if (s === 'micro') t += 0.7 / sim.microSpeed(save.tier) + 1.2;
    if (s === 'blend') t += sim.blendTaps(save.built.blender, save.tier) / 6 + 1;
  }
  return t * cook.slow;
}
const perItem = 2.4; // rough seconds to get one wanted item onto the tray
const estSecs = (e) => sh.leftOf(e) * perItem;

// Whose dish to build. Each rule sees what the player sees: the seated guests, their patience, what they lack, their price.
export const POLICY = {
  idle: () => null,     // the tray never moves
  park: () => null,     // the tray sits at one side and never moves
  greedy: () => null,   // no plan: catch anything anyone wants
  impatient: s => s.line.reduce((a, e) => (!a || e.left < a.left ? e : a), null),
  payer: s => s.line.reduce((a, e) => (!a || e.price > a.price ? e : a), null),
  nearest: s => s.line.reduce((a, e) => (!a || sh.leftOf(e) < sh.leftOf(a) || (sh.leftOf(e) === sh.leftOf(a) && e.left < a.left) ? e : a), null),
  // Mixed: give up on anyone who cannot be saved; among the rest, build the best coins per second of catching, and
  // put a guest first when they are about to be lost and can still be saved.
  mixed: s => {
    const can = s.line.filter(e => e.left > estSecs(e));
    if (!can.length) return POLICY.nearest(s);
    const urgent = can.filter(e => e.left < estSecs(e) + 9).sort((a, b) => a.left - b.left)[0];
    if (urgent) return urgent;
    return can.reduce((a, e) => (!a || e.price / (sh.leftOf(e) + 1) > a.price / (sh.leftOf(a) + 1) ? e : a), null);
  },
  // Two more adaptive rules, tried against the fixed plans (the reviewers' gate). Both read what a player can see.
  // slack: earliest deadline first, but only among guests who can still be saved; drop a guest the moment they cannot.
  slack: s => {
    const can = s.line.filter(e => e.left > estSecs(e) + 2);
    return (can.length ? can : s.line).reduce((a, e) => (!a || e.left - estSecs(e) < a.left - estSecs(a) ? e : a), null);
  },
  // worth: coins a second of the work left (catching and cooking), with the buzz in mind: when the buzz is high, never
  // let anyone walk, so the most impatient savable guest comes first.
  worth: (s, save, cook) => {
    const can = s.line.filter(e => e.left > estSecs(e) + 2); if (!can.length) return POLICY.nearest(s);
    if (s.buzz >= 3 || s.strikes >= 2) return can.reduce((a, e) => (!a || e.left < a.left ? e : a), null);
    return can.reduce((a, e) => { const v = x => x.price / (estSecs(x) + (save && cook ? cookSecs(save, x.recipe, cook) : 6)); return !a || v(e) > v(a) ? e : a; }, null);
  },
};

// When a scripted player uses each wheel action. Each returns the guest to use it on, or nothing.
const doomed = e => e.left < 6 && e.left < estSecs(e) * 0.6 && !(e.frozen > 0);
export const USE = {
  kick_out: s => s.line.find(doomed),
  slap: s => s.line.find(e => e.left < 10 && !(e.frozen > 0)),
  fridge: s => s.line.length >= 3 ? s.line.find(e => e.left < 12 && !(e.frozen > 0)) : null,
  pan: s => (s.buzz >= 3 && !(s.calm > 0) ? s.line[0] : null),
  microwave: s => s.line.find(e => e.mood),
  cook_self: (s, save, cook) => s.line.find(e => !e.self && cookSecs(save, e.recipe, cook) >= 7 && e.left > estSecs(e)),
  lock_out: s => (s.line.length >= s.seats && s.buzz >= 4 ? s.line[0] : null),
  trash: s => s.line.find(e => sh.leftOf(e) >= 3 && e.left < estSecs(e) * 1.3),
  rob: s => (s.strikes < sh.RUSH.strikes - 1 ? s.line.find(doomed) : null),
  hire: s => (s.t < 25 && s.line.length ? s.line.reduce((a, e) => (e.price < a.price ? e : a)) : null),
  fight: s => s.line.find(e => e.kind === 'rich' && !e.fought && e.left > estSecs(e) + 6),
};
// One shift. who: the rule for whose dish to build. use: a wheel action id, or null. random: use it at random instead.
export function playShift({ save, seed, cook, who = 'greedy', use = null, random = false, once = false, trig = {}, off = {}, night = 'rush', mission = null }) {
  const s = sh.newShift({ save, seed, off, night, mission }), c = s.sky;
  const r = sim.rng(seed * 31 + 7), seen = []; let busy = 0, job = null, x = who === 'park' ? 0.8 : 0, step = 0, focus = null, think = 0, acted = false;
  const uses = use == null ? [] : [].concat(use);
  for (let i = 0; i < 60 * 600 && !s.over; i++) {
    step++;
    if (busy > 0) { sh.stepShift(s, sim.DT, x); busy -= sim.DT; if (busy <= 0 && job) { job(); job = null; seen.length = 0; } continue; }
    const ready = s.line.filter(e => e.ready).sort((a, b) => a.left - b.left)[0];
    if (ready) { sh.startCook(s, ready); const q = Math.max(0.3, Math.min(1, cook.q + (r() - 0.5) * 0.3)); busy = cookSecs(save, ready.recipe, cook) + OVERHEAD; job = () => sh.finish(s, q); continue; }
    for (const use of (uses.length && s.nerve > 0 ? uses : [])) {
      if (once && s.acts[use]) continue;
      const e = random ? (r() < 0.004 && s.line.length ? s.line[Math.floor(r() * s.line.length)] : null) : (trig[use] ?? USE[use])(s, save, cook);
      if (e && sh.canAct(s, e, use)) {
        if (use === 'fight') { s.hold = true; busy = 3.5; const won = r() < cook.fight; job = () => { s.hold = false; sh.act(s, e, use, won); }; }   // as on the page: nothing is caught during the fight, and it counts only if they are still seated
        else { sh.act(s, e, use); busy = 1; }
        acted = true; break;
      }
    }
    if (acted) { acted = false; continue; }
    if ((think -= sim.DT) <= 0 || !s.line.includes(focus)) { focus = POLICY[who](s, save, cook); think = 0.8; }   // a person re-plans about once a second
    seen.push(c.items.map(it => ({ ...it })));
    const view = seen[Math.max(0, seen.length - 1 - Math.round(cook.react * 60))];
    const wantedBy = (it, e) => !sim.isJunk(it.id) && sh.lacks(e, it.id);
    const anyWants = it => s.line.some(e => wantedBy(it, e));
    const room = c.tray.length < s.holds - (focus ? sh.leftOf(focus) : 0);
    const mine = it => (focus ? (sh.ownerOf(s, it.id) === focus) : anyWants(it));
    const good = it => mine(it) || (focus && room && anyWants(it));
    const goals = view.filter(mine).sort((a, b) => a.y - b.y), also = view.filter(good).sort((a, b) => a.y - b.y);
    const low = (focus ? goals : goals.filter(it => it.y <= goals[0].y + 0.05).sort((p, q) => Math.abs(p.x - x) - Math.abs(q.x - x)));
    let target = low.length ? low[0].x : also.length ? also[0].x : x;
    for (const it of view) {
      if (good(it) || it.y > 0.35) continue;
      if (Math.abs(it.x - target) < c.half + sim.TUNE.size * 0.6) target = it.x + Math.sign(target - it.x || 1) * (c.half + sim.TUNE.size + 0.05);
    }
    target += Math.sin(step * 0.13 + seed) * (1 - cook.skill) * 0.25;
    const move = sim.TUNE.traySpeed * sim.DT;
    if (who !== 'idle' && who !== 'park') x += Math.max(-move, Math.min(move, target - x));
    sh.stepShift(s, sim.DT, x);
  }
  return { ...sh.result(s), secs: s.t, clatters: s.clatters, pushed: s.pushed, used: uses.reduce((n, id) => n + (s.acts[id] ?? 0), 0), done: Object.fromEntries(Object.keys(sh.MISSIONS).map(id => [id, sh.missionDone(s, id)])) };   // every mission is checked on every shift, shown or not
}

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) * p)];
export function table(rows, runs) {
  return rows.map(([name, opts]) => {
    const out = runs.map(seed => playShift({ ...opts, seed }));
    return { name, coins: +mean(out.map(o => o.coins)).toFixed(1), p25: pct(out.map(o => o.coins), 0.25), p75: pct(out.map(o => o.coins), 0.75), served: +mean(out.map(o => o.served)).toFixed(1), strikes: +mean(out.map(o => o.strikes)).toFixed(2), closedEarly: +mean(out.map(o => +o.closedEarly)).toFixed(2), turned: +mean(out.map(o => o.turned)).toFixed(1), buzz: +mean(out.map(o => o.bestBuzz)).toFixed(1), stars: +mean(out.map(o => o.stars)).toFixed(2), robbed: +mean(out.map(o => o.robbed)).toFixed(1), used: +mean(out.map(o => o.used)).toFixed(1), pushed: +mean(out.map(o => o.pushed)).toFixed(1), clat: +mean(out.map(o => o.clatters)).toFixed(1), secs: +mean(out.map(o => o.secs)).toFixed(0) };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runs = Array.from({ length: seeds }, (_, i) => 101 + i * 37);
  const save = saveAt(TIER);
  if (!sh.nightsFor(save).includes(NIGHT)) { console.error(`${NIGHT} is not open at rank ${TIER}`); process.exit(1); }
  if (question === 'order') {
    const o = off ? { cap: true } : {};
    for (const who of ['good', 'new']) { console.log(`order, ${who} cook, rank ${TIER}, ${NIGHT}${off ? ', tray holds everything' : ''}`); console.table(table(Object.keys(POLICY).map(p => [p, { save, cook: COOKS[who], who: p, off: o, night: NIGHT }]), runs).map(({ name, coins, p25, p75, served, strikes, closedEarly, stars }) => ({ name, coins, p25, p75, served, strikes, closedEarly, stars }))); }
  } else if (question === 'wheel') {
    for (const who of ['good', 'new']) {
      console.log(`wheel, ${who} cook, rank ${TIER}, ${NIGHT}, plan ${WHO}${off ? ', used at random' : ''}`);
      const rows = table([['never', { save, cook: COOKS[who], who: WHO, night: NIGHT }], ...sh.ACTS.map(id => [id, { save, cook: COOKS[who], who: WHO, use: id, random: off, night: NIGHT }])], runs);
      console.table(rows.map(({ name, coins, served, strikes, closedEarly, used, stars }) => ({ name, coins, 'vs never': +(coins - rows[0].coins).toFixed(1), served, strikes, closedEarly, used, stars })));
    }
  } else if (question === 'missions') {
    // Each mission with three plans on the same seeds: ignore it, play for it, park the tray. Then every wheel action
    // at random, to find a free route. Cells: both nights, a new and a good cook, the night's first rank and rank 10.
    const any = s => s.line[0] ?? null, soon = id => (s, save, cook) => USE[id](s, save, cook) ?? (s.t > 45 ? any(s) : null);
    const BUILT = {
      seat: { use: ['lock_out', 'kick_out'], trig: { lock_out: s => (s.line.length >= s.seats ? any(s) : null), kick_out: s => (s.line.length >= s.seats && !(s.locked > 0) ? s.line.reduce((a, e) => (e.left < a.left ? e : a)) : null) } },
      trio: { use: ['pan', 'hire', 'fridge', 'slap', 'trash'], once: true, trig: { pan: any, hire: s => (s.line.length >= 2 ? s.line.reduce((a, e) => (e.price < a.price ? e : a)) : null), fridge: any } },
      ...Object.fromEntries(sh.ACTS.map(id => ['use_' + id, { use: [id], once: true, trig: { [id]: soon(id) } }])),
    };
    const ids = Object.keys(sh.MISSIONS), cells = [], pctOf = (out, id) => Math.round(100 * mean(out.map(o => +o.done[id])));
    for (const night of sh.NIGHT_IDS) for (const hi of [0, 1]) for (const who of ['new', 'good']) {
      const cell = { name: `${night} ${hi ? 'top' : 'first'} ${who}`, who, rows: {} }, memo = {};
      for (const id of ids) {
        const tier = hi ? sim.TIERS.length - 1 : Math.max(sh.NIGHTS[night].from, sh.MISSIONS[id].from ?? 0);
        const base = { save: saveAt(tier), cook: COOKS[who], who: who === 'good' ? 'impatient' : 'greedy', night };
        const run = o => runs.map(seed => playShift({ ...base, ...o, seed }));
        const { ign, park, idle, rnd } = memo[tier] ??= { ign: run({}), park: run({ who: 'park' }), idle: run({ who: 'idle' }), rnd: Object.fromEntries(sh.ACTS.map(a => [a, run({ use: a, random: true })])) };
        const b = run({ ...BUILT[id], mission: id });   // as on the page: the shift knows its mission
        cell.rows[id] = { rank: tier, ignore: pctOf(ign, id), built: pctOf(b, id), park: Math.max(pctOf(park, id), pctOf(idle, id)), coins: Math.round(mean(b.map(o => o.coins)) - mean(ign.map(o => o.coins))), random: Math.max(...sh.ACTS.filter(a => 'use_' + a !== id).map(a => pctOf(rnd[a], id))) };
      }
      cells.push(cell);
    }
    for (const id of ids) {
      console.log(`mission ${id}`);
      console.table(cells.map(c => ({ cell: c.name, ...c.rows[id] })));
      const pair = (n, t) => [cells.find(c => c.name === `${n} ${t} new`).rows[id].built, cells.find(c => c.name === `${n} ${t} good`).rows[id].built];
      const pass = { 'ignore<30': cells.filter(c => c.rows[id].ignore < 30).length, 'built+20': cells.filter(c => c.rows[id].built >= c.rows[id].ignore + 20).length, 'good>=new': 2 * sh.NIGHT_IDS.flatMap(n => ['first', 'top'].map(t => pair(n, t))).filter(([a, b]) => b >= a).length, 'park<5': cells.filter(c => c.rows[id].park < 5).length, 'random<=built': cells.filter(c => c.rows[id].random <= c.rows[id].built).length, trade: cells.filter(c => c.rows[id].coins < 0).length };
      console.log(JSON.stringify(pass), Object.entries(pass).slice(0, 5).every(([, n]) => n >= 6) ? 'PASS' : 'fail');
    }
  } else if (question === 'seats') {
    for (const who of ['good', 'new']) { console.log(`seats, ${who} cook, rank ${TIER}`); console.table(table([3, 4, 5].map(n => [`${n} seats`, { save, cook: COOKS[who], who: 'impatient', off: { seats: n } }]), runs)); }
  } else if (question === 'nights') {
    // Which night pays most, for four kinds of player: a new or a good cook, with the tray two levels down or as built.
    const out = [];
    for (const who of ['new', 'good']) for (const tray of ['low', 'built']) {
      const sv = saveAt(TIER); if (tray === 'low') sv.built.tray = Math.max(1, sv.built.tray - 2);
      const rows = table(sh.nightsFor(sv).map(n => [n, { save: sv, cook: COOKS[who], who: who === 'good' ? 'impatient' : 'greedy', night: n }]), runs);
      for (const r of rows) r.perMin = +(r.coins / r.secs * 60).toFixed(0);
      const best = rows.reduce((a, b) => (b.perMin > a.perMin ? b : a));
      for (const r of rows) out.push({ player: `${who}, tray ${tray}`, night: r.name, coins: r.coins, perMin: r.perMin, served: r.served, strikes: r.strikes, closedEarly: r.closedEarly, secs: r.secs, best: r === best ? '<' : '' });
    }
    console.log(`nights, rank ${TIER}`); console.table(out);
  } else if (question === 'targets') {
    const rows = [];
    for (const night of sh.NIGHT_IDS) for (let t = sh.NIGHTS[night].from; t < sim.TIERS.length; t++) for (const who of ['new', 'good']) {
      const [a] = table([[`${night} ${sim.TIERS[t].name} ${who}`, { save: saveAt(t), cook: COOKS[who], who: who === 'good' ? 'impatient' : 'greedy', night }]], runs);
      rows.push({ name: a.name, coins: a.coins, p25: a.p25, p75: a.p75, served: a.served, strikes: a.strikes, closedEarly: a.closedEarly, stars: a.stars, targets: sh.targets(saveAt(t), night).join('/') });
    }
    console.table(rows);
  }
}
