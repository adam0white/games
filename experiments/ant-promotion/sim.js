// Ant Promotion: rules and world, no drawing. Deterministic for a given seed, input sequence and rival. It never calls the network.
export const WORLD = 2000, TOP = 18, MOBS = 64;
const SPEED = { slow: 104, medium: 124, fast: 150 };
const ROLE = {
  brute: { dp: 4, speed: 'slow', stealth: 1, trait: 'Strong, but slow' },
  runner: { dp: -3, speed: 'fast', stealth: 1, trait: 'Fast, but weaker' },
  sneak: { dp: 0, speed: 'medium', stealth: 0.6, trait: 'Hard to notice' },
};
// name, kind, main colour, dark colour, accent colour, drawing flags
const TREE = [
  [['Beetle', 'bug', '#3d6a34', '#1f3a1b', '#9fe07a', { round: 1, pin: 1 }], ['Fire Ant', 'bug', '#e0481f', '#8a1f0c', '#ffb13b', { pin: 1 }], ['Spider', 'bug', '#4a4252', '#221e28', '#d6cfe6', { legs: 8, fat: 1, bare: 1 }]],
  [['Scorpion', 'bug', '#c79a4a', '#8a6424', '#3b2a10', { claws: 1, sting: 1, bare: 1 }], ['Wasp', 'bug', '#f2c21c', '#2a2410', '#2a2410', { wings: 1, stripes: 1 }], ['Mantis', 'bug', '#6fbf3a', '#3f7a1c', '#d6f2a0', { long: 1, claws: 1 }]],
  [['Crab', 'bug', '#e0603a', '#9a3418', '#ffd0b0', { legs: 8, claws: 1, wide: 1, bare: 1 }], ['Mouse', 'quad', '#b9b2a8', '#8a8278', '#f2b6b6', { ears: 'round', tail: 'thin' }], ['Frog', 'quad', '#4fae4a', '#2f7a2c', '#d6f28a', { frog: 1, spots: 1 }]],
  [['Mole', 'quad', '#4a3f3a', '#2c2420', '#f2b6b6', { snout: 1, arms: 1, tail: 'stub' }], ['Lizard', 'quad', '#7fb86a', '#4f8a3c', '#e6f2a0', { liz: 1, tail: 'long', stripes: 1 }], ['Bat', 'bird', '#4b3d57', '#2c2236', '#8a7a9a', { membrane: 1, ears: 1 }]],
  [['Porcupine', 'quad', '#6b5a48', '#3d3226', '#f2ead6', { spikes: 1, tail: 'stub' }], ['Squirrel', 'quad', '#c9702e', '#8a4a1c', '#f2d6b0', { ears: 'point', tail: 'bushy' }], ['Snake', 'snake', '#5d9a3c', '#356a1c', '#e6f28a', { stripes: 1 }]],
  [['Turtle', 'quad', '#7fae5a', '#3f6a3a', '#a8d67a', { shell: 1, tail: 'stub' }], ['Rabbit', 'quad', '#e8e2d6', '#b9b2a4', '#ffffff', { ears: 'long', tail: 'stub' }], ['Owl', 'bird', '#8a6a44', '#5a4226', '#f2e2b6', { round: 1 }]],
  [['Badger', 'quad', '#5a5a5e', '#2c2c30', '#f4f4f4', { headStripe: 1, tail: 'stub', wide: 1 }], ['Cat', 'quad', '#e09a3a', '#a8641c', '#fff0d6', { ears: 'point', tail: 'thin', stripes: 1 }], ['Fox', 'quad', '#e2622a', '#9a3a12', '#ffffff', { ears: 'point', tail: 'bushy', snout: 1 }]],
  [['Dog', 'quad', '#b98a5a', '#6a4a2a', '#f2e2c6', { ears: 'flop', tail: 'thin', spots: 1 }], ['Eagle', 'bird', '#5a3d24', '#3a2614', '#f6f6f0', { whiteHead: 1 }], ['Lynx', 'quad', '#c9a878', '#7a5a34', '#2a2a2a', { ears: 'point', tail: 'stub', spots: 1 }]],
  [['Boar', 'quad', '#5b4638', '#33261c', '#f4f0e0', { tusks: 1, tail: 'thin', mane: 1, wide: 1 }], ['Deer', 'quad', '#b9834f', '#7a5228', '#f2e6d0', { antlers: 1, tail: 'stub', spots: 1 }], ['Wolf', 'quad', '#8d9199', '#555a62', '#e6e8ec', { ears: 'point', tail: 'bushy', snout: 1 }]],
  [['Gorilla', 'quad', '#33333a', '#1c1c22', '#6a6a74', { wide: 1, arms: 1 }], ['Ostrich', 'quad', '#3a3230', '#1f1a18', '#f2c6b0', { neck: 1, tail: 'bushy' }], ['Panther', 'quad', '#24243a', '#12121f', '#e6d24a', { ears: 'round', tail: 'long' }]],
  [['Crocodile', 'quad', '#4f6a3a', '#2f4a22', '#c6d68a', { liz: 1, snout: 1, tail: 'thick', spots: 1 }], ['Cheetah', 'quad', '#e8b84a', '#2a2210', '#fff2c6', { ears: 'round', tail: 'long', spots: 1 }], ['Python', 'snake', '#a88a3a', '#5a4418', '#f2e2a0', { long: 1, stripes: 1 }]],
  [['Bear', 'quad', '#6a4528', '#3d2614', '#c69a6a', { ears: 'round', wide: 1, tail: 'stub', snout: 1 }], ['Zebra', 'quad', '#f1f1f1', '#1c1c1c', '#1c1c1c', { stripes: 1, mane: 1, tail: 'tuft' }], ['Tiger', 'quad', '#f08a1c', '#1c1408', '#fff2e0', { stripes: 1, ears: 'round', tail: 'long' }]],
  [['Hippo', 'quad', '#8a7a8a', '#5a4c5a', '#d6b6c6', { wide: 1, ears: 'round', tail: 'stub', bigHead: 1 }], ['Lion', 'quad', '#d9a84a', '#9a6a1c', '#8a4a14', { mane: 2, tail: 'tuft' }], ['Komodo', 'quad', '#6e6a55', '#45412f', '#c6c2a0', { liz: 1, tail: 'thick' }]],
  [['Elephant', 'quad', '#8f9299', '#62656c', '#f4f0e0', { trunk: 1, tusks: 1, bigEars: 1, wide: 1, tail: 'thin' }], ['Giraffe', 'quad', '#e6b85a', '#8a5a1c', '#fff2c6', { neck: 1, spots: 1, tail: 'tuft' }], ['Sabertooth', 'quad', '#c98f4f', '#7a4f1f', '#fffbe6', { tusks: 1, ears: 'round', tail: 'stub', stripes: 1 }]],
  [['T-Rex', 'quad', '#7a5a3a', '#4a3420', '#e6d6a0', { liz: 1, bigHead: 1, tail: 'thick', stripes: 1 }], ['Raptor', 'quad', '#3f8a7a', '#1f564a', '#f2c63a', { liz: 1, tail: 'long', snout: 1, stripes: 1 }], ['Pterodactyl', 'bird', '#a8704f', '#6a4028', '#e6c6a0', { membrane: 1, crest: 1 }]],
  [['Yeti', 'quad', '#e9f1f7', '#b0c2d0', '#7fb0d6', { wide: 1, arms: 1, mane: 1 }], ['Griffin', 'bird', '#c99a3a', '#8a6218', '#f6f6f0', { four: 1, whiteHead: 1, longTail: 1 }], ['Basilisk', 'snake', '#3aa87a', '#1c6a48', '#f2d63a', { crest: 1, long: 1 }]],
  [['Dragon', 'bird', '#c0271f', '#7a120e', '#f2b63a', { membrane: 1, horns: 1, longTail: 1 }], ['Thunderbird', 'bird', '#2a6fd9', '#163f8a', '#f2e23a', { crest: 1, longTail: 1 }], ['Hydra', 'snake', '#6a44c0', '#3a2278', '#c6f23a', { heads: 3, long: 1 }]],
];
const form = (level, name, kind, c, d, e, f, power, speed, stealth, trait, role) =>
  ({ level, name, kind, c, d, e, f, power, speed: SPEED[speed], pace: speed, stealth, trait, role, r: level ? 9 + level * 1.2 : 6.5, range: level ? 110 + 4 * level : 70 });
