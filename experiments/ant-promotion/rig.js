// Creature rig for the Living look (moved from the lab page ant-creatures, 2026-11-24): the pure math under every animal. No drawing, no DOM, no randomness: the same inputs give the same pose.
// A rig follows a point that something else moves (the Ant Promotion sim, or a pen in the zoo). It never changes that point.
//   build(spec, r, x, y, a)          a rig with its body centre at (x, y), facing a; r is the animal's sim radius
//   update(rig, x, y, a, dt, look)   one fixed step (the page and the bots both use dt = 1/60); look is {x, y} or null
//   poke(rig)                        a bite or a poke: the body squashes and springs back
//   rig.hurry                        set by the caller (default 1): above 1 the feet take quicker, shorter steps (fleeing, sprinting)
// Spec numbers are in units of r (see creature.js for every species):
//   pts    radius of each spine point, head first          gaps  length of each spine segment
//   ahead  how far the head sits in front of the centre    bend  most a joint may bend (radians)
//   turn   head turn rate (rad/s)                          wave  { amp, len }: side-to-side swing per distance walked
//   legs   one entry per pair: { at, ang, len, out, fwd, rest }   gait 'walk' | 'hop' | 'fly' | 'none'
//   chains verlet chains (antennae, tails, necks, trunks): { at, side, ang, n, seg, stiff, damp, curl, wag, rate, off, lat, back }
//   hop    { len, h }   fly { at, h }   wings rate (rad/s, 0 for none)   breath rate (rad/s)
// Gait: legs are split into two groups (left of even pairs with right of odd pairs, and the rest). Only one group steps
// at a time and the groups take turns: a tripod for six legs, a trot for four, left-right for two.
const TAU = Math.PI * 2;
let MUT = null; // a deliberately broken rule for `node bots.mjs --mutate`; never set by the page
export const mutate = name => { MUT = name || null; };
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = u => u * u * (3 - 2 * u);

export function build(spec, r, x, y, a) {
  const c = { spec, r, x, y, a, ha: a, hurry: 1, t: 0, dist: 0, z: 0, hopPh: 0, fly: 0, wing: 0, squash: 0, look: 0, speed: 0, vx: 0, vy: 0, next: 0, last: -1,
    spine: [], legs: [], chains: [], reach: 0, stat: { legFrames: 0, drag: 0, waves: 0, alts: 0, overlap: 0, maxStretch: 0, resets: 0 } };
  spec.legs.forEach((L, i) => {
    for (const side of [-1, 1]) {
      const group = spec.gait === 'walk' ? (i + (side > 0 ? 1 : 0)) % 2 : 0;
      c.legs.push({ pair: i, side, group, L, len: L.len * r, hip: { x, y }, foot: { x, y }, from: { x, y }, knee: { x, y }, u: -1, lift: 0 });
    }
  });
  for (const C of spec.chains) c.chains.push({ C, pts: Array.from({ length: C.n + 1 }, () => ({ x, y, px: x, py: y })) });
  place(c, x, y, a);
  return c;
}

// Lay the body out straight behind the head and put every foot and chain at rest. Used at build and after a jump.
function place(c, x, y, a) {
  const { spec, r } = c, fx = Math.cos(a), fy = Math.sin(a);
  c.x = x; c.y = y; c.a = c.ha = a; c.vx = c.vy = c.speed = 0; c.z = 0;
  let px = x + fx * spec.ahead * r, py = y + fy * spec.ahead * r;
  c.spine = [{ x: px, y: py }];
  for (const g of spec.gaps) { px -= fx * g * r; py -= fy * g * r; c.spine.push({ x: px, y: py }); }
  for (const l of c.legs) { const { hip, target } = legAt(c, l); l.hip = hip; l.foot = { ...target }; l.from = { ...target }; l.u = -1; l.lift = 0; knee(l); }
  for (const ch of c.chains) {
    const root = chainRoot(c, ch.C); let qx = root.x, qy = root.y;
    let prev = root.a;
    ch.pts.forEach((p, k) => { if (k) { prev = restAngle(c, ch.C, prev, k); qx += Math.cos(prev) * ch.C.seg * r; qy += Math.sin(prev) * ch.C.seg * r; } p.x = p.px = qx; p.y = p.py = qy; });
  }
}

