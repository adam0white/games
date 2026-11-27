// Sky Kitchen: the rules. No window, no document: bots.mjs runs this file in Node.
// Everything a difficulty change touches is in TUNE, RECIPES, TIERS and BUILDINGS.

export const DT = 1 / 60;

// ---------- ingredients
// model: a file in models/food (or 'potato', made in art.js). chop: the cut piece's model, when the kit has one.
export const ING = {
  carrot: { model: 'carrot', chop: null },
  tomato: { model: 'tomato', chop: 'tomato-slice' },
  cabbage: { model: 'cabbage', chop: null },
  onion: { model: 'onion', chop: 'onion-half' },
  potato: { model: 'potato', chop: null },
  apple: { model: 'apple', chop: 'apple-half' },
  banana: { model: 'banana', chop: null },
  egg: { model: 'egg', chop: 'egg-half' },
  bread: { model: 'bread', chop: null },
  sausage: { model: 'hot-dog-raw', chop: null },
  cheese: { model: 'cheese', chop: 'cheese-cut' },
  mushroom: { model: 'mushroom', chop: 'mushroom-half' },
  patty: { model: 'meat-patty', chop: null },
  paprika: { model: 'paprika', chop: 'paprika-slice' },
  corn: { model: 'corn', chop: null },
  strawberry: { model: 'strawberry', chop: null },
  lemon: { model: 'lemon', chop: 'lemon-half' },
  steak: { model: 'meat-raw', chop: null },
  fish: { model: 'fish', chop: null },
  broccoli: { model: 'broccoli', chop: null },
  pear: { model: 'pear', chop: null },
  avocado: { model: 'avocado', chop: 'advocado-half' },
  orange: { model: 'orange', chop: null },
  grapes: { model: 'grapes', chop: null },
  watermelon: { model: 'watermelon', chop: null },
  pineapple: { model: 'pineapple', chop: null },
  cherries: { model: 'cherries', chop: null },
  coconut: { model: 'coconut', chop: 'coconut-half' },
  eggplant: { model: 'eggplant', chop: null },
  beet: { model: 'beet', chop: null },
  leek: { model: 'leek', chop: null },
  radish: { model: 'radish', chop: null },
  pumpkin: { model: 'pumpkin-basic', chop: null },
  celery: { model: 'celery-stick', chop: null },
  bacon: { model: 'bacon-raw', chop: null },
  loaf: { model: 'loaf', chop: null },
};
// Things nobody orders. Catching one is an extra like any other.
export const JUNK = { bones: { model: 'fish-bones' }, can: { model: 'soda-can-crushed' }, shard: { model: 'plate-broken' } };

