// Ant Promotion: Wilds. Rules and world, no drawing. A copy of ../../ant-promotion/sim.js where animals also hunt, flee from and eat each other.
// Deterministic for a given seed and input sequence: all chance comes from s.rand.
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

// ---------- Wilds: the food chain. Numbers that set how the meadow behaves.
export const WILD = {
  gap: 2,          // a mob hunts mobs at least this many levels below it
  scan: 4,         // each mob looks around every 4th step (15 times a second), staggered by id
  lostAfter: 2.5,  // a hunter gives up after this long without seeing its prey
  maxHunt: 8,      // or after this long chasing at all
  hear: 70,        // prey notices a hunter chasing it this close even from behind
  busy: 3,         // seconds a hunter spends eating its kill
  rest: [1.5, 3],    // seconds after eating or giving up before it hunts again (min, extra random)
  leftovers: 12,   // seconds leftovers stay on the ground
  scavenge: 1,     // bar points for eating leftovers
  fear: 2,         // seconds prey keeps running after it last saw its hunter
  herd: 150,       // radius in which animals of one kind stay together
  weakShare: 0.48, // the refill keeps at least this share of mobs weaker than the player
  near: 600,       // a hunt that starts this close to the player is announced
  distract: true,  // rule 5: a hunter after other prey ignores a player who is farther away (false is for measuring only)
};

export function create(seed = 1, stack = [ANT], xp = 0, weights = SPAWN_WEIGHTS) {
  const s = { rand: rng(seed), t: 0, tick: 0, weights, mobs: [], left: [], events: [], choosing: null, dead: null, won: false, eaten: 0, deaths: 0, nextId: 1,
    kills: 0, scavenged: 0, hunts: 0,
    player: { x: WORLD / 2, y: WORLD / 2, a: 0, ph: 0, stack: stack.slice(), xp, safe: 2.5 } };
  while (s.mobs.length < MOBS) spawn(s, 260);
  return s;
}
export const me = s => FORMS[s.player.stack[s.player.stack.length - 1]];
export const level = s => s.player.stack.length;

// Herd animals: food bugs, and any animal weaker than the player. They spawn in small groups of one kind.
const herds = (s, M) => M.level === 0 || M.power < me(s).power;

function spawn(s, minDist, weakOnly = false) {
  const pl = level(s), weights = weakOnly ? s.weights.filter(w => w[0] < 0) : s.weights, total = weights.reduce((n, w) => n + w[1], 0);
  let roll = s.rand() * total, off = 0;
  for (const [o, w] of weights) { if ((roll -= w) < 0) { off = o; break; } }
  const pool = FORMS.filter(f => f.level === clamp(pl + off, 0, TOP)), f = pool[Math.floor(s.rand() * pool.length)];
  let x = 0, y = 0;
  for (let i = 0; i < 30; i++) { x = 40 + s.rand() * (WORLD - 80); y = 40 + s.rand() * (WORLD - 80); if (Math.hypot(x - s.player.x, y - s.player.y) > minDist) break; }
  const group = herds(s, f) ? (f.level === 0 ? 4 : s.rand() < 0.5 ? 3 : 1) : 1;
  let first = null;
  for (let k = 0; k < group && s.mobs.length < MOBS; k++) {
    const gx = clamp(x + (k ? (s.rand() - 0.5) * 70 : 0), 40, WORLD - 40), gy = clamp(y + (k ? (s.rand() - 0.5) * 70 : 0), 40, WORLD - 40);
    const m = { id: s.nextId++, f: f.id, x: gx, y: gy, a: s.rand() * 6.283, alert: false, lost: 0, timer: 0, want: 0, wander: 0, walk: false, ph: s.rand() * 6,
      prey: 0, huntT: 0, lostT: 0, onPlayer: false, busy: 0, rest: s.rand() * 4, fear: 0, fearT: 0, fearSeen: false, hx: 0, hy: 0, mates: 0, dead: false };
    s.mobs.push(m); first ??= m;
  }
  return first;
}

