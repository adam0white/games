// Lantern Duet rules. Derived from experiments/lantern/sim.js (seed generator, river centre, width,
// speed, waterfall). Pure fixed-step story simulation: no window, no document, no Math.random.

export const DT = 1 / 60;
export const GOAL = 78; // river units from the start to dawn
export const BOAT = 0.022; // boat radius
export const SNAG_TIME = 0.5; // seconds a snag may last before it costs a heart
export const NIGHTS = 3;
export const WARN_TIME = 1.0; // seconds ahead at which a rock between the boats sets off the warning

const ROPE_SHARE = 0.45; // the rope reaches this share of the river's usual width
const MIN_GAP = BOAT * 2.2; // the boats never come closer than this
const BOAT_SPEED = 0.95; // river units per second each boat can move sideways
const START_GAP = 0.07;
const START_LIGHT = 0.8;
const HEARTS = 3;
const SAFE_TIME = 1.6; // seconds without damage after a hit
const WARM_TIME = 0.55; // seconds the flame does not fade after an ember
const EMBER_LIGHT = 0.055;
const FADE = 0.046; // flame lost per second at the start of the night
const FADE_LATE = 0.03; // and this much more per second by dawn
const EMBER_REACH_Y = 0.045; // how close along the river an ember must be to the rope
const EMBER_REACH_X = 0.025; // how far past a boat the rope still catches an ember
const EMBER_SPACING = 0.045; // across the river, between embers of one line after the teaching part
const SNAG_REACH_Y = 0.018; // extra distance along the river at which a rock catches the rope
const TEACH_END = 20; // night 1 keeps the teaching pattern until here (about 30 seconds)
const NARROW_SHARE = 0.42; // a narrow reach is this share of the river's usual width
const NARROW_RAMP = 0.6; // river units over which a narrow reach closes and opens
const STAGE = [1, 3, 5]; // each night's story stage in the main game's terms: night 3 has the waterfall

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The river's middle at distance y.
export function centre(s, y) {
  return 0.5 + 0.17 * Math.sin(y * 0.33 + s.p1) + 0.07 * Math.sin(y * 0.81 + s.p2);
}

// Half the river's usual width at distance y. It narrows through the night and again just before dawn.
export function baseHalf(s, y) {
  const k = Math.min(1, y / GOAL);
  return 0.27 - 0.07 * k - 0.035 * Math.max(0, (k - 0.88) / 0.12);
}

// How much narrow reaches squeeze the river at y: 1 is open water, NARROW_SHARE the tightest.
export function squeeze(s, y) {
  let k = 1;
  for (const n of s.narrows) {
    if (y < n.y0 - NARROW_RAMP || y > n.y1 + NARROW_RAMP) continue;
    const into = Math.min(1, (y - n.y0 + NARROW_RAMP) / NARROW_RAMP, (n.y1 + NARROW_RAMP - y) / NARROW_RAMP);
    k = Math.min(k, 1 - (1 - NARROW_SHARE) * into * into * (3 - 2 * into)); // eased in and out
  }
  return k;
}

// Half the river's width at distance y, narrow reaches included.
export function half(s, y) {
  const k = squeeze(s, y);
  return k === 1 ? baseHalf(s, y) : baseHalf(s, y) * k;
}

// Waterfall strength at y, 0 to 1. Only stage 5 and later have one, halfway down the river.
export function fall(s, y) {
  const d = y - GOAL * (s.stage >= 16 && y > GOAL * 0.7 ? 0.8 : 0.5);
  return s.stage >= 5 && d >= 0 && d < 3 ? Math.sin(d / 3 * Math.PI) : 0;
}

export const progress = s => Math.min(1, s.y / GOAL);

// Speed along the river. Duet tops out lower than the main game (0.99 instead of 1.24 on night 1),
// so rocks can be shown 1.2 seconds ahead on a phone and two thumbs have time to react.
export const speed = s =>
  (0.62 + 0.372 * Math.min(1, s.y / GOAL)) * (1 + 0.08 * (s.night - 1)) * (1 + 0.7 * fall(s, s.y));

// The rope's length follows the river's usual width, so in a narrow reach a wide rope meets the banks.
export const ropeMax = s => ROPE_SHARE * 2 * baseHalf(s, s.y);

// River units ahead that the warning looks.
export const ahead = s => speed(s) * WARN_TIME;

