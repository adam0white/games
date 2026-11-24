// Lantern Rhythm: pure, seeded simulation. No DOM. One tick is 1/60 s; the only input is a target x in [0, 1].
// Started from a copy of experiments/lantern/sim.js (story nights only) and cut down to what this experiment needs.
// The river is laid out on a beat grid. The boat's forward speed is constant for a night, so one beat is always
// BEAT units of river. Rocks sit exactly on beats; embers sit on off-beats (half a beat after a beat) along a safe line.
// A bar is four beats. Each bar's rocks come from a seeded pattern book that grows harder through the night.
// Differences from the main game, on purpose:
//   - constant forward speed (the main game speeds up from 0.62 to 1.24 times its pace over a night; this one runs at
//     the main game's average, 0.93 times the pace, all night), so a beat is a fixed distance;
//   - no waterfall, wind, ice, swinging or bobbing rocks, powers or gifts: nothing may move a rock off its beat;
//   - the flame never goes out: it fades only to FLOOR, so embers are the tune and survival never needs them;
//   - three hearts, so a hit costs the music (two bars of bare pulse) and a heart, not the run.
export const DT = 1 / 60;
export const BEAT = 0.775; // river units per beat, on every night
export const BARS = 26; // bars in a night; the first bar has no rocks
export const GOAL = BARS * 4 * BEAT; // about 80.6 units, about 87 s on night 1
export const BOAT = 0.022;
export const NIGHTS = 5;
export const HEARTS = 3;
export const FLOOR = 0.45; // the lowest the flame fades to
export const LANE = 0.6; // the side lanes sit this share of the half-width from the middle
export const BIG = 0.048, SMALL = 0.03; // rock radii: a big rock is a low drum, a small one a click
export const GAP = 0.075; // half-width of a gate's opening
export const nightPace = n => 1 + 0.035 * (n - 1); // the main game's pace for nights 1 to 20
export const bpm = n => 72 * nightPace(n); // 72 beats a minute on night 1, a little faster each night
export const speed = s => BEAT * bpm(s.stage) / 60; // river units a second; 0.93 on night 1
export const side = s => 0.95 * nightPace(s.stage); // the most the boat moves sideways in a second (the main game's limit)
export const beatOf = s => s.y / BEAT;
export const boat = () => BOAT;
export const progress = s => Math.min(1, s.y / GOAL);
export const reach = light => 0.17 + 0.6 * light;
export const sight = s => reach(s.light);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The river's course and width, as on a main-game story night.
export function centre(s, y) { return 0.5 + 0.17 * Math.sin(y * 0.33 + s.p1) + 0.07 * Math.sin(y * 0.81 + s.p2); }
export function half(s, y) { const k = Math.min(1, y / GOAL); return 0.27 - 0.07 * k - 0.035 * Math.max(0, (k - 0.88) / 0.12); }
export const laneX = (s, y, u) => centre(s, y) + u * LANE * half(s, y);

// Harmony. One chord a bar. Night is D minor (Dm7, Bb, F maj7, C add9); the last bars turn to D major, as in lab/lantern-song.
export const NIGHT = [[50, 53, 57, 60], [46, 50, 53, 58], [53, 57, 60, 64], [48, 52, 55, 62]];
export const DAWN = [[50, 54, 57, 62], [55, 59, 62, 66], [57, 61, 64, 69], [50, 54, 57, 66]];
export const DAWN_BAR = Math.ceil(0.86 * BARS);
export const chord = bar => (bar >= DAWN_BAR ? DAWN : NIGHT)[bar & 3];

// The pattern book: four beats a bar. L, M, R are the left, middle and right lanes; capitals are big rocks, small letters
// small rocks; G is a gate of logs from both banks with one lane open; a dot is an empty beat. Each pattern may be mirrored.
// Every beat leaves at least one lane open. Tier 0 opens night 1; a tier is added through the night and with each night.
export const BOOK = [
  ['L . R .', 'R . L .', 'L . . R', 'M . . .', 'L . M .', 'l . r .', 'M . l .', '. L . R'],
  ['L . R G', 'L r . R', 'M l M r', 'L . r l', 'LM . . R', 'G . L .', 'l r l .', 'M . G .'],
  ['L r L G', 'LM . MR .', 'L R L R', 'G . G .', 'Lm . r G', 'MR l . G', 'l r l r', 'LR . LM .'],
  ['LM MR LM G', 'L MR l G', 'LR LM LR MR', 'G l G r', 'MR LM MR G', 'Lm rM lM G', 'LR MR LR LM'],
];
export const tierAt = (stage, bar) => Math.min(BOOK.length - 1, Math.floor((stage - 1) * 0.5 + (bar / BARS) * 2.6));
const LANES = { l: -1, m: 0, r: 1 };

