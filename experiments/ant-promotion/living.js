// The Living look (look 4): every animal on a rig (rig.js) and drawn by creature.js. It reads the sim and never changes it.
// No DOM and no clock, so rig-bots.mjs runs the same code in Node.
//   const L = living()
//   L.step(s, hw, hh)        once after every sim step: rigs for the animals within hw, hh (world units) of the player, plus the player's
//   L.mob(g, m, px, scars)   draw one animal in world units (the caller has drawn its rings and aims already); px: world units per pixel
//   L.player(g, s, skin, px) draw the player
//   L.lift(m)                how high the body is off the ground (hops, flight, a pounce), so numbers can sit above it
//   L.event(e, s)            the sim's events that squash a body: a bite, a meal, a kill
//   L.clear()                a new world
// Body language comes from the sim's own state, so what the body shows is what the rules are doing:
//   pounce (m.pounce)            a crouch, then a leap with the body stretched out
//   old animal winding up (wind) a crouch that deepens until it springs; its leap or dive rises off the ground; a sprint takes quick steps
//   tired (tirePace, winded)     panting, tongue out, quick breath
//   fleeing (m.fear)             quick short steps, body stretched
//   stunned (m.stun)             eyes shut, body still and a little flat
//   rival temperament            ambusher lies low until it has seen you; stalker creeps long and slow; brute is bigger; coward trembles
//   player skills                shell: a dome over the body (a porcupine raises its quills); sprint and dive: quick steps, stretched, a dive lifts; leap: an arc through the air
//   Wild hide growing back       scratches on the back; slowed by an old animal's roar: a stagger
import { FORMS, me, powerOf, tirePace, POUNCE, OLD_SKILL, powerFor, hideReady, formOf } from './sim.js';
import { update, poke } from './rig.js';
import { creature, drawCreature, speciesFor as speciesOf } from './creature.js';

const DT = 1 / 60, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LEAP_S = 0.35; // how long the leap arc takes on screen (the sim moves the player at once)

