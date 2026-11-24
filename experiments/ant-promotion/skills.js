// Ant Promotion: the player's skill, a different one for every animal (tester t1, note #238, 2026-11-24). No drawing here.
// Each entry: label, cd (seconds to wait), use(c) -> false when nothing is in reach (then it is not spent), and, for a skill that lasts,
// a `fx` on the player that the rules in sim.js read:  t seconds left, name, and any of
//   add power   up speed   hidden (nothing sees you)   seenK (how far you are seen)   hush (weaker animals do not notice)   untouch (no bite)
//   noeat   still (you cannot walk)   lock (you go straight)   eatUp (eats up to this much stronger; `when` says which)   wide (bite reach)
// On an animal, m.fx: t, go ('to' | 'away', of x,y or `at`), blind, harmless, noturn, k speed, sap (power lost).
// Nothing here runs until the button is pressed, and only s.nrand is used, so a run that never presses it is unchanged.
// `kept` skills (a shell, a leap, a roar, a dive, a sprint: one animal each) run sim.js's older code.
import { FORMS, WORLD, powerOf, eatMob, needless, TIRE } from './sim.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ang = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const within = (c, R, ok = () => true) => c.s.mobs.filter(m => !m.gone && !(m.guard > 0) && Math.hypot(m.x - c.p.x, m.y - c.p.y) < R + FORMS[m.f].r + c.F.r && ok(m));
const nearest = (c, R, ok) => within(c, R, ok).sort((a, b) => Math.hypot(a.x - c.p.x, a.y - c.p.y) - Math.hypot(b.x - c.p.x, b.y - c.p.y))[0];
const weak = c => m => powerOf(m) < c.F.power, strong = c => m => powerOf(m) > c.F.power;
const ahead = (c, half) => m => Math.abs(ang(Math.atan2(m.y - c.p.y, m.x - c.p.x) - c.p.a)) < half;
const upTo = (c, n) => m => powerOf(m) <= c.F.power + n && (powerOf(m) < c.F.power || !m.nem && !m.old); // a skill never eats a rival or an old hunter that is stronger
const put = (m, fx) => { m.fx = { ...fx }; if (fx.blind || fx.harmless) { m.alert = false; m.hunt = 0; } return 1; };
const all = (list, fx) => { for (const m of list) put(m, typeof fx === 'function' ? fx(m) : fx); return list.length; };
const move = (m, dx, dy) => { const r = FORMS[m.f].r; m.x = clamp(m.x + dx, r, WORLD - r); m.y = clamp(m.y + dy, r, WORLD - r); };
const shove = (m, x, y, n) => { const a = Math.atan2(m.y - y, m.x - x); move(m, Math.cos(a) * n, Math.sin(a) * n); };
const mine = (c, t, more = {}) => { c.p.fx = { name: c.F.name, t, t0: t, ...more }; return 1; };
const item = (c, k, t, more = {}) => { const it = { k, x: c.p.x, y: c.p.y, t, t0: t, r: 12, ...more }; c.s.items.push(it); return it; };
const zone = (c, k, r, t) => { c.s.zones.push({ k, x: c.p.x, y: c.p.y, r, t, t0: t }); return 1; };