export function create(seed, night = 1) {
  const r = rng(seed);
  const s = {
    seed, night, stage: STAGE[night - 1], r, p1: r() * 6.28, p2: r() * 6.28,
    t: 0, y: 0, x: 0, left: 0, right: 0,
    light: START_LIGHT, hearts: HEARTS, safe: 0, warm: 0,
    rocks: [], embers: [], narrows: [], events: [],
    taken: 0, snags: 0, snag: null, danger: null, tight: null, over: null,
  };
  const c = centre(s, 0);
  s.left = c - START_GAP / 2;
  s.right = c + START_GAP / 2;
  s.x = c;
  let y = 3;
  // Night 1 opens with the teaching pattern: a wide ember line, then a lone rock, repeated.
  if (night === 1) {
    for (; y < TEACH_END; y += 3.6 + r() * 0.6) {
      const c = centre(s, y), h = half(s, y), offset = (r() - 0.5) * 0.025;
      for (const dx of [-0.17, -0.085, 0, 0.085, 0.17]) s.embers.push({ x: c + dx * (h / 0.27), y, got: false });
      const ry = y + 1.8, rc = centre(s, ry);
      addRock(s, rc + offset, ry, 0.034 + r() * 0.008);
    }
  }
  river(s, r, y);
  return s;
}

function addRock(s, x, y, rad) {
  s.rocks.push({ x, y, rad, snagged: false, spent: false, warned: false });
}

// After the teaching pattern, each stretch is an ember feature followed by a hazard. Both grow more
// varied, and the hazard follows the embers more closely, as the night goes on and on later nights.
const EMBER_KINDS = ['line', 'arc', 'offset'];
const HAZARD_KINDS = ['lone', 'side', 'pair', 'narrow'];

function river(s, r, from) {
  const clear = y => [-1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5].every(d => fall(s, y + d) === 0); // a whole stretch, never in or just after a waterfall
  let lastHazard = '';
  for (let y = from; y < GOAL - 2.5;) {
    if (!clear(y)) {
      y += 0.5;
      continue;
    }
    const p = Math.min(1, y / GOAL + 0.3 * (s.night - 1)); // how far the variety has grown, 0 to 1
    const emberKinds = p < 0.3 ? 1 : p < 0.45 ? 2 : 3;
    emberFeature(s, r, EMBER_KINDS[Math.floor(r() * emberKinds)], y, p);
    const hazards = HAZARD_KINDS.slice(0, p < 0.3 ? 2 : p < 0.45 ? 3 : 4).filter(k => k !== lastHazard);
    const hazard = hazards[Math.floor(r() * hazards.length)];
    lastHazard = hazard;
    const hy = y + 1.8 - 0.6 * p - 0.15 * r();
    const end = hazardFeature(s, r, hazard, hy);
    y = end + 1.7 - 0.5 * p + r() * 0.6;
  }
}

function emberFeature(s, r, kind, y, p) {
  const c = centre(s, y), h = half(s, y);
  const most = ROPE_SHARE * 2 * baseHalf(s, y) + 2 * EMBER_REACH_X - 0.03; // widest a full sweep can take
  if (kind === 'arc') {
    // A crescent bowed toward the boats: the rope sweeps it over a short stretch of river.
    const a = 0.45 * most, n = Math.round(2 * a / EMBER_SPACING) + 1;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) * 2 - 1;
      s.embers.push({ x: c + u * a, y: y + 0.3 * (1 - u * u), got: false });
    }
    return;
  }
  // A straight line of varying width; an 'offset' line is shorter and set toward one bank.
  const offset = kind === 'offset';
  const span = Math.min(most, (offset ? 0.16 : 0.2) + r() * 0.08 * (0.5 + p));
  const n = Math.round(span / EMBER_SPACING) + 1;
  const room = Math.max(0, h - BOAT - 0.05 - span / 2);
  const shift = offset ? (r() < 0.5 ? -1 : 1) * room * (0.6 + 0.4 * r()) : (r() - 0.5) * room * p;
  for (let i = 0; i < n; i++) s.embers.push({ x: c + shift - span / 2 + span * i / (n - 1), y, got: false });
}

// Places a hazard at y and returns where it ends.
function hazardFeature(s, r, kind, y) {
  const c = centre(s, y), h = half(s, y);
  if (kind === 'lone') {
    addRock(s, c + (r() - 0.5) * 0.05, y, 0.034 + r() * 0.01);
    return y;
  }
  if (kind === 'side') {
    // A big rock toward one bank: both boats steer round it on the open side.
    const side = r() < 0.5 ? -1 : 1, rad = 0.05 + r() * 0.012;
    addRock(s, c + side * h * 0.4, y, rad);
    return y;
  }
  if (kind === 'pair') {
    // Two rocks with a gap the boats can thread only together.
    const gap = 0.15 + r() * 0.03, rad = 0.032 + r() * 0.006, mid = c + (r() - 0.5) * 0.06;
    addRock(s, mid - gap / 2 - rad, y, rad);
    addRock(s, mid + gap / 2 + rad, y, rad);
    return y;
  }
  // A narrow reach: the river closes in, so the rope must be short. Embers in single file reward it.
  const len = 1 + r() * 0.6;
  s.narrows.push({ y0: y, y1: y + len, warned: false });
  for (let k = 0.3; k < len; k += 0.7) s.embers.push({ x: centre(s, y + k), y: y + k, got: false });
  return y + len + NARROW_RAMP;
}

