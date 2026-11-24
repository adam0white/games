// Ant Draft (lab): the rules. Pure, seeded, fixed timestep; runs in Node for bots.mjs and in the page.
// A run is 8 waves. In a wave, bugs walk in from the top and sides down to the mound along the bottom. The player's only
// input is a rally point (where the finger is): soldiers gather round it and bite any bug near them. Workers fetch the
// crumbs that dead bugs drop; crumbs at the nest hatch new soldiers. After each wave the player drafts one of three
// promotion cards. Cards stack, so runs differ. The run is lost when the nest falls or the last ant dies.

export const W = 360, H = 600, DT = 1 / 30, WAVES = 8;
export const NEST = { x: 180, y: 556, r: 26 }; // the entrance; the whole bottom edge (y >= LINE) is the mound
export const LINE = 552;

// Mutations for bots.mjs --mutate: each breaks one rule on purpose.
export const MUT = { name: null };

export function rng(seed) { // mulberry32 state lives in the run, so a run is reproducible from its seed and inputs
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Bugs. hp, speed (px/s), bite (damage per second to an ant), hit (nest damage on arrival), cost (wave budget), fly (ignores ants).
export const FOES = {
  termite: { hp: 7, spd: 30, bite: 5, hit: 1, cost: 1, r: 5, from: 1 },
  beetle: { hp: 34, spd: 19, bite: 9, hit: 3, cost: 4, r: 9, from: 2 },
  wasp: { hp: 9, spd: 46, bite: 0, hit: 2, cost: 3, r: 6, fly: true, from: 3 },
  spider: { hp: 150, spd: 15, bite: 22, hit: 8, cost: 16, r: 15, from: 8 },
};
export const ANTS = {
  soldier: { hp: 12, bite: 7, spd: 72, r: 4.5 },
  small: { hp: 6, bite: 4, spd: 80, r: 3.2 },
  worker: { hp: 6, bite: 0, spd: 55, r: 3.8 },
  guard: { hp: 45, bite: 12, spd: 50, r: 6.5 },
};

// Promotion cards. word: at most five words on the card; max: how many times it can be drafted.
export const CARDS = {
  split: { word: 'Soldiers split on death', max: 2 },
  haul: { word: 'Workers carry double', max: 2 },
  scout: { word: 'Scout the next wave', max: 2 },
  acid: { word: 'Acid trail', max: 3 },
  guard: { word: "Queen's guard", max: 2 },
  jaws: { word: 'Sharper jaws', max: 3 },
  shell: { word: 'Thicker shells', max: 3 },
  brood: { word: 'Brood burst', max: 3 },
  swift: { word: 'Swift legs', max: 2 },
  honey: { word: 'Honey nest', max: 3 },
};
export const CARD_IDS = Object.keys(CARDS);

// The bugs of wave n (1-based), in spawn order with times and entry points. Drawn from the run's wave seed, so the
// scout card can show the next wave before it starts.
export function plan(seed, n) {
  const r = rng((seed ^ Math.imul(n, 0x9E3779B1)) >>> 0);
  let budget = n === WAVES ? 58 : 4 + n * 7.5;
  const kinds = Object.keys(FOES).filter(k => FOES[k].from <= n && k !== 'spider');
  const list = [];
  if (n === WAVES) { list.push('spider'); budget -= FOES.spider.cost; }
  while (budget >= 1) {
    let k = kinds[Math.floor(r() * kinds.length)];
    if (FOES[k].cost > budget) k = 'termite';
    list.push(k); budget -= FOES[k].cost;
  }
  const span = 6 + n * 1.2; // seconds over which they arrive
  return list.map((kind, i) => {
    const side = n >= 3 && r() < 0.3 ? (r() < 0.5 ? -1 : 1) : 0; // from wave 3 some come in from the sides
    const x = side ? (side < 0 ? -10 : W + 10) : 20 + r() * (W - 40), y = side ? 80 + r() * 260 : -12;
    const at = kind === 'spider' ? span * 0.5 : (i / list.length) * span + r() * 0.8;
    const lane = side ? 40 + r() * (W - 80) : x;
    return { kind, x, y, at, lane };
  }).sort((a, b) => a.at - b.at);
}

export function create(seed, opts = {}) {
  const s = {
    seed: seed >>> 0, r: rng(seed ^ 0xA5A5A5), t: 0, wt: 0, wave: 1, phase: 'fight',
    ants: [], foes: [], crumbs: [], acid: [], queue: [], fx: [],
    nest: { ...NEST, hp: 16, max: 16 }, rally: { x: 180, y: 430 }, stock: 0, cards: {}, held: [], offer: [],
    kills: 0, lostAnts: 0, hatched: 0, score: 0, id: 0, acidT: 0,
  };
  for (const id of CARD_IDS) s.cards[id] = 0;
  for (let i = 0; i < 10; i++) addAnt(s, 'soldier', NEST.x + (s.r() - 0.5) * 60, NEST.y - 40 - s.r() * 40);
  for (let i = 0; i < 4; i++) addAnt(s, 'worker', NEST.x + (s.r() - 0.5) * 30, NEST.y - 10);
  if (opts.cards) for (const c of opts.cards) apply(s, c);
  startWave(s);
  return s;
}

function addAnt(s, kind, x, y) {
  const A = ANTS[kind], k = s.cards;
  const hp = A.hp * (kind === 'worker' ? 1 : 1 + 0.5 * k.shell);
  const a = r => s.r() * r;
  const ant = { id: ++s.id, kind, x, y, hp, max: hp, ox: (a(2) - 1) * 26, oy: (a(2) - 1) * 18, carry: 0, target: null, ph: a(6.28), hurt: 0, bit: 0 };
  s.ants.push(ant); return ant;
}
function addFoe(s, kind, x, y, lane) {
  const F = FOES[kind];
  s.foes.push({ id: ++s.id, kind, x, y, lane: Math.max(20, Math.min(W - 20, lane)), hp: F.hp, max: F.hp, ph: s.r() * 6.28, hurt: 0, wob: s.r() * 6.28, fight: null });
}

function startWave(s) {
  s.phase = 'fight'; s.wt = 0;
  s.queue = plan(s.seed, s.wave);
  s.fx.push({ type: 'wave', n: s.wave });
}

// The three cards offered after a wave: distinct, not at their max, drawn from the run's RNG.
function deal(s) {
  const pool = CARD_IDS.filter(id => s.cards[id] < CARDS[id].max);
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(s.r() * pool.length), 1)[0]);
  return out;
}

