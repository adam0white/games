// Living animals for Ant Promotion (the Living look; moved from the lab page ant-creatures, 2026-11-24): every species as a
// short parameter record, built on rig.js and drawn with Canvas2D paths.
//   speciesFor(F)            { spec, look } for a form from sim.js FORMS (cached)
//   creature(F, x, y, a)     a rig for that form, body centre at (x, y)
//   drawCreature(g, c, opt)  draw it in world units. opt: { px: world units per screen pixel, shadow: true, skin: { c, p } for the
//                            Ant, low: plain drawing for a body a few pixels across, and the pose from living.js: lift, stretch,
//                            crouch, size, tremble (0..1), sleep, pant (0..1), shell, scuff, scars (count) }
// No DOM is touched here, so bots.mjs builds every species in Node. Drawing takes the context it is given.
import { FORMS } from './sim.js';
import { build } from './rig.js';

const TAU = Math.PI * 2, PI = Math.PI;
const LX = -0.5, LY = -0.78; // light from the upper left, in world (and screen) axes
const INK = '#1d1410';
let LOW = false, SHUT = false, PATTERN = null, BRISTLE = 0; // set for the length of one drawCreature call

// ---------- species records
// A spec is in units of the animal's sim radius r. Most records come from the form's kind and drawing flags in sim.js;
// a few species get their own lines below so each reads at a glance.
const tail = (type, extra = {}) => {
  const T = { thin: [4, 0.3, 0.09], long: [6, 0.32, 0.16], bushy: [4, 0.3, 0.3], stub: [1, 0.16, 0.18], tuft: [4, 0.3, 0.08], thick: [5, 0.38, 0.34] }[type];
  return T && { at: -1, back: true, side: 1, ang: 0, n: T[0], seg: T[1], w: T[2], type, stiff: 0.18, damp: 0.82, curl: 0, wag: type === 'stub' ? 0.2 : 0.5, rate: 6, wagMove: true, off: 0.6, ...extra };
};
const antenna = (side, o = {}) => ({ at: 0, side, ang: 0.5, n: 3, seg: 0.27, stiff: 0.3, damp: 0.78, curl: -0.28, wag: 0.12, rate: 5 + side, phase: side, off: 0.75, lat: 0.4, antenna: 1, ...o });
const bugLegs = (pairs, len, at = 1) => Array.from({ length: pairs }, (_, i) => {
  const k = pairs === 1 ? 0.5 : i / (pairs - 1);
  return { at, ang: 0.55 + k * 1.95, len, out: 0.55, fwd: 0.12 - 0.24 * k, rest: 0.78 };
});
const quadLegs = (front, back, len, out = 0.6, rest = 0.42, ang = PI / 2) => [{ at: front, ang: ang - 0.15, len, out, fwd: 0, rest }, { at: back, ang: ang + 0.15, len, out, fwd: 0, rest }];