// Forward direction of the body at spine point i (the head uses the head's own heading).
function dirAt(c, i) {
  if (i <= 0) return { x: Math.cos(c.ha), y: Math.sin(c.ha) };
  const s = c.spine, j = Math.min(i, s.length - 1), dx = s[j - 1].x - s[j].x, dy = s[j - 1].y - s[j].y, d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}
const rot = (d, t) => ({ x: d.x * Math.cos(t) - d.y * Math.sin(t), y: d.x * Math.sin(t) + d.y * Math.cos(t) });

// Where a leg's hip is and where its foot wants to be now.
function legAt(c, l) {
  const { r } = c, L = l.L, s = c.spine[L.at], d = dirAt(c, L.at), n = { x: -d.y, y: d.x }, rad = c.spec.pts[L.at] * r;
  const hip = { x: s.x + n.x * l.side * L.out * rad + d.x * L.fwd * r, y: s.y + n.y * l.side * L.out * rad + d.y * L.fwd * r };
  const o = rot(d, l.side * L.ang), reach = l.len * 0.98;
  let tx = hip.x + o.x * l.len * L.rest, ty = hip.y + o.y * l.len * L.rest;
  if (c.spec.gait === 'walk' && c.speed > 1) { // land ahead of the rest spot, so the foot is under the body half a stride later
    const ahead = Math.min(reach * 0.45, c.speed * stepTime(c) * 0.9), k = ahead / c.speed;
    tx += c.vx * k; ty += c.vy * k;
  } else if (c.spec.gait !== 'walk') { // hopping and flying: the feet fold in while in the air
    const tuck = 1 - 0.55 * clamp(c.z / (0.35 * r) + c.fly, 0, 1); tx = hip.x + (tx - hip.x) * tuck; ty = hip.y + (ty - hip.y) * tuck;
  }
  const dx = tx - hip.x, dy = ty - hip.y, dd = Math.hypot(dx, dy);
  if (dd > reach * 0.9) { tx = hip.x + dx / dd * reach * 0.9; ty = hip.y + dy / dd * reach * 0.9; }
  return { hip, target: { x: tx, y: ty }, reach };
}
// A step is quicker when the animal is faster, so the feet keep up at a run and still look calm at a walk.
const stepTime = c => clamp(0.42 * c.reach / Math.max(1, c.speed * (c.hurry || 1)), 1 / 30, 0.2);

// Two-bone IK: the knee, bent outward from the body, for a leg whose upper and lower parts are each half its length.
function knee(l) {
  const h = l.hip, f = l.foot, dx = f.x - h.x, dy = f.y - h.y, d = clamp(Math.hypot(dx, dy), 1e-6, l.len), half = l.len / 2;
  const along = d / 2, up = Math.sqrt(Math.max(0, half * half - along * along)), ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1);
  // perpendicular on the outside: the side away from the body
  const s = l.side * (l.L.bendIn ? -1 : 1);
  l.knee = { x: h.x + ux * along - uy * up * s * (l.L.flip ? -1 : 1), y: h.y + uy * along + ux * up * s * (l.L.flip ? -1 : 1) };
}

function chainRoot(c, C) {
  const i = C.at < 0 ? c.spine.length - 1 : C.at, s = c.spine[i], d = dirAt(c, i), n = { x: -d.y, y: d.x }, rad = c.spec.pts[i] * c.r;
  const back = C.back ? -1 : 1;
  return { x: s.x + d.x * back * (C.off ?? 0) * rad + n.x * C.side * (C.lat ?? 0) * rad, y: s.y + d.y * back * (C.off ?? 0) * rad + n.y * C.side * (C.lat ?? 0) * rad, a: Math.atan2(d.y, d.x) + (C.back ? Math.PI : 0) };
}
// The angle segment k of a chain rests at, given the angle of the segment before it (the body's heading for the first):
// fanned out by ang, curled a little more each segment, and a wave that runs down it over time.
const wagAt = (c, C, k) => (C.wag ? Math.sin(c.t * C.rate - k * 0.8 + (C.phase ?? 0)) * C.wag * (C.wagMove ? 0.35 + 0.65 * clamp(c.speed / (c.r * 3), 0, 1) : 1) : 0);
const restAngle = (c, C, prev, k) => prev + C.side * (k === 1 ? C.ang : C.curl) + wagAt(c, C, k) * (k === 1 ? 1 : 0.45);