export const FORMS = [
  form(0, 'Aphid', 'bug', '#a8d66a', '#6a9a34', '#e6f2c6', { fat: 1 }, 3, 'slow', 1, '', 'food'),
  form(0, 'Mite', 'bug', '#d66a6a', '#8a2c2c', '#f2c6c6', { legs: 8, fat: 1, bare: 1 }, 5, 'fast', 1, '', 'food'),
  form(0, 'Grub', 'snake', '#f2e6c6', '#d6c08a', '#8a5a2a', { grub: 1 }, 7, 'slow', 1, '', 'food'),
  form(1, 'Ant', 'bug', '#3a2a22', '#1f1612', '#c98a5a', { pin: 1 }, 10, 'medium', 1, '', 'ant'),
];
export const ANT = 3;
TREE.forEach((row, i) => row.forEach((t, j) => {
  const role = ['brute', 'runner', 'sneak'][j], R = ROLE[role], level = i + 2;
  FORMS.push(form(level, t[0], t[1], t[2], t[3], t[4], t[5], level * 10 + R.dp, R.speed, R.stealth, R.trait, role));
}));
FORMS.forEach((f, i) => { f.id = i; });
export const optionsFor = level => FORMS.filter(f => f.level === level + 1);
export const needFor = level => 8 + level;
export const article = name => (/^[AEIOU]/.test(name) ? 'an ' : 'a ') + name;