function make(F) {
  const f = F.f, kind = F.kind, name = F.name;
  const spec = { pts: [], gaps: [], ahead: 0, bend: 0.55, turn: 10, legs: [], gait: 'walk', chains: [], wave: null, hop: null, fly: null, wings: 0, breath: 2.2 };
  const look = { kind, name, c: F.c, d: F.d, e: F.e, f, eye: 0.09, eyeAt: [0.45, 0.42], body: 'segments', legW: 0.1, foot: 0, wing: null };
  if (kind === 'bug') {
    const fat = f.fat || f.round ? 1.22 : 1, legs = f.legs || 6;
    if (legs === 8) { // spiders, mites, crabs: a front body carrying all eight legs and a round rear
      spec.pts = f.wide ? [0.42, 0.66] : [0.42, 0.62 * fat]; spec.gaps = f.wide ? [0.45] : [0.78];
      spec.legs = bugLegs(4, f.wide ? 1.35 : 1.75, 0).map((L, i) => ({ ...L, ang: 0.55 + i * 0.62, out: 0.6, rest: 0.72, fwd: 0.05 }));
      look.eye = 0.07; look.eyes = name === 'Spider' ? 8 : 2; look.eyeAt = [0.55, 0.3];
    } else {
      spec.pts = f.long ? [0.28, 0.2, 0.22, 0.4] : [0.34, 0.36, 0.6 * fat]; spec.gaps = f.long ? [0.42, 0.5, 0.7] : [0.56, 0.74];
      spec.legs = bugLegs(3, f.long ? 1.25 : 1.3, f.long ? 2 : 1);
      if (!f.bare) spec.chains.push(antenna(-1), antenna(1));
    }
    if (f.pin) { // an ant's waist: head, thorax, a thin pin, the gaster
      spec.pts = [0.34, 0.3, 0.13, 0.52 * fat]; spec.gaps = [0.52, 0.42, 0.5];
      spec.legs = bugLegs(3, 1.3, 1);
    }
    if (f.round) { spec.pts = [0.32, 0.34, 0.74]; spec.gaps = [0.5, 0.8]; }
    if (f.claws) spec.chains.push(...[-1, 1].map(side => ({ at: 0, side, ang: 0.55, n: 2, seg: f.long ? 0.42 : 0.48, stiff: 0.45, damp: 0.7, curl: -0.9, wag: 0.1, rate: 3, phase: side, off: 0.6, lat: 0.5, claw: f.long ? 'mantis' : 'pincer' })));
    if (f.sting) spec.chains.push({ at: -1, back: true, side: 1, ang: 0, n: 6, seg: 0.3, stiff: 0.4, damp: 0.75, curl: 0.5, wag: 0.12, rate: 2.5, off: 0.7, sting: 1, w: 0.2 });
    if (f.wings) { spec.gait = 'fly'; spec.fly = { at: 0, h: 0.7 }; spec.wings = 60; spec.legs = bugLegs(3, 0.7, 1).map(L => ({ ...L, rest: 0.85 })); look.wing = 'insect'; }
    spec.ahead = spec.gaps.reduce((a, b) => a + b, 0) * 0.45; spec.bend = 0.45; spec.turn = 12;
  } else if (kind === 'snake') {
    const n = f.grub ? 6 : f.long ? 22 : 15;
    for (let i = 0; i < n; i++) spec.pts.push(f.grub ? (i === 0 ? 0.4 : 0.52 - 0.12 * Math.max(0, i - 3)) : 0.36 * (1 - 0.78 * (i / (n - 1)) ** 1.4) + 0.035);
    spec.gaps = Array(n - 1).fill(f.grub ? 0.36 : f.long ? 0.24 : 0.27);
    spec.ahead = f.grub ? 0.9 : 0.95; spec.legs = []; spec.gait = 'none'; spec.bend = f.grub ? 0.3 : 0.5; spec.turn = 7;
    spec.wave = f.grub ? { amp: 0.06, len: 1.4 } : { amp: 0.42, len: f.long ? 3.4 : 3 };
    look.body = 'tube'; look.eyeAt = [0.4, 0.5]; look.eye = 0.1;
    if (f.heads) { // three necks, each with a head
      spec.chains.push(...[-1, 0, 1].map(k => ({ at: 0, side: k || 1, ang: k ? 0.55 : 0, n: 3, seg: 0.38, stiff: 0.25, damp: 0.8, curl: k ? -0.22 : 0, wag: 0.25, rate: 2.5 + k, phase: k * 2, off: 0.6, neck: 1 })));
    }
  } else if (kind === 'bird') {
    const round = f.round ? 1.25 : 1;
    spec.pts = [0.36 * round, 0.6 * round, 0.42]; spec.gaps = [0.62, 0.6]; spec.ahead = 0.7; spec.turn = 9;
    if (f.four) { spec.legs = quadLegs(1, 2, 0.8, 0.6, 0.45); spec.gait = 'walk'; }
    else { spec.legs = [{ at: 1, ang: PI / 2 + 0.25, len: 0.75, out: 0.35, fwd: -0.1, rest: 0.5 }]; spec.gait = 'hop'; spec.hop = { len: 0.8, h: 0.28 }; }
    spec.fly = { at: (f.membrane ? 0.45 : 0.7) * F.speed / F.r, h: 1.3 };
    if (f.four) spec.fly = null;
    spec.wings = 15; look.wing = f.membrane ? 'membrane' : 'feather'; look.body = 'bird'; look.eyeAt = [0.35, 0.5]; look.eye = f.round ? 0.15 : 0.1; look.legW = 0.08;
    if (f.longTail) spec.chains.push(tail('long', { n: 6, seg: 0.38, w: 0.12, wag: 0.35, rate: 4 }));
    if (f.membrane && f.ears) spec.chains = [];
  } else { // quad
    const wide = f.wide ? 1.2 : 1, big = f.bigHead ? 1.3 : 1;
    if (f.liz) { // head, neck, body, hips, then a tail that is part of the spine, so the whole body swings as it walks
      const t = f.tail === 'thick' ? [0.34, 0.27, 0.2, 0.14, 0.08] : [0.26, 0.19, 0.13, 0.08, 0.05];
      spec.pts = [0.4 * big, 0.36, 0.52 * wide, 0.5 * wide, 0.42, ...t]; spec.gaps = [0.5, 0.42, 0.5, 0.45, ...t.map(() => 0.42)];
      spec.legs = quadLegs(2, 4, 1.05, 0.85, 0.72, PI / 2); spec.wave = { amp: 0.22, len: 2.6 }; spec.bend = 0.42; spec.ahead = 1.0;
      look.legW = 0.15; look.foot = 0.13;
    } else {
      spec.pts = [0.42 * big, 0.36 * wide, 0.62 * wide, 0.64 * wide, 0.56 * wide]; spec.gaps = [0.5, 0.4, 0.5, 0.48];
      spec.legs = quadLegs(2, 4, 0.95, 0.62, 0.42); spec.ahead = 0.95;
      look.legW = 0.2; look.foot = 0.15;
      const t = tail(f.tail); if (t) spec.chains.push(t);
    }
    if (f.neck) { spec.pts = [0.28, 0.2, 0.2, 0.22, 0.58, 0.62, 0.54]; spec.gaps = [0.36, 0.36, 0.36, 0.48, 0.48, 0.45]; spec.legs = quadLegs(4, 6, 0.95, 0.62, 0.42); spec.ahead = 1.6; spec.bend = 0.35; }
    if (f.frog) { spec.pts = [0.46, 0.64, 0.55]; spec.gaps = [0.5, 0.42]; spec.legs = [{ at: 1, ang: 0.8, len: 0.75, out: 0.7, fwd: 0.1, rest: 0.8 }, { at: 2, ang: 2.4, len: 1.2, out: 0.8, fwd: -0.1, rest: 0.55 }]; spec.gait = 'hop'; spec.hop = { len: 1.5, h: 0.5 }; spec.ahead = 0.6; look.legW = 0.18; look.foot = 0.16; }
    if (f.shell) { spec.turn = 4; look.legW = 0.22; }
    if (f.trunk) spec.chains.push({ at: 0, side: 1, ang: 0, n: 5, seg: 0.2, stiff: 0.22, damp: 0.8, curl: 0.12, wag: 0.3, rate: 2.2, off: 0.85, trunk: 1, w: 0.17 });
    if (name === 'Rabbit') { spec.gait = 'hop'; spec.hop = { len: 1.2, h: 0.4 }; }
    if (['Ostrich', 'T-Rex', 'Raptor'].includes(name)) { // two legs
      spec.legs = [{ at: name === 'Ostrich' ? 4 : 3, ang: PI / 2 + 0.2, len: name === 'T-Rex' ? 1.1 : 1.0, out: 0.55, fwd: 0, rest: 0.4 }];
      look.arms = name !== 'Ostrich'; look.legW = 0.18;
    }
    look.body = 'quad'; look.eyeAt = [0.38, 0.5]; look.eye = 0.09;
    shape(name, spec, look);
  }
  if (F.level === 0) spec.turn = 8;
  spec.breath = 1.6 + 3 / Math.sqrt(F.r);
  if (!spec.ahead) spec.ahead = spec.gaps.reduce((a, b) => a + b, 0) * 0.45;
  return { spec, look };
}
// Species that read alike at play size (dog, lynx and cat; bear, boar, gorilla and mole; hippo and mouse; the ostrich) get
// their own proportions, gait and marks here, so the outline alone tells them apart.
function shape(name, spec, look) {
  const T = spec.chains.find(C => C.type), legs = (front, back = front) => { spec.legs[0].len = front; spec.legs[1].len = back; };
  switch (name) {
    case 'Cat': // slim and low, a long tail held up in a curl
      spec.pts = spec.pts.map((v, i) => (i ? v * 0.8 : v * 0.92)); spec.gaps = spec.gaps.map(g => g * 1.05);
      if (T) Object.assign(T, { n: 6, seg: 0.3, w: 0.08, curl: 0.32, ang: 0.3, wag: 0.35, rate: 3 });
      look.legW = 0.15; break;
    case 'Dog': // a muzzle, big floppy ears, a tail that wags fast
      look.muzzle = 1; look.bigFlop = 1;
      if (T) Object.assign(T, { n: 4, seg: 0.3, w: 0.11, wag: 0.9, rate: 14, wagMove: false, ang: -0.4 }); break;
    case 'Lynx': // long legs, tufted ears, a ruff at the cheeks, a stub tail with a black tip
      legs(1.2, 1.25); look.tufts = 1; look.ruff = 1; spec.pts = spec.pts.map((v, i) => (i ? v * 0.92 : v)); look.legW = 0.18; break;
    case 'Sabertooth': // heavy at the front, two long fangs
      spec.pts = [0.48, 0.44, 0.7, 0.62, 0.5]; look.fangs = 1; break;
    case 'Bear': // a shoulder hump, short thick legs
      spec.pts = [0.44, 0.44, 0.74, 0.66, 0.54]; legs(0.85); look.legW = 0.28; look.foot = 0.2; look.hump = 1; break;
    case 'Gorilla': // knuckle-walks: long front legs, short back ones, a broad chest and a silver back, no tail
      spec.pts = [0.38, 0.5, 0.74, 0.56, 0.44]; legs(1.35, 0.8); spec.legs[0].out = 0.75; look.legW = 0.26; look.foot = 0.17; look.ape = 1; look.noArms = 1; break;
    case 'Boar': // a flat pink snout disc, a bristle ridge down the back
      look.disc = 1; look.ridge = 1; legs(0.8); break;
    case 'Mole': // a round velvet body, big pink digging hands, a pink star nose, tiny eyes
      spec.pts = [0.4, 0.5, 0.66, 0.62, 0.46]; legs(0.6); look.eye = 0.035; look.pinkHands = 1; look.star = 1; break;
    case 'Mouse': // small body, big round ears, a long pink tail, a pointed pink nose
      spec.pts = [0.42, 0.34, 0.5, 0.52, 0.44]; look.mouseEars = 1; look.pinkTail = 1; look.nose = 1;
      if (T) Object.assign(T, { n: 7, seg: 0.34, w: 0.055, wag: 0.6, curl: 0.12 }); break;
    case 'Hippo': // a barrel body and a broad square muzzle with nostrils on top
      spec.pts = [0.5, 0.52, 0.78, 0.8, 0.66]; legs(0.75); look.legW = 0.3; look.foot = 0.2; look.square = 1; look.smallEars = 1; break;
    case 'Ostrich': // a fluffy black body with white plumes, a long pale neck, a small head with a beak
      look.bird = 1; spec.pts = [0.22, 0.14, 0.14, 0.16, 0.62, 0.68, 0.5]; look.legW = 0.12; look.foot = 0; spec.legs[0].len = 1.25;
      if (T) Object.assign(T, { type: 'plume', n: 3, seg: 0.28, w: 0.3 }); break;
    case 'Lion': look.bigMane = 1; break;
  }
}
const cache = new Map();
export function speciesFor(F) { let s = cache.get(F.id); if (!s) cache.set(F.id, s = make(F)); return s; }
export function creature(F, x, y, a) { const { spec, look } = speciesFor(F); const c = build(spec, F.r, x, y, a); c.look2 = look; c.F = F; c.seed = (F.id * 7919 + Math.round(x * 13 + y * 7)) % 1000; return c; }
export const SPECIES = FORMS;