// ---------- dishes
// need: what the tray must hold, exactly. steps: the stations in order. tier: the restaurant star that puts it on the menu.
export const RECIPES = {
  sticks: { tier: 0, price: 6, need: { carrot: 3 }, steps: ['chop'], dish: null, bowl: false },
  fruitcup: { tier: 0, price: 7, need: { apple: 2, banana: 1 }, steps: ['chop'], dish: null, bowl: true },
  salad: { tier: 0, price: 8, need: { tomato: 2, cabbage: 1 }, steps: ['chop'], dish: 'salad' },
  egg: { tier: 1, price: 9, need: { egg: 2 }, steps: ['fry'], dish: 'egg-cooked' },
  hotdog: { tier: 1, price: 10, need: { sausage: 1, bread: 1 }, steps: ['fry'], dish: 'hot-dog' },
  fries: { tier: 1, price: 11, need: { potato: 3 }, steps: ['chop', 'fry'], dish: 'fries' },
  soup: { tier: 2, price: 14, need: { carrot: 2, onion: 1, potato: 1 }, steps: ['chop', 'micro'], dish: 'bowl-soup' },
  pizza: { tier: 2, price: 16, need: { tomato: 2, cheese: 1, mushroom: 1 }, steps: ['chop', 'micro'], dish: 'pizza' },
  smoothie: { tier: 3, price: 17, need: { strawberry: 2, banana: 1 }, steps: ['blend'], dish: 'frappe' },
  burger: { tier: 3, price: 20, need: { patty: 1, bread: 1, tomato: 1, cheese: 1 }, steps: ['chop', 'fry'], dish: 'burger-cheese' },
  skewer: { tier: 3, price: 21, need: { paprika: 1, mushroom: 1, onion: 1, corn: 1 }, steps: ['chop', 'fry'], dish: 'skewer-vegetables' },
  steak: { tier: 4, price: 30, need: { steak: 1, potato: 2, broccoli: 1 }, steps: ['chop', 'fry', 'micro'], dish: 'meat-cooked' },
  fishplate: { tier: 4, price: 28, need: { fish: 1, lemon: 1, avocado: 1 }, steps: ['chop', 'fry'], dish: 'fish' },
  tasting: { tier: 5, price: 44, need: { pear: 1, cheese: 1, strawberry: 2, avocado: 1 }, steps: ['chop', 'blend', 'micro'], dish: 'cake' },
  // Added 2026-11-26 so every rank has five or more dishes.
  sandwich: { tier: 0, price: 8, need: { bread: 1, cheese: 1, tomato: 1 }, steps: ['chop'], dish: 'sandwich' },
  crudites: { tier: 0, price: 7, need: { celery: 2, radish: 1 }, steps: ['chop'], dish: null, bowl: true },
  berrybowl: { tier: 0, price: 7, need: { cherries: 1, grapes: 1, orange: 1 }, steps: ['chop'], dish: null, bowl: true },
  melon: { tier: 0, price: 6, need: { watermelon: 1, lemon: 1 }, steps: ['chop'], dish: null },
  bacon: { tier: 1, price: 12, need: { bacon: 2, egg: 1 }, steps: ['fry'], dish: 'bacon' },
  pancakes: { tier: 1, price: 11, need: { egg: 1, banana: 1, strawberry: 1 }, steps: ['chop', 'fry'], dish: 'pancakes' },
  taco: { tier: 1, price: 12, need: { patty: 1, tomato: 1, cabbage: 1 }, steps: ['chop', 'fry'], dish: 'taco' },
  eggplant: { tier: 1, price: 10, need: { eggplant: 1, paprika: 1, onion: 1 }, steps: ['chop', 'fry'], dish: 'skewer-vegetables' },
  pumpkin: { tier: 2, price: 14, need: { pumpkin: 1, onion: 1, leek: 1 }, steps: ['chop', 'micro'], dish: 'bowl-broth' },
  stew: { tier: 2, price: 16, need: { steak: 1, carrot: 1, potato: 1 }, steps: ['chop', 'micro'], dish: 'pot-stew' },
  sub: { tier: 2, price: 15, need: { loaf: 1, sausage: 1, cheese: 1 }, steps: ['chop', 'micro'], dish: 'sub' },
  borscht: { tier: 2, price: 15, need: { beet: 2, cabbage: 1, potato: 1 }, steps: ['chop', 'micro'], dish: 'bowl-soup' },
  juice: { tier: 3, price: 15, need: { orange: 3 }, steps: ['blend'], dish: 'soda-glass' },
  tropical: { tier: 3, price: 19, need: { pineapple: 1, coconut: 1, banana: 1 }, steps: ['chop', 'blend'], dish: 'cocktail' },
  sundae: { tier: 3, price: 18, need: { strawberry: 1, cherries: 1, banana: 1 }, steps: ['blend'], dish: 'sundae' },
  donut: { tier: 4, price: 24, need: { egg: 2, strawberry: 1, cherries: 1 }, steps: ['fry'], dish: 'donut-sprinkles' },
  cupcake: { tier: 4, price: 26, need: { egg: 1, banana: 1, lemon: 1, cherries: 1 }, steps: ['blend', 'micro'], dish: 'cupcake' },
  brunch: { tier: 4, price: 32, need: { bacon: 1, egg: 2, avocado: 1, bread: 1 }, steps: ['chop', 'fry'], dish: 'egg-cooked' },
  surf: { tier: 5, price: 52, need: { steak: 1, fish: 1, lemon: 1, broccoli: 1 }, steps: ['chop', 'fry', 'micro'], dish: 'plate-dinner' },
  feast: { tier: 5, price: 48, need: { pumpkin: 1, corn: 1, potato: 2, leek: 1 }, steps: ['chop', 'micro'], dish: 'pot' },
  croissant: { tier: 5, price: 40, need: { loaf: 1, egg: 1, cheese: 1 }, steps: ['micro'], dish: 'croissant' },
  rainbow: { tier: 5, price: 46, need: { pineapple: 1, watermelon: 1, grapes: 1, orange: 1, pear: 1 }, steps: ['chop', 'blend'], dish: 'frappe' },
};
export const RECIPE_IDS = Object.keys(RECIPES);
export const chopsFor = r => Object.entries(RECIPES[r].need).reduce((n, [, c]) => n + c, 0);