export function living() {
  const rigs = new Map(), stat = { rigs: 0, stepped: 0, drawn: 0, low: 0 };
  let mine = null, leap = null;

  // What the sim says about an animal, as a pose. Plain numbers; the rig and the drawing take them.
  function moodOf(s, m, F) {
    const M = formOf(s, m), o = {}, strong = powerOf(m) > F.power;
    if (m.pounce > 0) { // a pounce: crouch for the first moment, then a leap that lands
      const u = 1 - m.pounce / POUNCE.secs;
      if (u < 0.15) o.crouch = u / 0.15; else { const k = (u - 0.15) / 0.85; o.lift = Math.sin(Math.PI * Math.min(1, k * 1.7)) * 0.7; o.stretch = 0.22 * (1 - k); }
    }
    if (m.wind > 0) o.crouch = clamp(1 - m.wind / OLD_SKILL.wind, 0, 1); // gathering for its skill
    if (m.burst > 0) {
      const kind = powerFor(M)?.kind;
      if (kind === 'leap' || kind === 'dive') { o.lift = 0.55; o.stretch = 0.2; }
      else if (kind === 'shell') o.shell = 1;
      else { o.hurry = 1.7; o.stretch = 0.12; }
    }
    if (m.puff > 0 || m.winded > 0) o.pant = 1;
    else if (strong && m.alert) { const k = 1 - tirePace(m); if (k > 0) { o.pant = clamp(k * 1.6, 0, 1); o.hurry = 1 - 0.3 * k; } }
    if (m.fear && !m.fear.gone) { o.hurry = 1.8; o.stretch = Math.max(o.stretch || 0, 0.1); }
    else if (m.chase && !m.chase.gone) o.stretch = Math.max(o.stretch || 0, 0.06);
    if (m.nem && s.nemesis) { // the rival's temperament in how it holds itself
      const T = s.nemesis.knobs.temperament;
      if (T === 'ambusher' && !m.alert) o.crouch = Math.max(o.crouch || 0, 0.6);
      if (T === 'stalker') { o.stretch = Math.max(o.stretch || 0, 0.1); o.hurry = (o.hurry || 1) * 0.75; }
      if (T === 'brute') o.size = 1.1;
      if (T === 'coward') { o.size = 0.93; if (m.alert) o.tremble = 1; }
    }
    if (m.stun > 0) { o.sleep = 1; o.crouch = Math.max(o.crouch || 0, 0.3); o.lift = 0; o.tremble = 0; }
    return o;
  }
  function playerMood(s, F) {
    const p = s.player, o = {};
    if (p.shell > 0) o.shell = 1;
    if (p.boost > 0) { o.hurry = 1.7; o.stretch = 0.14; if (p.veil > 0) o.lift = 0.45; }
    if (p.slow > 0) o.tremble = 0.6;
    if (s.wild && F.role === 'brute' && !hideReady(s)) o.scuff = 1;
    if (leap) { const u = clamp(leap.t / LEAP_S, 0, 1); o.lift = Math.max(o.lift || 0, Math.sin(Math.PI * u) * 1.3); o.stretch = 0.2 * (1 - u); }
    return o;
  }

  function step(s, hw, hh) {
    const p = s.player, F = me(s), seen = new Set();
    stat.stepped = 0;
    for (const m of s.mobs) {
      if (Math.abs(m.x - p.x) > hw || Math.abs(m.y - p.y) > hh) continue; // far animals have no rig; one is laid out fresh when it comes near
      seen.add(m.id); let c = rigs.get(m.id);
      const E = formOf(s, m); if (!c || c.F !== E) rigs.set(m.id, c = creature(E, m.x, m.y, m.a)); // a new body when the meadow changes it (formOf: FORMS[m.f] itself when nothing has)
      c.mood = moodOf(s, m, F); c.hurry = c.mood.hurry || 1;
      const look = m.chase && !m.chase.gone ? m.chase : m.fear && !m.fear.gone ? m.fear : m.alert ? p : null; // eyes on what it hunts or flees
      update(c, m.x, m.y, m.a, DT, look); stat.stepped++;
    }
    for (const id of rigs.keys()) if (!seen.has(id)) rigs.delete(id);
    stat.rigs = rigs.size;
    if (s.dead) return;
    if (!mine || mine.F.id !== F.id) { mine = creature(FORMS[F.id], p.x, p.y, p.a); leap = null; }
    // a leap or being thrown clear moves the player at once; the body flies there in an arc instead of appearing
    const jump = Math.hypot(p.x - mine.x, p.y - mine.y);
    if (!leap && jump > Math.max(2 * F.r, 20) && jump < 500) leap = { x0: mine.x, y0: mine.y, t: 0 };
    let x = p.x, y = p.y;
    if (leap) {
      leap.t += DT; const u = Math.min(1, leap.t / LEAP_S), e = u * u * (3 - 2 * u);
      if (u >= 1) leap = null; else { x = leap.x0 + (p.x - leap.x0) * e; y = leap.y0 + (p.y - leap.y0) * e; }
      if (leap) { // feed the rig in small steps so it never re-lays itself
        const d = Math.hypot(x - mine.x, y - mine.y), lim = Math.max(3.5 * F.r, 35);
        if (d > lim) { x = mine.x + (x - mine.x) / d * lim; y = mine.y + (y - mine.y) / d * lim; }
      }
    }
    mine.mood = playerMood(s, F); mine.hurry = mine.mood.hurry || 1;
    let look = null, bd = Infinity; // the player's eyes: the nearest danger that has seen it, else the nearest meal
    for (const m of s.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y), strong = powerOf(m) > F.power; if (d < 400 && (strong ? m.alert : true) && d * (strong ? 0.5 : 1) < bd) { bd = d * (strong ? 0.5 : 1); look = m; } }
    update(mine, x, y, p.a, DT, look);
  }

  // Small and far bodies get the plain drawing: no outline, eyes or fur marks (a few pixels across, they would not show).
  const LOW_PX = 6;
  function mob(g, m, px, scars = 0) {
    const c = rigs.get(m.id); if (!c) return false;
    const low = c.r / px < LOW_PX;
    drawCreature(g, c, { px, ...c.mood, scars, low }); stat.drawn++; if (low) stat.low++;
    return true;
  }
  function player(g, s, skin, px) {
    if (!mine || s.dead) return false;
    drawCreature(g, mine, { px, ...mine.mood, skin: FORMS[mine.F.id].role === 'ant' ? skin : null }); stat.drawn++;
    return true;
  }
  const liftOf = c => (c ? c.z + (c.mood?.lift || 0) * c.r : 0);
  return {
    step, mob, player, stat,
    begin() { stat.drawn = 0; stat.low = 0; },
    lift: m => liftOf(m ? rigs.get(m.id) : mine),
    rig: m => (m ? rigs.get(m.id) : mine),
    get rigs() { return rigs; },
    clear() { rigs.clear(); mine = null; leap = null; },
    event(e, s) { // a bite squashes the biter: the player on a meal or when the hide takes a bite, an animal that eats another, the killer
      if (e.t === 'eat' || e.t === 'hide') { if (mine) poke(mine); }
      else if (e.t === 'power' && (e.kind === 'roar' || e.kind === 'sting')) { if (mine) poke(mine); }
      else if (e.t === 'mobeat') { let best = null, bd = Infinity; for (const m of s.mobs) { const d = Math.hypot(m.x - e.x, m.y - e.y); if (FORMS[m.f].name === e.by && d < bd) { bd = d; best = m; } } const c = best && rigs.get(best.id); if (c) poke(c); }
      else if (e.t === 'die') { const c = rigs.get(e.killer); if (c) poke(c); }
      else if (e.t === 'oldSkill' || e.t === 'pounce') { const c = rigs.get(e.id); if (c) poke(c); }
    },
  };
}

// A still picture of an animal for the menu, the promotion cards and the book: a rig walked a few steps so its legs settle.
export function extent(F) { // body length and width in r, legs included
  const { spec } = speciesOf(F), leg = Math.max(0, ...spec.legs.map(L => L.len * (L.out ?? 0.6) + 0.3)), wide = Math.max(...spec.pts);
  const span = spec.gaps.reduce((a, b) => a + b, 0) + spec.pts[0] + spec.pts.at(-1) + Math.max(0, ...spec.chains.map(C => C.n * C.seg * (C.back ? 0.7 : 0.3)));
  return [span + (spec.legs.length ? leg * 0.6 : 0), 2 * Math.max(wide, leg + wide * 0.5)];
}
export function still(F, a = -0.35, steps = 40) {
  const c = creature(F, 0, 0, a);
  for (let i = 0; i < steps; i++) update(c, Math.cos(a) * F.r * 0.02 * i, Math.sin(a) * F.r * 0.02 * i, a, DT);
  return c;
}
export function portraitLiving(x, F, w, h, skin = null, c = still(F)) {
  const [len, wid] = extent(F), k = Math.min(w * 0.78 / (len * F.r), h * 0.66 / (wid * F.r));
  x.save(); x.translate(w / 2, h * 0.55); x.scale(k, k); x.translate(-c.x, -c.y);
  drawCreature(x, c, { px: 1 / k, skin: F.role === 'ant' ? skin : null });
  x.restore();
}