// ---------- drawing helpers
const tones = new Map();
export function shade(hex, k) {
  const key = hex + k; let v = tones.get(key); if (v) return v;
  const n = parseInt(hex.slice(1), 16), ch = s => { const x = n >> s & 255; return Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k); };
  tones.set(key, v = '#' + (ch(16) << 16 | ch(8) << 8 | ch(0)).toString(16).padStart(6, '0'));
  return v;
}
const oval = (g, x, y, rx, ry, a) => { g.beginPath(); g.ellipse(x, y, Math.max(0.05, rx), Math.max(0.05, ry), a, 0, TAU); };
// A shaded, outlined ellipse: ink rim, dark tone, body colour toward the light, a soft highlight.
function blob(g, x, y, rx, ry, a, col, ow, hi = 0.22) {
  if (LOW) { oval(g, x, y, rx, ry, a); g.fillStyle = col; g.fill(); return; }
  if (ow > 0) { oval(g, x, y, rx + ow, ry + ow, a); g.fillStyle = INK; g.fill(); }
  oval(g, x, y, rx, ry, a); g.fillStyle = shade(col, -0.3); g.fill();
  const m = Math.min(rx, ry); oval(g, x + LX * m * 0.16, y + LY * m * 0.16, rx * 0.84, ry * 0.84, a); g.fillStyle = col; g.fill();
  if (hi) { oval(g, x + LX * m * 0.42, y + LY * m * 0.42, rx * 0.4, ry * 0.36, a); g.fillStyle = shade(col, hi); g.fill(); }
}
function dot(g, x, y, r, col) { g.beginPath(); g.arc(x, y, Math.max(0.05, r), 0, TAU); g.fillStyle = col; g.fill(); }
function limb(g, pts, w, col, ow) {
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (ow > 0) { g.lineWidth = w + ow * 2; g.strokeStyle = INK; g.stroke(); }
  g.lineWidth = w; g.strokeStyle = col; g.stroke();
}
// A smooth body around a row of points with a radius each: front cap, one side, back cap, other side.
function tubePath(g, P, R, k = 1, ox = 0, oy = 0, grow = 0) {
  const n = P.length, L = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, r = R[i] * k + grow;
    L.push({ x: P[i].x + nx * r + ox, y: P[i].y + ny * r + oy }); Rt.push({ x: P[i].x - nx * r + ox, y: P[i].y - ny * r + oy });
  }
  const a0 = Math.atan2(P[0].y - P[1].y, P[0].x - P[1].x), an = Math.atan2(P[n - 2].y - P[n - 1].y, P[n - 2].x - P[n - 1].x);
  g.beginPath();
  g.arc(P[0].x + ox, P[0].y + oy, Math.max(0.05, R[0] * k + grow), a0 - PI / 2, a0 + PI / 2);
  smooth(g, L);
  g.arc(P[n - 1].x + ox, P[n - 1].y + oy, Math.max(0.05, R[n - 1] * k + grow), an + PI / 2, an + PI * 1.5);
  smooth(g, Rt.reverse());
  g.closePath();
}
function smooth(g, S) { g.lineTo(S[0].x, S[0].y); for (let i = 1; i < S.length - 1; i++) g.quadraticCurveTo(S[i].x, S[i].y, (S[i].x + S[i + 1].x) / 2, (S[i].y + S[i + 1].y) / 2); g.lineTo(S[S.length - 1].x, S[S.length - 1].y); }
function tube(g, P, R, col, ow, hi = 0.2) {
  if (LOW) { tubePath(g, P, R); g.fillStyle = col; g.fill(); return; }
  if (ow > 0) { tubePath(g, P, R, 1, 0, 0, ow); g.fillStyle = INK; g.fill(); }
  tubePath(g, P, R); g.fillStyle = shade(col, -0.3); g.fill();
  const m = R.reduce((a, b) => a + b, 0) / R.length;
  tubePath(g, P, R, 0.8, LX * m * 0.16, LY * m * 0.16); g.fillStyle = col; g.fill();
  if (hi) { tubePath(g, P, R, 0.32, LX * m * 0.42, LY * m * 0.42); g.fillStyle = shade(col, hi); g.fill(); }
}
const ang = (a, b) => Math.atan2(a.y - b.y, a.x - b.x);
const at = (p, a, fwd, side) => ({ x: p.x + Math.cos(a) * fwd - Math.sin(a) * side, y: p.y + Math.sin(a) * fwd + Math.cos(a) * side });

// ---------- drawing a creature
export function drawCreature(g, c, opt = {}) {
  LOW = !!opt.low; SHUT = !!opt.sleep; PATTERN = opt.skin?.p || null; BRISTLE = opt.shell && c.look2.f.spikes ? 1 : 0;
  g.save(); body(g, c, opt); g.restore();
  LOW = SHUT = false; PATTERN = null; BRISTLE = 0;
}
function body(g, c, opt) {
  const lk = c.look2, F = c.F, r = c.r, px = opt.px || 0.5, ow = LOW ? 0 : Math.max(px * 0.9, r * 0.055), S = c.spine, n = S.length;
  const pant = opt.pant || 0, sq = c.squash, breathe = 1 + (pant ? Math.sin(c.t * 17) * 0.07 * pant : c.breath * 0.035), swell = (1 + sq * 0.28) * breathe;
  const col = opt.skin?.c || lk.c, dark = opt.skin?.c ? shade(opt.skin.c, -0.45) : lk.d, acc = lk.e, f = lk.f;
  // the pose: stretched out (a leap, a sprint) or gathered in (a crouch), bigger or smaller, trembling; around the body centre, along its heading
  const crouch = opt.crouch || 0, ex = (opt.stretch || 0) - crouch * 0.2, ey = crouch * 0.14, sz = opt.size || 1, tr = opt.tremble ? Math.sin(c.t * 47) * r * 0.07 * opt.tremble : 0;
  if (ex || ey || sz !== 1 || tr) { g.translate(c.x + tr, c.y); g.rotate(c.ha); g.scale(sz * (1 + ex), sz * (1 + ey)); g.rotate(-c.ha); g.translate(-c.x, -c.y); }
  // a bite squashes the body toward the head and makes it wider
  const P = sq > 0 ? S.map((p, i) => i ? { x: S[0].x + (p.x - S[0].x) * (1 - sq * 0.22), y: S[0].y + (p.y - S[0].y) * (1 - sq * 0.22) } : p) : S;
  const R = c.spec.pts.map((v, i) => v * r * (i ? swell : 1 + sq * 0.12));
  const lift = c.z + (opt.lift || 0) * r, hx = lift * 0.35, hy = -lift * 0.55; // height shows as the body rising toward the viewer's top left of its shadow
  // shadow on the ground
  if (opt.shadow !== false && !LOW) {
    g.beginPath();
    const sh = 1 - Math.min(0.45, lift / (4 * r)), sx = r * 0.14 + lift * 0.5, sy = r * 0.22 + lift * 0.7;
    for (let i = 0; i < n; i++) { const p = P[i]; g.moveTo(p.x + sx + R[i] * sh, p.y + sy); g.arc(p.x + sx, p.y + sy, Math.max(0.1, R[i] * 1.05 * sh), 0, TAU); }
    if (lk.wing && (c.fly > 0.2 || lk.wing === 'insect')) { const a = ang(P[0], P[1]); for (const s of [-1, 1]) { const w = at(P[1], a, 0, s * r * 0.9 * sh); g.moveTo(w.x + sx + r * 0.6, w.y + sy); g.ellipse(w.x + sx, w.y + sy, r * 0.6 * sh, r * 0.3 * sh, a, 0, TAU); } }
    g.fillStyle = 'rgba(16,30,8,0.24)'; g.fill();
  }
  g.save(); if (lift) g.translate(hx, hy);
  const a0 = ang(P[0], P[1]) + c.look * 0.25; // the head turns a little toward what it looks at
  // legs under the body
  for (const l of c.legs) drawLeg(g, c, l, lk, dark, ow, px, hx, hy);
  // tails and other chains under the body
  for (const ch of c.chains) if (!ch.C.antenna && !ch.C.neck && !ch.C.claw && !ch.C.trunk) drawChain(g, c, ch, lk, col, dark, acc, ow, px);
  if (lk.wing === 'feather' || lk.wing === 'membrane') drawWings(g, c, P, R, lk, col, dark, acc, ow, false);
  // body
  if (lk.body === 'segments') drawBug(g, c, P, R, lk, col, dark, acc, ow, px, a0);
  else if (lk.body === 'tube') drawSnake(g, c, P, R, lk, col, dark, acc, ow, px, a0);
  else if (lk.body === 'bird') drawBird(g, c, P, R, lk, col, dark, acc, ow, px, a0);
  else drawQuad(g, c, P, R, lk, col, dark, acc, ow, px, a0);
  for (const ch of c.chains) if (ch.C.antenna || ch.C.neck || ch.C.claw || ch.C.trunk) drawChain(g, c, ch, lk, col, dark, acc, ow, px);
  if (lk.wing === 'insect') drawWings(g, c, P, R, lk, col, dark, acc, ow, true);
  if (lk.wing && lk.wing !== 'insect' && c.fly > 0.05) drawWings(g, c, P, R, lk, col, dark, acc, ow, true);
  if (!LOW) marks(g, c, P, R, opt, a0, px, pant);
  g.restore();
}