// The contact rule, as the owner wrote it. `alert` means the mob has noticed the player.
//   weaker, has not noticed            -> eat (this is the sneak-up)
//   weaker, noticed, not faster        -> eat
//   weaker, noticed, faster            -> cannot eat
//   stronger                           -> the player dies (a slower one can be outrun before contact)
//   same power                         -> nothing
export function encounter(player, mob) {
  if (mob.power < player.power) return !mob.alert || mob.speed <= player.speed ? 'eat' : 'none';
  if (mob.power > player.power) return 'die';
  return 'none';
}

function rng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const CONE = 1.13; // half-angle a mob can see, radians
export const SPAWN_WEIGHTS = [[-3, 1], [-2, 3], [-1, 5], [0, 3], [1, 2], [2, 1]];

// Wild rules (a variant; classic is the default and is unchanged):
//   thick hide: a strong (brute) animal survives one bite, then the hide needs HIDE_S seconds to grow back
//   the hunt: every HUNT_EVERY seconds the nearest stronger animal within HUNT_REACH tracks you for HUNT_S seconds, wherever it is looking
export const HIDE_S = 25, HUNT_EVERY = 45, HUNT_S = 5, HUNT_REACH = 700;
export const hideReady = s => !!s.wild && me(s).role === 'brute' && s.t >= s.player.hideAt;

