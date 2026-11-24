// A small, independent meadow. Rules use a fixed tick and a serializable RNG.
export const WIDTH = 360, HEIGHT = 500, DT = 1 / 60, DAY = 180;
export const RESIDENTS = [
  { id: 'beetle', name: 'Beetle', mood: 'grumpy', x: 64, y: 385, color: '#cb9560' },
  { id: 'snail', name: 'Snail', mood: 'sleepy', x: 72, y: 130, color: '#e3b15c' },
  { id: 'spider', name: 'Spider', mood: 'sly', x: 285, y: 135, color: '#aa8cbd' },
  { id: 'frog', name: 'Frog', mood: 'proud', x: 285, y: 390, color: '#77a977' },
];
export const FALLBACK = {
  beetle: { name: 'Beetle', ask: { fetch: 'Bring me {count} seeds. Good ones.', hunt: 'Catch {count} aphids off my roots.', escort: 'Bring that lost ant here.', race: 'Beat me to the golden pebble!', hide: 'Hide this pebble under the leaf. Stay still.' }, thanks: 'Hmph. You are a proper neighbour.', scold: 'Late again. Try with both feet.', secret: 'The oldest stone is hollow underneath.' },
  snail: { name: 'Snail', ask: { fetch: 'A little dew. {count} drops, please.', hunt: 'Those {count} aphids keep me awake.', escort: 'Our little friend has lost the way.', race: 'To the pebble. I will watch from here.', hide: 'Shh. Hide this pebble under the leaf.' }, thanks: 'You make the meadow feel like home.', scold: 'Oh. I waited until my tea went cold.', secret: 'Dew tastes sweeter on a moonlit morning.' },
  spider: { name: 'Spider', ask: { fetch: 'Bring {count} crumbs. No questions.', hunt: '{count} aphids. A tiny favour, really.', escort: 'Lead our wanderer safely home.', race: 'Touch the pebble before my thread falls.', hide: 'Hide this pebble beneath that leaf.' }, thanks: 'A deal is a deal. Watch my silk.', scold: 'That was not quite our arrangement.', secret: 'A strand of silk can carry a whole ant.' },
  frog: { name: 'Frog', ask: { fetch: 'Fetch {count} berries for a champion.', hunt: 'Catch {count} aphids. Show some spring!', escort: 'Bring that lost ant to my pond.', race: 'Race you to the golden pebble!', hide: 'Bird above! Hide this pebble beneath the leaf.' }, thanks: 'Splendid! I shall guard your path.', scold: 'Even champions practise. Try again.', secret: 'The pond reflects stars before the sky does.' },
};
const PLANS = { beetle: ['fetch', 'hunt', 'race'], snail: ['fetch', 'escort', 'hide'], spider: ['hunt', 'race', 'fetch'], frog: ['race', 'hide', 'escort'] };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const home = id => RESIDENTS.find(r => r.id === id);
const emit = (s, type, more = {}) => s.events.push({ type, t: type, ...more });
export function random(s) {
  s.r = (s.r + 0x6d2b79f5) | 0;
  let t = Math.imul(s.r ^ s.r >>> 15, 1 | s.r);
  t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
export function create({ seed = 1, memory = {} } = {}) {
  return { seed: seed >>> 0, r: seed | 0, t: 0, tick: 0, status: 'play', player: { x: 105, y: 397, a: Math.PI, ph: 0, safe: 0, slow: 0 },
    friends: Object.fromEntries(RESIDENTS.map(r => [r.id, 0])), memory: Object.fromEntries(RESIDENTS.map(r => [r.id, { visits: Math.max(0, memory[r.id]?.visits | 0), failed: !!memory[r.id]?.failed }])),
    attempts: Object.fromEntries(RESIDENTS.map(r => [r.id, 0])), cooldown: 0, quest: null, completed: [], failed: 0, events: [],
    world: { rockOpen: 0, trail: 0, bridge: 0, frogHelp: 0 },
    // Hunters roam; contact loses time rather than killing or resetting the run.
    hunters: [{ x: 162, y: 204, a: 0, id: 0 }, { x: 248, y: 298, a: 2, id: 1 }, { x: 116, y: 270, a: 4, id: 2 }],
    rules: { requirementMultiplier: 1 },
  };
}

// The page may prefetch this preview; offering does not consume RNG or change it.
export function peekQuest(s, giver) {
  const r = home(giver), stage = s.friends[giver] + 1;
  if (!r || stage > 3) return null;
  const kind = PLANS[giver][stage - 1];
  const target = kind === 'fetch' ? ({ beetle: 'seed', snail: 'dewdrop', spider: 'crumb', frog: 'berry' }[giver]) : kind === 'hunt' ? 'aphid' : kind === 'escort' ? 'lost-ant' : 'pebble';
  return { id: `${giver}-${stage}-${s.attempts[giver]}`, giver, kind, target, count: kind === 'fetch' || kind === 'hunt' ? stage + 1 : 1, mood: r.mood, variant: (s.seed + RESIDENTS.indexOf(r) + stage + s.attempts[giver]) % 4, stage };
}
function offer(s, giver) {
  const info = peekQuest(s, giver), r = home(giver);
  if (!info) return;
  const { kind, stage, count } = info;
  const q = { ...info, progress: 0, remaining: [0, 65, 37, 24][stage], points: [], goal: { x: r.x, y: r.y }, ready: false, hold: 0 };
  // Tasks stay in their resident's half of the meadow. Their amber targets are visible.
  const inward = r.x < WIDTH / 2 ? 1 : -1, down = r.y < HEIGHT / 2 ? 1 : -1;
  for (let i = 0; i < count; i++) {
    const spread = stage === 1 ? 30 : 48;
    q.points.push({ x: clamp(r.x + inward * (48 + (i % 2) * spread + stage * 8) + (random(s) - .5) * 12, 26, 334), y: clamp(r.y + down * (35 + Math.floor(i / 2) * spread) + (random(s) - .5) * 12, 52, 458), taken: false, a: random(s) * Math.PI * 2 });
  }
  if (kind === 'race') {
    q.goal = { x: clamp(r.x + inward * (100 + stage * 20), 28, 332), y: clamp(r.y + down * (100 + stage * 15), 52, 458) };
    q.remaining = [0, 23, 15, 11][stage];
    q.points = [{ ...q.goal, taken: false }];
  }
  if (kind === 'escort') { q.lost = { ...q.points[0], a: 0, ph: 0 }; q.points = []; q.remaining += 8; }
  if (kind === 'hide') { q.points = [{ x: r.x + inward * 72, y: r.y + down * 48, taken: false }]; q.holdNeed = 2.8 + stage * .7; q.remaining = [0, 24, 17, 12][stage]; }
  // Never place a target inside the movable boulder.
  const rock = { x: 180 + s.world.rockOpen * 22, y: 340 }, avoid = v => {
    const d = distance(v, rock), min = 42 - s.world.rockOpen * 3;
    if (d < min) { const a = Math.atan2(v.y - rock.y, v.x - rock.x); v.x = rock.x + Math.cos(a) * min; v.y = rock.y + Math.sin(a) * min; }
  };
  q.points.forEach(avoid); if (kind === 'race') { avoid(q.goal); q.points[0] = { ...q.goal, taken: false }; } if (q.lost) avoid(q.lost);
  s.quest = q; emit(s, 'offer', { quest: q, giver, kind, stage, id: q.id });
}
function complete(s) {
  const q = s.quest, r = home(q.giver);
  s.friends[q.giver]++;
  s.memory[q.giver].visits++; s.memory[q.giver].failed = false;
  s.world.rockOpen = s.friends.beetle; s.world.trail = s.friends.snail;
  s.world.bridge = s.friends.spider; s.world.frogHelp = s.friends.frog;
  s.hunters = s.hunters.filter(h => h.id >= s.world.frogHelp);
  s.completed.push({ giver: q.giver, kind: q.kind, stage: q.stage, at: s.t });
  emit(s, 'complete', { giver: q.giver, kind: q.kind, stage: q.stage, id: q.id, x: r.x, y: r.y, hearts: s.friends[q.giver] });
  s.quest = null; s.cooldown = 1.1;
  if (RESIDENTS.every(r => s.friends[r.id] === 3)) { s.status = 'won'; emit(s, 'win'); }
}
function fail(s) {
  const q = s.quest;
  s.memory[q.giver].failed = true; s.failed++; s.attempts[q.giver]++;
  emit(s, 'fail', { giver: q.giver, kind: q.kind, stage: q.stage, id: q.id });
  s.quest = null; s.cooldown = 1.3;
}
export function step(s, input = {}) {
  s.events.length = 0;
  if (s.status !== 'play') return s;
  s.t += DT; s.tick++; s.cooldown = Math.max(0, s.cooldown - DT);
  if (s.t >= DAY) { if (s.quest) fail(s); s.status = 'night'; emit(s, 'night'); return s; }
  const p = s.player;
  p.safe = Math.max(0, p.safe - DT); p.slow = Math.max(0, p.slow - DT);
  let x = Number.isFinite(input.x) ? input.x : 0, y = Number.isFinite(input.y) ? input.y : 0;
  const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
  let speed = 26;
  // Spider's bridge widens with each heart. Other crossings remain possible, slowly.
  if (p.y > 237 && p.y < 263 && !(s.world.bridge && Math.abs(p.x - 180) < 25 + s.world.bridge * 17)) speed *= .52;
  if (s.world.trail && p.x < 108 + s.world.trail * 6 && p.y > 120 && p.y < 410) speed *= 1 + s.world.trail * .13;
  if (p.slow) speed *= .55;
  if (distance(p, { x: 180 + s.world.rockOpen * 22, y: 340 }) < 44 - s.world.rockOpen * 5) speed *= Math.min(1, .38 + s.world.rockOpen * .21);
  p.x = clamp(p.x + x * speed * DT, 16, WIDTH - 16); p.y = clamp(p.y + y * speed * DT, 38, HEIGHT - 20);
  if (length > .01) { p.a = Math.atan2(y, x); p.ph += DT * Math.min(length, 1) * 12; }
  // The blocked path is slow, never an impassable trap for a new thumb.
  for (const h of s.hunters) {
    h.alert = s.t > 15 && distance(p, h) < 62 && s.quest?.kind !== 'hide';
    if (h.alert) h.a = Math.atan2(p.y - h.y, p.x - h.x);
    else h.a += Math.sin(s.t * .8 + h.id) * DT * 1.8;
    const pace = h.alert ? 18 : 10;
    h.x = clamp(h.x + Math.cos(h.a) * pace * DT, 110, 260); h.y = clamp(h.y + Math.sin(h.a) * pace * DT, 190, 310);
    if (s.t > 15 && distance(p, h) < 17 && !p.safe && s.quest?.kind !== 'hide') { p.safe = 2; p.slow = .8; if (s.quest) s.quest.remaining -= 1; emit(s, 'hit', { x: p.x, y: p.y }); }
  }
  if (!s.quest) {
    if (!s.cooldown) { const r = RESIDENTS.find(r => s.friends[r.id] < 3 && distance(p, r) < 30); if (r) offer(s, r.id); }
    return s;
  }
  const q = s.quest;
  q.remaining -= DT;
  if (q.remaining <= 0) { fail(s); return s; }
  if (q.kind === 'fetch' || q.kind === 'hunt') {
    // Aphids waddle around the marked plant; they never leave the playable area.
    if (q.kind === 'hunt') q.points.forEach((v, i) => { if (!v.taken) { v.x += Math.sin(s.t * 1.1 + i) * DT * 6; v.y += Math.cos(s.t + i * 2) * DT * 4; } });
    for (const v of q.points) if (!v.taken && distance(p, v) < 21) { v.taken = true; q.progress++; emit(s, 'collect', { x: v.x, y: v.y, kind: q.kind, progress: q.progress }); }
    q.ready = q.progress >= q.count * s.rules.requirementMultiplier;
    if (q.ready && distance(p, q.goal) < 32) complete(s);
  } else if (q.kind === 'race') {
    if (distance(p, q.goal) < 24) { q.progress = 1; if (s.rules.requirementMultiplier === 1) complete(s); }
  } else if (q.kind === 'escort') {
    const l = q.lost, d = distance(p, l);
    if (d < 70 && d > 16) { const speed = Math.min(26 * .92 * DT, d - 16); l.a = Math.atan2(p.y - l.y, p.x - l.x); l.x += (p.x - l.x) / d * speed; l.y += (p.y - l.y) / d * speed; l.ph += DT * 10; }
    if (distance(l, q.goal) < 34 && distance(p, q.goal) < 32) { q.progress = 1; if (s.rules.requirementMultiplier === 1) complete(s); }
  } else if (q.kind === 'hide') {
    if (distance(p, q.points[0]) < 26) q.hold += DT; else q.hold = Math.max(0, q.hold - DT * .5);
    q.progress = Math.min(1, q.hold / q.holdNeed);
    if (q.hold >= q.holdNeed * s.rules.requirementMultiplier) complete(s);
  }
  return s;
}

// A visible navigation arrow and the bot use exactly the same public goal.
export function guide(s) {
  const q = s.quest;
  let target;
  if (!q) {
    const available = RESIDENTS.filter(r => s.friends[r.id] < 3);
    const min = Math.min(...available.map(r => s.friends[r.id]));
    target = available.filter(r => s.friends[r.id] === min).sort((a, b) => distance(s.player, a) - distance(s.player, b))[0] || s.player;
  } else if (q.kind === 'fetch' || q.kind === 'hunt') {
    target = q.ready ? q.goal : q.points.filter(v => !v.taken).sort((a, b) => distance(s.player, a) - distance(s.player, b))[0] || q.goal;
  } else if (q.kind === 'escort') {
    target = distance(s.player, q.lost) > 45 ? q.lost : q.goal;
  } else target = q.kind === 'hide' ? q.points[0] : q.goal;
  return { x: target.x, y: target.y };
}