export const SKILLS = {
  // level 2
  Beetle: { label: 'Dung ball', cd: 10, use(c) { item(c, 'ball', 3, { vx: Math.cos(c.p.a) * 230, vy: Math.sin(c.p.a) * 230, r: 24, x: c.p.x + Math.cos(c.p.a) * 30, y: c.p.y + Math.sin(c.p.a) * 30 }); return 1; } },
  'Fire Ant': { label: 'Colony', cd: 13, reach: 180, use: c => within(c, 180, weak(c)).length && mine(c, 2.5), tick(c, dt) { for (const m of within(c, 180, weak(c))) shove(m, c.p.x, c.p.y, -Math.min(110 * dt, Math.hypot(m.x - c.p.x, m.y - c.p.y))); } },
  Spider: { label: 'Web', cd: 13, use: c => zone(c, 'web', 100, 8) },
  // level 3
  Scorpion: { label: 'Sting', cd: 14, reach: 140, use(c) { const m = nearest(c, 140, strong(c)); return m && put(m, { t: 7, sap: 25 }); } },
  Wasp: { label: 'Numbing sting', cd: 11, reach: 130, use(c) { const m = nearest(c, 130, strong(c)); return m && put(m, { t: 5, harmless: 1, k: 0.5 }); } },
  Mantis: { label: 'Ambush', cd: 13, use: c => mine(c, 5, { eatUp: 10, when: 'still', hidden: 'still' }) },
  // level 4
  Crab: { label: 'Pinch', cd: 12, reach: 110, use(c) { const m = nearest(c, 110, strong(c)); if (!m) return 0; put(m, { t: 3, harmless: 1, blind: 1, held: 1 }); return mine(c, 3, { at: m }); },
    tick(c) { const m = c.p.fx.at, d = (FORMS[m.f].r + c.F.r) * 0.95; if (m.gone || !m.fx) return; m.x = clamp(c.p.x - Math.cos(c.p.a) * d, 0, WORLD); m.y = clamp(c.p.y - Math.sin(c.p.a) * d, 0, WORLD); } },
  Mouse: { label: 'Crumb', cd: 12, reach: 280, use(c) { const it = item(c, 'crumb', 6); all(within(c, 280, weak(c)), { t: 6, go: 'to', at: it, blind: 1, k: 0.8 }); return 1; } },
  Frog: { label: 'Tongue', cd: 7, reach: 150, use(c) { const m = nearest(c, 150, m => weak(c)(m) && ahead(c, 0.9)(m)); if (!m) return 0; c.s.events.push({ t: 'tongue', x: m.x, y: m.y }); eatMob(c.s, m); return 1; } },
  // level 5
  Mole: { label: 'Dig', cd: 13, use: c => mine(c, 4, { hidden: 1, untouch: 1, noeat: 1 }) },
  Lizard: { label: 'Drop the tail', cd: 12, reach: 320, use(c) { const it = item(c, 'tail', 4); all(within(c, 320, strong(c)), { t: 4, go: 'to', at: it, blind: 1, harmless: 1 }); return 1; } },
  Bat: { label: 'Echo', cd: 13, use: c => mine(c, 6, { hush: 1 }) },
  // level 6
  Porcupine: { label: 'Quills', cd: 13, use: c => mine(c, 4, { quills: 1 }) },
  Squirrel: { label: 'Nut store', cd: 16, use(c) { for (let i = 0; i < 4; i++) { const a = c.s.nrand() * 6.283, d = 60 + c.s.nrand() * 90; item(c, 'nut', 10, { xp: 1, r: 8, x: clamp(c.p.x + Math.cos(a) * d, 20, WORLD - 20), y: clamp(c.p.y + Math.sin(a) * d, 20, WORLD - 20) }); } return 1; } },
  Snake: { label: 'Hypnotise', cd: 10, reach: 240, use(c) { const m = nearest(c, 240, weak(c)); return m && put(m, { t: 6, go: 'to', at: c.p, blind: 1 }); } },
  // level 7
  Turtle: { label: 'Shell', cd: 16, kept: 1 }, Rabbit: { label: 'Bound', cd: 6, kept: 1 },
  Owl: { label: 'Darkness', cd: 14, use: c => mine(c, 6, { seenK: 0.45 }) },
  // level 8
  Badger: { label: 'Den', cd: 14, use: c => zone(c, 'den', 120, 5) },
  Cat: { label: 'Nine lives', cd: 18, use: c => mine(c, 9, { life: 1 }) },
  Fox: { label: 'False trail', cd: 12, reach: 420, use(c) { const it = item(c, 'fox', 4, { vx: -Math.cos(c.p.a) * 150, vy: -Math.sin(c.p.a) * 150, f: c.F.id }); all(within(c, 420, m => strong(c)(m) && m.alert), { t: 4, go: 'to', at: it, blind: 1 }); return 1; } },
  // level 9
  Dog: { label: 'Bark', cd: 11, reach: 220, use: c => all(within(c, 220, strong(c)), { t: 2.5, go: 'away', at: c.p, blind: 1 }) },
  Eagle: { label: 'Dive', cd: 10, kept: 1 },
  Lynx: { label: 'Stalk', cd: 13, use: c => mine(c, 6, { seenK: 0.2, up: 0.75 }) },
  // level 10
  Boar: { label: 'Charge', cd: 11, use: c => mine(c, 1.1, { lock: c.p.a, up: 2, ram: 1 }) },
  Deer: { label: 'Scatter', cd: 13, reach: 320, use(c) { const list = within(c, 320, strong(c)); let n = 0; for (const m of list) { const o = c.s.mobs.filter(o => o !== m && !o.nem && !o.old && powerOf(o) < powerOf(m)).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0]; if (o) n += put(m, { t: 5, go: 'to', at: o, blind: 1 }); } return n; } },
  Wolf: { label: 'Pack', cd: 17, use(c) { for (const e of [-1, 1]) item(c, 'wolf', 6, { f: c.F.id, x: c.p.x + e * 30, r: 16, a: c.p.a }); return 1; } },
  // level 11
  Gorilla: { label: 'Chest beat', cd: 15, use: c => mine(c, 5, { add: 12 }) },
  Ostrich: { label: 'Dust cloud', cd: 13, use: c => zone(c, 'dust', 140, 5) },
  Panther: { label: 'Silent kill', cd: 14, use: c => mine(c, 5, { eatUp: 20, when: 'unseen' }) },
  // level 12
  Crocodile: { label: 'Death roll', cd: 15, reach: 80, use(c) { const m = nearest(c, 80, upTo(c, 10)); if (!m) return 0; put(m, { t: 2, harmless: 1, blind: 1, held: 1 }); return mine(c, 1.3, { at: m, still: 1, untouch: 1 }); },
    tick(c) { c.p.a += 0.35; }, end(c) { const m = c.p.fx.at; if (!m.gone && c.s.mobs.includes(m)) eatMob(c.s, m); } },
  Cheetah: { label: 'Sprint', cd: 8, kept: 1 },
  Python: { label: 'Coil', cd: 13, use: c => within(c, 130, weak(c)).length && zone(c, 'coil', 150, 6) },
  // level 13
  Bear: { label: 'Hibernate', cd: 18, use: c => mine(c, 2.5, { still: 1, untouch: 1 }), end(c) { c.p.xp += 3; c.s.events.push({ t: 'snack', gain: 3, x: c.p.x, y: c.p.y }); } },
  Zebra: { label: 'Dazzle', cd: 14, reach: 300, use: c => all(within(c, 300), { t: 4, blind: 1 }) },
  Tiger: { label: 'Mark', cd: 14, reach: 420, use(c) { const m = nearest(c, 420, m => weak(c)(m) && !m.mark); if (!m) return 0; m.mark = 3; return 1; } },
  // level 14
  Hippo: { label: 'Wide bite', cd: 13, use: c => mine(c, 4, { wide: 2.4 }) },
  Lion: { label: 'Roar', cd: 14, kept: 1 },
  Komodo: { label: 'Slow venom', cd: 13, reach: 130, use(c) { const m = nearest(c, 130, m => upTo(c, 10)(m) && !m.nem && !m.old && !m.venom); if (!m) return 0; m.venom = 4; return 1; } },
  // level 15
  Elephant: { label: 'Water spray', cd: 12, reach: 260, use(c) { const list = within(c, 260, ahead(c, 0.7)); for (const m of list) shove(m, c.p.x, c.p.y, 170); return all(list, { t: 1.2, blind: 1, go: 'away', at: c.p, k: 0.4 }); } },
  Giraffe: { label: 'High view', cd: 14, use: c => mine(c, 8, { view: 1.7 }) },
  Sabertooth: { label: 'Blood scent', cd: 15, use: c => mine(c, 5, { got: 0 }), tick(c) { const f = c.p.fx, n = Math.floor(f.t0 - f.t); if (n > f.got) { f.got = n; if (within(c, 160, weak(c)).length) { c.p.xp++; c.s.events.push({ t: 'snack', gain: 1, x: c.p.x, y: c.p.y }); } } } },
  // level 16
  'T-Rex': { label: 'Quake', cd: 13, reach: 340, use: c => all(within(c, 340), { t: 3, noturn: 1 }) },
  Raptor: { label: 'Turn the herd', cd: 13, reach: 380, use: c => all(within(c, 380, m => weak(c)(m) && m.alert), { t: 3.5, go: 'to', at: c.p, k: 0.9 }) },
  Pterodactyl: { label: 'Carry off', cd: 14, reach: 140, use(c) { const m = nearest(c, 140, strong(c)); if (!m) return 0; const a = Math.atan2(WORLD / 2 - c.p.y, WORLD / 2 - c.p.x); move(m, Math.cos(a) * 750, Math.sin(a) * 750); return put(m, { t: 1, blind: 1 }); } },
  // level 17
  Yeti: { label: 'Bitter cold', cd: 15, reach: 260, use(c) { const list = within(c, 260, m => strong(c)(m) && !m.nem); for (const m of list) { m.alert = false; m.hunt = 0; m.tire = TIRE.fresh; m.winded = 4; } return list.length; } },
  Griffin: { label: 'Glide', cd: 15, use: c => mine(c, 4, { untouch: 1 }) },
  Basilisk: { label: 'Dread stare', cd: 13, reach: 280, use(c) { const list = within(c, 280, m => strong(c)(m) && ahead(c, 0.8)(m)); for (const m of list) m.want = m.a = Math.atan2(m.y - c.p.y, m.x - c.p.x); return all(list, { t: 3, noturn: 1, k: 0.3, blind: 1 }); } },
  // level 18
  Dragon: { label: 'Fire breath', cd: 15, reach: 200, use(c) { const list = within(c, 200, m => weak(c)(m) && ahead(c, 0.55)(m) && !m.nem && !m.old).slice(0, 3); for (const m of list) cook(c.s, m); return list.length; } },
  Thunderbird: { label: 'Whirlwind', cd: 14, reach: 250, use: c => within(c, 250, weak(c)).length && mine(c, 4),
    tick(c, dt) { for (const m of within(c, 250, weak(c))) { const a = Math.atan2(m.y - c.p.y, m.x - c.p.x) + 2.2 * dt, d = Math.max(0, Math.hypot(m.x - c.p.x, m.y - c.p.y) - 70 * dt); m.x = clamp(c.p.x + Math.cos(a) * d, 10, WORLD - 10); m.y = clamp(c.p.y + Math.sin(a) * d, 10, WORLD - 10); } } },
  Hydra: { label: 'Three bites', cd: 15, reach: 170, use(c) { const list = within(c, 170, weak(c)).slice(0, 3); for (const m of list) { c.s.events.push({ t: 'tongue', x: m.x, y: m.y }); eatMob(c.s, m); } return list.length; } },
};
for (const [name, k] of Object.entries(SKILLS)) k.name = name;
export const skillFor = F => SKILLS[F.name] || null;
// An animal that drops becomes a meal on the ground, worth what eating it is worth.
export function cook(s, m) { m.gone = true; s.items.push({ k: 'meal', x: m.x, y: m.y, t: 12, t0: 12, r: 14, xp: needless(s, m), f: m.f }); const i = s.mobs.indexOf(m); if (i >= 0) s.mobs.splice(i, 1); }
export const clearSkill = p => { if (p.fx) p.fx = null; };
// Once a step, before the animals move. F is the player's animal; moving: whether the stick is pushed.
export function skillTick(s, F, moving, dt) {
  const p = s.player, c = { s, p, F };
  if (p.fx) {
    const K = SKILLS[p.fx.name]; p.fx.moving = moving; K.tick?.(c, dt);
    if (p.fx && (p.fx.t -= dt) <= 0) { K.end?.(c); p.fx = null; }
  }
  for (const m of s.mobs.slice()) if (m.venom > 0 && (m.venom -= dt) <= 0 && !m.gone) cook(s, m);
  for (let i = s.zones.length - 1; i >= 0; i--) {
    const z = s.zones[i]; if ((z.t -= dt) <= 0) { s.zones.splice(i, 1); continue; }
    for (const m of s.mobs) { const d = Math.hypot(m.x - z.x, m.y - z.y), r = FORMS[m.f].r;
      if (z.k === 'den' && powerOf(m) > F.power && d < z.r + r) shove(m, z.x, z.y, z.r + r - d);
      if (z.k === 'coil') { if (d < z.r && powerOf(m) < F.power) m.coil = z; if (m.coil === z && d > z.r - r) { const a = Math.atan2(m.y - z.y, m.x - z.x); m.x = z.x + Math.cos(a) * (z.r - r); m.y = z.y + Math.sin(a) * (z.r - r); } } }
  }
  for (let i = s.items.length - 1; i >= 0; i--) {
    const it = s.items[i]; let off = (it.t -= dt) <= 0;
    if (it.vx || it.vy) { it.x = clamp(it.x + it.vx * dt, 10, WORLD - 10); it.y = clamp(it.y + it.vy * dt, 10, WORLD - 10); }
    if (it.k === 'ball') for (const m of s.mobs) if (Math.hypot(m.x - it.x, m.y - it.y) < it.r + FORMS[m.f].r) { move(m, it.vx * dt * 1.3, it.vy * dt * 1.3); m.fx = { t: 0.7, blind: 1, harmless: 1 }; m.alert = false; }
    if (it.k === 'wolf' && !off) { let best = null, bd = 420; for (const m of s.mobs) { const d = Math.hypot(m.x - it.x, m.y - it.y); if (powerOf(m) < F.power && d < bd) { bd = d; best = m; } }
      if (best) { it.a = Math.atan2(best.y - it.y, best.x - it.x); it.x += Math.cos(it.a) * 230 * dt; it.y += Math.sin(it.a) * 230 * dt; if (bd < it.r + FORMS[best.f].r) { eatMob(s, best); off = true; } } }
    if (it.xp && !off && Math.hypot(p.x - it.x, p.y - it.y) < F.r + it.r) { p.xp += it.xp; s.events.push({ t: 'snack', gain: it.xp, x: it.x, y: it.y }); off = true; }
    if (off) s.items.splice(i, 1);
  }
}
// What sim.js asks while an animal looks, moves and touches.
export const unseen = (s, m, d, strong) => { const f = s.player.fx; if (m.fx?.blind) return true; if (f && (f.hidden === 1 || f.hidden === 'still' && !f.moving || f.hush && !strong)) return true; return s.zones.some(z => z.k === 'dust' && Math.hypot(s.player.x - z.x, s.player.y - z.y) < z.r); };
export const seenK = s => s.player.fx?.seenK || 1;
export function drive(s, m, speed) { // an animal under a skill: where it heads and how fast
  const f = m.fx; if (f?.go) { const a = Math.atan2(f.at.y - m.y, f.at.x - m.x); m.want = f.go === 'to' ? a : a + Math.PI; speed = FORMS[m.f].speed; if (f.go === 'to' && Math.hypot(f.at.x - m.x, f.at.y - m.y) < 8) speed = 0; }
  if (f?.k) speed *= f.k; if (f?.held) speed = 0;
  for (const z of s.zones) if (z.k === 'web' && Math.hypot(m.x - z.x, m.y - z.y) < z.r) speed *= 0.25;
  return speed;
}
export function touch(s, m, out, F, power) { // what a contact becomes: 'eat', 'die', 'none' or 'bump'
  const p = s.player, f = p.fx;
  if (f?.noeat && out === 'eat') return 'none';
  if (f?.eatUp && out !== 'eat' && power <= F.power + f.eatUp && !(power > F.power && (m.nem || m.old)) && (f.when === 'still' ? !f.moving : !m.alert)) return 'eat';
  if (out === 'die') {
    if (m.fx?.harmless || f?.untouch) return 'none';
    if (f?.quills || f?.ram) { shove(m, p.x, p.y, 150); m.fx = { t: 1.5, blind: 1 }; m.alert = false; m.hunt = 0; s.events.push({ t: 'stun', x: m.x, y: m.y, shell: true }); return 'bump'; }
    if (f?.life && p.safe <= 0) { p.fx = null; p.safe = 1.5; shove(m, p.x, p.y, 200); m.fx = { t: 1.5, blind: 1 }; m.alert = false; m.hunt = 0; s.events.push({ t: 'life', x: p.x, y: p.y }); return 'bump'; }
  }
  return out;
}
export function wideBites(s, F) { const w = s.player.fx?.wide; if (!w) return; const c = { s, p: s.player, F }; for (const m of within(c, F.r * w, weak(c))) eatMob(s, m); }
