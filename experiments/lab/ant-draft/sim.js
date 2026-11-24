// Ant Draft: the rules. Pure, seeded, fixed timestep; runs in Node for bots.mjs and in the page.
// One input during a fight: the rally point (where the thumb is). One input between waves: which of three cards.
export const DT = 1 / 30, W = 360, H = 600, WAVES = 8, MAXLVL = 3;
export const QUEEN = { x: 180, y: 540, r: 22, hp: 100 };
export const LEASH = 85, AGGRO = 55;

// Cards: icon first, at most five words (bots.mjs asserts the word count).
export const CARDS = [
  { id: 'split', name: 'Split', words: 'Soldiers split on death' },
  { id: 'carry', name: 'Haul', words: 'Workers carry double' },
  { id: 'scout', name: 'Scout', words: 'Reveals and slows next wave' },
  { id: 'acid', name: 'Acid', words: 'Swarm leaves acid trail' },
  { id: 'guard', name: 'Guard', words: "Queen's guard circles her" },
  { id: 'jaws', name: 'Jaws', words: 'Bites hit harder' },
  { id: 'legs', name: 'Legs', words: 'Ants run faster' },
  { id: 'brood', name: 'Brood', words: 'More ants hatch each wave' },
  { id: 'shell', name: 'Shell', words: 'Ants take more hits' },
  { id: 'jelly', name: 'Jelly', words: 'Queen heals each wave' },
  { id: 'fire', name: 'Fire', words: 'Dead ants explode' },
  { id: 'frenzy', name: 'Frenzy', words: 'Kills speed up bites' },
];
export const CARD = Object.fromEntries(CARDS.map(c => [c.id, c]));

// Enemies. `q` is the damage of one bite on the queen; `food` the crumbs dropped.
export const FOES = {
  aphid: { hp: 8, speed: 30, dmg: 2, q: 4, r: 7, food: 1, cd: 0.8 },
  beetle: { hp: 42, speed: 17, dmg: 5, q: 9, r: 12, food: 2, cd: 1 },
  wasp: { hp: 13, speed: 50, dmg: 4, q: 3, r: 8, food: 1, cd: 0.9 }, // flies past soldiers and hunts workers
  spider: { hp: 24, speed: 24, dmg: 3, q: 4, r: 10, food: 2, cd: 1.6, range: 235 }, // stops far off and spits at the queen
  stag: { hp: 300, speed: 12, dmg: 8, q: 22, r: 20, food: 6, cd: 1.1 },
};
// Each wave: groups of [type, count, lane (0..1 across the top), first second, seconds between].
export const WAVE = [
  [['aphid', 6, 0.5, 1, 1.6]],
  [['aphid', 5, 0.2, 1, 1.2], ['aphid', 4, 0.8, 5, 1.2], ['beetle', 1, 0.5, 8, 1]],
  [['aphid', 6, 0.75, 1, 1], ['beetle', 2, 0.25, 3, 4], ['wasp', 2, 0.5, 9, 3]],
  [['aphid', 6, 0.2, 1, 0.9], ['spider', 1, 0.85, 3, 1], ['beetle', 2, 0.6, 6, 3], ['wasp', 2, 0.3, 11, 2], ['aphid', 5, 0.8, 12, 0.9]],
  [['beetle', 2, 0.8, 1, 2.5], ['aphid', 8, 0.3, 2, 0.8], ['wasp', 3, 0.6, 8, 1.6], ['spider', 2, 0.12, 9, 5], ['beetle', 2, 0.25, 13, 2.5]],
  [['aphid', 8, 0.5, 1, 0.6], ['spider', 2, 0.88, 3, 4], ['beetle', 3, 0.2, 5, 2.5], ['wasp', 4, 0.7, 10, 1.3], ['aphid', 8, 0.15, 13, 0.6]],
  [['beetle', 3, 0.5, 1, 2], ['spider', 2, 0.1, 2, 1.5], ['aphid', 10, 0.8, 4, 0.6], ['wasp', 5, 0.3, 9, 1.1], ['spider', 2, 0.9, 12, 1.5], ['beetle', 3, 0.2, 14, 2]],
  [['stag', 1, 0.5, 1, 1], ['aphid', 8, 0.2, 3, 0.7], ['wasp', 4, 0.8, 7, 1.2], ['beetle', 3, 0.75, 10, 2.5], ['spider', 2, 0.1, 12, 3], ['aphid', 10, 0.6, 16, 0.6]],
];