// What the pose adds on top: scars (the rival's repeat wins), scratches while a Wild hide grows back, a tongue when panting, the shell.
function marks(g, c, P, R, opt, a0, px, pant) {
  const r = c.r, n = P.length, k = Math.min(n - 1, n > 3 ? 2 : 1), m = P[k], a = ang(P[k - 1] || P[0], P[k + 1] || P[k]);
  g.lineCap = 'round';
  for (let i = 0; i < Math.min(4, opt.scars || 0); i++) { const u = (i - 1.5) * 0.28 * R[k]; for (const [cl, w] of [['#3a0d0d', 0.2], ['#ffe3d6', 0.09]]) limb(g, [at(m, a, u - R[k] * 0.15, -R[k] * 0.55), at(m, a, u + R[k] * 0.15, R[k] * 0.55)], Math.max(px * 1.2, r * w * 0.7), cl, 0); }
  if (opt.scuff) for (const u of [-0.3, 0, 0.3]) limb(g, [at(m, a, u * R[k] + R[k] * 0.12, -R[k] * 0.5), at(m, a, u * R[k] - R[k] * 0.12, R[k] * 0.5)], Math.max(px, r * 0.05), '#f6d2c2', 0);
  if (pant > 0.15 && c.look2.kind !== 'bug') { // tongue out, flapping with the breath
    const h = P[0], hr = R[0], q = c.look2.kind === 'snake' ? 1.45 : c.look2.f.snout || c.look2.f.liz ? 1.7 : 1.05, t0 = at(h, a0, hr * q, 0), wob = Math.sin(c.t * 17) * 0.3;
    limb(g, [t0, at(t0, a0 + wob, r * 0.32 * pant, 0)], Math.max(px * 1.4, r * 0.13), '#e0607a', Math.max(px * 0.6, r * 0.03));
  }
  if (opt.shell && !BRISTLE) { // a see-through dome (a porcupine raises its quills instead) over the whole body
    const head = P[0], tail = P[n - 1], cx = (head.x + tail.x) / 2, cy = (head.y + tail.y) / 2, len = Math.hypot(head.x - tail.x, head.y - tail.y) / 2 + Math.max(...R) * 1.2, wid = Math.max(...R) * 1.6;
    oval(g, cx, cy, len, wid, ang(head, tail)); g.fillStyle = 'rgba(160,214,255,0.32)'; g.fill(); g.lineWidth = Math.max(px * 2, r * 0.08); g.strokeStyle = '#cfe8ff'; g.stroke();
    oval(g, cx + LX * wid * 0.35, cy + LY * wid * 0.35, len * 0.45, wid * 0.3, ang(head, tail)); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
  }
}

function drawLeg(g, c, l, lk, dark, ow, px, hx, hy) {
  const r = c.r, w = Math.max(px * 1.3, lk.legW * r), f = l.foot, k = l.knee, lift = l.lift || 0;
  // a lifted foot rises toward the viewer: drawn a little up-left and bigger
  const up = lift * r * 0.18, F = { x: f.x - up * 0.4 - hx, y: f.y - up - hy };
  if (lk.kind === 'bug') {
    limb(g, [l.hip, k, F], w, dark, ow);
    if (lk.f.legs === 8) dot(g, k.x, k.y, w * 0.7, shade(dark, 0.25));
  } else if (lk.kind === 'bird' && !lk.f.four) {
    if (c.fly > 0.6) return; // tucked in flight
    limb(g, [l.hip, F], w, '#e8a23a', ow * 0.6);
    for (const s of [-0.5, 0, 0.5]) { const a = c.ha + s; limb(g, [F, { x: F.x + Math.cos(a) * r * 0.22, y: F.y + Math.sin(a) * r * 0.22 }], w * 0.6, '#e8a23a', 0); }
  } else {
    limb(g, [l.hip, k, F], w, lk.bird ? '#d9a08a' : lk.pinkHands && l.L.at < 3 ? '#f0b0a8' : dark, ow);
    if (lk.foot) blob(g, F.x, F.y, lk.foot * r * (1 + lift * 0.25), lk.foot * r * 0.8 * (1 + lift * 0.25), c.ha, dark, ow, 0);
  }
}

function drawChain(g, c, ch, lk, col, dark, acc, ow, px) {
  const C = ch.C, p = ch.pts, r = c.r, f = lk.f;
  if (C.antenna) { limb(g, p, Math.max(px * 1.1, r * 0.06), dark, ow * 0.6); dot(g, p.at(-1).x, p.at(-1).y, Math.max(px, r * 0.06), dark); return; }
  if (C.claw === 'pincer') {
    limb(g, p.slice(0, 2), Math.max(px * 1.4, r * 0.14), dark, ow);
    const a = ang(p[2], p[1]), open = 0.35 + c.squash * 0.6;
    blob(g, p[2].x, p[2].y, r * 0.3, r * 0.2, a, col, ow);
    for (const s of [-1, 1]) limb(g, [at(p[2], a, r * 0.15, s * r * 0.08), at(p[2], a + s * open, r * 0.42, 0)], Math.max(px, r * 0.08), dark, ow * 0.6);
    return;
  }
  if (C.claw === 'mantis') { limb(g, p, Math.max(px * 1.3, r * 0.11), col, ow); const a = ang(p[2], p[1]); limb(g, [p[2], at(p[2], a + C.side * 2.4, r * 0.3, 0)], Math.max(px, r * 0.08), lk.d, ow * 0.6); return; }
  if (C.trunk) { const R = p.map((_, i) => C.w * r * (1 - 0.45 * i / (p.length - 1))); tube(g, p, R, col, ow, 0.12); return; }
  if (C.neck) { // a hydra neck and its head
    tube(g, p, p.map(() => r * 0.2), col, ow, 0.18);
    const a = ang(p.at(-1), p.at(-2)); head(g, c, p.at(-1), a, r * 0.32, r * 0.26, lk, col, dark, acc, ow, px, 'snake');
    return;
  }
  if (C.sting) { const R = p.map((_, i) => r * C.w * (1 - 0.35 * i / p.length)); tube(g, p, R, col, ow, 0.18); const a = ang(p.at(-1), p.at(-2)); blob(g, p.at(-1).x, p.at(-1).y, r * 0.17, r * 0.14, a, acc, ow, 0); limb(g, [p.at(-1), at(p.at(-1), a + 0.6, r * 0.28, 0)], Math.max(px, r * 0.06), INK, 0); return; }
  // tails
  const type = C.type || 'long', m = p.length;
  if (type === 'stub') { blob(g, p[1].x, p[1].y, r * 0.18, r * 0.16, 0, dark, ow, 0.1); if (lk.tufts) dot(g, p[1].x, p[1].y, r * 0.1, INK); return; }
  if (type === 'plume') { for (let i = m - 1; i >= 0; i--) for (const s of [-1, 0, 1]) { const a = ang(p[Math.max(0, i - 1)], p[Math.min(m - 1, i + 1)]) + PI + s * 0.5; blob(g, ...xy(at(p[i], a, r * 0.18, 0)), r * C.w * (1.1 - i * 0.15), r * C.w * 0.6, a, '#f6f2ea', ow, 0.1); } return; }
  if (type === 'bushy') { const R = p.map((_, i) => r * (0.12 + 0.22 * Math.sin(PI * (i + 0.6) / (m + 0.4)))); tube(g, p, R, col, ow, 0.18); blob(g, p.at(-1).x, p.at(-1).y, r * 0.14, r * 0.12, 0, acc, 0, 0); return; }
  const R = p.map((_, i) => r * C.w * (1 - 0.7 * i / (m - 1)) + px * 0.4);
  tube(g, p, R, lk.pinkTail ? '#e3a2a0' : type === 'thin' || type === 'tuft' ? lk.d : col, ow, 0.12);
  if (type === 'tuft') blob(g, p.at(-1).x, p.at(-1).y, r * 0.15, r * 0.13, 0, acc, ow, 0.15);
  if (lk.kind === 'bird' && lk.f.longTail) { const a = ang(p.at(-1), p.at(-2)); blob(g, p.at(-1).x, p.at(-1).y, r * 0.24, r * 0.14, a, acc, ow, 0.2); }
}

