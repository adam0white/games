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
// How far and how wide each species sees (tester t1, note #148, 2026-11-23): [times its plain sight distance, half-angle].
// A snake sees a long thin strip, a bird nearly all the way round but close. Others differ where the animal suggests it; the rest keep the
// plain wedge [1, CONE]. Wide sights are shorter, so the area an animal watches stays about the same. Food bugs (level 0) keep the plain wedge.
// Animals hunting each other still use the plain wedge.
const SIGHT_KIND = { snake: [1.7, 0.42], bird: [0.62, 2.65] };
const SIGHT = {
  Spider: [0.75, 2.2], Mantis: [1.25, 0.8], Crab: [0.75, 2], Frog: [0.8, 2], Mole: [0.5, Math.PI], Lizard: [0.85, 1.7], Bat: [0.55, Math.PI], Turtle: [0.8, 0.9],
  Rabbit: [0.65, 2.1], Owl: [0.9, 1.6], Eagle: [0.7, 2.2], Deer: [0.65, 1.9], Ostrich: [1.2, 1.4], Cheetah: [1.4, 0.65], Python: [1.5, 0.5], Zebra: [0.65, 1.8],
  Giraffe: [1.35, 0.9], Pterodactyl: [0.7, 2.6], Griffin: [0.7, 2.3], Basilisk: [1.85, 0.34], Dragon: [0.8, 2.1], Hydra: [1, 1.9],
};
export const sightOf = F => (F.level < 1 ? [1, CONE] : SIGHT[F.name] || SIGHT_KIND[F.kind] || [1, CONE]);
export const sightWords = F => { const [far, half] = sightOf(F), w = half > 2.5 ? 'almost all round' : half > 1.6 ? 'wide' : half < 0.95 ? 'narrow' : '', d = far < 0.9 ? 'close' : far > 1.15 ? 'far' : ''; return [w, d].filter(Boolean).join(', ') || 'straight ahead'; };
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

// Ant Hide change: seeded geometry, solid movement and sight clipping.
const GRASS_PACE = 0.8;
const SEARCH_SECONDS = 3;
const BODY_LENGTH = 2;

const CELL = 200;
const CELLS_PER_SIDE = WORLD / CELL;
const coverIndex = new WeakMap();

function indexCover(items, padding) {
  const cells = Array.from({ length: CELLS_PER_SIDE ** 2 }, () => []);
  for (const item of items) {
    const extent = item.r + padding;
    const x0 = Math.max(0, Math.floor((item.x - extent) / CELL));
    const y0 = Math.max(0, Math.floor((item.y - extent) / CELL));
    const x1 = Math.min(CELLS_PER_SIDE - 1, Math.floor((item.x + extent) / CELL));
    const y1 = Math.min(CELLS_PER_SIDE - 1, Math.floor((item.y + extent) / CELL));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells[y * CELLS_PER_SIDE + x].push(item);
  }
  coverIndex.set(items, cells);
}

const nearbyCover = (items, x, y) =>
  coverIndex.get(items)?.[Math.floor(y / CELL) * CELLS_PER_SIDE + Math.floor(x / CELL)] ?? items;

const insideGrass = (patch, x, y) => (x - patch.x) ** 2 + (y - patch.y) ** 2 < patch.r ** 2;

export function grassAt(s, x, y) {
  return s.cover && nearbyCover(s.grass, x, y).find(patch => insideGrass(patch, x, y));
}

export function sharesGrass(s, x, y, tx, ty) {
  return s.cover && nearbyCover(s.grass, x, y).some(patch =>
    insideGrass(patch, x, y) && insideGrass(patch, tx, ty));
}

function rockDistance(s, x, y, dx, dy, maxDistance, radius = 0) {
  if (!s.cover) return maxDistance;
  let distance = maxDistance;
  const rocks = maxDistance + radius <= 38 ? nearbyCover(s.rocks, x, y) : s.rocks;
  for (const rock of rocks) {
    const rx = rock.x - x, ry = rock.y - y, r = rock.r + radius;
    const along = rx * dx + ry * dy, side = rx * dy - ry * dx;
    if (along <= 0 || along - r >= distance || Math.abs(side) >= r) continue;
    distance = Math.min(distance, Math.max(0, along - Math.sqrt(r * r - side * side)));
  }
  return distance;
}