// Taking a card. Effects that act once happen here; the rest are read from s.cards while the wave runs.
export function apply(s, id) {
  s.cards[id]++; s.held.push(id);
  if (id === 'guard') { for (let i = 0; i < 2; i++) { const g = addAnt(s, 'guard', NEST.x, NEST.y - 30); g.gx = s.cards.guard === 1 ? (i ? 270 : 90) : (i ? 200 : 160); } }
  if (id === 'brood') { for (let i = 0; i < 4; i++) addAnt(s, 'soldier', NEST.x + (s.r() - 0.5) * 40, NEST.y - 30); }
  if (id === 'honey') { s.nest.max += 4; s.nest.hp = Math.min(s.nest.max, s.nest.hp + 8); }
  if (id === 'shell') for (const a of s.ants) if (a.kind !== 'worker') { a.max = ANTS[a.kind].hp * (1 + 0.5 * s.cards.shell); a.hp = a.max; }
  if (id === 'haul') addAnt(s, 'worker', NEST.x, NEST.y - 10);
}

export function choose(s, i) {
  if (s.phase !== 'draft' || !s.offer[i]) return false;
  apply(s, s.offer[i]); s.fx.push({ type: 'pick', id: s.offer[i] });
  s.offer = []; s.wave++;
  startWave(s);
  return true;
}

export const speedOf = (s, kind) => ANTS[kind].spd * (1 + 0.3 * s.cards.swift);
const hatchNeed = s => Math.max(1, 3 - (s.cards.brood ? 1 : 0));
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function moveTo(o, x, y, v) {
  const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy);
  if (d < 0.5) return 0;
  const k = Math.min(1, (v * DT) / d); o.x += dx * k; o.y += dy * k; o.dir = Math.atan2(dy, dx); return d;
}