function eyes(g, c, h, a, rx, ry, lk, px, big = 1, over = 0) {
  if (LOW) return;
  const r = c.r, er = Math.max(px * 1.3, lk.eye * r * big), [fw, sd] = lk.eyeAt;
  const blink = SHUT || ((c.t * 0.7 + c.seed * 0.013) % 4.3) < 0.11;
  const look = c.look, pdx = Math.cos(look) * er * 0.38, pdy = Math.sin(look) * er * 0.38;
  const n = lk.eyes === 8 ? 4 : 1;
  for (const s of [-1, 1]) for (let k = 0; k < n; k++) {
    const e = at(h, a, rx * (fw - k * 0.18), s * ry * (sd + k * 0.12) * (1 - over)), rr = er * (k ? 0.7 : 1);
    if (blink) { limb(g, [at(e, a, 0, -rr), at(e, a, 0, rr)], Math.max(px, rr * 0.4), INK, 0); continue; }
    dot(g, e.x, e.y, rr * 1.25, INK); dot(g, e.x, e.y, rr, '#fffdf2');
    const pp = at(e, a, pdx, pdy); dot(g, pp.x, pp.y, rr * 0.62, '#0b0b0b'); dot(g, pp.x + LX * rr * 0.3, pp.y + LY * rr * 0.3, rr * 0.24, '#ffffff');
  }
}

// A head: ellipse rx along a, ry across. style picks the details.
function head(g, c, h, a, rx, ry, lk, col, dark, acc, ow, px, style) {
  const r = c.r, f = lk.f, bite = c.squash;
  if (style === 'snake') {
    if (Math.sin(c.t * 3 + c.seed) > 0.55 || bite > 0.2) { const t = at(h, a, rx * 1.05, 0), fl = Math.sin(c.t * 30) * 0.25; limb(g, [t, at(t, a + fl, r * 0.25, 0)], Math.max(px, r * 0.05), '#e0324a', 0); for (const s of [-1, 1]) limb(g, [at(t, a + fl, r * 0.25, 0), at(t, a + fl + s * 0.5, r * 0.36, 0)], Math.max(px * 0.8, r * 0.04), '#e0324a', 0); }
    blob(g, h.x, h.y, rx, ry, a, col, ow);
    if (f.crest) for (let i = 0; i < 3; i++) { const b = at(h, a, -rx * (0.3 + i * 0.35), 0); g.beginPath(); g.moveTo(...xy(at(b, a, rx * 0.2, -ry * 0.2))); g.lineTo(...xy(at(b, a, -rx * 0.35, 0))); g.lineTo(...xy(at(b, a, rx * 0.2, ry * 0.2))); g.closePath(); g.fillStyle = acc; g.fill(); }
    eyes(g, c, h, a, rx, ry, lk, px);
    return;
  }
}
const xy = p => [p.x, p.y];

function drawBug(g, c, P, R, lk, col, dark, acc, ow, px, a0) {
  const r = c.r, f = lk.f, n = P.length;
  // rear to front, each segment its own shaded oval along the body
  for (let i = n - 1; i >= 0; i--) {
    const a = i ? ang(P[i - 1], P[i]) : a0, rx = R[i] * (i === n - 1 && n > 2 ? 1.25 : 1.05), ry = R[i];
    const segCol = i === 0 ? (f.legs === 8 ? col : dark) : i === n - 1 ? col : (f.pin ? col : dark);
    blob(g, P[i].x, P[i].y, rx, ry, a, segCol, ow, i === n - 1 ? 0.3 : 0.2);
    if (i === n - 1 && n > 1) { // the rear: stripes, a beetle's wing case, hairs
      if (f.stripes) for (const k of [-0.45, 0, 0.45]) { const m = at(P[i], a, rx * k, 0); limb(g, [at(m, a, 0, -ry * 0.82), at(m, a, 0, ry * 0.82)], ry * 0.22, acc, 0); }
      else if (f.round) { limb(g, [at(P[i], a, rx * 0.95, 0), at(P[i], a, -rx * 0.98, 0)], Math.max(px, r * 0.05), INK, 0); for (const s of [-1, 1]) dot(g, ...xy(at(P[i], a, rx * 0.15, s * ry * 0.45)), ry * 0.12, shade(col, 0.35)); }
      else if (f.legs === 8 && lk.name === 'Spider') { const m = at(P[i], a, -rx * 0.1, 0); for (const k of [0, 1]) dot(g, ...xy(at(m, a, -k * rx * 0.4, 0)), ry * 0.16, acc); dot(g, ...xy(at(m, a, rx * 0.35, 0)), ry * 0.2, acc); }
      else for (const k of [-0.5, -0.1, 0.3]) { const m = at(P[i], a, rx * k - rx * 0.1, 0); g.beginPath(); g.ellipse(m.x, m.y, rx * 0.3, ry * 0.85, a, -1.1, 1.1); g.lineWidth = Math.max(px * 0.7, r * 0.04); g.strokeStyle = shade(col, -0.35); g.stroke(); }
    }
    if (i === n - 1 && PATTERN && !LOW) { // the Ant's skin pattern from the menu, on its gaster
      if (PATTERN === 'stripes') for (const k of [-0.5, -0.1, 0.3]) { const m = at(P[i], a, rx * k, 0); limb(g, [at(m, a, 0, -ry * 0.8), at(m, a, 0, ry * 0.8)], ry * 0.2, '#f4e6c6', 0); }
      if (PATTERN === 'spots') for (const [u, v] of [[-0.4, 0.3], [0.1, -0.35], [0.35, 0.25], [-0.2, -0.1]]) dot(g, ...xy(at(P[i], a, u * rx, v * ry)), ry * 0.16, '#f4e6c6');
    }
  }
  const a = a0, h = P[0], rx = R[0] * 1.05, ry = R[0];
  if (!f.bare || f.legs === 8) { // mandibles, wide open in a bite
    const open = 0.25 + c.squash * 0.9 + Math.max(0, Math.sin(c.t * 2.3 + c.seed)) * 0.15;
    for (const s of [-1, 1]) { const b = at(h, a, rx * 0.75, s * ry * 0.35); limb(g, [b, at(b, a + s * open, r * 0.22, 0), at(b, a - s * 0.5, r * 0.36, 0)], Math.max(px, r * (f.legs === 8 ? 0.07 : 0.08)), f.pin ? acc : INK, 0); }
  }
  eyes(g, c, h, a, rx, ry, lk, px, f.legs === 8 ? 0.8 : 1);
  if (PATTERN === 'crown' && !LOW) { const b0 = at(h, a, -rx * 0.2, 0), w = ry * 0.75; g.beginPath(); for (const [u, v] of [[0.35, -1], [-0.45, -1], [-0.1, -0.5], [-0.55, 0], [-0.1, 0.5], [-0.45, 1], [0.35, 1]]) g.lineTo(...xy(at(b0, a, u * w, v * w))); g.closePath(); g.fillStyle = '#ffd23a'; g.fill(); g.lineWidth = Math.max(px * 0.8, r * 0.03); g.strokeStyle = INK; g.stroke(); }
}

function drawSnake(g, c, P, R, lk, col, dark, acc, ow, px, a0) {
  const r = c.r, f = lk.f, n = P.length;
  if (f.grub) { // fat soft rings that swell in a wave
    for (let i = n - 1; i >= 1; i--) { const a = ang(P[i - 1], P[i]), w = R[i] * (1 + 0.08 * Math.sin(c.t * 6 - i)); blob(g, P[i].x, P[i].y, w * 0.85, w, a, i % 2 ? col : shade(col, -0.06), ow, 0.25); }
    blob(g, P[0].x, P[0].y, R[0] * 0.8, R[0] * 0.75, a0, acc, ow, 0.2);
    for (const s of [-1, 1]) limb(g, [at(P[0], a0, R[0] * 0.6, s * R[0] * 0.25), at(P[0], a0, R[0] * 0.95, s * R[0] * 0.1)], Math.max(px, r * 0.06), INK, 0);
    return;
  }
  const body = P.slice(1), BR = R.slice(1);
  tube(g, body, BR, col, ow, 0.25);
  // belly scales and pattern
  for (let i = 1; i < n - 1; i++) {
    const a = ang(P[i - 1], P[i]), w = R[i];
    if (f.stripes && i % 3 === 0) limb(g, [at(P[i], a, 0, -w * 0.78), at(P[i], a, 0, w * 0.78)], w * 0.5, dark, 0);
    else if (i % 2 === 0) dot(g, ...xy(at(P[i], a, 0, 0)), w * 0.22, shade(dark, 0.1));
    if (f.crest && i < 10 && i % 2) { g.beginPath(); g.moveTo(...xy(at(P[i], a, w * 0.6, 0))); g.lineTo(...xy(at(P[i], a, -w * 0.5, -w * 0.35))); g.lineTo(...xy(at(P[i], a, -w * 0.5, w * 0.35))); g.closePath(); g.fillStyle = acc; g.fill(); }
  }
  if (!f.heads) head(g, c, P[0], a0, R[0] * 1.45, R[0] * 1.15, lk, col, dark, acc, ow, px, 'snake');
  else blob(g, P[0].x, P[0].y, R[0] * 1.2, R[0] * 1.2, a0, col, ow);
}

