// Sky Kitchen: the Rush shift. Rules only, no window and no document: the page (main.js) and the scripted players
// (measure.mjs) drive a shift through the same calls: newShift, stepShift, startCook, finish, rob, result.
// A Rush is one shift on a clock with one shared sky: every seated guest's ingredients fall at once, the tray holds only
// so much, and what you choose to catch decides whose dish gets made. More guests come than one cook can serve.
import * as sim from './sim.js';

export const RUSH = {
  secs: 120,               // doors open this long; whoever is seated at the bell can still be served
  open: 2,                 // guests already seated when the doors open
  arrive: [7, 11],         // seconds between arrivals (drawn evenly), shorter at higher ranks (arriveCut a rank)
  arriveCut: 0.25,
  patience: [46, 62],      // seconds a seated guest waits (drawn evenly); moods and big spenders wait less
  perItem: 7, perStep: 5, perRank: 2.5,   // extra seconds of patience for each item past three, each cook step past one, each rank
  richShare: 0.22,         // a big spender pays richPay times the price and has richWait of the patience
  richPay: 2.2, richWait: 0.7,
  buzzMax: 5, buzzStep: 0.12,  // each guest served adds a step of buzz; each step adds this share to the pay
  strikes: 3,              // walkouts that close the doors early
  tipSteps: [[0.5, 1], [0.2, 0.5], [0, 0]],   // patience left when the cooking starts -> share of the full tip
  tipByStars: [0, 0.1, 0.3, 0.6],
  robTake: 0.6,            // rob: share of the price at once; it is a strike, the buzz is gone ...
  robScare: 9,             // ... and every other seated guest loses this many seconds of patience
  fork: 1.0,               // seconds between forks: two items fall together, too far apart to catch both on a small tray
  forkGap: [1.0, 1.15],    // lane units between the two
  decoy: 0.18,             // share of fork sides that hold something nobody wants (more with hardness)
  nerve: 3,                // wheel actions a shift
  freeze: 25, calm: 15, lock: 18, hireHolds: 2, selfQuality: 0.62, fightPay: 2, trashWait: 12,   // what the wheel actions do (see act)
  trayBase: 3,             // the tray holds trayBase + tray level items; one more pushes the oldest off
};
export const trayHolds = save => RUSH.trayBase + save.built.tray;
// Three seats at every rank for now. Measured with scripted players, a fourth and fifth seat lowered takings and
// closed the doors early (NOTES.md), so the Tables build does not add Rush seats until a seat is worth having.
export const seatsFor = () => 3;
// Nights: a Rush with one rule changed. Each has its own stars. `from` is the rank that opens it. Two more were tried and
// dropped (a Banquet and a Critics' night; NOTES.md has the numbers).
//   lunch    quick dishes only, all at one set price (the average of the whole menu at this rank), a shorter shift,
//            guests come faster and wait less
export const NIGHTS = {
  rush: { from: 0 },
  lunch: { from: 1, secs: 90, menu: 'quick', arrive: 0.6, patience: 0.62, setPrice: true },
};
export const NIGHT_IDS = Object.keys(NIGHTS);
export const nightsFor = save => NIGHT_IDS.filter(id => NIGHTS[id].from <= save.tier);
const size = id => sim.chopsFor(id) + 2 * (sim.RECIPES[id].steps.length - 1);   // items to catch, and two for each extra cooking step
export function nightMenu(save, night) {
  const all = sim.menuFor(save), kind = NIGHTS[night]?.menu;
  if (!kind) return all;
  const by = all.slice().sort((a, b) => size(a) - size(b) || sim.RECIPES[a].price - sim.RECIPES[b].price), n = Math.max(3, Math.ceil(all.length / 3));
  return kind === 'quick' ? by.slice(0, n) : by.slice(-n);
}
export const setPriceFor = save => { const all = sim.menuFor(save); return Math.round(all.reduce((n, id) => n + priceOf(save, id), 0) / all.length); };
export const priceOf = (save, recipe) => Math.round(sim.RECIPES[recipe].price * (1 + 0.15 * save.tier));