export function create(seed, stage = 1) {
  stage = Math.max(1, Math.min(NIGHTS, Math.floor(stage) || 1));
  const r = rng(seed), m = rng(seed ^ 0x51ed27);
  const s = { seed, stage, r, m, p1: r() * 6.28, p2: r() * 6.28, n: 0, t: 0, y: 0, x: 0.5, light: 0.8, warm: 0, safe: 0, hearts: HEARTS, take: 0.05,
    rocks: [], embers: [], line: [], bars: [], nextBar: 0, lane: 0, pend: null, motifA: null, motifB: null,
    taken: 0, missed: 0, streak: 0, best: 0, hits: 0, bare: -1, events: [], over: null };
  s.motifA = motif(m); s.motifB = motif(m);
  s.x = centre(s, 0);
  return s;
}

// A one-bar tune: which of the four off-beats carry a note, and each note's place in a walk over two octaves of the chord.
function motif(m) {
  const slots = [null, null, null, null], count = 2 + Math.floor(m() * 3);
  let walk = 2 + Math.floor(m() * 4);
  const free = [0, 1, 2, 3];
  for (let i = 0; i < count; i++) free.splice(Math.floor(m() * free.length), 1).forEach(j => { slots[j] = 0; });
  for (let j = 0; j < 4; j++) if (slots[j] !== null) { walk = Math.max(0, Math.min(7, walk + (m() < 0.5 ? -1 : 1) * (m() < 0.25 ? 2 : 1))); slots[j] = walk; }
  return slots;
}
const pitch = (bar, deg) => chord(bar)[deg % 4] + 12 * (1 + (deg >> 2));

function rock(x, y, rad, beat, u, kind = '') { return { x, x0: x, y, y0: y, rad, kind, len: 0, beat, side: u, big: rad >= BIG }; }

// Lay one bar: its rocks on the beats, the safe line through them, and embers on the off-beats along that line.
function lay(s, bar) {
  const r = s.r, tier = tierAt(s.stage, bar);
  let text = '. . . .', mirror = false;
  if (bar > 0) {
    const t = r() < 0.7 || tier === 0 ? tier : Math.floor(r() * tier); // most bars from this tier, some from an easier one
    text = BOOK[t][Math.floor(r() * BOOK[t].length)]; mirror = r() < 0.5;
  }
  s.bars.push({ bar, text, mirror, tier });
  // A tune for this bar: A A B A, with a new B every four bars.
  if (bar % 4 === 0 && bar) s.motifB = motif(s.m);
  const tune = bar % 4 === 2 ? s.motifB : s.motifA;
  const lanes = [];
  text.split(' ').forEach((tok, i) => {
    const j = bar * 4 + i, y = j * BEAT, c = centre(s, y), h = half(s, y);
    const blocked = new Set(), row = [];
    if (tok === 'G') {
      const open = Math.floor(r() * 3) - 1, g = c + open * LANE * h; // the lane left open
      for (const [lo, hi, u] of [[c - h, g - GAP, -1], [g + GAP, c + h, 1]]) {
        const len = (hi - lo) / 2 - 0.018;
        if (len > 0.005) { const q = rock((lo + hi) / 2, y, 0.018, j, u, 'log'); q.len = len; q.gate = true; row.push(q); }
      }
      for (const u of [-1, 0, 1]) if (u !== open) blocked.add(u);
    } else if (tok !== '.') for (const ch of tok) {
      let u = LANES[ch.toLowerCase()]; if (mirror) u = -u;
      blocked.add(u); row.push(rock(c + u * LANE * h, y, ch === ch.toUpperCase() ? BIG : SMALL, j, u));
    }
    // The safe lane: the lane already taken if it is open (kept half the time when a move is possible), else an open lane.
    const open = [-1, 0, 1].filter(u => !blocked.has(u));
    let u = s.lane;
    if (!open.includes(u) || (row.length && open.length > 1 && r() < 0.5)) u = open[Math.floor(r() * open.length)];
    lanes.push(u); s.lane = u;
    s.rocks.push(...row);
  });
  // The off-beat after the last bar's fourth beat waits for the next bar's first lane; place it now with this lane.
  const place = (j, u0, u1, note) => { const y = (j + 0.5) * BEAT, u = (u0 + u1) / 2; s.embers.push({ x: laneX(s, y, u), y, got: false, kind: 'ember', note, beat: j + 0.5 }); };
  if (s.pend) { const p = s.pend; s.line.push({ y: (p.j + 0.5) * BEAT, x: laneX(s, (p.j + 0.5) * BEAT, (p.u + lanes[0]) / 2) }); if (p.note !== null) place(p.j, p.u, lanes[0], p.note); s.pend = null; }
  for (let i = 0; i < 4; i++) {
    const j = bar * 4 + i;
    s.line.push({ y: j * BEAT, x: laneX(s, j * BEAT, lanes[i]), beat: j });
    const note = tune[i] === null ? null : pitch(bar, tune[i]);
    if (i < 3) { s.line.push({ y: (j + 0.5) * BEAT, x: laneX(s, (j + 0.5) * BEAT, (lanes[i] + lanes[i + 1]) / 2) }); if (note !== null) place(j, lanes[i], lanes[i + 1], note); }
    else if (bar === BARS - 1) { s.line.push({ y: (j + 0.5) * BEAT, x: laneX(s, (j + 0.5) * BEAT, lanes[i]) }); if (note !== null) place(j, lanes[i], lanes[i], note); }
    else s.pend = { j, u: lanes[i], note };
  }
}