// ---------- the restaurant
// Star tiers: the restaurant's own level, like the main building of a town. Each tier lets the others grow one level.
export const TIERS = [
  { name: 'cart', guests: 3, cost: 0 },
  { name: 'diner', guests: 4, cost: 60, needs: { tray: 2, stove: 1 } },
  { name: 'bistro', guests: 4, cost: 150, needs: { tray: 3, micro: 1, tables: 2 } },
  { name: 'restaurant', guests: 5, cost: 320, needs: { knife: 3, blender: 1, decor: 2 } },
  { name: 'fine', guests: 5, cost: 600, needs: { tray: 5, stove: 3, micro: 3, tables: 4 } },
  { name: 'five', guests: 6, cost: 1000, needs: { decor: 5, blender: 3, knife: 5 } },
  // Past five stars the town rises above the Lid. Each new rank adds a twist to the catch (TWISTS) and one building level.
  { name: 'garden', guests: 6, cost: 1500, needs: { tray: 7, stove: 6 } },
  { name: 'galley', guests: 7, cost: 2000, needs: { knife: 6, micro: 6, decor: 6 } },
  { name: 'cloud', guests: 7, cost: 2600, needs: { blender: 5, tables: 6, tray: 8 } },
  { name: 'starlight', guests: 8, cost: 3300, needs: { knife: 7, decor: 7, stove: 7 } },
  { name: 'top', guests: 8, cost: 4200, needs: { micro: 7, blender: 6, tray: 9 } },
];
// What each rank above five stars adds to the catch. wind: steady sideways sway on every item; gust: the whole sky
// leans left and right together; jitter: some items fall much faster than others; pairs: two or three at once.
export const TWISTS = [null, null, null, null, null, null,
  { id: 'wind', wind: 0.18, fall: 0.04 },
  { id: 'gust', wind: 0.18, gust: 0.22, fall: 0.07 },
  { id: 'jitter', wind: 0.18, gust: 0.22, jitter: 0.45, fall: 0.09 },
  { id: 'triples', wind: 0.2, gust: 0.25, jitter: 0.45, triples: true, fall: 0.11 },
  { id: 'all', wind: 0.22, gust: 0.3, jitter: 0.55, triples: true, fall: 0.14 },
];
export const twistFor = tier => TWISTS[Math.min(tier, TWISTS.length - 1)] ?? null;
// Buildings: level 0 means not built. max: highest level at each star tier. cost(level) is the price of reaching it.
export const BUILDINGS = {
  tray: { max: [2, 3, 4, 5, 5, 7, 7, 8, 8, 9, 9], cost: l => [0, 0, 20, 45, 90, 160, 260, 380, 520, 700][l] },
  knife: { max: [1, 2, 3, 4, 5, 5, 6, 6, 7, 7, 8], cost: l => [0, 0, 25, 50, 90, 150, 320, 480, 650][l] },
  stove: { max: [1, 2, 3, 3, 4, 6, 6, 6, 7, 7, 7], cost: l => [0, 40, 60, 100, 150, 220, 340, 500][l] },
  micro: { max: [0, 1, 2, 3, 4, 5, 6, 6, 6, 7, 7], cost: l => [0, 70, 90, 130, 180, 240, 360, 520][l] },
  blender: { max: [0, 0, 1, 2, 3, 4, 4, 5, 5, 6, 6], cost: l => [0, 110, 140, 180, 230, 400, 560][l] },
  tables: { max: [1, 2, 3, 4, 5, 6, 6, 6, 6, 6, 6], cost: l => [0, 0, 35, 70, 120, 180, 260][l] },
  decor: { max: [1, 2, 3, 4, 5, 6, 6, 6, 7, 7, 7], cost: l => [0, 0, 30, 60, 110, 170, 250, 420][l] },
};
export const BUILDING_IDS = Object.keys(BUILDINGS);
export const STATION = { chop: 'knife', fry: 'stove', micro: 'micro', blend: 'blender' };