function rnd(s) { let t = (s.rng = (s.rng + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const lvl = (s, id) => s.cards[id] | 0;
// How far the Fire card's explosion reaches (tester t1, note #237, "Bigger explosions"; it was 30 at every level).
export const blast = level => 36 + 8 * level;
const ev = (s, type, x, y, data) => s.events.push({ type, x, y, ...data });

// opts.level: a level from levels.js ({ waves: [...WAVE rows], tough, swift, start }); without it the run is the 8-wave long run, unchanged.
// opts.safe: the tutorial, where the queen cannot be hurt. opts: waves and hp (a shorter run and a weak queen, for the phone check), mutate (bots.mjs --mutate: the queen takes no damage), noCards (picks do nothing).
export function create(seed = 1, opts = {}) {
  const s = {
    seed, rng: seed | 0, opts, t: 0, tick: 0, wave: 0, list: opts.level?.waves ?? WAVE, tough: opts.level?.tough ?? 1, swift: opts.level?.swift ?? 1, waves: opts.level ? opts.level.waves.length : Math.min(WAVES, opts.waves || WAVES), phase: 'fight', waveT: 0,
    queen: { hp: opts.hp || QUEEN.hp, max: QUEEN.hp, hurt: 0 }, rally: { x: 180, y: 430 }, ants: [], foes: [], crumbs: [], acid: [], spits: [], pending: [],
    cards: {}, picks: [], offers: [], food: 0, frenzy: 0, id: 1, events: [], kills: 0, lost: 0, hatched: 0, trail: { x: 180, y: 430, t: 0 },
  };
  for (let i = 0; i < (opts.level?.start ?? 6); i++) addAnt(s, 'soldier');
  for (let i = 0; i < 2; i++) addAnt(s, 'worker');
  startWave(s);
  return s;
}

function addAnt(s, kind, x, y) {
  const shell = 1 + 0.35 * lvl(s, 'shell'), base = kind === 'soldier' ? 10 : kind === 'guard' ? 22 : kind === 'mini' ? 4 : 6;
  const a = { id: s.id++, kind, x: x ?? QUEEN.x + (rnd(s) - 0.5) * 40, y: y ?? QUEEN.y - 20 - rnd(s) * 20, hp: base * shell, max: base * shell, cd: rnd(s) * 0.4, ang: -Math.PI / 2,
    oa: rnd(s) * 6.283, or: 6 + rnd(s) * 22, carry: 0, slow: 0, born: s.t };
  s.ants.push(a); return a;
}

function startWave(s) {
  s.phase = 'fight'; s.waveT = 0; s.frenzy = 0;
  if (s.wave > 0) {
    const n = 3 + 2 * lvl(s, 'brood');
    for (let i = 0; i < n; i++) { const a = addAnt(s, 'soldier'); ev(s, 'hatch', a.x, a.y); }
    const heal = 14 * lvl(s, 'jelly'); if (heal) { s.queen.hp = Math.min(s.queen.max, s.queen.hp + heal); ev(s, 'heal', QUEEN.x, QUEEN.y, { n: heal }); }
  }
  while (s.ants.filter(a => a.kind === 'worker').length < 2) addAnt(s, 'worker');
  s.ants = s.ants.filter(a => a.kind !== 'guard');
  for (let i = 0; i < 2 * lvl(s, 'guard'); i++) addAnt(s, 'guard');
  s.pending = plan(s, s.wave);
  ev(s, 'wave', W / 2, H / 2, { n: s.wave + 1 });
}
// The spawn list of a wave: fixed composition, seeded positions. Also used by the page to show the next wave to a scout.
function plan(s, w) {
  const out = [];
  for (const [type, count, lane, first, gap] of s.list[w]) for (let i = 0; i < count; i++)
    out.push({ type, at: first + i * gap, x: Math.max(24, Math.min(W - 24, lane * W + (rnd(s) - 0.5) * 70)) });
  return out.sort((a, b) => a.at - b.at);
}
export const composition = (w, list = WAVE) => { const n = {}; for (const [type, count] of list[w] ?? []) n[type] = (n[type] | 0) + count; return n; };

export function setRally(s, x, y) { s.rally.x = Math.max(8, Math.min(W - 8, x)); s.rally.y = Math.max(8, Math.min(H - 8, y)); }

export function pick(s, i) {
  if (s.phase !== 'draft' || !s.offers[i]) return false;
  const id = s.offers[i];
  if (!s.opts.noCards) s.cards[id] = lvl(s, id) + 1;
  s.picks.push(id); s.offers = []; s.wave++;
  ev(s, 'pick', W / 2, H / 2, { id });
  startWave(s); return true;
}
function deal(s) {
  const pool = CARDS.map(c => c.id).filter(id => lvl(s, id) < MAXLVL), out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd(s) * pool.length), 1)[0]);
  s.offers = out; s.phase = 'draft'; ev(s, 'draft', W / 2, H / 2);
}