export function sightDistance(s, x, y, angle, maxDistance) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const wallX = dx > 0 ? (WORLD - x) / dx : dx < 0 ? -x / dx : Infinity;
  const wallY = dy > 0 ? (WORLD - y) / dy : dy < 0 ? -y / dy : Infinity;
  return rockDistance(s, x, y, dx, dy, Math.min(maxDistance, wallX, wallY));
}

export function visibilityPolygon(s, mob) {
  const M = FORMS[mob.f], F = me(s);
  const T = mob.nem ? TEMPERAMENTS[s.nemesis.knobs.temperament] : null;
  const [far, half] = sightOf(M);
  const range = M.range * far * (T ? T.sight : 1) * F.stealth + F.r;
  const cone = Math.min(Math.PI, half * (T ? T.cone : 1));
  const points = [{ x: mob.x, y: mob.y }];
  const rays = Math.ceil(32 * cone);
  const angles = Array.from({ length: rays + 1 }, (_, i) => -cone + cone * 2 * i / rays);
  for (const rock of s.rocks || []) {
    const dx = rock.x - mob.x, dy = rock.y - mob.y, distance = Math.hypot(dx, dy);
    if (distance <= rock.r || distance - rock.r >= range) continue;
    const center = Math.atan2(dy, dx) - mob.a, offset = Math.asin(rock.r / distance);
    for (const side of [-1, 1]) for (const epsilon of [-0.00001, 0.00001]) {
      const edge = wrap(center + side * offset + epsilon);
      if (Math.abs(edge) < cone) angles.push(edge);
    }
  }
  angles.sort((a, b) => a - b);
  for (const relative of angles) {
    const angle = mob.a + relative;
    const distance = sightDistance(s, mob.x, mob.y, angle, range);
    points.push({ x: mob.x + Math.cos(angle) * distance, y: mob.y + Math.sin(angle) * distance });
  }
  return points;
}

export function clearSight(s, x, y, tx, ty) {
  if (!s.cover) return true;
  const dx = tx - x, dy = ty - y, distance = Math.hypot(dx, dy);
  return !distance || rockDistance(s, x, y, dx / distance, dy / distance, distance) >= distance;
}

function move(s, body, radius, dx, dy) {
  if (s.cover) {
    const length = Math.hypot(dx, dy);
    if (length) {
      const ux = dx / length, uy = dy / length;
      const distance = rockDistance(s, body.x, body.y, ux, uy, length, radius);
      if (distance < length) {
        const x = body.x + ux * distance, y = body.y + uy * distance;
        const rock = s.rocks.find(r => Math.hypot(x - r.x, y - r.y) <= r.r + radius + 1e-6);
        if (rock) {
          const nx = (x - rock.x) / (rock.r + radius), ny = (y - rock.y) / (rock.r + radius);
          const slide = (length - distance) * (ux * -ny + uy * nx);
          const slideAngle = Math.atan2(ny, nx) + slide / (rock.r + radius);
          body.x = rock.x + Math.cos(slideAngle) * (rock.r + radius + 1e-5);
          body.y = rock.y + Math.sin(slideAngle) * (rock.r + radius + 1e-5);
          return true;
        }
      }
    }
  }
  body.x = clamp(body.x + dx, radius, WORLD - radius);
  body.y = clamp(body.y + dy, radius, WORLD - radius);
  return false;
}

function coverLayout(seed) {
  const rand = rng(seed ^ 0x92d68ca2);
  const rocks = [{ x: 1068, y: 1102, r: 38 }, { x: 1244, y: 990, r: 38 }];
  const grass = [{ x: 1134, y: 925, r: 76 }, { x: 910, y: 1090, r: 70 }];
  for (let y = 200; y <= 1800; y += 220) for (let x = 200; x <= 1800; x += 220) {
    if (Math.hypot(x - WORLD / 2, y - WORLD / 2) < 450) continue;
    const cx = x + (rand() - 0.5) * 30, cy = y + (rand() - 0.5) * 30;
    rocks.push({ x: cx - 35, y: cy, r: 45 + rand() * 15 });
    const broad = ((x + y - 400) / 220) % 2 === 0;
    grass.push({ x: cx + 59, y: cy + 42, r: (broad ? 100 : 60) + rand() * 20 });
  }
  indexCover(rocks, 38);
  indexCover(grass, 0);
  return { rocks, grass };
}