// ---------- the rival (from the wildcard lab, where it is called the Nemesis)
// The animal that kills the player becomes the rival: one mob, marked `nem`, that stays in the world until the player eats it.
// Power the rival gains each time it kills the player again (one level's worth), and the most it can gain in all.
export const NEM_STEP = 10, NEM_MAX_BONUS = 30;
// Bar points for eating the rival, on top of the normal gain.
export const NEM_PRIZE = 6;
// How each temperament changes behaviour. sight and cone scale the sight wedge; idle false means it stands still
// when it has not noticed the player; chase scales chase speed; turn is the chase turn rate (radians/s);
// hold and reach scale how long and how far it keeps chasing after losing sight; hunt scales the time between
// trips to look for the player; flee is the power margin at which it runs from the player instead of chasing.
export const TEMPERAMENTS = {
  ambusher: { sight: 1.35, cone: 1.3, idle: false, chase: 1, turn: 7, hold: 0.8, reach: 0.9, hunt: 1.6, flee: 0 },
  stalker: { sight: 1.15, cone: 1, idle: true, chase: 1.08, turn: 7, hold: 1.4, reach: 1.2, hunt: 1, flee: 0 },
  brute: { sight: 1, cone: 1, idle: true, chase: 1.1, turn: 3.5, hold: 2, reach: 1.5, hunt: 1, flee: 0 },
  coward: { sight: 1.1, cone: 1, idle: true, chase: 1, turn: 7, hold: 0.5, reach: 0.7, hunt: 1.2, flee: 12 },
};
export const TEMPERAMENT_NAMES = Object.keys(TEMPERAMENTS);
// persistence 1-3: how long it keeps a chase going, how far it follows, and how often it comes looking for the player.
// territory 1-3: how far it wanders from its home spot before walking back.
const HOLD = [0, 1.5, 2.5, 3.5], FORGET = [0, 1.2, 1.5, 1.8], SEEK = [0, 45, 30, 18], RADIUS = [0, 250, 450, 700];
export const DEFAULT_KNOBS = { temperament: 'stalker', persistence: 2, territory: 2 };
export function cleanKnobs(k = {}) {
  const int = (v, d) => (Number.isInteger(v) ? clamp(v, 1, 3) : d);
  return { temperament: TEMPERAMENTS[k?.temperament] ? k.temperament : DEFAULT_KNOBS.temperament, persistence: int(k?.persistence, 2), territory: int(k?.territory, 2) };
}
// A coward runs once the player is within this much of its power: at most T.flee, and at most a quarter of its own power,
// so a small rival does not run from the ant it has just eaten.
const fleeMargin = (T, power) => Math.min(T.flee, power * 0.25);
// Power of a mob, counting the rival's gains. Use this, not FORMS[m.f].power, wherever a mob is compared with the player.
export const powerOf = m => FORMS[m.f].power + (m.bonus || 0);

// nemesis: what nemesisSave() returned on an earlier visit, or null for a world with no rival.
export function create(seed = 1, stack = [ANT], xp = 0, weights = SPAWN_WEIGHTS, wild = false, nemesis = null) {
  const s = { wild, huntAt: HUNT_EVERY, hides: 0, hunts: 0, mobEats: 0, rand: rng(seed), nrand: rng((seed ^ 0x5bd1e995) >>> 0), t: 0, tick: 0, weights, mobs: [], events: [], choosing: null, dead: null, won: false, eaten: 0, deaths: 0, nextId: 1,
    nemesis: null, player: { x: WORLD / 2, y: WORLD / 2, a: 0, ph: 0, stack: stack.slice(), xp, safe: 2.5, hideAt: 0, busy: 0 } };
  while (s.mobs.length < MOBS) spawn(s, 260);
  if (nemesis && FORMS[nemesis.f]) placeNemesis(s, nemesis);
  return s;
}
// What the player is now. Picking the same kind again builds on it: each earlier fast pick makes a fast animal faster (fastBoost),
// each earlier sneaky pick shrinks the distance a sneaky animal is seen from by 5%. `again` counts the picks of this kind.
// Fast again (revised 2026-11-23, note #46): 5% a pick showed as about 2% on screen, because the view zooms out each level.
// Now SAME_FAST a pick, capped at FAST_CAP times the plain fast speed. fastBoost(k) is the factor after k fast picks.
export const SAME_FAST = 1.12, FAST_CAP = 2.5, SAME_SNEAK = 0.95;
export const fastBoost = k => Math.min(FAST_CAP, SAME_FAST ** Math.max(0, k - 1));
export const me = s => {
  const p = s.player, id = p.stack[p.stack.length - 1], key = p.stack.length * 1000 + id;
  if (p.meKey !== key) {
    const F = FORMS[id]; let k = 0; for (const i of p.stack) if (FORMS[i].role === F.role) k++;
    p.meKey = key; p.me = { ...F, again: k, speed: F.role === 'runner' ? F.speed * fastBoost(k) : F.speed, stealth: F.role === 'sneak' ? F.stealth * SAME_SNEAK ** (k - 1) : F.stealth };
  }
  return p.me;
};
export const level = s => s.player.stack.length;
export const nemesisMob = s => (s.nemesis ? s.mobs.find(m => m.id === s.nemesis.id) : null);