function drawBird(g, c, P, R, lk, col, dark, acc, ow, px, a0) {
  const r = c.r, f = lk.f;
  // tail fan (birds without a long tail)
  if (!f.longTail) { const a = ang(P[1], P[2]), b = P[2]; g.beginPath(); g.moveTo(...xy(at(b, a, r * 0.2, -r * 0.18))); g.lineTo(...xy(at(b, a, -r * 0.62, -r * 0.42))); g.quadraticCurveTo(...xy(at(b, a, -r * 0.45, 0)), ...xy(at(b, a, -r * 0.62, r * 0.42))); g.lineTo(...xy(at(b, a, r * 0.2, r * 0.18))); g.closePath(); g.lineWidth = ow * 2; g.strokeStyle = INK; g.stroke(); g.fillStyle = dark; g.fill(); }
  const ab = ang(P[0], P[2]), mid = { x: (P[1].x * 2 + P[2].x) / 3, y: (P[1].y * 2 + P[2].y) / 3 };
  blob(g, mid.x, mid.y, R[1] * 1.35, R[1] * 0.95, ab, col, ow);
  for (const k of [-0.35, 0.05, 0.4]) for (const s of [-1, 1]) { const m = at(mid, ab, -k * R[1], s * R[1] * 0.42); g.beginPath(); g.arc(m.x, m.y, R[1] * 0.25, ab + PI - 1.1, ab + PI + 1.1); g.lineWidth = Math.max(px * 0.7, r * 0.04); g.strokeStyle = shade(col, -0.25); g.stroke(); }
  if (c.fly <= 0.05 && lk.wing) for (const sd of [-1, 1]) { // folded wings along the back, so a bird on foot still reads as a bird
    const R1 = R[1], root = at(mid, ab, R1 * 0.6, sd * R1 * 0.5), tip = at(mid, ab, -R1 * 1.55, sd * R1 * 0.22);
    g.beginPath(); g.moveTo(root.x, root.y); g.quadraticCurveTo(...xy(at(mid, ab, -R1 * 0.25, sd * R1 * 1.12)), tip.x, tip.y); g.quadraticCurveTo(...xy(at(mid, ab, -R1 * 0.35, sd * R1 * 0.2)), root.x, root.y); g.closePath();
    g.lineWidth = ow * 2; g.strokeStyle = INK; g.stroke(); g.fillStyle = dark; g.fill();
    for (const q of [0.35, 0.65]) { const m = at(mid, ab, R1 * (0.45 - q * 1.6), sd * R1 * (0.55 + 0.25 * Math.sin(q * PI))); limb(g, [m, at(m, ab + PI - sd * 0.35, R1 * 0.45, 0)], Math.max(px * 0.7, r * 0.045), lk.wing === 'membrane' ? acc : shade(dark, 0.25), 0); }
  }
  // head
  const h = P[0], hr = R[0], hc = f.whiteHead ? acc : col;
  if (f.horns) for (const s of [-1, 1]) limb(g, [at(h, a0, -hr * 0.2, s * hr * 0.55), at(h, a0, -hr * 1.5, s * hr * 1.1)], Math.max(px, r * 0.1), acc, ow);
  if (f.ears) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(...xy(at(h, a0, -hr * 0.3, s * hr * 0.3))); g.lineTo(...xy(at(h, a0, -hr * 0.2, s * hr * 1.5))); g.lineTo(...xy(at(h, a0, hr * 0.35, s * hr * 0.6))); g.closePath(); g.fillStyle = dark; g.fill(); g.lineWidth = ow; g.strokeStyle = INK; g.stroke(); }
  if (f.crest) { g.beginPath(); g.moveTo(...xy(at(h, a0, 0, -hr * 0.35))); g.lineTo(...xy(at(h, a0, -hr * 2.4, 0))); g.lineTo(...xy(at(h, a0, 0, hr * 0.35))); g.closePath(); g.fillStyle = acc; g.fill(); g.lineWidth = ow; g.strokeStyle = INK; g.stroke(); }
  // beak, or a snout for the bat; opens in a bite
  const open = c.squash * 0.5;
  if (f.membrane && !f.crest && !f.horns) blob(g, ...xy(at(h, a0, hr * 0.8, 0)), hr * 0.55, hr * 0.45, a0, col, ow, 0.1);
  else for (const s of [-1, 1]) { g.beginPath(); g.moveTo(...xy(at(h, a0, hr * 0.6, s * hr * 0.42))); g.lineTo(...xy(at(h, a0, hr * (f.crest && f.membrane ? 2.6 : f.round ? 1.35 : 1.75), s * open * hr))); g.lineTo(...xy(at(h, a0, hr * 0.7, 0))); g.closePath(); g.fillStyle = f.round ? '#c9a25a' : '#f2b63a'; g.fill(); g.lineWidth = ow * 0.8; g.strokeStyle = INK; g.stroke(); }
  blob(g, h.x, h.y, hr, hr * 0.95, a0, hc, ow, 0.25);
  if (f.round) for (const s of [-1, 1]) { dot(g, ...xy(at(h, a0, hr * 0.32, s * hr * 0.45)), hr * 0.42, shade(acc, 0.1)); } // owl face discs
  eyes(g, c, h, a0, hr, hr, lk, px, f.round ? 1.2 : 1);
}

function drawWings(g, c, P, R, lk, col, dark, acc, ow, over) {
  const r = c.r, a = ang(P[0], P[2] || P[1]), base = P[1], k = lk.wing;
  if (k === 'insect') {
    const beat = Math.sin(c.wing);
    g.globalAlpha = 0.55;
    for (const s of [-1, 1]) for (const [fw, len, sp] of [[0.1, 1.0, 0.55], [-0.15, 0.75, 0.95]]) {
      const root = at(P[1], a, fw * r, s * R[1] * 0.4), wa = a + PI + s * (sp + beat * 0.35);
      const m = at(root, wa, len * r * 0.5, 0);
      oval(g, m.x, m.y, len * r * 0.55, r * 0.22, wa); g.fillStyle = '#eef8ff'; g.fill(); g.lineWidth = Math.max(0.3, r * 0.03); g.strokeStyle = '#5a6a7a'; g.stroke();
    }
    g.globalAlpha = 1; return;
  }
  const fl = c.fly, beat = Math.sin(c.wing) * fl, span = r * (lk.f.round ? 1.5 : 1.9) * (0.35 + 0.65 * fl) * (1 + beat * 0.3);
  if (!over && fl > 0.05) return; // folded wings are drawn under the body only when not flying
  if (over && fl <= 0.05) return;
  for (const s of [-1, 1]) {
    const root = at(base, a, R[1] * 0.3, s * R[1] * 0.3), sweep = a + s * (PI / 2) + s * (1 - fl) * 1.2 - s * beat * 0.25;
    const tip = at(root, sweep, span, 0), back = at(root, sweep + s * 0.9 * (1 - 0.4 * fl), span * 0.75, 0), tail = at(root, a + PI, R[1] * 1.3, 0);
    g.beginPath(); g.moveTo(root.x, root.y); g.quadraticCurveTo(...xy(at(root, sweep - s * 0.25, span * 0.6, 0)), tip.x, tip.y);
    if (k === 'membrane') { g.lineTo(...xy(at(back, sweep, -span * 0.1, s * span * 0.08))); g.lineTo(back.x, back.y); g.lineTo(...xy(at(tail, a, R[1] * 0.4, s * R[1] * 0.4))); }
    else { g.quadraticCurveTo(back.x, back.y, tail.x, tail.y); }
    g.closePath(); g.lineWidth = ow * 2; g.strokeStyle = INK; g.stroke(); g.fillStyle = dark; g.fill();
    if (k === 'membrane') { for (const t of [tip, back]) limb(g, [root, t], Math.max(0.4, r * 0.06), acc, 0); }
    else for (const q of [0.45, 0.7, 0.92]) { const m = at(root, sweep, span * q, 0); limb(g, [m, at(m, sweep + s * 1.2, span * 0.32, 0)], Math.max(0.4, r * 0.05), acc, 0); }
  }
}