export function newSave() {
  return { v: 1, coins: 0, tier: 0, day: 1, served: 0, best: 0, tutorial: false, sound: true, dayAtTier: 0,
    built: { tray: 1, knife: 1, stove: 0, micro: 0, blender: 0, tables: 1, decor: 1 } };
}

export function menuFor(save) {
  return RECIPE_IDS.filter(id => {
    const r = RECIPES[id];
    return r.tier <= save.tier && r.steps.every(s => s === 'chop' || save.built[STATION[s]] > 0);
  });
}
export function canBuild(save, id) {
  const lv = save.built[id], next = lv + 1, b = BUILDINGS[id];
  if (next > b.max[save.tier]) return { ok: false, why: 'star', cost: b.cost(next) ?? null };
  const cost = b.cost(next);
  if (cost == null) return { ok: false, why: 'max', cost: null };
  return { ok: save.coins >= cost, why: save.coins >= cost ? null : 'coins', cost };
}
export function build(save, id) {
  const c = canBuild(save, id); if (!c.ok) return false;
  save.coins -= c.cost; save.built[id]++; return true;
}
export function canStar(save) {
  const next = TIERS[save.tier + 1]; if (!next) return { ok: false, why: 'max' };
  const missing = Object.entries(next.needs).filter(([k, v]) => save.built[k] < v);
  if (missing.length) return { ok: false, why: 'needs', missing, cost: next.cost };
  return { ok: save.coins >= next.cost, why: save.coins >= next.cost ? null : 'coins', cost: next.cost };
}
export function star(save) { const c = canStar(save); if (!c.ok) return false; save.coins -= c.cost; save.tier++; return true; }

// ---------- difficulty
// One number for how hard a catch is: the restaurant's star plus a little for each day at that star.
// Simple at first: the first orders are slow, small and mostly what you need.
export const TUNE = {
  lane: 1,              // the catch lane is x in [-1, 1]; the tray sits at y = 0, items start at y = 1.15
  start: 1.15,
  size: 0.15,           // an item's half width, in lane units
  trayHalf: [0, 0.27, 0.31, 0.35, 0.39, 0.43, 0.47, 0.5, 0.53, 0.56],   // by tray level
  traySpeed: 3.2,       // lane units a second a bot may move the tray (a finger is faster)
  fall: { base: 0.42, perHard: 0.035, max: 0.75 },       // lane heights a second
  every: { base: 1.0, perHard: -0.05, min: 0.55 },      // seconds between items
  extra: { base: 0.2, perHard: 0.06, max: 0.5 },      // share of items nobody ordered
  junkFrom: 2,          // hardness at which junk starts to fall
  drift: { from: 4, amp: 0.12 },                       // sideways sway from this hardness
  pairsFrom: 5,         // two items at once from this hardness
  payBase: 2, payPerTier: 3,                           // coins to toss an extra and keep going
  catchY: 0.085,        // an item lands on the tray when its bottom reaches the tray top (drawn 0.12 world units low)
  golden: 0.07,         // chance a guest (after the first, from the diner on) orders a golden recipe
  patience: 40,         // seconds a guest waits happily for the catch; then the tip shrinks
};
export const hardness = save => save.tier * 1.6 + Math.min(4, (save.dayAtTier ?? 0) * 0.4);
export const payCost = save => TUNE.payBase + TUNE.payPerTier * save.tier;

export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- the catch
// need: { id: count }. Options: hard, trayLevel, seed, tutorial (only needed items, slower).
export function newCatch({ need, hard = 0, trayLevel = 1, seed = 1, tutorial = false, pool = null, twist = null }) {
  const fall = Math.min(TUNE.fall.max + (twist?.fall ?? 0), TUNE.fall.base + TUNE.fall.perHard * hard) * (tutorial ? 0.8 : 1);
  const every = Math.max(TUNE.every.min, TUNE.every.base + TUNE.every.perHard * hard) * (tutorial ? 1.1 : 1);
  const extraShare = tutorial === 'first' ? 0 : Math.min(TUNE.extra.max, TUNE.extra.base + TUNE.extra.perHard * hard);
  const others = (pool ?? Object.keys(ING)).filter(id => !(id in need));
  if (hard >= TUNE.junkFrom) others.push(...Object.keys(JUNK));
  return {
    need: { ...need }, got: {}, tray: [], items: [], t: 0, next: 0.6, seq: 0, r: rng(seed),
    fall, every, extraShare, others, hard, half: TUNE.trayHalf[Math.min(TUNE.trayHalf.length - 1, trayLevel)],
    x: 0, extra: null, done: false, spawned: 0, caught: 0, missedNeeded: 0, tutorial, twist,
  };
}
export const left = c => Object.entries(c.need).reduce((n, [k, v]) => n + Math.max(0, v - (c.got[k] ?? 0)), 0);
export const isJunk = id => id in JUNK;