// Mob A sees B: B is inside A's sight wedge and range (shortened by B's stealth).
const sees = (a, A, b, B) => { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); return d < A.range * B.stealth + B.r && Math.abs(wrap(Math.atan2(dy, dx) - a.a)) < CONE; };
// Run away from a point; near a wall, slide along it.
function away(m, fx, fy) {
  const pad = 90;
  if (m.x < pad) fx += (pad - m.x) / 40; if (m.x > WORLD - pad) fx -= (m.x - WORLD + pad) / 40;
  if (m.y < pad) fy += (pad - m.y) / 40; if (m.y > WORLD - pad) fy -= (m.y - WORLD + pad) / 40;
  return Math.atan2(fy, fx);
}

// One look around for mob m: start a hunt, notice a hunter, and work out where its herd is.
function scan(s, m, M, byId) {
  const p = s.player;
  let prey = null, pd = Infinity, fear = null, fd = Infinity, n = 0, cx = 0, cy = 0, ax = 0, ay = 0, sx = 0, sy = 0, alarm = null;
  const canHunt = !m.prey && m.rest <= 0 && M.level >= WILD.gap;
  for (const o of s.mobs) {
    if (o === m || o.dead) continue;
    const dx = o.x - m.x, dy = o.y - m.y;
    if (dx > 400 || dx < -400 || dy > 400 || dy < -400) continue;
    const O = FORMS[o.f], d = Math.hypot(dx, dy);
    if (canHunt && O.level <= M.level - WILD.gap && d < pd && sees(m, M, o, O)) { prey = o; pd = d; }
    if (O.level >= M.level + WILD.gap && o.busy <= 0 && d < fd && (sees(m, M, o, O) || (o.prey === m.id && d < WILD.hear))) { fear = o; fd = d; }
    if (o.f === m.f && d < WILD.herd) {
      n++; cx += o.x; cy += o.y; ax += Math.cos(o.a); ay += Math.sin(o.a);
      if (o.fearT > 0.5 && o.fear && o.fearSeen && !alarm) alarm = o.fear; // only fear from a hunter actually seen is passed on, so it cannot loop
    }
    const near = (M.r + O.r) * 1.6;
    if (d < near && d > 0.01) { sx -= dx / d * (near - d) / near; sy -= dy / d * (near - d) / near; }
  }
  if (prey) {
    m.prey = prey.id; m.huntT = 0; m.lostT = 0; s.hunts++;
    if (Math.hypot(m.x - p.x, m.y - p.y) < WILD.near) s.events.push({ t: 'hunt', id: m.id, prey: prey.id, x: m.x, y: m.y });
  }
  if (fear) { m.fear = fear.id; m.fearT = WILD.fear; m.fearSeen = true; }
  else if (alarm && m.fearT <= 0 && byId.has(alarm)) { m.fear = alarm; m.fearT = WILD.fear * 0.6; m.fearSeen = false; } // a herd mate is running: run too
  m.mates = n; m.hx = sx * 1.5; m.hy = sy * 1.5;
  if (n) {
    const tx = cx / n - m.x, ty = cy / n - m.y, td = Math.hypot(tx, ty) || 1, pull = clamp((td - 40) / 80, 0, 1);
    m.hx += tx / td * pull + ax / n * 0.5; m.hy += ty / td * pull + ay / n * 0.5;
  }
}