// The ostrich: a big bird on two long legs. A fluffy black body with white wing plumes, a long bare neck, a small head with a beak.
function drawOstrich(g, c, P, R, lk, col, dark, acc, ow, px, a0) {
  const r = c.r, n = P.length, a = ang(P[3], P[n - 1]), m = P[5];
  tube(g, P.slice(0, 5), R.slice(0, 5).map(v => v * 0.75), acc, ow, 0.15); // the neck, pale skin
  blob(g, m.x, m.y, R[5] * 1.35, R[5] * 1.05, a, col, ow, 0.18);
  for (const s of [-1, 1]) blob(g, ...xy(at(m, a, -R[5] * 0.35, s * R[5] * 0.62)), R[5] * 0.75, R[5] * 0.38, a - s * 0.25, '#f6f2ea', ow * 0.7, 0.1); // wing plumes
  for (const k of [-0.4, 0.1, 0.5]) { const q = at(m, a, k * R[5], 0); g.beginPath(); g.arc(q.x, q.y, R[5] * 0.4, a + PI - 1, a + PI + 1); g.lineWidth = Math.max(px * 0.7, r * 0.04); g.strokeStyle = shade(col, 0.25); g.stroke(); }
  const h = P[0], hr = R[0];
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(...xy(at(h, a0, hr * 0.5, s * hr * 0.45))); g.lineTo(...xy(at(h, a0, hr * 1.9, s * c.squash * hr * 0.5))); g.lineTo(...xy(at(h, a0, hr * 0.6, 0))); g.closePath(); g.fillStyle = '#e8b06a'; g.fill(); if (ow) { g.lineWidth = ow * 0.8; g.strokeStyle = INK; g.stroke(); } }
  blob(g, h.x, h.y, hr * 1.05, hr, a0, acc, ow, 0.2);
  eyes(g, c, h, a0, hr, hr, { ...lk, eye: 0.11 }, px, 1.2);
}