// The rival uses its own random stream (nrand), so a world without one runs exactly as it did before the rival existed.
function farSpot(s, from = 700) {
  let x = 0, y = 0;
  for (let i = 0; i < 40; i++) { x = 80 + s.nrand() * (WORLD - 160); y = 80 + s.nrand() * (WORLD - 160); if (Math.hypot(x - s.player.x, y - s.player.y) > from) break; }
  return { x, y };
}
function placeNemesis(s, n) {
  const { x, y } = farSpot(s);
  const m = { id: s.nextId++, f: n.f, x, y, a: s.nrand() * 6.283, alert: false, lost: 0, timer: 0, want: 0, walk: false, ph: 0, nem: true, bonus: clamp(n.bonus | 0, 0, NEM_MAX_BONUS) };
  s.mobs.push(m);
  s.nemesis = { id: m.id, f: n.f, bonus: m.bonus, kills: n.kills | 0, escapes: n.escapes | 0, kin: n.kin | 0, knobs: cleanKnobs(n.knobs), home: { x, y }, rest: 0, hunt: 20, seek: 0, chase: 0, stalk: 0, commit: false };
}
// Make the mob that killed the player the rival. Only when no rival is alive. Call it after a 'die' event.
// The rival takes no part in animals hunting each other: it drops its own chase, and whoever was chasing it lets go.
export function crown(s, mobId, knobs) {
  if (s.nemesis) return false;
  const m = s.mobs.find(x => x.id === mobId); if (!m || m.gone) return false;
  m.nem = true; m.bonus = 0; m.chase = m.fear = null; m.fed = 0; m.hunt = 0;
  for (const o of s.mobs) { if (o.chase === m) o.chase = null; if (o.fear === m) o.fear = null; }
  s.nemesis = { id: m.id, f: m.f, bonus: 0, kills: 1, escapes: 0, kin: 0, knobs: cleanKnobs(knobs), home: { x: m.x, y: m.y }, rest: 20, hunt: SEEK[2], seek: 0, chase: 0, stalk: 0, commit: false };
  s.events.push({ t: 'nemRise', f: m.f });
  return true;
}
// The part of the rival worth saving between visits.
export const nemesisSave = s => (s.nemesis ? { f: s.nemesis.f, bonus: s.nemesis.bonus, kills: s.nemesis.kills, escapes: s.nemesis.escapes, kin: s.nemesis.kin, knobs: { ...s.nemesis.knobs } } : null);

function spawn(s, minDist) {
  const pl = level(s), total = s.weights.reduce((n, w) => n + w[1], 0);
  let roll = s.rand() * total, off = 0;
  for (const [o, w] of s.weights) { if ((roll -= w) < 0) { off = o; break; } }
  const pool = FORMS.filter(f => f.level === clamp(pl + off, 0, TOP)), f = pool[Math.floor(s.rand() * pool.length)];
  let x = 0, y = 0;
  for (let i = 0; i < 30; i++) { x = 40 + s.rand() * (WORLD - 80); y = 40 + s.rand() * (WORLD - 80); if (Math.hypot(x - s.player.x, y - s.player.y) > minDist) break; }
  const m = { id: s.nextId++, f: f.id, x, y, a: s.rand() * 6.283, alert: false, lost: 0, timer: 0, want: 0, walk: false, ph: s.rand() * 6 };
  s.mobs.push(m);
  return m;
}