function spawnOne(c, xAt = null) {
  const stillNeeded = Object.entries(c.need).filter(([k, v]) => (c.got[k] ?? 0) < v);
  let id;
  if (!stillNeeded.length || (c.others.length && c.r() < c.extraShare)) id = c.others[Math.floor(c.r() * c.others.length)];
  else {
    const total = stillNeeded.reduce((n, [, v]) => n + v, 0); let pick = c.r() * total;
    for (const [k, v] of stillNeeded) { if ((pick -= v) <= 0) { id = k; break; } }
    id ??= stillNeeded[0][0];
  }
  const x = xAt ?? (c.r() * 2 - 1) * (TUNE.lane - TUNE.size);
  const tw = c.twist, amp = Math.max(c.hard >= TUNE.drift.from ? TUNE.drift.amp : 0, tw?.wind ?? 0);
  const drift = amp ? amp * (c.r() * 2 - 1) : 0;
  const speed = tw?.jitter ? Math.max(0.65, 1 + (c.r() * 2 - 1) * tw.jitter) : 0.9 + c.r() * 0.2;
  c.items.push({ n: c.seq++, id, x, x0: x, y: TUNE.start, vy: c.fall * speed, drift, phase: c.r() * 6.28, spin: c.r() * 6.28, state: 'fall' });
  c.spawned++;
}

// Moves the catch one step. trayX is where the player's tray is (clamped). Returns events: { caught, extra, missed }.
export function stepCatch(c, trayX, dt = DT) {
  const ev = [];
  if (c.done || c.extra) return ev;
  c.t += dt;
  c.x = Math.max(-TUNE.lane + c.half * 0.6, Math.min(TUNE.lane - c.half * 0.6, trayX));
  c.next -= dt;
  if (c.next <= 0) {
    c.next = c.every * (0.85 + c.r() * 0.3);
    if (c.hard >= TUNE.pairsFrom && c.r() < 0.35) {
      const a = (c.r() * 2 - 1) * 0.8; spawnOne(c, a); spawnOne(c, a > 0 ? a - 0.9 : a + 0.9);
      if (c.twist?.triples && c.r() < 0.4) spawnOne(c, a > 0 ? a - 0.45 : a + 0.45);
    } else spawnOne(c);
  }
  for (const it of c.items) {
    if (it.state !== 'fall') continue;
    const prevY = it.y;
    it.y -= it.vy * dt;
    const gust = c.twist?.gust ? c.twist.gust * Math.sin(c.t * 0.9) : 0;
    if (it.drift || gust) it.x = Math.max(-TUNE.lane + TUNE.size, Math.min(TUNE.lane - TUNE.size, it.x0 + it.drift * Math.sin(c.t * 2.2 + it.phase) + gust));
    if (prevY > TUNE.catchY && it.y <= TUNE.catchY) {
      if (Math.abs(it.x - c.x) <= c.half + TUNE.size * 0.5) {
        const wanted = !isJunk(it.id) && (c.got[it.id] ?? 0) < (c.need[it.id] ?? 0);
        it.state = 'caught'; it.dx = it.x - c.x; c.caught++;
        if (wanted) { c.got[it.id] = (c.got[it.id] ?? 0) + 1; c.tray.push(it); ev.push({ type: 'caught', it }); }
        else { c.extra = it; c.tray.push(it); ev.push({ type: 'extra', it }); return ev; }
        if (left(c) === 0) { c.done = true; ev.push({ type: 'done' }); return ev; }
      }
    }
    if (it.y < -0.35 && it.state === 'fall') {
      it.state = 'gone';
      if (!isJunk(it.id) && (c.got[it.id] ?? 0) < (c.need[it.id] ?? 0)) c.missedNeeded++;
      ev.push({ type: 'missed', it });
    }
  }
  c.items = c.items.filter(it => it.state === 'fall');
  return ev;
}
// After an extra: toss it (the player paid) and go on, or start the catch again from an empty tray.
export function tossExtra(c) {
  if (!c.extra) return; c.tray = c.tray.filter(it => it !== c.extra); c.extra = null;
  c.items = c.items.filter(it => it.y > 0.35); // clear items right above the tray so the next frame is fair
}
export function restartCatch(c) {
  c.got = {}; c.tray = []; c.items = []; c.extra = null; c.next = 0.8; c.done = false; c.restarts = (c.restarts ?? 0) + 1;
}