function searchHeading(s, mob, radius, dx, dy) {
  const distance = Math.hypot(dx, dy);
  const forward = Math.atan2(dy, dx);
  if (!distance) return forward;
  const ux = dx / distance, uy = dy / distance;
  const hit = rockDistance(s, mob.x, mob.y, ux, uy, distance, radius);
  if (hit >= distance) return forward;
  const x = mob.x + ux * hit, y = mob.y + uy * hit;
  const rock = s.rocks.find(r => Math.hypot(x - r.x, y - r.y) <= r.r + radius + 1e-6);
  if (!rock) return forward;
  const around = Math.atan2(mob.y - rock.y, mob.x - rock.x);
  const destination = Math.atan2(mob.lastSeen.y - rock.y, mob.lastSeen.x - rock.x);
  const side = Math.sign(wrap(destination - around)) || 1;
  const next = around + side * 0.65, margin = rock.r + radius + 12;
  return Math.atan2(rock.y + Math.sin(next) * margin - mob.y, rock.x + Math.cos(next) * margin - mob.x);
}

// Ant Hide change: follow the last seen point, then sweep the sight cone.
function updateSearch(s, m, sees, blocked, wouldSee, p, dt) {
  if (sees) {
    m.lastSeen = { x: p.x, y: p.y };
    m.search = 0;
    m.sweeping = false;
    m.lostToCover = false;
    m.coverBlockedSight = false;
    return;
  }
  if (p.safe > 0 || m.stun > 0 || m.winded > 0) {
    m.alert = false;
    m.search = 0;
    m.sweeping = false;
    m.lastSeen = null;
    return;
  }
  if (m.alert && m.lastSeen && !(m.search > 0)) {
    m.search = SEARCH_SECONDS;
    m.lostToCover = blocked;
    m.coverBlockedSight = false;
    m.sweeping = false;
    m.rockTurn = 0;
    s.events.push({ t: 'search', id: m.id, x: m.lastSeen.x, y: m.lastSeen.y });
  }
  if (!(m.search > 0)) return;
  if (blocked && wouldSee) m.coverBlockedSight = true;
  if (!m.sweeping) return;
  m.search -= dt;
  if (m.search > 0) return;
  m.search = 0;
  m.sweeping = false;
  m.alert = false;
  m.lastSeen = null;
  if (m.lostToCover || m.coverBlockedSight) {
    // The hunter stops looking briefly when the player gets away.
    m.winded = 1;
    s.escapes++;
    s.events.push({ t: 'escape', id: m.id, x: m.x, y: m.y });
  }
}