// input: { x, y } with length up to 1. One call advances 1/60 s.
export function step(s, input) {
  s.events.length = 0;
  if (s.choosing || s.dead) return s;
  const dt = 1 / 60, p = s.player, F = me(s), N = s.nemesis;
  s.t += dt; s.tick++;
  if (p.safe > 0) p.safe -= dt;
  if (p.busy > 0) p.busy -= dt;
  let ix = input?.x || 0, iy = input?.y || 0; const il = Math.hypot(ix, iy);
  if (il > 1) { ix /= il; iy /= il; }
  if (il > 0.01) { p.a = Math.atan2(iy, ix); p.ph += Math.min(1, il) * dt * 10; }
  p.x = clamp(p.x + ix * F.speed * dt, F.r, WORLD - F.r); p.y = clamp(p.y + iy * F.speed * dt, F.r, WORLD - F.r);

  if (s.wild && s.t >= s.huntAt) {
    let hunter = null, near = HUNT_REACH;
    for (const m of s.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (powerOf(m) > F.power && !m.alert && d < near) { near = d; hunter = m; } }
    if (hunter && p.safe <= 0) { hunter.hunt = HUNT_S; s.hunts++; s.huntAt = s.t + HUNT_EVERY; s.events.push({ t: 'hunt', id: hunter.id, name: FORMS[hunter.f].name }); }
    else s.huntAt = s.t + 2; // nobody in reach, or you are still safe: look again soon
  }
  if (N) {
    if (N.rest > 0) N.rest -= dt;
    else if ((N.hunt -= dt) <= 0) {
      const T = TEMPERAMENTS[N.knobs.temperament], m = nemesisMob(s);
      if (!(T.flee && m && powerOf(m) - F.power <= fleeMargin(T, powerOf(m)))) N.seek = 8 + 4 * N.knobs.persistence; // a coward stays home once the player is close to its power
      N.hunt = SEEK[N.knobs.persistence] * T.hunt * (0.8 + s.nrand() * 0.4);
    }
    if (N.seek > 0) { N.seek -= dt; N.home = { x: p.x, y: p.y }; } // it comes looking for you
  }
  for (let i = s.mobs.length - 1; i >= 0; i--) {
    const m = s.mobs[i], M = FORMS[m.f], dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy), to = Math.atan2(dy, dx);
    if (m.hunt > 0) m.hunt -= dt;
    const T = m.nem ? TEMPERAMENTS[N.knobs.temperament] : null, power = powerOf(m);
    const range = M.range * (T ? T.sight : 1), cone = CONE * (T ? T.cone : 1);
    const sees = p.safe <= 0 && (m.hunt > 0 || d < range * F.stealth + F.r && Math.abs(wrap(to - m.a)) < cone);
    const wasAlert = m.alert;
    if (sees) { if (!m.alert && power !== F.power) s.events.push({ t: 'notice', strong: power > F.power, id: m.id, nem: !!m.nem }); m.alert = true; m.lost = 0; }
    else if (m.alert) {
      const forget = T ? FORGET[N.knobs.persistence] * T.reach : 1.8, hold = T ? HOLD[N.knobs.persistence] * T.hold : 1.5;
      m.lost = d > range * forget ? m.lost + dt : 0; if (m.lost > hold || p.safe > 0) m.alert = false;
    }
    // animals hunt each other: a stronger animal that sees a weaker one (at most 2 levels below, never the little food bugs) chases it.
    // The rival takes no part: it hunts only the player, and no animal hunts it.
    if (m.fed > 0) m.fed -= dt;
    if (!m.nem && (s.tick + m.id) % 12 === 0) {
      const was = m.chase; m.chase = m.fear = null; let bc = Infinity, bf = Infinity;
      if (M.level >= 1) for (const o of s.mobs) {
        if (o === m || o.gone || o.nem) continue; const O = FORMS[o.f], op = powerOf(o); if (op === power || O.level < 1) continue;
        const ex = o.x - m.x, ey = o.y - m.y; if (ex > 220 || ex < -220 || ey > 220 || ey < -220) continue; const e = Math.hypot(ex, ey);
        if (op > power) { if (o.chase === m && e < bf) { bf = e; m.fear = o; } }
        else if (!(m.fed > 0) && M.level - O.level <= 2 && e < M.range * 0.85 && e < bc && Math.abs(wrap(Math.atan2(ey, ex) - m.a)) < CONE) { bc = e; m.chase = o; }
      }
      m.chaseFor = m.chase && m.chase === was ? (m.chaseFor || 0) + 0.2 : 0;
      if (m.chaseFor > 6) { m.chase = null; m.fed = 5; } // gives up on prey it cannot catch
    }
    if (m.chase?.gone) m.chase = null; if (m.fear?.gone) m.fear = null;
    let speed = 0, turn = 2.5;
    // a coward rival runs once the player's power gets close to its own
    const flees = power < F.power || (T && T.flee && power - F.power <= fleeMargin(T, power));
    if (m.alert && power !== F.power) {
      turn = 7; speed = M.speed;
      if (!flees) {
        m.want = to;
        if (T) {
          turn = T.turn; speed = M.speed * T.chase; N.chase += dt;
          if (N.knobs.temperament === 'stalker' && !N.commit) { // follow at the edge of sight; strike when the player is busy eating or comes close
            N.stalk += dt;
            if (p.busy > 0 || d < range * 0.45 || N.stalk > 7) N.commit = true;
            else speed = d > range * 0.7 ? Math.min(M.speed, F.speed) * 0.95 : 0;
          }
        }
      } else { // run away; near a wall, slide along it
        let fx = -dx / (d || 1), fy = -dy / (d || 1); const pad = 90;
        if (m.x < pad) fx += (pad - m.x) / 40; if (m.x > WORLD - pad) fx -= (m.x - WORLD + pad) / 40;
        if (m.y < pad) fy += (pad - m.y) / 40; if (m.y > WORLD - pad) fy -= (m.y - WORLD + pad) / 40;
        m.want = Math.atan2(fy, fx);
      }
    } else if (m.fear) {
      turn = 7; speed = M.speed; m.want = Math.atan2(m.y - m.fear.y, m.x - m.fear.x);
      if (m.x < 70 || m.x > WORLD - 70 || m.y < 70 || m.y > WORLD - 70) m.want = Math.atan2(WORLD / 2 - m.y, WORLD / 2 - m.x);
    } else if (m.chase) {
      turn = 6; speed = M.speed * 0.8; m.want = Math.atan2(m.chase.y - m.y, m.chase.x - m.x);
      if (Math.hypot(m.chase.x - m.x, m.chase.y - m.y) < (M.r + FORMS[m.chase.f].r) * 0.8) {
        m.chase.gone = true; m.fed = 15; s.mobEats++; s.events.push({ t: 'mobeat', name: FORMS[m.chase.f].name, by: M.name, x: m.chase.x, y: m.chase.y }); m.chase = null;
      }
    } else {
      m.timer -= dt;
      const rand = T ? s.nrand : s.rand;
      if (m.timer <= 0) { m.walk = rand() < 0.7; m.timer = 0.6 + rand() * 2.6; m.want = m.a + (rand() - 0.5) * 3.2; }
      if (m.x < 70 || m.x > WORLD - 70 || m.y < 70 || m.y > WORLD - 70) m.want = Math.atan2(WORLD / 2 - m.y, WORLD / 2 - m.x);
      speed = m.walk ? M.speed * 0.38 : 0;
      if (T) {
        if (!T.idle) speed = 0; // an ambusher waits
        const hx = N.home.x - m.x, hy = N.home.y - m.y;
        if (Math.hypot(hx, hy) > RADIUS[N.knobs.territory]) { m.want = Math.atan2(hy, hx); speed = M.speed * 0.6; turn = 4; }
      }
    }
    if (T && wasAlert && !m.alert) { // the player got away
      if (N.chase > 1.5 && power > F.power && !s.dead) { N.escapes++; s.events.push({ t: 'nemEscape', escapes: N.escapes }); }
      N.chase = 0; N.stalk = 0; N.commit = false;
    }
    m.a += clamp(wrap(m.want - m.a), -turn * dt, turn * dt);
    m.x = clamp(m.x + Math.cos(m.a) * speed * dt, M.r, WORLD - M.r); m.y = clamp(m.y + Math.sin(m.a) * speed * dt, M.r, WORLD - M.r);
    m.ph += speed * dt * 0.09;

    if (!m.gone && d < (M.r + F.r) * 0.85) {
      const out = encounter(F, { power, speed: M.speed, alert: m.alert });
      if (out === 'eat') {
        let gain = M.level >= F.level - 1 ? 3 : M.level === F.level - 2 ? 2 : 1;
        m.gone = true; s.mobs.splice(i, 1); s.eaten++; p.busy = 1.2;
        if (m.nem) { // the payoff: a prize, and the world has no rival until the next death
          gain += NEM_PRIZE;
          s.events.push({ t: 'nemEaten', f: m.f, kills: N.kills, escapes: N.escapes, kin: N.kin, x: m.x, y: m.y });
          s.nemesis = null;
        } else if (N && m.f === N.f) { N.kin++; s.events.push({ t: 'kin', kin: N.kin }); }
        p.xp += gain;
        s.events.push({ t: 'eat', name: M.name, gain, x: m.x, y: m.y, nem: !!m.nem });
      } else if (out === 'die' && p.safe <= 0 && hideReady(s)) { // wild: the hide takes the bite and you are thrown clear
        p.hideAt = s.t + HIDE_S; p.safe = 1.5; s.hides++;
        p.x = clamp(p.x + dx / (d || 1) * 70, F.r, WORLD - F.r); p.y = clamp(p.y + dy / (d || 1) * 70, F.r, WORLD - F.r);
        s.events.push({ t: 'hide', name: M.name, x: p.x, y: p.y });
      } else if (out === 'die' && p.safe <= 0) {
        s.dead = { as: F.name, to: M.name, level: level(s), killer: m.id, nem: !!m.nem }; s.deaths++;
        s.events.push({ t: 'die', killer: m.id, nem: !!m.nem });
        if (m.nem) { // the rival gets stronger and goes home to rest
          N.kills++; N.bonus = m.bonus = Math.min(NEM_MAX_BONUS, m.bonus + NEM_STEP);
          N.rest = 25; N.seek = 0; N.chase = 0; N.stalk = 0; N.commit = false; m.alert = false; m.hunt = 0;
          s.events.push({ t: 'nemKill', kills: N.kills, bonus: N.bonus });
        }
        return s;
      } else if (d > 0.01) { // bump apart
        const push = (M.r + F.r) * 0.85 - d; m.x -= dx / d * push; m.y -= dy / d * push;
      }
    }
  }
  for (let i = s.mobs.length - 1; i >= 0; i--) if (s.mobs[i].gone) s.mobs.splice(i, 1);
  if (p.xp >= needFor(level(s))) {
    if (level(s) < TOP) { s.choosing = optionsFor(level(s)); s.events.push({ t: 'full' }); }
    else { p.xp = needFor(TOP); if (!s.won) { s.won = true; s.events.push({ t: 'win' }); } }
  }
  if (s.tick % 20 === 0) upkeep(s);
  return s;
}