// ---------- cooking: each step gives a quality from 0 to 1
// Chop: each piece needs `cuts` swipes; quality falls with time over a par.
export const chopCuts = save => (save.tier >= 2 ? 3 : save.tier >= 1 ? 2 : 1);
// From the diner on, pieces slide on the board (lane units a second); faster at higher ranks.
export const chopSlide = save => (save.tier >= 1 ? Math.min(0.4, 0.12 + 0.05 * save.tier) : 0);
// Par counts strikes (pieces x cuts): about half a second each to aim and drop the knife. A better knife does not
// change par; it has a wider edge (knifeReach) and steadies the pieces (knifeCalm), so the same par is easier to make.
export const knifeReach = knife => 0.02 + 0.005 * knife;
export const knifeCalm = knife => Math.max(0.6, 1 - 0.05 * (knife - 1));
export function chopQuality(seconds, strikes, knife) { const par = strikes * 0.52 + 0.8; return seconds <= par ? 1 : Math.max(0.4, 1 - (seconds - par) / (par * 1.5)); }
// Fry: hold to heat; doneness grows while held; let go inside the golden band.
export function fryBand(stove, tier) { const w = 0.14 + 0.04 * stove - 0.015 * tier; return [0.62 - w / 2, 0.62 + w / 2]; }
export const FRY_RATE = 0.42; // doneness a second while held
export function fryQuality(d, band) { if (d >= band[0] && d <= band[1]) return 1; if (d > 0.95) return 0; return Math.max(0.35, 1 - Math.min(Math.abs(d - band[0]), Math.abs(d - band[1])) * 3); }
// Microwave: a needle sweeps the dial; stop it in the green.
export function microBand(micro, tier) { const w = 0.12 + 0.035 * micro - 0.012 * tier; return [0.7 - w / 2, 0.7 + w / 2]; }
export const microSpeed = tier => 0.55 + 0.08 * tier; // dial turns a second
export function microQuality(p, band) { if (p >= band[0] && p <= band[1]) return 1; return Math.max(0.3, 1 - Math.min(Math.abs(p - band[0]), Math.abs(p - band[1])) * 3.5); }
// Blend: tap to fill the jug before it settles back.
export const blendTaps = (blender, tier) => Math.max(8, 16 + tier * 2 - blender * 3);

// ---------- paying
// stars 1 to 3 from the mean quality; the tip grows with stars, decor and a quick catch.
export function dishStars(q) { return q >= 0.9 ? 3 : q >= 0.6 ? 2 : 1; }
export function bill(save, recipeId, quality, waitSeconds) {
  const r = RECIPES[recipeId], stars = dishStars(quality);
  const price = Math.round(r.price * (1 + 0.15 * save.tier));
  const quick = waitSeconds <= TUNE.patience ? 1 : Math.max(0.2, 1 - (waitSeconds - TUNE.patience) / 60);
  const tip = Math.round(price * [0, 0.1, 0.25, 0.5][stars] * (1 + 0.1 * (save.built.decor - 1)) * quick);
  return { price, tip, stars, total: price + tip };
}