export function update(c, x, y, a, dt, look = null) {
  const { spec, r } = c;
  if (Math.hypot(x - c.x, y - c.y) > Math.max(4 * r, 40)) { place(c, x, y, a); c.stat.resets++; } // a jump (spawn, revive, thrown clear): start again here
  const mx = (x - c.x) / dt, my = (y - c.y) / dt, k = 1 - Math.exp(-dt * 12);
  c.vx += (mx - c.vx) * k; c.vy += (my - c.vy) * k; c.speed = Math.hypot(c.vx, c.vy);
  c.dist += Math.hypot(x - c.x, y - c.y); c.x = x; c.y = y; c.a = a; c.t += dt;
  c.ha += clamp(wrap(a - c.ha), -spec.turn * dt, spec.turn * dt);
  c.squash = Math.max(0, c.squash - dt * 3.5);

  // hopping and flying
  if (spec.gait === 'hop' || spec.gait === 'fly') {
    const flying = spec.fly && c.speed > spec.fly.at * r ? 1 : 0;
    c.fly += (flying - c.fly) * (1 - Math.exp(-dt * 5));
    if (spec.hop && c.speed > 0.4 * r && c.fly < 0.5) c.hopPh += dt * Math.max(2.2, c.speed / (spec.hop.len * r));
    else if (spec.hop) { const f = c.hopPh % 1; if (f > 0.02) c.hopPh += dt * 2.5; if (c.hopPh % 1 < f) c.hopPh = Math.ceil(c.hopPh - 1e-9); } // finish the hop in the air
    const hz = spec.hop ? Math.sin(Math.PI * (c.hopPh % 1)) * spec.hop.h * r : 0;
    c.z = Math.max(hz * (1 - c.fly), c.fly * (spec.fly ? spec.fly.h * r : 0));
  }
  if (spec.wings) c.wing += dt * (spec.gait === 'fly' || spec.gait === 'hop' ? spec.wings * (0.12 + 0.88 * c.fly) : spec.wings);

  // spine: the head leads, each point keeps its distance from the one before and bends at most `bend` per joint
  const fx = Math.cos(c.ha), fy = Math.sin(c.ha), sway = spec.wave ? Math.sin(c.dist / (spec.wave.len * r) * TAU) * spec.wave.amp * r * clamp(c.speed / (1.5 * r), 0, 1) : 0;
  const s = c.spine; s[0].x = x + fx * spec.ahead * r - fy * sway; s[0].y = y + fy * spec.ahead * r + fx * sway;
  for (let i = 1; i < s.length; i++) {
    const g = spec.gaps[i - 1] * r, p = s[i - 1], q = s[i];
    if (MUT === 'spine') { q.x += (p.x - q.x) * 0.2; q.y += (p.y - q.y) * 0.2; continue; } // broken: points drift toward the one before instead of keeping their length
    let ux = q.x - p.x, uy = q.y - p.y; const d = Math.hypot(ux, uy);
    if (d < 1e-9) { ux = -fx; uy = -fy; } else { ux /= d; uy /= d; }
    let ca = Math.atan2(-fy, -fx); // the way the body runs on from the joint: straight back from the head, or on from the segment before
    if (i > 1) { const o = s[i - 2]; ca = Math.atan2(p.y - o.y, p.x - o.x); }
    const rel = wrap(Math.atan2(uy, ux) - ca), lim = spec.bend;
    if (Math.abs(rel) > lim) { const t = ca + clamp(rel, -lim, lim); ux = Math.cos(t); uy = Math.sin(t); }
    q.x = p.x + ux * g; q.y = p.y + uy * g;
  }

  // legs
  c.reach = c.legs.length ? c.legs[0].len * 0.98 : 0;
  const thr = (l) => l.len * (c.speed > 2.2 * r ? 0.42 : 0.32) / clamp(c.hurry || 1, 0.6, 2); // hurrying: shorter, quicker steps; creeping: longer, slower ones
  let anyNeed = false, anyStep = false;
  for (const l of c.legs) {
    const { hip, target, reach } = legAt(c, l); l.hip = hip; l.target = target; l.reach = reach;
    if (spec.gait !== 'walk') { l.foot.x = target.x; l.foot.y = target.y; l.lift = c.z / r; }
    else if (l.u >= 0) {
      l.u = Math.min(1, l.u + dt / l.dur); const e = ease(l.u);
      l.foot.x = l.from.x + (target.x - l.from.x) * e; l.foot.y = l.from.y + (target.y - l.from.y) * e; l.lift = Math.sin(Math.PI * l.u);
      if (l.u >= 1) { l.u = -1; l.lift = 0; }
    }
    if (l.u >= 0) anyStep = true;
    l.err = Math.hypot(l.foot.x - target.x, l.foot.y - target.y);
    l.need = spec.gait === 'walk' && l.u < 0 && (l.err > thr(l) || Math.hypot(l.foot.x - hip.x, l.foot.y - hip.y) > reach * 0.94);
    if (l.need) anyNeed = true;
  }
  if (spec.gait === 'walk') {
    const start = l => { l.u = 0; l.dur = stepTime(c); l.from = { ...l.foot }; };
    if (MUT === 'gait') { for (const l of c.legs) if (l.need) start(l); } // broken: every leg steps when it likes
    else if (!anyStep && anyNeed) {
      const g = c.next, go = c.legs.filter(l => l.group === g && (l.need || l.err > thr(l) * 0.3));
      if (go.length) { go.forEach(start); c.stat.waves++; if (c.last !== g) c.stat.alts++; c.last = g; }
      c.next = 1 - g;
    }
    let a0 = false, a1 = false; for (const l of c.legs) if (l.u >= 0) { if (l.group) a1 = true; else a0 = true; }
    if (a0 && a1) c.stat.overlap++;
  }
  for (const l of c.legs) {
    const dx = l.foot.x - l.hip.x, dy = l.foot.y - l.hip.y, d = Math.hypot(dx, dy);
    if (d > l.reach && MUT !== 'clamp') { l.foot.x = l.hip.x + dx / d * l.reach; l.foot.y = l.hip.y + dy / d * l.reach; if (spec.gait === 'walk') c.stat.drag++; } // dragged: never longer than the leg
    c.stat.maxStretch = Math.max(c.stat.maxStretch, Math.hypot(l.foot.x - l.hip.x, l.foot.y - l.hip.y) / l.len);
    if (spec.gait === 'walk') c.stat.legFrames++;
    knee(l);
  }

  // verlet chains: antennae, tails, necks, a trunk
  for (const ch of c.chains) {
    const C = ch.C, root = chainRoot(c, C), p = ch.pts, damp = C.damp, g = C.seg * r;
    p[0].x = p[0].px = root.x; p[0].y = p[0].py = root.y;
    for (let k = 1; k < p.length; k++) {
      const q = p[k], vx = (q.x - q.px) * damp, vy = (q.y - q.py) * damp; q.px = q.x; q.py = q.y; q.x += vx; q.y += vy;
      const ang = restAngle(c, C, k === 1 ? root.a : Math.atan2(p[k - 1].y - p[k - 2].y, p[k - 1].x - p[k - 2].x), k); // each segment rests relative to the one before
      q.x += (p[k - 1].x + Math.cos(ang) * g - q.x) * C.stiff; q.y += (p[k - 1].y + Math.sin(ang) * g - q.y) * C.stiff;
      const dx = q.x - p[k - 1].x, dy = q.y - p[k - 1].y, d = Math.hypot(dx, dy);
      if (MUT !== 'spine') { if (d > 1e-9) { q.x = p[k - 1].x + dx / d * g; q.y = p[k - 1].y + dy / d * g; } else { q.x = p[k - 1].x + Math.cos(ang) * g; q.y = p[k - 1].y + Math.sin(ang) * g; } }
    }
  }

  // eyes: toward what it hunts or flees; otherwise a slow look round
  let want = Math.sin(c.t * 0.7) * 0.35;
  if (look) want = clamp(wrap(Math.atan2(look.y - s[0].y, look.x - s[0].x) - c.ha), -1.1, 1.1);
  c.look += (want - c.look) * (1 - Math.exp(-dt * 10));
  c.breath = Math.sin(c.t * spec.breath);
  return c;
}

export function poke(c) { c.squash = 1; }
// Every number a rig holds, for the NaN and determinism proofs.
export function numbers(c) {
  const out = [c.x, c.y, c.ha, c.z, c.fly, c.wing, c.look, c.squash, c.breath, c.speed];
  for (const p of c.spine) out.push(p.x, p.y);
  for (const l of c.legs) out.push(l.hip.x, l.hip.y, l.foot.x, l.foot.y, l.knee.x, l.knee.y, l.lift);
  for (const ch of c.chains) for (const p of ch.pts) out.push(p.x, p.y);
  return out;
}