// off: switches for measure.mjs (--off). drain: patience does not run down. cap: the tray holds everything.
// scare: rob has no witnesses. buzz: no buzz pay.
export function newShift({ save, seed = 1, off = {}, night = 'rush', mission = null }) {
  const N = NIGHTS[night] ?? NIGHTS.rush;
  const sky = sim.newCatch({ need: {}, hard: sim.hardness(save), trayLevel: save.built.tray, seed: seed ^ 0x736b79, twist: sim.twistFor(save.tier) });
  if (sky.twist?.gust) sky.twist = { ...sky.twist, gust: 0 };   // a gust slides the whole sky sideways, which carries one side of every pair onto a tray that never moved
  sky.shared = true; sky.next = 1e9;   // the shift drops its own forks (dropFork); the catch's own spawner stays off
  return {
    save, seed, off, night: NIGHTS[night] ? night : 'rush', N, secs: N.secs ?? RUSH.secs, r: sim.rng(seed ^ 0x52757368), t: 0, doors: true, over: false,
    line: [], at: null, seq: 0, nextArrive: 0, seats: off.seats ?? seatsFor(save), menu: nightMenu(save, night), setPrice: N.setPrice ? setPriceFor(save) : null, sky, holds: off.cap ? 99 : trayHolds(save),
    skyNext: 0.5, coins: 0, tips: 0, served: 0, robbed: 0, strikes: 0, turned: 0, buzz: 0, bestBuzz: 0, stars: [], lastRecipe: null, clatters: 0, pushed: 0,
    nerve: off.nerve ?? RUSH.nerve, calm: 0, locked: 0, hold: false, hired: false, acts: {}, won: 0, mission: MISSIONS[mission] ? mission : null,
  };
}

function makeGuest(s) {
  const r = s.r, tier = s.save.tier;
  const from = s.menu.filter(id => id !== s.lastRecipe);
  const recipe = (from.length ? from : s.menu)[Math.floor(r() * (from.length || s.menu.length))];
  s.lastRecipe = recipe;
  const kind = r() < RUSH.richShare ? 'rich' : null;
  const mood = tier >= sim.MOOD_FROM && !kind && r() < 0.18 ? sim.MOODS[Math.floor(r() * sim.MOODS.length)] : null;
  let full = RUSH.patience[0] + r() * (RUSH.patience[1] - RUSH.patience[0]);
  full += RUSH.perItem * Math.max(0, sim.chopsFor(recipe) - 3) + RUSH.perStep * (sim.RECIPES[recipe].steps.length - 1) + RUSH.perRank * tier;   // bigger dishes buy more patience
  if (kind === 'rich') full *= RUSH.richWait;
  if (mood === 'rude') full *= 0.8;
  full *= s.N.patience ?? 1;
  full = Math.round(full);
  return { n: s.seq++, recipe, kind, mood, look: Math.floor(r() * 8), full, left: full, need: { ...sim.RECIPES[recipe].need }, got: {}, ready: false,
    price: Math.round((s.setPrice ?? priceOf(s.save, recipe)) * (kind === 'rich' ? RUSH.richPay : 1)) };
}
// A fork: two things fall together, far apart. Each side is something a different seated guest lacks (when two guests
// lack something), or now and then something nobody wants. The player's tray goes one way or the other.
function dropFork(s) {
  const c = s.sky, r = s.r, open = s.line.filter(e => leftOf(e) > 0);
  if (!open.length) return;
  const pickId = e => { const ids = Object.keys(e.need).filter(id => lacks(e, id)); return ids[Math.floor(r() * ids.length)]; };
  const a = open[Math.floor(r() * open.length)], rest = open.filter(e => e !== a), b = rest.length ? rest[Math.floor(r() * rest.length)] : null;
  const decoyShare = s.calm > 0 ? 0 : Math.min(0.4, RUSH.decoy + 0.02 * c.hard);
  const ids = [pickId(a), b ? pickId(b) : null].map(id => (id == null ? (s.calm > 0 ? pickId(a) : c.others[Math.floor(r() * c.others.length)]) : r() < decoyShare ? c.others[Math.floor(r() * c.others.length)] : id));
  if (ids.every(id => !open.some(e => lacks(e, id)))) ids[0] = pickId(a);   // never two decoys
  // One falls each side of the middle, each farther out than a tray left in the middle can reach: every pair is a side to pick.
  const lim = sim.TUNE.lane - sim.TUNE.size, near = Math.min(lim - 0.04, c.half + sim.TUNE.size + 0.04);
  const side = () => near + r() * (lim - near), xs = r() < 0.5 ? [-side(), side()] : [side(), -side()];
  const vy = c.fall * (0.95 + r() * 0.1);
  ids.forEach((id, i) => { c.items.push({ n: c.seq++, id, x: xs[i], x0: xs[i], y: sim.TUNE.start, vy, drift: 0, phase: 0, spin: r() * 6.28, state: 'fall', fork: c.seq }); c.spawned++; });
}
export const lacks = (e, id) => (e.got[id] ?? 0) < (e.need[id] ?? 0);
export const leftOf = e => Object.entries(e.need).reduce((n, [k, v]) => n + Math.max(0, v - (e.got[k] ?? 0)), 0);
// Who a caught item goes to: the seated guest who still lacks it and has the least patience left.
export const ownerOf = (s, id) => s.line.filter(e => lacks(e, id)).reduce((a, e) => (!a || e.left < a.left ? e : a), null);
// The sky drops what the seated guests still lack, so the catch sees their needs added together.
function sync(s) {
  const c = s.sky, need = {}, got = {};
  for (const e of s.line) for (const [k, v] of Object.entries(e.need)) { need[k] = (need[k] ?? 0) + v; got[k] = (got[k] ?? 0) + (e.got[k] ?? 0); }
  c.need = need; c.got = got; c.done = false;
  c.others = Object.keys(sim.ING).filter(id => !(id in need));
  if (c.hard >= sim.TUNE.junkFrom) c.others.push(...Object.keys(sim.JUNK));
  c.tray = c.tray.filter(it => s.line.includes(it.owner));
}
function unseat(s, e) { s.line.splice(s.line.indexOf(e), 1); sync(s); }