// ---------- a day: which guests come, what they order
export function dayPlan(save, seed) {
  const r = rng(seed), menu = menuFor(save), guests = TIERS[save.tier].guests + Math.max(0, save.built.tables - 1) % 2;
  // Newer dishes come up a bit more often, but never the same dish twice in a row and never more than half a day.
  const out = [], cap = Math.ceil(guests / 2);
  for (let i = 0; i < guests; i++) {
    const count = id => out.filter(o => o.recipe === id).length;
    const ok = menu.filter(id => id !== out.at(-1)?.recipe && count(id) < cap);
    const from = ok.length ? ok : menu;
    const weights = from.map(id => (1 + (RECIPES[id].tier === save.tier ? 0.6 : 0)) / (1 + count(id) * 2));
    let pick = r() * weights.reduce((a, b) => a + b, 0), id = from[0];
    for (let k = 0; k < from.length; k++) { if ((pick -= weights[k]) <= 0) { id = from[k]; break; } }
    out.push({ recipe: id, look: Math.floor(r() * 8) });
  }
  // Moods (from the Bistro, when the Manners Wheel arrives): a few guests a day are rude, picky or sneaky. Drawn from
  // a separate stream so the dish plan stays the same as before moods existed.
  const rm = rng(seed ^ 0x5eed);
  if (save.tier >= MOOD_FROM) {
    const cap = Math.min(3, 1 + Math.floor(save.tier / 4));
    let n = 0;
    for (let i = 1; i < out.length && n < cap; i++) if (rm() < 0.3) { out[i].mood = MOODS[Math.floor(rm() * MOODS.length)]; n++; }
  }
  return out;
}
export const MOOD_FROM = 2;
export const MOODS = ['rude', 'picky', 'sneaky'];
// Make sure today has a guest of each mood an open mission asks for (skipping the first guest).
export function forceMoods(plan, moods) {
  const out = plan.map(p => ({ ...p }));
  for (const m of moods) {
    if (out.some(p => p.mood === m)) continue;
    const i = out.findIndex((p, k) => k > 0 && !p.mood); if (i < 0) break;
    out[i].mood = m;
  }
  return out;
}

// ---------- the Manners Wheel. "Feed everyone. Throw food? Spin first. THEN feed."
// Sorting actions send the guest off in a slapstick way; they come back polite and order. back: false means they do
// not come back to eat (robbed, hired, or lost a fight and stayed to work).
export const WHEEL = {
  kick_out: { stunt: 'fly', back: true },
  slap: { stunt: 'spin', back: true },
  fridge: { stunt: 'into', at: 'fridge', back: true },
  pan: { stunt: 'hop', back: true },
  microwave: { stunt: 'into', at: 'micro', back: true },
  cook_self: { stunt: 'into', at: 'stove', back: true },
  lock_out: { stunt: 'out', back: true },
  trash: { stunt: 'into', at: 'trash', back: true },
  rob: { stunt: 'shake', back: false },
  hire: { stunt: 'join', back: false },
  fight: { stunt: 'fight', back: true },
};
export const WHEEL_IDS = Object.keys(WHEEL);
// What sorting a guest does to the tip: a moody guest comes back sorry (a bigger tip); a calm guest comes back sulking.
export const wheelTip = mood => (mood ? 1.25 : 0);
// Moody guests left alone: rude ones tip nothing and throw anything under three stars back; picky ones tip only for
// three stars; sneaky ones run off with half the bill.
export function moodBill(b, mood) {
  if (mood === 'rude') return { ...b, tip: 0, total: b.price, thrown: b.stars < 3 };
  if (mood === 'picky' && b.stars < 3) return { ...b, tip: 0, total: b.price };
  if (mood === 'sneaky') { const price = Math.ceil(b.price / 2); return { ...b, price, tip: 0, total: price, dashed: true }; }
  return b;
}
export const robTake = (save, recipeId) => Math.round(RECIPES[recipeId].price * (1 + 0.15 * save.tier) * 0.6);
// A fist fight: tap faster than the guest. Taps needed in FIGHT_SECS seconds.
export const FIGHT_SECS = 3;
export const fightTaps = tier => Math.round(10 + tier * 1.2);
// Staff: hired guests earn a wage and add to tips; a guest who lost a fight owes one free shift and may rebel.
export const STAFF_MAX = 2;
export const wage = tier => 8 + tier * 6;
export const staffTip = n => 1 + 0.15 * n;
export const REBEL_CHANCE = 0.4;
// The very first day is the tutorial: a fixed, gentle order list.
export const TUTORIAL_DAY = [{ recipe: 'sticks', look: 0 }, { recipe: 'salad', look: 3 }, { recipe: 'fruitcup', look: 5 }];