function upkeep(s) {
  const p = s.player, pl = level(s);
  for (let i = s.mobs.length - 1; i >= 0; i--) {
    const m = s.mobs[i], gap = FORMS[m.f].level - pl;
    if (!m.nem && (gap < -3 || gap > 2) && Math.hypot(m.x - p.x, m.y - p.y) > 700) { m.gone = true; s.mobs.splice(i, 1); } // the rival is never cleared away
  }
  for (let i = 0; i < 4 && s.mobs.length < MOBS; i++) spawn(s, 520);
}

// Pick one of the three offered forms.
export function choose(s, i) {
  if (!s.choosing) return;
  const f = s.choosing[i]; s.player.stack.push(f.id); s.player.xp = 0; s.player.safe = 1.5; s.choosing = null;
  s.events.push({ t: 'evolve', name: f.name });
}

// After a death: go back one form (restart = false) or start over as an ant.
export function revive(s, restart) {
  if (!s.dead) return;
  const p = s.player;
  if (restart) { p.stack = [ANT]; s.won = false; } else if (p.stack.length > 1) p.stack.pop();
  p.xp = 0; p.safe = 2.5; p.busy = 0; p.x = WORLD / 2; p.y = WORLD / 2; s.dead = null;
  const F = me(s);
  s.mobs = s.mobs.filter(m => m.nem || powerOf(m) <= F.power || Math.hypot(m.x - p.x, m.y - p.y) > 520);
  const n = nemesisMob(s); // the rival is not removed; if it is close it is moved away
  if (n && Math.hypot(n.x - p.x, n.y - p.y) < 650) { const at = farSpot(s); n.x = at.x; n.y = at.y; n.alert = false; n.hunt = 0; s.nemesis.home = at; s.nemesis.seek = 0; }
  upkeep(s);
}

// Mobs the player could eat right now: weaker, and either not faster or not yet alert.
export const catchable = s => { const F = me(s); return s.mobs.filter(m => encounter(F, { power: powerOf(m), speed: FORMS[m.f].speed, alert: m.alert }) === 'eat' && (FORMS[m.f].speed <= F.speed || !m.alert)); };