function hurtFoe(s, f, dmg) {
  if (f.hp <= 0) return;
  f.hp -= dmg; f.flash = 0.12; ev(s, 'hit', f.x, f.y, { id: f.id, n: dmg, foe: f.type });
  if (f.hp > 0) return;
  s.kills++; ev(s, 'kill', f.x, f.y, { foe: f.type });
  const F = FOES[f.type];
  for (let i = 0; i < F.food; i++) s.crumbs.push({ id: s.id++, x: Math.max(12, Math.min(W - 12, f.x + (rnd(s) - 0.5) * 22)), y: Math.max(12, Math.min(H - 12, f.y + (rnd(s) - 0.5) * 22)), taken: 0 });
  if (lvl(s, 'frenzy')) s.frenzy = 1.5 * lvl(s, 'frenzy');
}
function killAnt(s, a) {
  a.hp = 0; s.lost++; ev(s, 'antdie', a.x, a.y, { kind: a.kind });
  if (a.carry) s.crumbs.push({ id: s.id++, x: a.x, y: a.y, taken: 0 });
  const fire = lvl(s, 'fire');
  if (fire) { const R = blast(fire), n = (a.kind === 'mini' ? 3 : 6) * fire; let hits = 0; for (const f of s.foes) if (f.hp > 0 && Math.hypot(f.x - a.x, f.y - a.y) < R + f.r) { hurtFoe(s, f, n); hits++; } ev(s, 'boom', a.x, a.y, { n, hits, r: R }); }
  const split = lvl(s, 'split');
  if (split && a.kind === 'soldier') { for (let i = 0; i <= split; i++) addAnt(s, 'mini', a.x + (rnd(s) - 0.5) * 14, a.y + (rnd(s) - 0.5) * 14); ev(s, 'split', a.x, a.y); }
}
function move(o, tx, ty, d) {
  const dx = tx - o.x, dy = ty - o.y, n = Math.hypot(dx, dy);
  if (n < 0.01) return 0;
  const k = Math.min(1, d / n); o.x += dx * k; o.y += dy * k; if (n > 1.5) o.ang = Math.atan2(dy, dx); return n;
}