// nemesis: what nemesisSave() returned on an earlier visit, or null for a world with no rival.
export function create(seed = 1, stack = [ANT], xp = 0, weights = SPAWN_WEIGHTS, wild = false, nemesis = null, cover = true) {
  const s = { wild, huntAt: HUNT_EVERY, hides: 0, hunts: 0, mobEats: 0, tired: 0, powers: 0, rand: rng(seed), nrand: rng((seed ^ 0x5bd1e995) >>> 0), t: 0, tick: 0, weights, mobs: [], events: [], choosing: null, dead: null, won: false, eaten: 0, deaths: 0, nextId: 1,
    nemesis: null, player: { x: WORLD / 2, y: WORLD / 2, a: 0, ph: 0, stack: stack.slice(), xp, safe: 2.5, hideAt: 0, busy: 0 } };
  // Ant Hide change: cover has a separate random stream and a teaching patrol.
  if (cover) Object.assign(s, coverLayout(seed), { cover, coverSeconds: 0, escapes: 0, hidden: false });
  while (s.mobs.length < MOBS) spawn(s, 260);
  if (cover && stack.length === 1) {
    const hunter = s.mobs[0];
    Object.assign(hunter, { f: 4, x: 1340, y: 1040, a: Math.PI, want: Math.PI, timer: 7, walk: true, teaching: true });
  }
  if (nemesis && FORMS[nemesis.f]) placeNemesis(s, nemesis);
  return s;
}
// What the player is now. Picking the same kind again builds on it: each earlier fast pick makes a fast animal faster (fastBoost),
// each earlier sneaky pick shrinks the distance a sneaky animal is seen from by 5%. `again` counts the picks of this kind.
// Fast again (revised 2026-11-23, note #46): 5% a pick showed as about 2% on screen, because the view zooms out each level.
// Now SAME_FAST a pick, capped at FAST_CAP times the plain fast speed. fastBoost(k) is the factor after k fast picks.
export const SAME_FAST = 1.12, FAST_CAP = 1.8, SAME_SNEAK = 0.95;
export const fastBoost = k => Math.min(FAST_CAP, SAME_FAST ** Math.max(0, k - 1));
// Stronger animals keep up (tester t1, note #101, 2026-11-23): once repeat fast picks made the player faster than every animal,
// nothing could catch them. A stronger animal now runs with the player's fast boost, and a fast one runs PACE_UP faster than that.
// A player without a fast boost (every brute or sneak, and a first fast pick) meets exactly the speeds it met before.
export const PACE_UP = 1.06;
// A hunter pounces on a fast animal (tester t1, note #149, 2026-11-23: "you just outrun every mob"). A medium or fast stronger animal that
// is fresh and within `near` of its sight distance dashes at `up` times the player's speed for `secs`, then needs `rest` seconds.
// Only a player whose current animal is a fast pick meets it; slow hunters never pounce, so what is marked slow can still be outrun.
export const POUNCE = { near: 0.62, up: 1.3, secs: 1, rest: 6 };
export const pounces = (M, F) => F.role === 'runner' && M.pace !== 'slow';
// Animals hunting each other try harder (note #106, 2026-11-23: "the animals don't strive and try enough to kill each other").
// Before: chase at 0.8 of plain speed, see prey within 0.85 of sight range, give up after 6 s, full for 15 s after a kill;
// prey flees at full speed, so only a faster hunter ever caught anything. Now a hunter runs at full speed, lunges when close,
// keeps its prey in mind once it has turned away and gives up later. It then stays full for 70 s, so the meadow is not
// emptied of the player's food: shorter rests (10 to 40 s) gave 50 to 95 kills a minute and cut careful bots' levels.
export const PREY = { run: 1, lunge: 1.3, close: 2.5, sight: 1, give: 8, fed: 70 };
// A hunter tires (owner, 2026-11-23: Wild "makes things impossible"; a hunter should slow down with time or stop after you run a while).
// A stronger animal chases the player at full pace for `fresh` seconds, slows evenly to `slow` of its pace by `spent` seconds, then
// gives up and cannot notice the player for `rest` seconds. Time not spent chasing wins the breath back. The rival does not tire:
// its temperament already sets how long it keeps at it.
export const TIRE = { fresh: 4, spent: 10, slow: 0.55, rest: 7 };
export const tirePace = m => { const k = ((m.tire || 0) - TIRE.fresh) / (TIRE.spent - TIRE.fresh); return k <= 0 ? 1 : 1 - (1 - TIRE.slow) * Math.min(1, k); };
export const chasePace = (M, F) => { const b = F.speed / SPEED[F.pace]; return b > 1 ? M.speed * b * (M.pace === 'fast' ? PACE_UP : 1) : M.speed; };
// How fast an animal is against the player, for the » mark: a stronger one at its chase pace, a weaker one at its own speed.
export const paceAgainst = (m, F) => (powerOf(m) > F.power ? chasePace(FORMS[m.f], F) : FORMS[m.f].speed);
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
  for (let i = 0; i < 40; i++) { x = 80 + s.nrand() * (WORLD - 160); y = 80 + s.nrand() * (WORLD - 160); if (Math.hypot(x - s.player.x, y - s.player.y) > from && !s.rocks?.some(r => Math.hypot(x - r.x, y - r.y) < r.r + 40)) break; }
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
  for (let i = 0; i < 30; i++) { x = 40 + s.rand() * (WORLD - 80); y = 40 + s.rand() * (WORLD - 80); if (Math.hypot(x - s.player.x, y - s.player.y) > minDist && !s.rocks?.some(r => Math.hypot(x - r.x, y - r.y) < r.r + f.r)) break; }
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
  if (p.cd > 0) p.cd -= dt; if (p.boost > 0) p.boost -= dt; if (p.veil > 0) p.veil -= dt;
  if (input?.power && !s.choosing) usePower(s);
  let ix = input?.x || 0, iy = input?.y || 0; const il = Math.hypot(ix, iy);
  if (il > 1) { ix /= il; iy /= il; }
  if (il > 0.01) { p.a = Math.atan2(iy, ix); p.ph += Math.min(1, il) * dt * 10; }
  // Ant Hide change: slow in grass, collide with rock and count time hidden.
  const pv = F.speed * (p.boost > 0 ? p.boostK : 1);
  if (s.cover) {
    const pace = grassAt(s, p.x, p.y) ? GRASS_PACE : 1;
    move(s, p, F.r, ix * pv * dt * pace, iy * pv * dt * pace);
    s.hidden = !!grassAt(s, p.x, p.y);
    if (s.hidden) s.coverSeconds += dt;
  } else {
    p.x = clamp(p.x + ix * pv * dt, F.r, WORLD - F.r); p.y = clamp(p.y + iy * pv * dt, F.r, WORLD - F.r);
  }

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
  const playerGrass = grassAt(s, p.x, p.y);
  for (let i = s.mobs.length - 1; i >= 0; i--) {
    const m = s.mobs[i], M = FORMS[m.f], dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy), to = Math.atan2(dy, dx);
    if (m.hunt > 0) m.hunt -= dt;
    const T = m.nem ? TEMPERAMENTS[N.knobs.temperament] : null, power = powerOf(m);
    const [far, half] = sightOf(M), range = M.range * far * (T ? T.sight : 1), cone = Math.min(Math.PI, half * (T ? T.cone : 1));
    if (m.winded > 0) m.winded -= dt;
    if (m.spring > 0) m.spring -= dt; if (m.pounce > 0) m.pounce -= dt;
    if (m.stun > 0) m.stun -= dt;
    // Ant Hide change: cover blocks sight and starts a last-seen search.
    const withinSight = m.hunt > 0 || d < range * F.stealth + F.r && Math.abs(wrap(to - m.a)) < cone;
    const blocked = s.cover && (withinSight || m.alert) && (!clearSight(s, m.x, m.y, p.x, p.y) || playerGrass && d > 1.5 * BODY_LENGTH * M.r && !sharesGrass(s, p.x, p.y, m.x, m.y));
    const wouldSee = p.safe <= 0 && !(p.veil > 0) && !(m.winded > 0) && !(m.stun > 0) && withinSight;
    const sees = !blocked && wouldSee;
    if (s.cover) m.seesPlayer = sees;
    const wasAlert = m.alert;
    if (s.cover && power > F.power) updateSearch(s, m, sees, blocked, wouldSee, p, dt);
    else if (s.cover && m.search > 0) {
      m.search = 0;
      m.sweeping = false;
      m.lastSeen = null;
      m.alert = false;
    }
    if (sees) { if (!m.alert && power !== F.power) s.events.push({ t: 'notice', strong: power > F.power, id: m.id, nem: !!m.nem }); m.alert = true; m.lost = 0; }
    else if (m.alert && !(s.cover && power > F.power)) {
      const forget = T ? FORGET[N.knobs.persistence] * T.reach : 1.8, hold = T ? HOLD[N.knobs.persistence] * T.hold : 1.5;
      m.lost = d > range * forget ? m.lost + dt : 0; if (m.lost > hold || p.safe > 0) m.alert = false;
    }
    // animals hunt each other: a stronger animal that sees a weaker one (at most 2 levels below, never the little food bugs) chases it.
    // The rival takes no part: it hunts only the player, and no animal hunts it.
    // Ant Hide change: animals also lose sight of each other through cover.
    if (m.fed > 0) m.fed -= dt;
    if (!m.nem && (s.tick + m.id) % 12 === 0) {
      const was = m.chase; m.chase = m.fear = null; let bc = Infinity, bf = Infinity;
      if (M.level >= 1) for (const o of s.mobs) {
        if (o === m || o.gone || o.nem) continue; const O = FORMS[o.f], op = powerOf(o); if (op === power || O.level < 1) continue;
        const ex = o.x - m.x, ey = o.y - m.y; if (ex > 220 || ex < -220 || ey > 220 || ey < -220) continue; const e = Math.hypot(ex, ey);
        if (op > power) { if (o.chase === m && e < bf) { bf = e; m.fear = o; } }
        else if (!(m.fed > 0) && M.level - O.level <= 2 && e < M.range * PREY.sight && e < bc && (!s.cover || clearSight(s, m.x, m.y, o.x, o.y) && (!grassAt(s, o.x, o.y) || e <= 1.5 * BODY_LENGTH * M.r || sharesGrass(s, o.x, o.y, m.x, m.y))) && (o === was || Math.abs(wrap(Math.atan2(ey, ex) - m.a)) < CONE)) { bc = e; m.chase = o; }
      }
      m.chaseFor = m.chase && m.chase === was ? (m.chaseFor || 0) + 0.2 : 0;
      if (m.chaseFor > PREY.give) { m.chase = null; m.fed = 5; } // gives up on prey it cannot catch
    }
    if (m.chase?.gone) m.chase = null; if (m.fear?.gone) m.fear = null;
    let speed = 0, turn = 2.5, hunting = false;
    // a coward rival runs once the player's power gets close to its own
    const flees = power < F.power || (T && T.flee && power - F.power <= fleeMargin(T, power));
    if (m.alert && power !== F.power && !(s.cover && m.search > 0)) {
      turn = 7; speed = M.speed;
      if (!flees) {
        m.want = to; const pace = chasePace(M, F); speed = pace; hunting = true;
        if (!T) {
          speed = pace * tirePace(m);
          if (m.pounce > 0) speed = Math.max(speed, F.speed * POUNCE.up);
          else if (!(m.spring > 0) && pounces(M, F) && tirePace(m) === 1 && p.safe <= 0 && d < (range * F.stealth + F.r) * POUNCE.near) { m.pounce = POUNCE.secs; m.spring = POUNCE.rest; s.pounced = (s.pounced || 0) + 1; s.events.push({ t: 'pounce', id: m.id, name: M.name, x: m.x, y: m.y }); }
          m.tire = (m.tire || 0) + dt;
          if (m.tire >= TIRE.spent) { m.alert = false; m.hunt = 0; m.winded = TIRE.rest; m.tire = TIRE.fresh; s.tired++; s.events.push({ t: 'tired', id: m.id, name: M.name, x: m.x, y: m.y }); }
        }
        if (T) {
          turn = T.turn; speed = pace * T.chase; N.chase += dt;
          if (N.knobs.temperament === 'stalker' && !N.commit) { // follow at the edge of sight; strike when the player is busy eating or comes close
            N.stalk += dt;
            if (p.busy > 0 || d < range * 0.45 || N.stalk > 7) N.commit = true;
            else speed = d > range * 0.7 ? Math.min(pace, F.speed) * 0.95 : 0;
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
      const gap = Math.hypot(m.chase.x - m.x, m.chase.y - m.y), reach = M.r + FORMS[m.chase.f].r;
      turn = 6; speed = M.speed * (gap < reach * PREY.close ? PREY.lunge : PREY.run); m.want = Math.atan2(m.chase.y - m.y, m.chase.x - m.x);
      if (gap < reach * 0.8 && clearSight(s, m.x, m.y, m.chase.x, m.chase.y)) {
        m.chase.gone = true; m.fed = PREY.fed; s.mobEats++; s.events.push({ t: 'mobeat', name: FORMS[m.chase.f].name, by: M.name, x: m.chase.x, y: m.chase.y }); m.chase = null;
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
    // Ant Hide change: navigate to the last seen point and search from there.
    if (s.cover && power > F.power && m.search > 0) {
      const dx = m.lastSeen.x - m.x, dy = m.lastSeen.y - m.y;
      if (Math.hypot(dx, dy) < M.r) m.sweeping = true;
      m.want = m.sweeping ? m.a + 1 : searchHeading(s, m, M.r, dx, dy);
      speed = m.sweeping ? 0 : M.speed;
      turn = m.sweeping ? 2.5 : 7;
      hunting = false;
    }
    if (s.cover && m.rockTurn > 0) {
      m.rockTurn -= dt;
      m.want = m.rockHeading;
    }
    if (!m.alert) m.pounce = 0;
    if (T && wasAlert && !m.alert) { // the player got away
      if (N.chase > 1.5 && power > F.power && !s.dead) { N.escapes++; s.events.push({ t: 'nemEscape', escapes: N.escapes }); }
      N.chase = 0; N.stalk = 0; N.commit = false;
    }
    if (m.stun > 0) { speed = 0; turn = 0; m.alert = false; m.chase = null; }
    if (!hunting && m.tire > 0) m.tire = Math.max(0, m.tire - dt * 1.5);
    m.a += clamp(wrap(m.want - m.a), -turn * dt, turn * dt);
    // Ant Hide change: animals use the same rock and grass movement as the player.
    if (s.cover) {
      if (grassAt(s, m.x, m.y)) speed *= GRASS_PACE;
      m.movingIntent = speed > 0;
      if (move(s, m, M.r, Math.cos(m.a) * speed * dt, Math.sin(m.a) * speed * dt) && !(m.rockTurn > 0)) {
        const rock = s.rocks.find(r => Math.hypot(m.x - r.x, m.y - r.y) <= r.r + M.r + 0.01);
        if (rock) {
          const outward = Math.atan2(m.y - rock.y, m.x - rock.x);
          m.rockTurn = 0.55;
          m.rockHeading = outward + Math.sign(wrap(m.a - outward) || 1) * 0.7;
        }
      }
    } else {
      m.x = clamp(m.x + Math.cos(m.a) * speed * dt, M.r, WORLD - M.r); m.y = clamp(m.y + Math.sin(m.a) * speed * dt, M.r, WORLD - M.r);
    }
    m.ph += speed * dt * 0.09;

    // Ant Hide change: bodies cannot touch through a rock.
    if (!m.gone && d < (M.r + F.r) * 0.85 && clearSight(s, m.x, m.y, p.x, p.y)) {
      let out = encounter(F, { power, speed: M.speed, alert: m.alert }); if (out === 'die' && m.stun > 0) out = 'none'; // a stunned animal cannot bite
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
        move(s, p, F.r, dx / (d || 1) * 70, dy / (d || 1) * 70);
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
        const push = (M.r + F.r) * 0.85 - d; if (s.cover) move(s, m, M.r, -dx / d * push, -dy / d * push); else { m.x -= dx / d * push; m.y -= dy / d * push; }
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
// ---- A power for every animal (tester note #148: "every animal should have its own ability, tied to its species").
// Six kinds of power; each species has its own name for it, and bigger animals reach further. The Ant has none: you earn one.
//   sting:  the nearest animal within reach cannot move or see for a while
//   leap:   jump ahead at once, and nothing can bite you in the air
//   shell:  nothing can bite or see you for a few seconds (you can still eat)
//   roar:   every weaker animal within reach freezes
//   dive:   a short burst of speed during which nothing notices you
//   sprint: a longer burst of speed
// cd is the wait in seconds before the next use. One button; input.power asks for it.
export const POWER = {
  sting: { cd: 10, reach: 120, stun: 3 }, leap: { cd: 6, jump: 150, air: 0.35 }, shell: { cd: 16, time: 3 },
  roar: { cd: 14, reach: 230, stun: 2.5 }, dive: { cd: 10, time: 1.2, speed: 1.9 }, sprint: { cd: 8, time: 2, speed: 1.6 },
};
const POWERS = {
  sting: { 'Fire Ant': 'Fire bite', Spider: 'Web', Scorpion: 'Sting', Wasp: 'Sting', Snake: 'Venom', Python: 'Squeeze', Komodo: 'Venom bite', Basilisk: 'Stone stare', Hydra: 'Three bites' },
  leap: { Mouse: 'Scurry', Frog: 'Hop', Squirrel: 'Jump', Rabbit: 'Bound', Cat: 'Pounce', Lynx: 'Pounce', Deer: 'Bound', Raptor: 'Leap' },
  shell: { Beetle: 'Hard shell', Crab: 'Shell', Mole: 'Dig', Porcupine: 'Spikes', Turtle: 'Shell', Badger: 'Dig', Crocodile: 'Dive under' },
  roar: { Dog: 'Bark', Boar: 'Snort', Wolf: 'Howl', Gorilla: 'Chest beat', Bear: 'Roar', Tiger: 'Roar', Hippo: 'Bellow', Lion: 'Roar', Elephant: 'Trumpet', Sabertooth: 'Snarl', 'T-Rex': 'Roar', Yeti: 'Howl', Dragon: 'Fire breath' },
  dive: { Bat: 'Swoop', Owl: 'Silent dive', Eagle: 'Dive', Pterodactyl: 'Dive', Griffin: 'Dive', Thunderbird: 'Storm dive' },
  sprint: { Mantis: 'Strike', Lizard: 'Dart', Fox: 'Dash', Ostrich: 'Run', Panther: 'Dash', Cheetah: 'Sprint', Zebra: 'Gallop', Giraffe: 'Gallop' },
};
const POWER_OF = {}; for (const [kind, names] of Object.entries(POWERS)) for (const [name, label] of Object.entries(names)) POWER_OF[name] = { kind, label, ...POWER[kind] };
export const powerFor = F => POWER_OF[F.name] || null;
export const powerReady = s => !!powerFor(me(s)) && !(s.player.cd > 0) && !s.dead && !s.choosing;
function usePower(s) {
  const p = s.player, F = me(s), W = powerFor(F); if (!W || p.cd > 0) return;
  const reach = (W.reach || 0) * (1 + F.level * 0.02); let hit = 0;
  if (W.kind === 'sting') {
    let best = null, bd = reach + F.r;
    for (const m of s.mobs) { const d = Math.hypot(m.x - p.x, m.y - p.y) - FORMS[m.f].r; if (d < bd) { bd = d; best = m; } }
    if (!best) { s.events.push({ t: 'powerMiss', label: W.label }); p.cd = 1; return; } // nothing in reach: try again in a second
    best.stun = W.stun; best.alert = false; best.hunt = 0; hit = 1; s.events.push({ t: 'stun', x: best.x, y: best.y });
  } else if (W.kind === 'roar') {
    for (const m of s.mobs) if (powerOf(m) < F.power && Math.hypot(m.x - p.x, m.y - p.y) < reach) { m.stun = W.stun; m.alert = false; hit++; s.events.push({ t: 'stun', x: m.x, y: m.y }); }
  } else if (W.kind === 'leap') {
    const d = W.jump + F.r * 3; p.from = { x: p.x, y: p.y };
    // Ant Hide change: a leap cannot cross a solid rock.
    move(s, p, F.r, Math.cos(p.a) * d, Math.sin(p.a) * d); p.safe = Math.max(p.safe, W.air);
  } else if (W.kind === 'shell') p.safe = Math.max(p.safe, W.time);
  else { p.boost = W.time; p.boostK = W.speed; if (W.kind === 'dive') { p.veil = W.time; for (const m of s.mobs) if (!m.nem) { m.alert = false; m.hunt = 0; } } }
  p.cd = W.cd; s.powers++; s.events.push({ t: 'power', kind: W.kind, label: W.label, hit, x: p.x, y: p.y, reach });
}

export function choose(s, i) {
  if (!s.choosing) return;
  const f = s.choosing[i]; s.player.stack.push(f.id); s.player.xp = 0; s.player.safe = 1.5; s.player.cd = 0; s.choosing = null;
  // Ant Hide change: a larger form cannot grow into a rock.
  if (s.cover) {
    for (const rock of s.rocks) {
      const dx = s.player.x - rock.x, dy = s.player.y - rock.y, distance = Math.hypot(dx, dy);
      if (distance >= rock.r + f.r) continue;
      const radius = rock.r + f.r + 1e-5;
      s.player.x = rock.x + dx / distance * radius;
      s.player.y = rock.y + dy / distance * radius;
    }
  }
  s.events.push({ t: 'evolve', name: f.name });
}

// After a death: go back one form (restart = false) or start over as an ant.
export function revive(s, restart) {
  if (!s.dead) return;
  const p = s.player;
  if (restart) { p.stack = [ANT]; s.won = false; } else if (p.stack.length > 1) p.stack.pop();
  p.xp = 0; p.safe = 2.5; p.busy = 0; p.cd = 0; p.boost = 0; p.veil = 0; p.x = WORLD / 2; p.y = WORLD / 2; s.dead = null;
  const F = me(s);
  s.mobs = s.mobs.filter(m => m.nem || powerOf(m) <= F.power || Math.hypot(m.x - p.x, m.y - p.y) > 520);
  const n = nemesisMob(s); // the rival is not removed; if it is close it is moved away
  if (n && Math.hypot(n.x - p.x, n.y - p.y) < 650) { const at = farSpot(s); n.x = at.x; n.y = at.y; n.alert = false; n.hunt = 0; s.nemesis.home = at; s.nemesis.seek = 0; }
  upkeep(s);
}

// Mobs the player could eat right now: weaker, and either not faster or not yet alert.
export const catchable = s => { const F = me(s); return s.mobs.filter(m => encounter(F, { power: powerOf(m), speed: FORMS[m.f].speed, alert: m.alert }) === 'eat' && (FORMS[m.f].speed <= F.speed || !m.alert)); };