// Moves the shift on. trayX: where the player's tray is. Returns events: arrive {e}, turned {e} (no seat), walkout {e},
// bell (doors close on time), closed (three strikes), over; and from the sky: caught {it, e}, pushed {it, e} (the tray was
// full; the oldest item of another guest fell off), clatter {it, lost} (nobody wants this), ready {e}, missed {it}.
export function stepShift(s, dt, trayX = 0) {
  const ev = [];
  if (s.over) return ev;
  s.t += dt;
  if (s.doors) {
    if (s.t >= s.secs) { s.doors = false; ev.push({ type: 'bell' }); }
    else {
      if (s.locked > 0) s.locked -= dt; else s.nextArrive -= dt;   // a locked door: nobody comes, nobody is turned away
      while (s.nextArrive <= 0 && s.doors) {
        const early = s.seq + 1 < RUSH.open;   // the opening guests come together; the next one comes at the usual pace
        s.nextArrive += early ? 0.8 : (s.N.arrive ?? 1) * Math.max(3.5, RUSH.arrive[0] - RUSH.arriveCut * s.save.tier + s.r() * (RUSH.arrive[1] - RUSH.arrive[0]));
        const e = makeGuest(s);
        if (s.line.length >= s.seats) { s.turned++; s.buzz = Math.max(0, s.buzz - 1); ev.push({ type: 'turned', e }); }
        else { s.line.push(e); sync(s); ev.push({ type: 'arrive', e }); }
      }
    }
  }
  if (s.calm > 0) s.calm -= dt;
  for (const e of s.line.slice()) {
    if (e.frozen > 0) { e.frozen -= dt; continue; }   // in the fridge: no patience lost
    if (s.off.drain) continue;
    e.left -= dt;
    if (e.left <= 0) {
      unseat(s, e); s.strikes++; s.buzz = 0; ev.push({ type: 'walkout', e });
      if (s.doors && s.strikes >= RUSH.strikes) { s.doors = false; s.closedEarly = true; ev.push({ type: 'closed' }); }
    }
  }
  // An empty room has nothing falling: what was in the air belonged to guests who are gone.
  if (!s.line.length && s.sky.items.length) { for (const it of s.sky.items) ev.push({ type: 'missed', it }); s.sky.items = []; }
  // The sky stops while the cook is at the counter.
  if (!s.at && !s.hold && s.line.length) {
    const c = s.sky;
    c.next = 1e9; if ((s.skyNext -= dt) <= 0) { s.skyNext += RUSH.fork; dropFork(s); }
    // stepCatch credits by the summed need; sort out here whose item it is.
    for (const x of sim.stepCatch(c, trayX, dt)) {
      if (x.type === 'done') continue;
      if (x.type === 'missed') { ev.push(x); continue; }
      const it = x.it;
      if (x.type === 'extra') {
        // Nobody wants this: it knocks the newest item off the tray and costs a step of buzz.
        c.extra = null; c.tray = c.tray.filter(y => y !== it);
        const lost = c.tray.pop() ?? null;
        if (lost) { lost.owner.got[lost.id]--; lost.owner.ready = false; }
        s.buzz = Math.max(0, s.buzz - 1); s.clatters++;
        ev.push({ type: 'clatter', it, lost });
      } else {
        const e = ownerOf(s, it.id); it.owner = e; e.got[it.id] = (e.got[it.id] ?? 0) + 1;
        ev.push({ type: 'caught', it, e });
        if (c.tray.length > s.holds) {
          const k = c.tray.findIndex(y => y.owner !== e), out = c.tray.splice(k < 0 ? 0 : k, 1)[0];
          out.owner.got[out.id]--; out.owner.ready = false; s.pushed++;
          ev.push({ type: 'pushed', it: out, e: out.owner });
        }
        if (leftOf(e) === 0 && !e.ready) {
          if (e.self) { e.tipShare = 0; unseat(s, e); s.at = e; const buzz = s.buzz, best = s.bestBuzz; ev.push({ type: 'selfserved', e, bill: finish(s, RUSH.selfQuality) }); s.buzz = buzz; s.bestBuzz = best; }   // told to cook it themselves
          else { e.ready = true; ev.push({ type: 'ready', e }); }
        }
      }
      sync(s);
    }
    c.done = false;
  }
  if (!s.doors && !s.line.length && !s.at) { s.over = true; ev.push({ type: 'over' }); }
  return ev;
}