function hit(s, cause) {
  if (s.safe) return;
  s.hearts--;
  s.safe = SAFE_TIME;
  s.events.push('hurt');
  if (!s.hearts) {
    s.over = cause;
    s.events.push('hit');
  }
}

// The lead-in to a snag: a rock ahead, within WARN_TIME, lies between the boats. It shows before any
// snag timer runs and sounds once per rock. A narrow reach ahead that the rope is too wide for warns too.
function warn(s) {
  const reach = ahead(s);
  s.danger = null;
  for (const k of s.rocks) {
    if (k.spent || k.snagged || k.y < s.y || k.y - s.y > reach + k.rad) continue;
    if (s.left < k.x - k.rad && s.right > k.x + k.rad) {
      s.danger = k;
      if (!k.warned) {
        k.warned = true;
        s.events.push('warn');
      }
      break;
    }
  }
  s.tight = null;
  for (const n of s.narrows) {
    if (n.y1 < s.y || n.y0 - NARROW_RAMP - s.y > reach) continue;
    const room = 2 * (half(s, Math.max(s.y, n.y0)) - BOAT);
    if (s.right - s.left > room) {
      s.tight = n;
      if (!n.warned) {
        n.warned = true;
        s.events.push('narrow');
      }
    }
    break;
  }
}

// One fixed step. targets = [left boat x, right boat x] that the player asks for.
export function step(s, targets) {
  s.events = [];
  if (s.over) return s;
  s.t += DT;
  s.y += speed(s) * DT;
  s.safe = Math.max(0, s.safe - DT);
  s.warm = Math.max(0, s.warm - DT);

  // Each boat moves toward its target at a limited speed.
  for (const [i, key] of ['left', 'right'].entries()) {
    s[key] += Math.max(-BOAT_SPEED * DT, Math.min(BOAT_SPEED * DT, targets[i] - s[key]));
  }
  // The rope keeps the gap between its shortest and longest, about the pair's middle.
  let mid = (s.left + s.right) / 2;
  let gap = Math.max(MIN_GAP, Math.min(ropeMax(s), s.right - s.left));
  s.left = mid - gap / 2;
  s.right = mid + gap / 2;

  // A boat past the bank costs a heart; the pair is then pushed back inside. A narrow reach also
  // squeezes the gap, so the boats never sit outside the banks.
  const c = centre(s, s.y), edge = half(s, s.y) - BOAT;
  if (s.left < c - edge || s.right > c + edge) hit(s, 'bank');
  gap = Math.max(MIN_GAP, Math.min(gap, 2 * edge));
  mid = Math.max(c - edge + gap / 2, Math.min(c + edge - gap / 2, mid));
  s.left = mid - gap / 2;
  s.right = mid + gap / 2;
  s.x = (s.left + s.right) / 2;

  if (!s.warm) s.light -= (FADE + FADE_LATE * Math.min(1, s.y / GOAL)) * DT;

  // The rope is a net: any ember it passes over is taken.
  for (const e of s.embers) {
    if (e.got || Math.abs(e.y - s.y) >= EMBER_REACH_Y) continue;
    if (e.x < s.left - EMBER_REACH_X || e.x > s.right + EMBER_REACH_X) continue;
    e.got = true;
    s.taken++;
    s.light = Math.min(1, s.light + EMBER_LIGHT);
    s.warm = WARM_TIME;
    s.events.push('ember');
  }

  for (const k of s.rocks) {
    for (const x of [s.left, s.right]) {
      if (Math.hypot(x - k.x, s.y - k.y) < k.rad + BOAT) hit(s, 'rock');
    }
    // A rock between the boats catches the rope. The snag stays after the rock passes,
    // until both boats are on one side of it, or SNAG_TIME runs out and it costs a heart.
    const between = s.left < k.x - k.rad && s.right > k.x + k.rad;
    if (!k.spent && !k.snagged && Math.abs(k.y - s.y) < k.rad + SNAG_REACH_Y && between) {
      k.snagged = true;
      k.since = s.t;
      s.snags++;
      s.events.push('snag');
    }
    if (k.snagged) {
      if (s.left > k.x + k.rad || s.right < k.x - k.rad) {
        k.snagged = false;
        k.spent = true;
        s.events.push('free');
      } else if (s.t - k.since >= SNAG_TIME) {
        hit(s, 'rope');
        k.snagged = false;
        k.spent = true;
        s.events.push('snap');
      }
    }
  }
  s.snag = s.rocks.find(k => k.snagged) || null;
  warn(s);

  if (!s.over && s.light <= 0) {
    s.light = 0;
    s.over = 'dark';
    s.events.push('out');
  }
  if (!s.over && s.y >= GOAL) {
    s.over = 'dawn';
    s.events.push('dawn');
  }
  return s;
}