// One fixed step. input: { x, y } rally point in arena units, or null to keep the last one.
export function step(s, input) {
  s.fx.length = 0;
  if (s.phase !== 'fight') return s;
  if (input) s.rally = { x: Math.max(10, Math.min(W - 10, input.x)), y: Math.max(20, Math.min(H - 20, input.y)) };
  s.t += DT; s.wt += DT;
  const k = s.cards;
  // spawn
  while (s.queue.length && s.queue[0].at <= s.wt) { const q = s.queue.shift(); addFoe(s, q.kind, q.x, q.y, q.lane); }
  const slow = 1 - 0.12 * k.scout;
  // bugs
  for (const f of s.foes) {
    const F = FOES[f.kind]; f.ph += DT * 8; f.hurt = Math.max(0, f.hurt - DT);
    f.fight = null;
    if (!F.fly) { // the nearest ant in reach stops it
      let best = null, bd = (F.r + 9) ** 2;
      for (const a of s.ants) { const d = d2(a, f); if (d < bd) { bd = d; best = a; } }
      if (best) {
        f.fight = best.id;
        const dmg = MUT.name === 'nobite' ? 0 : F.bite * DT;
        best.hp -= dmg; best.hurt = 0.15;
        continue;
      }
    }
    f.wob += DT * 2;
    const tx = f.lane + Math.sin(f.wob) * (F.fly ? 40 : 10), ty = H;
    if (f.y < 20 || f.x < 0 || f.x > W) moveTo(f, f.lane, Math.max(f.y, 40), F.spd * slow); else moveTo(f, tx, ty, F.spd * slow);
    if (f.y >= LINE) {
      f.hp = 0; f.arrived = true;
      if (MUT.name !== 'safenest') s.nest.hp -= F.hit;
      s.fx.push({ type: 'nest', x: f.x, y: f.y, hit: F.hit });
    }
  }
  // ants
  const bite = 1 + 0.4 * k.jaws;
  for (const a of s.ants) {
    const A = ANTS[a.kind]; a.ph += DT * 12; a.hurt = Math.max(0, a.hurt - DT); a.bit = Math.max(0, a.bit - DT);
    const v = speedOf(s, a.kind);
    if (a.kind === 'worker') {
      if (a.carry) { if (moveTo(a, NEST.x, NEST.y - 6, v) < 8) { s.stock += a.carry; a.carry = 0; s.fx.push({ type: 'deliver', x: a.x, y: a.y }); } continue; }
      let c = null, cd = Infinity;
      for (const cr of s.crumbs) { if (cr.taken) continue; const d = d2(cr, a); if (d < cd) { cd = d; c = cr; } }
      if (c) { if (moveTo(a, c.x, c.y, v) < 4) { c.taken = true; a.carry = k.haul ? 1 + k.haul : 1; s.fx.push({ type: 'pickup', x: a.x, y: a.y }); } }
      else moveTo(a, NEST.x + a.ox, NEST.y - 26 + a.oy * 0.4, v * 0.5);
      continue;
    }
    // soldiers and guards: bite the nearest bug in reach, otherwise go to their place
    const home = a.kind === 'guard' ? { x: a.gx, y: LINE - 26 } : { x: s.rally.x + a.ox, y: s.rally.y + a.oy };
    const aggro = a.kind === 'guard' ? 70 : 38;
    let f = null, fd = aggro * aggro;
    for (const e of s.foes) { if (e.hp <= 0) continue; const d = d2(e, a); if (d < fd && (a.kind !== 'guard' || e.y > LINE - 90)) { fd = d; f = e; } }
    if (f) {
      const reach = FOES[f.kind].r + A.r + 4;
      if (fd > reach * reach) moveTo(a, f.x, f.y, v);
      else { f.hp -= A.bite * bite * DT; f.hurt = 0.12; a.bit = 0.1; f.lastBy = a.id; }
    } else moveTo(a, home.x, home.y, v);
    if (k.acid && a.kind !== 'guard') { // acid trail: a soldier that has moved leaves a drop now and then
      a.drip = (a.drip || 0) + DT;
      if (a.drip > 0.5 && (a.lx === undefined || Math.abs(a.lx - a.x) + Math.abs(a.ly - a.y) > 6)) { a.drip = 0; a.lx = a.x; a.ly = a.y; if (s.acid.length < 160) s.acid.push({ x: a.x, y: a.y, life: 2.5 }); }
    }
  }
  // acid
  if (s.acid.length) {
    const dps = 5 * k.acid;
    for (const p of s.acid) { p.life -= DT; for (const e of s.foes) if (!FOES[e.kind].fly && e.hp > 0 && d2(p, e) < 100) { e.hp -= dps * DT / 2; e.hurt = Math.max(e.hurt, 0.05); } }
    s.acid = s.acid.filter(p => p.life > 0);
  }
  // deaths
  const alive = [];
  for (const e of s.foes) {
    if (e.hp > 0) { alive.push(e); continue; }
    if (e.arrived) continue;
    s.kills++; s.score += FOES[e.kind].cost * 10;
    const n = Math.max(1, Math.round(FOES[e.kind].cost / 1.5));
    for (let i = 0; i < n; i++) s.crumbs.push({ x: e.x + (s.r() - 0.5) * 14, y: e.y + (s.r() - 0.5) * 14, taken: false });
    s.fx.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind });
  }
  s.foes = alive;
  s.crumbs = s.crumbs.filter(c => !c.taken);
  const living = [];
  for (const a of s.ants) {
    if (a.hp > 0) { living.push(a); continue; }
    s.lostAnts++; s.fx.push({ type: 'die', x: a.x, y: a.y, kind: a.kind });
    if (a.kind === 'soldier' && k.split && MUT.name !== 'nosplit') {
      for (let i = 0; i < k.split + 1; i++) { const b = { ...a }; Object.assign(b, { id: ++s.id, kind: 'small', hp: ANTS.small.hp, max: ANTS.small.hp, x: a.x + (i - 0.5) * 6, ox: a.ox + (i - 0.5) * 8 }); living.push(b); }
      s.fx.push({ type: 'split', x: a.x, y: a.y });
    }
  }
  s.ants = living;
  // hatch
  while (s.stock >= hatchNeed(s)) { s.stock -= hatchNeed(s); s.hatched++; const n = addAnt(s, 'soldier', NEST.x, NEST.y - 14); s.fx.push({ type: 'hatch', x: n.x, y: n.y }); }
  // end of wave or run
  if (s.nest.hp <= 0 || !s.ants.length) { s.nest.hp = Math.max(0, s.nest.hp); s.phase = 'lost'; s.fx.push({ type: 'lost' }); return s; }
  if (!s.queue.length && !s.foes.length) {
    s.score += 100 + s.nest.hp * 5;
    if (k.honey) s.nest.hp = Math.min(s.nest.max, s.nest.hp + 2 * k.honey);
    // the colony regroups: two new soldiers for the next wave
    for (let i = 0; i < 2; i++) addAnt(s, 'soldier', NEST.x + (i - 0.5) * 20, NEST.y - 20);
    if (s.wave >= WAVES) { s.phase = 'won'; s.score += 500; s.fx.push({ type: 'won' }); return s; }
    s.phase = 'draft'; s.offer = deal(s); s.fx.push({ type: 'cleared', n: s.wave });
  }
  return s;
}

// A short fingerprint of the state, for the determinism check.
export function digest(s) {
  let h = 2166136261;
  const mix = v => { h ^= Math.round(v * 100) | 0; h = Math.imul(h, 16777619) >>> 0; };
  mix(s.t); mix(s.wave); mix(s.nest.hp); mix(s.kills); mix(s.score);
  for (const a of s.ants) { mix(a.x); mix(a.y); mix(a.hp); }
  for (const f of s.foes) { mix(f.x); mix(f.y); mix(f.hp); }
  return h.toString(16);
}