// Take a ready guest's food to the stove. Their seat frees, their clock stops, and how long they waited sets the tip.
export function startCook(s, e) {
  if (s.at || !s.line.includes(e) || !e.ready) return false;
  tipFor(e);
  unseat(s, e); s.sky.items = s.sky.items.filter(it => it.y > 0.5); s.at = e; return true;
}
const tipFor = e => { const f = e.left / e.full; e.tipShare = RUSH.tipSteps.find(([min]) => f >= min)[1]; };
export const buzzPay = s => (s.off.buzz ? 1 : 1 + RUSH.buzzStep * s.buzz);

// What the guest at the counter would pay for a dish of this quality (0 to 1). Does not change the shift.
export function quote(s, e, quality) {
  const stars = sim.dishStars(quality);
  let tip = e.price * RUSH.tipByStars[stars] * (1 + 0.1 * (s.save.built.decor - 1)) * (e.tipShare ?? 1) * (e.tipMul ?? 1);
  let price = e.price, thrown = false;
  if (e.mood === 'rude') { tip = 0; thrown = stars < 3; }
  if (e.mood === 'picky' && stars < 3) tip = 0;
  if (e.mood === 'sneaky') { price = Math.ceil(price / 2); tip = 0; }
  const m = buzzPay(s) * (s.N.pay ?? 1);
  return { stars, price: Math.round(price * m), tip: Math.round(tip * m), total: Math.round(price * m) + Math.round(tip * m), thrown };
}
// The dish is served: the guest pays, the buzz grows.
export function finish(s, quality) {
  const e = s.at; if (!e) return null;
  const b = quote(s, e, quality);
  s.coins += b.total; s.tips += b.tip; s.served++; s.stars.push(b.stars);
  s.buzz = Math.min(RUSH.buzzMax, s.buzz + 1); s.bestBuzz = Math.max(s.bestBuzz, s.buzz);
  s.at = null; return b;
}
// The wheel in a Rush. Each action does one different thing and each has a price. A shift has RUSH.nerve of them.
//   kick_out   the guest leaves: no strike, no pay, one step of buzz
//   slap       their patience is full again; their tip is halved
//   fridge     25 s in the fridge: no patience lost, and the tip stays where it was
//   pan        bang it: everything in the air that nobody ordered is gone, and none falls for 15 s
//   microwave  a moody guest turns calm and tips half as much again
//   cook_self  they cook it themselves: when their food is caught they are served at once, for the price alone:
//              no tip, and no buzz, because the kitchen did nothing
//   lock_out   the door is locked for 18 s: nobody comes and nobody is turned away
//   trash      their order goes in the bin: they get the smallest dish on the menu instead, and wait a little longer
//   rob        their coins now: a strike, the buzz is gone and the room saw it
//   hire       they join the staff (no pay): the tray holds two more for the rest of the shift; once a shift
//   fight      win and they pay double; lose and they storm out, which is a strike
export const ACTS = ['kick_out', 'slap', 'fridge', 'pan', 'microwave', 'cook_self', 'lock_out', 'trash', 'rob', 'hire', 'fight'];
export function canAct(s, e, id) {
  if (s.over || s.nerve <= 0 || s.at || !s.line.includes(e) || e.ready || !ACTS.includes(id)) return false;
  if (id === 'microwave') return !!e.mood;
  if (id === 'slap') return e.left < e.full * 0.9;   // nothing to wake up yet
  if (id === 'cook_self') return !e.self;
  if (id === 'fridge') return !(e.frozen > 0);
  if (id === 'hire') return !s.hired;
  if (id === 'lock_out') return s.doors && !(s.locked > 0);
  if (id === 'trash') return !!smallest(s, e);
  if (id === 'fight') return !e.fought;
  return true;
}
const smallest = (s, e) => s.menu.filter(id => id !== e.recipe && sim.chopsFor(id) < sim.chopsFor(e.recipe)).sort((a, b) => sim.RECIPES[a].steps.length - sim.RECIPES[b].steps.length || sim.chopsFor(a) - sim.chopsFor(b))[0] ?? null;
const less = (s, n = 1) => { s.buzz = Math.max(0, s.buzz - n); };
// won: only for fight, the result of the tap fight. Returns null when it cannot be done, else what happened.
export function act(s, e, id, won = false) {
  if (!canAct(s, e, id)) return null;
  s.nerve--; s.acts[id] = (s.acts[id] ?? 0) + 1;
  const out = { id, gone: false, closed: false, coins: 0 };
  const strike = () => { s.strikes++; s.buzz = 0; if (s.doors && s.strikes >= RUSH.strikes) { s.doors = false; s.closedEarly = true; out.closed = true; } };
  if (id === 'kick_out') { unseat(s, e); less(s); out.gone = true; }
  else if (id === 'slap') { e.left = e.full; e.tipMul = (e.tipMul ?? 1) * 0.5; }
  else if (id === 'fridge') e.frozen = RUSH.freeze;
  else if (id === 'pan') { s.calm = RUSH.calm; s.sky.items = s.sky.items.filter(it => s.line.some(e => lacks(e, it.id))); }
  else if (id === 'microwave') { e.mood = null; e.tipMul = (e.tipMul ?? 1) * 1.5; }
  else if (id === 'cook_self') e.self = true;
  else if (id === 'lock_out') s.locked = RUSH.lock;
  else if (id === 'trash') {
    const to = smallest(s, e), rich = e.kind === 'rich' ? RUSH.richPay : 1;
    s.sky.tray = s.sky.tray.filter(it => it.owner !== e);
    e.recipe = to; e.need = { ...sim.RECIPES[to].need }; e.got = {}; e.ready = false; e.price = Math.round((s.setPrice ?? priceOf(s.save, to)) * rich * (e.payMul ?? 1));
    e.left = Math.min(e.full, e.left + RUSH.trashWait); sync(s);
  } else if (id === 'rob') {
    const n = Math.round(e.price * RUSH.robTake); unseat(s, e); s.coins += n; s.robbed += n; out.coins = n; out.gone = true; strike();
    if (!s.off.scare) for (const w of s.line) w.left = Math.max(0.5, w.left - RUSH.robScare);
  } else if (id === 'hire') { unseat(s, e); s.hired = true; s.holds += RUSH.hireHolds; out.gone = true; }
  else if (id === 'fight') {
    e.fought = true;
    if (won) { s.won++; e.payMul = RUSH.fightPay; e.price = Math.round(e.price * RUSH.fightPay); } else { unseat(s, e); out.gone = true; strike(); }
    out.won = won;
  }
  return out;
}