function drawQuad(g, c, P, R, lk, col, dark, acc, ow, px, a0) {
  const r = c.r, f = lk.f, n = P.length, name = lk.name;
  const bodyStart = f.neck ? 1 : 1, body = P.slice(bodyStart), BR = R.slice(bodyStart);
  if (f.spikes) { // quills: drawn before the body, fanned backwards
    const m = P[3], a = ang(P[2], P[4]);
    for (let i = 0; i < 20; i++) { const t = PI * (0.42 + 1.16 * i / 19), len = r * (1.15 + (i % 3) * 0.12) * (1 + c.squash * 0.25 + BRISTLE * 0.45); const b = at(m, a, Math.cos(t) * r * 0.3, Math.sin(t) * r * 0.25); limb(g, [b, at(m, a + 0, Math.cos(t) * len, Math.sin(t) * len * 0.85)], Math.max(px, r * 0.07), i % 2 ? acc : dark, ow * 0.5); }
  }
  if (f.mane && !f.neck) {
    const m = P[1], a = ang(P[0], P[2]), k = lk.bigMane ? 1.25 : 1, mc = f.mane === 2 ? acc : dark;
    if (lk.bigMane) { g.beginPath(); for (let i = 0; i < 18; i++) { const t = i / 18 * TAU, rr = R[0] * (i % 2 ? 1.55 : 2.15) * k * 0.85; g.lineTo(...xy(at(m, a, Math.cos(t) * rr, Math.sin(t) * rr))); } g.closePath(); g.fillStyle = shade(mc, -0.2); g.fill(); g.lineWidth = ow; g.strokeStyle = INK; if (ow) g.stroke(); }
    blob(g, m.x, m.y, R[0] * 1.55 * k, R[0] * 1.6 * k, a, mc, ow, 0.15);
  }
  if (lk.bird) { drawOstrich(g, c, P, R, lk, col, dark, acc, ow, px, a0); return; }
  tube(g, body, BR, col, ow, 0.18);
  if (lk.hump) { const a = ang(P[1], P[3]); blob(g, ...xy(at(P[2], a, -R[2] * 0.1, 0)), R[2] * 0.75, R[2] * 0.62, a, shade(col, -0.12), 0, 0.25); }
  if (lk.ape) { const a = ang(P[2], P[4]); blob(g, ...xy(at(P[3], a, -R[3] * 0.1, 0)), R[3] * 0.95, R[3] * 0.7, a, '#9a9aa6', 0, 0.2); }
  if (lk.ridge) for (let i = 1; i < 5; i++) { const a = ang(P[i - 1], P[i]); for (const u of [-0.3, 0.2]) limb(g, [at(P[i], a, u * R[i], 0), at(P[i], a, u * R[i] - R[i] * 0.35, 0)], Math.max(px, r * 0.09), INK, 0); }
  // fur pattern, inside the body
  for (let i = 2; i < n - (f.liz ? 3 : 0); i++) {
    const a = ang(P[i - 1], P[i]), w = R[i];
    if (f.stripes && !f.liz) for (const s of [-1, 1]) limb(g, [at(P[i], a, -w * 0.1, s * w * 0.88), at(P[i], a, w * 0.12, s * w * 0.3)], w * 0.18, name === 'Zebra' ? '#1c1c1c' : dark, 0);
    if (f.stripes && f.liz) limb(g, [at(P[i], a, 0, -w * 0.7), at(P[i], a, 0, w * 0.7)], w * 0.2, dark, 0);
    if (f.spots) for (const [u, v] of [[0.2, 0.45], [-0.3, -0.4], [0.35, -0.2], [-0.2, 0.15]]) dot(g, ...xy(at(P[i], a, u * w, v * w)), w * 0.13, dark);
  }
  if (f.headStripe) limb(g, [P[0], P[Math.min(4, n - 1)]], R[0] * 0.38, acc, 0);
  if (f.shell) { const m = P[3], a = ang(P[2], P[4]); blob(g, m.x, m.y, R[3] * 1.35, R[3] * 1.2, a, dark, ow, 0.18); for (const [u, v] of [[0, 0], [0.5, 0.42], [0.5, -0.42], [-0.5, 0.42], [-0.5, -0.42]]) blob(g, ...xy(at(m, a, u * R[3], v * R[3])), R[3] * 0.32, R[3] * 0.28, a, acc, 0, 0.15); }
  if ((f.arms || lk.arms) && !lk.noArms) { const a = ang(P[1], P[2]); for (const s of [-1, 1]) { const sh = at(P[2], a, 0, s * R[2] * 0.75), hand = at(sh, a + s * (0.4 + Math.sin(c.t * 2 + s) * 0.1), r * (lk.arms ? 0.45 : 0.6), 0); limb(g, [sh, hand], r * (lk.arms ? 0.1 : 0.2), dark, ow); if (!lk.arms) blob(g, hand.x, hand.y, r * (lk.pinkHands ? 0.28 : 0.2), r * (lk.pinkHands ? 0.24 : 0.17), a, lk.pinkHands ? '#f0b0a8' : dark, ow, 0.1); } }
  // head
  const h = P[0], hr = R[0], a = a0;
  const ears = f.ears, open = c.squash;
  if (f.bigEars) for (const s of [-1, 1]) { const flap = 0.25 + Math.sin(c.t * 1.8 + s) * 0.18; blob(g, ...xy(at(h, a - s * flap, -hr * 0.35, s * hr * 1.0)), hr * 0.7, hr * 0.95, a + s * 0.2, dark, ow, 0.1); }
  if (ears === 'long') for (const s of [-1, 1]) blob(g, ...xy(at(h, a, -hr * 1.1, s * hr * 0.4)), hr * 1.05, hr * 0.28, a - s * 0.22 + Math.sin(c.t * 3 + s) * 0.08, col, ow, 0.2);
  if (ears === 'flop') { const k = lk.bigFlop ? 1.45 : 1; for (const s of [-1, 1]) blob(g, ...xy(at(h, a, -hr * 0.3 * k, s * hr * 0.9)), hr * 0.42 * k, hr * 0.62 * k, a + s * 0.5 + Math.sin(c.t * 9 + s) * 0.06 * Math.min(1, c.speed / r), dark, ow, 0.1); }
  if (f.antlers) for (const s of [-1, 1]) { const b = at(h, a, -hr * 0.2, s * hr * 0.45), t = at(b, a + s * 1.3, r * 0.75, 0); limb(g, [b, t, at(t, a + s * 0.4, r * 0.4, 0)], Math.max(px, r * 0.08), acc, ow * 0.6); limb(g, [at(b, a + s * 1.3, r * 0.4, 0), at(b, a + s * 0.7, r * 0.75, 0)], Math.max(px, r * 0.07), acc, ow * 0.6); }
  if (f.mane && f.neck) for (let i = 1; i < 4; i++) dot(g, P[i].x, P[i].y, R[i] * 0.6, dark);
  // snout first, then the head over it
  const liz = f.liz, snout = f.snout || f.bigHead || liz;
  if (f.frog) { blob(g, h.x, h.y, hr * 1.15, hr * 1.2, a, col, ow); if (open > 0.1) limb(g, [at(h, a, hr * 1.1, 0), at(h, a, hr * 1.1 + open * r * 1.4, 0)], r * 0.08, '#e0607a', 0); for (const s of [-1, 1]) blob(g, ...xy(at(h, a, hr * 0.15, s * hr * 0.62)), hr * 0.4, hr * 0.4, a, acc, ow, 0.3); eyes(g, c, h, a, hr, hr, { ...lk, eyeAt: [0.15, 0.62], eye: 0.13 }, px); return; }
  if (snout) {
    const len = liz ? (name === 'Crocodile' ? 1.6 : 1.05) : f.bigHead ? 0.75 : 0.62, w = liz ? (name === 'Crocodile' ? 0.42 : 0.55) : 0.5;
    for (const s of open > 0.15 && liz ? [-1, 1] : [0]) blob(g, ...xy(at(h, a + s * open * 0.35, hr * (0.55 + len * 0.55), 0)), hr * len * 0.7, hr * w, a + s * open * 0.35, liz ? col : f.bigHead ? col : acc, ow, 0.18);
    if (!liz) dot(g, ...xy(at(h, a, hr * (0.55 + len * 1.15), 0)), hr * 0.16, INK);
    if (liz && name === 'Crocodile') for (let k = 0; k < 4; k++) for (const s of [-1, 1]) dot(g, ...xy(at(h, a, hr * (0.9 + k * 0.4), s * hr * 0.42)), Math.max(px * 0.6, hr * 0.06), '#fffbe6');
  }
  if (lk.nose) { g.beginPath(); for (const s of [-1, 1]) g.lineTo(...xy(at(h, a, hr * 0.5, s * hr * 0.45))); g.lineTo(...xy(at(h, a, hr * 1.55, 0))); g.closePath(); g.fillStyle = col; g.fill(); if (ow) { g.lineWidth = ow; g.strokeStyle = INK; g.stroke(); } dot(g, ...xy(at(h, a, hr * 1.5, 0)), hr * 0.16, '#e3a2a0'); }
  if (lk.fangs) for (const s of [-1, 1]) { const b = at(h, a, hr * 0.75, s * hr * 0.3); g.beginPath(); g.moveTo(...xy(at(b, a, 0, -s * hr * 0.12))); g.quadraticCurveTo(...xy(at(b, a, hr * 0.7, s * hr * 0.2)), ...xy(at(b, a, hr * 1.25, s * hr * 0.05))); g.lineTo(...xy(at(b, a, 0, s * hr * 0.16))); g.closePath(); g.fillStyle = '#fffbe6'; g.fill(); if (ow) { g.lineWidth = ow * 0.7; g.strokeStyle = INK; g.stroke(); } }
  if (f.tusks && !lk.fangs) for (const s of [-1, 1]) limb(g, [at(h, a, hr * 0.6, s * hr * 0.4), at(h, a, hr * 1.4, s * hr * 0.65), at(h, a, hr * 1.7, s * hr * 0.35)], Math.max(px, r * 0.09), '#fffbe6', ow * 0.6);
  blob(g, h.x, h.y, hr * (liz ? 1.1 : 1.0), hr * (liz ? 0.85 : 0.92), a, col, ow, 0.22);
  if (f.whiteHead) blob(g, h.x, h.y, hr * 0.7, hr * 0.6, a, acc, 0, 0);
  if (lk.muzzle) { blob(g, ...xy(at(h, a, hr * 1.0, 0)), hr * 0.55, hr * 0.42, a, acc, ow, 0.15); dot(g, ...xy(at(h, a, hr * 1.45, 0)), hr * 0.2, INK); }
  if (lk.square) { const m = at(h, a, hr * 0.95, 0); g.save(); g.translate(m.x, m.y); g.rotate(a); g.beginPath(); if (g.roundRect) g.roundRect(-hr * 0.3, -hr * 0.8, hr * 0.95, hr * 1.6, hr * 0.4); else g.rect(-hr * 0.3, -hr * 0.8, hr * 0.95, hr * 1.6); if (ow) { g.lineWidth = ow * 2; g.strokeStyle = INK; g.stroke(); } g.fillStyle = shade(col, 0.08); g.fill(); g.restore(); for (const s of [-1, 1]) dot(g, ...xy(at(h, a, hr * 1.4, s * hr * 0.4)), hr * 0.12, INK); }
  if (lk.ape) { blob(g, ...xy(at(h, a, hr * 0.35, 0)), hr * 0.6, hr * 0.62, a, '#5a5560', 0, 0.15); limb(g, [at(h, a, hr * 0.15, -hr * 0.6), at(h, a, hr * 0.3, 0), at(h, a, hr * 0.15, hr * 0.6)], Math.max(px, hr * 0.2), INK, 0); }
  if (lk.ruff) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(...xy(at(h, a, hr * 0.4, s * hr * 0.7))); g.lineTo(...xy(at(h, a, -hr * 0.1, s * hr * 1.35))); g.lineTo(...xy(at(h, a, -hr * 0.25, s * hr * 1.05))); g.lineTo(...xy(at(h, a, -hr * 0.55, s * hr * 1.25))); g.lineTo(...xy(at(h, a, -hr * 0.5, s * hr * 0.6))); g.closePath(); g.fillStyle = '#f2e6cc'; g.fill(); }
  if (lk.disc) { blob(g, ...xy(at(h, a, hr * 0.95, 0)), hr * 0.28, hr * 0.42, a, '#e8a6a0', ow, 0.1); for (const s of [-1, 1]) dot(g, ...xy(at(h, a, hr * 1.02, s * hr * 0.15)), hr * 0.08, INK); }
  if (lk.star) { const m = at(h, a, hr * 1.05, 0); for (let i = 0; i < 10; i++) { const t = a + (i / 10) * TAU; limb(g, [m, at(m, t, hr * 0.32, 0)], Math.max(px, hr * 0.13), '#ee8f9a', 0); } dot(g, m.x, m.y, hr * 0.18, '#f4a6b0'); }
  if (ears === 'round') { const k = lk.mouseEars ? 1.75 : lk.smallEars ? 0.6 : 1; for (const s of [-1, 1]) { const e = at(h, a, -hr * 0.3, s * hr * (0.85 + (k - 1) * 0.3)); blob(g, e.x, e.y, hr * 0.36 * k, hr * 0.36 * k, a, dark, ow, 0); dot(g, e.x, e.y, hr * 0.18 * k, '#e8a6a0'); } }
  if (ears === 'point') for (const s of [-1, 1]) { g.beginPath(); g.moveTo(...xy(at(h, a, -hr * 0.55, s * hr * 0.4))); g.lineTo(...xy(at(h, a, -hr * 0.55, s * hr * 1.25))); g.lineTo(...xy(at(h, a, hr * 0.1, s * hr * 0.75))); g.closePath(); g.fillStyle = dark; g.fill(); g.lineWidth = ow; g.strokeStyle = INK; g.stroke(); dot(g, ...xy(at(h, a, -hr * 0.35, s * hr * 0.8)), hr * 0.14, '#e8a6a0'); if (lk.tufts) limb(g, [at(h, a, -hr * 0.55, s * hr * 1.25), at(h, a, -hr * 0.7, s * hr * 1.65)], Math.max(px, hr * 0.12), INK, 0); }
  if (f.headStripe) limb(g, [at(h, a, hr * 0.9, 0), at(h, a, -hr * 0.9, 0)], hr * 0.35, acc, 0);
  if (f.horns) for (const s of [-1, 1]) limb(g, [at(h, a, 0, s * hr * 0.5), at(h, a, -hr * 1.2, s * hr * 1.1)], Math.max(px, r * 0.1), acc, ow);
  if (name === 'Mole') for (const s of [-1, 1]) for (const k of [-0.2, 0.2]) limb(g, [at(h, a, hr * 1.2, s * hr * 0.2), at(h, a, hr * 1.5, s * hr * (0.5 + k))], Math.max(px * 0.6, r * 0.02), '#fff8e6', 0);
  if (ears && !liz && !f.bigEars && ears !== 'long') for (const s of [-1, 1]) for (const k of [0.2, 0.5]) limb(g, [at(h, a, hr * (snout ? 1.1 : 0.75), s * hr * 0.25), at(h, a, hr * (snout ? 1.6 : 1.3), s * hr * (0.5 + k))], Math.max(px * 0.6, r * 0.022), '#fff8e6', 0);
  if (!snout && !f.trunk && !lk.muzzle && !lk.nose) dot(g, ...xy(at(h, a, hr * 0.95, 0)), hr * 0.17, INK);
  eyes(g, c, h, a, hr, hr, lk, px, f.bigHead ? 0.9 : 1);
}