export function step(s) {
  s.events.length = 0;
  if (s.phase !== 'fight') return s;
  s.t += DT; s.waveT += DT; s.tick++;
  if (s.frenzy > 0) s.frenzy -= DT;
  if (s.queen.hurt > 0) s.queen.hurt -= DT;
  const scout = lvl(s, 'scout');
  // Arrivals.
  while (s.pending.length && s.pending[0].at <= s.waveT) {
    const p = s.pending.shift(), F = FOES[p.type], hp = F.hp * (1 + 0.06 * s.wave) * s.tough;
    s.foes.push({ id: s.id++, type: p.type, x: p.x, y: -16, hp, max: hp, r: F.r, cd: 0.5, ang: Math.PI / 2, slow: 1.6 * scout, flash: 0, busy: 0 });
    ev(s, 'spawn', p.x, 0, { foe: p.type });
  }
  const fighters = s.ants.filter(a => a.kind !== 'worker');
  // Foes.
  for (const f of s.foes) {
    if (f.hp <= 0) continue;
    const F = FOES[f.type]; f.cd -= DT; if (f.flash > 0) f.flash -= DT; if (f.slow > 0) f.slow -= DT;
    const speed = F.speed * s.swift * (f.slow > 0 ? 0.5 : 1) * DT;
    // Bite the nearest ant in reach.
    let near = null, nd = f.r + 10, held = false;
    for (const a of s.ants) { if (a.hp <= 0) continue; const d = Math.hypot(a.x - f.x, a.y - f.y); if (d < nd) { nd = d; near = a; } if (a.kind !== 'worker' && d < f.r + 11) held = true; }
    if (near && f.cd <= 0) { f.cd = F.cd; near.hp -= F.dmg; ev(s, 'chomp', near.x, near.y, { n: F.dmg }); if (near.hp <= 0) killAnt(s, near); }
    const qd = Math.hypot(QUEEN.x - f.x, QUEEN.y - f.y);
    f.busy = 0;
    if (f.type === 'wasp') {
      let w = null, wd = 1e9; for (const a of s.ants) if (a.kind === 'worker' && a.hp > 0) { const d = Math.hypot(a.x - f.x, a.y - f.y); if (d < wd) { wd = d; w = a; } }
      if (w) move(f, w.x, w.y, speed); else if (qd > QUEEN.r + f.r + 4) move(f, QUEEN.x, QUEEN.y, speed);
    } else if (F.range && qd <= F.range) {
      f.busy = 1; f.ang = Math.atan2(QUEEN.y - f.y, QUEEN.x - f.x);
      if (f.cd <= 0 && !near) { f.cd = F.cd; s.spits.push({ id: s.id++, x: f.x, y: f.y, dmg: F.q }); ev(s, 'spit', f.x, f.y); }
    } else if (qd > QUEEN.r + f.r + 4) { if (!held) move(f, QUEEN.x, QUEEN.y, speed); else if (f.type === 'stag') move(f, QUEEN.x, QUEEN.y, speed * 0.45); }
    if (!F.range && qd <= QUEEN.r + f.r + 6 && f.cd <= 0 && !near) { f.cd = F.cd; hurtQueen(s, F.q); }
  }
  for (const p of s.spits) { if (move(p, QUEEN.x, QUEEN.y - 6, 120 * DT) < 6) { p.dead = 1; hurtQueen(s, p.dmg); } }
  s.spits = s.spits.filter(p => !p.dead);
  // Ants.
  const jaws = 1 + 0.3 * lvl(s, 'jaws'), legs = 1 + 0.2 * lvl(s, 'legs'), haul = 1 + lvl(s, 'carry');
  let gi = 0; const guards = 2 * lvl(s, 'guard');
  for (const a of s.ants) {
    if (a.hp <= 0) continue;
    a.cd -= DT;
    if (a.kind === 'worker') {
      const sp = 52 * legs * DT;
      if (a.carry) { if (move(a, QUEEN.x, QUEEN.y - 14, sp) < 8) { s.food += a.carry; a.carry = 0; ev(s, 'deliver', QUEEN.x, QUEEN.y - 14); while (s.food >= 3) { s.food -= 3; s.hatched++; const n = addAnt(s, 'soldier'); ev(s, 'hatch', n.x, n.y); } } }
      else {
        let c = null, cd = 1e9; for (const k of s.crumbs) if (!k.taken || k.taken === a.id) { const d = Math.hypot(k.x - a.x, k.y - a.y); if (d < cd) { cd = d; c = k; } }
        if (c) { c.taken = a.id; if (move(a, c.x, c.y, sp) < 5) { c.gone = 1; a.carry = haul; ev(s, 'crumb', a.x, a.y); } }
        else move(a, QUEEN.x + Math.cos(a.oa) * 34, QUEEN.y - 26 + Math.sin(a.oa) * 12, sp);
      }
      s.crumbs = s.crumbs.filter(k => !k.gone);
      continue;
    }
    // Soldiers, minis and guards: a home point (the rally, or a place on the ring round the queen) and a leash from it.
    let hx, hy, leash = LEASH;
    if (a.kind === 'guard') { const g = s.t * 1.1 + (gi++ / guards) * 6.283; hx = QUEEN.x + Math.cos(g) * 46; hy = QUEEN.y + Math.sin(g) * 40; leash = 34; }
    else { hx = s.rally.x + Math.cos(a.oa) * a.or; hy = s.rally.y + Math.sin(a.oa) * a.or; }
    let t = null, td = AGGRO;
    for (const f of s.foes) { if (f.hp <= 0) continue; const d = Math.hypot(f.x - a.x, f.y - a.y) - f.r; if (d < td && Math.hypot(f.x - hx, f.y - hy) < leash + f.r) { td = d; t = f; } }
    const sp = (a.kind === 'mini' ? 80 : 70) * legs * DT;
    if (t) {
      if (td > 5) move(a, t.x, t.y, Math.min(sp, td - 4)); else a.ang = Math.atan2(t.y - a.y, t.x - a.x);
      if (td <= 7 && a.cd <= 0) { a.cd = s.frenzy > 0 ? 0.25 : 0.5; hurtFoe(s, t, (a.kind === 'mini' ? 1.5 : a.kind === 'guard' ? 4 : 3) * jaws); ev(s, 'bite', t.x, t.y); }
    } else move(a, hx, hy, sp);
  }
  // Acid: the swarm's middle drips a puddle as it moves.
  const acid = lvl(s, 'acid');
  if (acid) {
    let n = 0, cx = 0, cy = 0; for (const a of fighters) if (a.hp > 0 && a.kind !== 'guard') { n++; cx += a.x; cy += a.y; }
    if (n) { cx /= n; cy /= n; s.trail.t -= DT; if (s.trail.t <= 0 && Math.hypot(cx - s.trail.x, cy - s.trail.y) > 9) { s.trail = { x: cx, y: cy, t: 0.2 }; s.acid.push({ id: s.id++, x: cx, y: cy, life: 3.2 }); } }
    for (const p of s.acid) { p.life -= DT; for (const f of s.foes) if (f.hp > 0 && f.type !== 'wasp' && Math.hypot(f.x - p.x, f.y - p.y) < 18 + f.r) hurtFoe(s, f, 3.2 * acid * DT); }
    s.acid = s.acid.filter(p => p.life > 0);
  }
  s.ants = s.ants.filter(a => a.hp > 0); s.foes = s.foes.filter(f => f.hp > 0);
  if (s.queen.hp <= 0) { s.phase = 'lost'; ev(s, 'lost', QUEEN.x, QUEEN.y); }
  else if (!s.foes.length && !s.pending.length) {
    s.spits.length = 0;
    if (s.wave + 1 >= s.waves) { s.phase = 'won'; ev(s, 'won', QUEEN.x, QUEEN.y); } else deal(s);
  }
  return s;
}
function hurtQueen(s, dmg) {
  if (s.opts.mutate || s.opts.safe) return; // the broken rule for `bots.mjs --mutate`
  s.queen.hp = Math.max(0, s.queen.hp - dmg); s.queen.hurt = 0.3; ev(s, 'queenhit', QUEEN.x, QUEEN.y, { n: dmg });
}
export function score(s) { return (s.wave + (s.phase === 'won' ? 1 : 0)) * 100 + Math.round(s.queen.hp) + s.kills; }
// What a scout shows: the next wave's enemies by type.
export const nextWave = s => composition(s.wave + 1, s.list);

// The same players bots.mjs measures; the phone check drives the page with `careful`.
export function threat(s) {
  let best = null, bs = -1e9;
  for (const f of s.foes) {
    const qd = Math.hypot(QUEEN.x - f.x, QUEEN.y - f.y);
    let v = -qd; if (f.type === 'spider' && f.busy) v += 260; if (f.type === 'wasp') v -= 120; if (f.y < 20) v -= 200;
    if (v > bs) { bs = v; best = f; }
  }
  return best;
}