// The target: coins for one, two and three stars at each rank, set from `node measure.mjs targets` (see NOTES.md):
// one star is a little under a new cook's poor shift, three stars is a good cook's average shift.
export const TARGETS = [[150, 215, 260], [190, 295, 385], [180, 290, 380], [240, 410, 570], [240, 450, 660], [360, 630, 910], [430, 710, 1020], [480, 820, 1180], [480, 950, 1480], [550, 1050, 1570], [580, 1120, 1710]];
// Another night has its own targets, set the same way from `node measure.mjs targets 60`: one star is 0.88 of a
// new cook's poor shift (the lower quarter), three stars a good cook's average, two stars half way.
export const NIGHT_TARGETS = {
  lunch: [null, [150, 225, 300], [150, 235, 315], [185, 295, 400], [260, 410, 560], [410, 620, 830], [395, 670, 945], [455, 765, 1075], [500, 825, 1145], [565, 900, 1230], [570, 960, 1345]],
};
export const targets = (save, night = 'rush') => { const t = Math.min(TARGETS.length - 1, save.tier); return NIGHT_TARGETS[night]?.[t] ?? TARGETS[t]; };
// Rush coins are bigger than a day's. The save gets this share, so a Rush pays about what the same minutes of days pay.
export const SHARE = 0.25;
// Missions: one goal a shift, shown at the start and checked at the bell. Each also needs one star, so a tray that
// does nothing completes none. A mission pays outside the star count, so no star target moves (NOTES.md, slice 4).
// keep: true while it holds and lost for good once broken; the others are done the moment they happen.
export const MISSIONS = {
  ...Object.fromEntries(ACTS.map(id => ['use_' + id, { ok: id === 'fight' ? s => s.won > 0 : s => (s.acts[id] ?? 0) > 0 }])),
  trio: { ok: s => Object.keys(s.acts).length >= 3 },        // three different wheel actions
  seat: { ok: s => s.turned === 0, keep: true, from: 2 },    // nobody is turned away at the door (free below the Bistro)
};
MISSIONS.use_microwave.from = sim.MOOD_FROM;                 // it needs a moody guest
// The order they are offered in: the plain ones first, the costly ones last.
export const MISSION_ORDER = ['use_pan', 'use_slap', 'use_fridge', 'use_trash', 'use_hire', 'use_kick_out', 'use_cook_self', 'use_lock_out', 'use_microwave', 'trio', 'seat', 'use_fight', 'use_rob'];
export const missionsFor = save => MISSION_ORDER.filter(id => (MISSIONS[id].from ?? 0) <= save.tier);
// The mission for a shift: the next one not yet done, a step along each shift so a hard one is not offered twice running.
export function missionFor(save, done = {}, turn = 0) {
  const open = missionsFor(save), todo = open.filter(id => !done[id]), pool = todo.length ? todo : open;
  return pool[Math.max(0, Math.floor(turn)) % pool.length] ?? null;
}
export const missionHolds = (s, id = s.mission) => !!MISSIONS[id]?.ok(s);
export const missionDone = (s, id = s.mission) => missionHolds(s, id) && s.coins >= targets(s.save, s.night)[0];
export const missionPay = (save, night = 'rush') => Math.max(5, Math.round(targets(save, night)[0] * 0.2 / 5) * 5);
export function result(s) {
  const tg = targets(s.save, s.night), stars = tg.filter(x => s.coins >= x).length;
  return { share: Math.round(s.coins * SHARE), coins: s.coins, tips: s.tips, served: s.served, strikes: s.strikes, turned: s.turned, robbed: s.robbed, bestBuzz: s.bestBuzz, stars, targets: tg, closedEarly: !!s.closedEarly, mission: s.mission, missionDone: s.mission ? missionDone(s) : false };
}