// input: { x, y } with length up to 1. One call advances 1/60 s.
export function step(s, input) {
  s.events.length = 0;
  if (s.choosing || s.dead) return s;
  const dt = 1 / 60, p = s.player, F = me(s);
  s.t += dt; s.tick++;
  if (p.safe > 0) p.safe -= dt;
  let ix = input?.x || 0, iy = input?.y || 0; const il = Math.hypot(ix, iy);
  if (il > 1) { ix /= il; iy /= il; }
  if (il > 0.01) { p.a = Math.atan2(iy, ix); p.ph += Math.min(1, il) * dt * 10; }
  p.x = clamp(p.x + ix * F.speed * dt, F.r, WORLD - F.r); p.y = clamp(p.y + iy * F.speed * dt, F.r, WORLD - F.r);
  const byId = new Map(); for (const m of s.mobs) byId.set(m.id, m);

  for (let i = s.mobs.length - 1; i >= 0; i--) {
    const m = s.mobs[i]; if (m.dead) continue;
    const M = FORMS[m.f], dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy), to = Math.atan2(dy, dx);
    if (m.rest > 0) m.rest -= dt;
    if (m.fearT > 0) m.fearT -= dt;
    // Noticing the player. A mob busy eating notices nobody.
    if (m.busy > 0) { m.alert = false; m.lost = 0; }
    else {
      const seen = p.safe <= 0 && d < M.range * F.stealth + F.r && Math.abs(wrap(to - m.a)) < CONE;
      if (seen) { if (!m.alert && M.power !== F.power) s.events.push({ t: 'notice', strong: M.power > F.power, id: m.id }); m.alert = true; m.lost = 0; }
      else if (m.alert) { m.lost = d > M.range * 1.8 ? m.lost + dt : 0; if (m.lost > 1.5 || p.safe > 0) m.alert = false; }
      if ((s.tick + m.id) % WILD.scan === 0) scan(s, m, M, byId);
    }
    // The current prey and hunter, looked up by id: either may have been eaten or removed.
    let P = m.prey ? byId.get(m.prey) : null, dP = Infinity;
    if (m.prey && (!P || P.dead)) { m.prey = 0; P = null; m.rest = WILD.rest[0] + s.rand() * WILD.rest[1]; }
    if (P) {
      dP = Math.hypot(P.x - m.x, P.y - m.y); m.huntT += dt;
      m.lostT = dP < M.range * 1.6 ? 0 : m.lostT + dt;
      if (m.lostT > WILD.lostAfter || m.huntT > WILD.maxHunt) { m.prey = 0; P = null; dP = Infinity; m.rest = WILD.rest[0] + s.rand() * WILD.rest[1]; }
    }
    let H = m.fear && m.fearT > 0 ? byId.get(m.fear) : null;
    if (H && H.dead) H = null;
    if (!H) m.fear = 0;
    // Rule 5: chase the player only when the player is nearer than the current prey (with a margin, so it does not flip every step).
    const hunter = m.alert && M.power > F.power;
    m.onPlayer = hunter && !H && (!P || !WILD.distract || (m.onPlayer ? d < dP * 1.15 : d < dP * 0.85));

    let speed = 0, turn = 2.5;
    if (m.busy > 0) {
      m.busy -= dt; m.ph += dt * 3;
      if (m.busy <= 0) m.rest = WILD.rest[0] + s.rand() * WILD.rest[1];
    } else if (H) { // run from a stronger animal; also from the player if the player is stronger and has been seen
      turn = 7; speed = M.speed;
      const hd = Math.hypot(m.x - H.x, m.y - H.y) || 1; let fx = (m.x - H.x) / hd * 1.2, fy = (m.y - H.y) / hd * 1.2;
      if (m.alert && M.power < F.power) { fx -= dx / (d || 1); fy -= dy / (d || 1); }
      m.want = away(m, fx, fy);
    } else if (m.onPlayer) { turn = 7; speed = M.speed; m.want = to; }
    else if (P) { turn = 7; speed = M.speed; m.want = Math.atan2(P.y - m.y, P.x - m.x); }
    else if (m.alert && M.power < F.power) { turn = 7; speed = M.speed; m.want = away(m, -dx / (d || 1), -dy / (d || 1)); }
    else {
      m.timer -= dt;
      if (m.timer <= 0) { m.walk = s.rand() < 0.7; m.timer = 0.6 + s.rand() * 2.6; m.wander = m.a + (s.rand() - 0.5) * 3.2; }
      m.want = m.wander;
      let go = m.walk;
      if (m.mates || m.hx || m.hy) { // drift with the herd: cohesion, alignment and separation from scan()
        const k = m.walk ? 0.7 : 0.25; m.want = Math.atan2(Math.sin(m.wander) * k + m.hy, Math.cos(m.wander) * k + m.hx);
        if (Math.hypot(m.hx, m.hy) > 0.6) go = true;
      }
      if (m.x < 70 || m.x > WORLD - 70 || m.y < 70 || m.y > WORLD - 70) m.want = Math.atan2(WORLD / 2 - m.y, WORLD / 2 - m.x);
      speed = go ? M.speed * 0.38 : 0;
    }
    m.a += clamp(wrap(m.want - m.a), -turn * dt, turn * dt);
    m.x = clamp(m.x + Math.cos(m.a) * speed * dt, M.r, WORLD - M.r); m.y = clamp(m.y + Math.sin(m.a) * speed * dt, M.r, WORLD - M.r);
    m.ph += speed * dt * 0.09;

    // A hunter that reaches its prey kills it and stays to eat. The pile lies just past the prey, away from the eater.
    if (P && !m.onPlayer && !H && m.busy <= 0) {
      const PR = FORMS[P.f], kd = Math.hypot(P.x - m.x, P.y - m.y);
      if (kd < (M.r + PR.r) * 0.85) {
        P.dead = true; m.prey = 0; m.busy = WILD.busy; m.alert = false; m.onPlayer = false; s.kills++;
        const ux = (P.x - m.x) / (kd || 1), uy = (P.y - m.y) / (kd || 1);
        const lx = clamp(P.x + ux * PR.r * 0.4, 20, WORLD - 20), ly = clamp(P.y + uy * PR.r * 0.4, 20, WORLD - 20);
        s.left.push({ id: s.nextId++, x: lx, y: ly, f: P.f, by: m.f, t: WILD.leftovers, r: Math.max(7, PR.r * 0.75) });
        m.a = Math.atan2(uy, ux);
        s.events.push({ t: 'kill', x: lx, y: ly, hunter: m.f, prey: P.f, id: m.id });
      }
    }

    if (d < (M.r + F.r) * 0.85) {
      const out = encounter(F, { power: M.power, speed: M.speed, alert: m.alert });
      if (out === 'eat') {
        const gain = M.level >= F.level - 1 ? 3 : M.level === F.level - 2 ? 2 : 1;
        s.mobs.splice(i, 1); m.dead = true; s.eaten++; p.xp += gain;
        s.events.push({ t: 'eat', name: M.name, gain, x: m.x, y: m.y });
      } else if (out === 'die' && p.safe <= 0) {
        s.dead = { as: F.name, to: M.name, level: level(s) }; s.deaths++;
        s.events.push({ t: 'die' });
        s.mobs = s.mobs.filter(o => !o.dead);
        return s;
      } else if (d > 0.01) { // bump apart
        const push = (M.r + F.r) * 0.85 - d; m.x -= dx / d * push; m.y -= dy / d * push;
      }
    }
  }
  s.mobs = s.mobs.filter(o => !o.dead);
  // Leftovers: fade away, or the player eats them for a fixed small amount.
  for (let i = s.left.length - 1; i >= 0; i--) {
    const L = s.left[i]; L.t -= dt;
    if (Math.hypot(L.x - p.x, L.y - p.y) < F.r + L.r) {
      s.left.splice(i, 1); p.xp += WILD.scavenge; s.scavenged++;
      s.events.push({ t: 'scavenge', x: L.x, y: L.y, f: L.f, gain: WILD.scavenge });
    } else if (L.t <= 0) s.left.splice(i, 1);
  }
  if (p.xp >= needFor(level(s))) {
    if (level(s) < TOP) { s.choosing = optionsFor(level(s)); s.events.push({ t: 'full' }); }
    else { p.xp = needFor(TOP); if (!s.won) { s.won = true; s.events.push({ t: 'win' }); } }
  }
  if (s.tick % 20 === 0) upkeep(s);
  return s;
}