function spawn(s) {
  // One bar at a time, well ahead of the light, so the same seed always gives the same river.
  while (s.nextBar < BARS && s.nextBar * 4 * BEAT < s.y + 4.2) lay(s, s.nextBar++);
}

// A blow: a spare heart takes it, else the run ends. A hit drops the music to its bare pulse for two bars.
function blow(s, cause) {
  s.hits++; s.streak = 0; s.bare = Math.floor(beatOf(s)) + 8;
  if (s.hearts > 1) { s.hearts--; s.safe = 1.6; s.events.push('hurt'); return false; }
  s.hearts = 0; s.over = cause; s.events.push('hit'); return true;
}

export function step(s, target) {
  s.events.length = 0;
  if (s.over) return s;
  spawn(s);
  s.n++; s.t = s.n * DT; s.y = s.t * speed(s); // from the tick count, so rounding never pulls the river off its beat
  const max = side(s) * DT, dx = Math.max(0, Math.min(1, target)) - s.x;
  s.x += Math.max(-max, Math.min(max, dx));
  s.warm = Math.max(0, s.warm - DT); s.safe = Math.max(0, s.safe - DT);
  if (!s.warm) s.light = Math.max(FLOOR, s.light - (0.04 + 0.025 * progress(s)) * nightPace(s.stage) * DT);
  for (const e of s.embers) if (!e.got && Math.hypot(e.x - s.x, e.y - s.y) < s.take) {
    e.got = true; s.taken++; s.streak++; s.best = Math.max(s.best, s.streak);
    s.light = Math.min(1, s.light + 0.3); s.warm = 2.5; s.events.push('ember');
  }
  for (const k of s.rocks) {
    if (Math.abs(k.y - s.y) > 0.2) continue;
    const d = Math.hypot(Math.max(0, Math.abs(k.x - s.x) - k.len), k.y - s.y) - k.rad - BOAT;
    if (d < 0 && !s.safe) { if (blow(s, k.kind || 'rock')) return s; }
  }
  const c = centre(s, s.y), edge = half(s, s.y) - BOAT;
  if (Math.abs(s.x - c) > edge) {
    if (s.safe) s.x = c + Math.sign(s.x - c) * edge;
    else { if (blow(s, 'bank')) return s; s.x = c + Math.sign(s.x - c) * (edge - 0.03); }
  }
  // An ember left behind is a hole in the tune. Embers are laid in order of y, so the oldest is first.
  while (s.embers.length && s.embers[0].y < s.y - 0.06) { const e = s.embers.shift(); if (!e.got) { s.missed++; s.streak = 0; s.events.push('miss'); } }
  if (s.y >= GOAL) { s.over = 'dawn'; s.events.push('dawn'); }
  if (s.rocks.length && s.rocks[0].y0 < s.y - 1.5) s.rocks = s.rocks.filter(k => k.y0 >= s.y - 1.5);
  while (s.line.length > 2 && s.line[1].y < s.y - 1) s.line.shift();
  return s;
}

// The share of the tune played so far: embers taken over embers passed (laid behind the boat or taken).
export const melody = s => s.taken + s.missed ? s.taken / (s.taken + s.missed) : 1;