// Remove mobs far outside the player's band and refill. Hunters eat weak mobs, so the refill keeps the weak share at least where the main game has it.
function upkeep(s) {
  const p = s.player, pl = level(s), F = me(s);
  for (let i = s.mobs.length - 1; i >= 0; i--) {
    const m = s.mobs[i], gap = FORMS[m.f].level - pl;
    if ((gap < -3 || gap > 2) && Math.hypot(m.x - p.x, m.y - p.y) > 700) s.mobs.splice(i, 1);
  }
  for (let i = 0; i < 4 && s.mobs.length < MOBS; i++) {
    const weak = s.mobs.filter(m => FORMS[m.f].power < F.power).length;
    spawn(s, 520, pl > 1 && weak < s.mobs.length * WILD.weakShare);
  }
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
  p.xp = 0; p.safe = 2.5; p.x = WORLD / 2; p.y = WORLD / 2; s.dead = null;
  const F = me(s);
  s.mobs = s.mobs.filter(m => FORMS[m.f].power <= F.power || Math.hypot(m.x - p.x, m.y - p.y) > 520);
  upkeep(s);
}

// Mobs the player could eat right now: weaker, and either not faster or not yet alert.
export const catchable = s => { const F = me(s); return s.mobs.filter(m => encounter(F, { ...FORMS[m.f], alert: m.alert }) === 'eat' && (FORMS[m.f].speed <= F.speed || !m.alert)); };
