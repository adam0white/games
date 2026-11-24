// Fix-It Stall: the rules. Pure and seeded; no window or document, so bots.mjs runs it in Node.
//
// The page feeds pointer input in object-local units: the bench box is 100 x 100, (0,0) top left.
//   const s = create({ seed, unlocked, tutorial, hearts });
//   input(s, { type: 'down' | 'move' | 'up', x, y });   any time; the result shows in s.events at once
//   step(s);                                             advances the shift by DT seconds
//   s.events                                             what happened since the page last emptied it
// Every repair is a small state machine driven by those three input types. Its progress p runs 0..1.

export const DT = 1 / 60;
export const DAY = 90; // seconds in a shift; the tutorial customers do not use up the day
export const RAMP = 15; // seconds of shift per ramp level
export const LEVELS = 6; // levels 0..5
export const HINT_AFTER = 1.5; // seconds with no progress before the faint hint
export const WORKS = 0.6; // the "it works" moment
export const LEAVE = 0.7; // a grumpy customer walking off
export const KINDS = ['screw', 'pin', 'dent', 'wheel', 'rub', 'clock', 'chain', 'glue', 'sharpen', 'sew', 'pump', 'oil', 'zip', 'spring', 'thread'];
export const TUTOR = ['screw', 'pin', 'dent']; // the first three jobs ever, one each, very patient
export const WORD = { screw: 'Turn!', pin: 'Pull!', dent: 'Tap!', wheel: 'Flick!', rub: 'Rub!', clock: 'Set it!', chain: 'Hook it!', glue: 'Push & hold!', sharpen: 'Swipe!', sew: 'Sew!', pump: 'Pump!', oil: 'Tap when open!', zip: 'Zip it up!', spring: 'Pull back!', thread: 'Thread it!' };
export const OBJECT = { screw: 'bell', pin: 'music box', dent: 'kettle', wheel: 'wheel', rub: 'lamp', clock: 'clock', chain: 'bike', glue: 'vase', sharpen: 'knife', sew: 'teddy', pump: 'ball', oil: 'door', zip: 'jacket', spring: 'toy car', thread: 'needle' };
export const COIN = { screw: 2, pin: 2, dent: 2, wheel: 3, rub: 3, clock: 2, chain: 2, glue: 3, sharpen: 3, sew: 3, pump: 3, oil: 3, zip: 3, spring: 2, thread: 3 };
export const QUICK_BONUS = 1; // coins for a repair done with at least half the patience left
export const PATIENCE = [13, 12, 10.5, 9.5, 8.5, 7.5]; // seconds for one repair, by ramp level
export const TWO_PATIENCE = 1.6; // a two-repair job gets this many times the patience
export const TUTOR_PATIENCE = 45;
export const NEW_PATIENCE = 30; // the first customer with a newly unlocked job
export const REGULAR_AT = 5; // the regular is the sixth customer of a shift (after the tutorial)
export const TWO_CHANCE = [0, 0.15, 0.25, 0.3, 0.4, 0.45];
// The golden customer: rare, brings a gold object that needs two repairs, waits less than an ordinary two-repair
// customer, and pays four times over. Decided when the customer joins the queue, so you see them coming.
export const GOLDEN_CHANCE = 0.025;
export const GOLDEN_PATIENCE = 1.45; // times the level's patience (an ordinary two-repair job gets TWO_PATIENCE)
export const GOLDEN_PAY = 4;
export const GOLDEN_FROM = 6; // no golden customer among the first six of a shift
// Touch radii in local units. index.html scales 100 units to at least 300 px, so the smallest (dent, 17) is 51 px.
export const HIT = { screw: 60, pin: 32, dent: 17, wheel: 52, rub: 38, clock: 54, chain: 26, glue: 30, sharpen: 36, sew: 26, pump: 26, oil: 30, zip: 22, spring: 26, thread: 22 };

const DENTS = [[28, 54], [50, 42], [72, 54], [38, 76], [62, 76]];
// Where a second-job screw sits on each object (all at least 28 units from the box edge, so a thumb can circle it).
const SCREW_SPOT = { pin: [72, 80], dent: [50, 20], wheel: [50, 54], rub: [50, 40], clock: [50, 52], chain: [68, 36], glue: [50, 60], sharpen: [32, 52], sew: [76, 50], pump: [74, 80], oil: [58, 46], zip: [32, 44], spring: [50, 72], thread: [32, 46] };

// ---------- random numbers: mulberry32 on s.r, so a run is fixed by its seed
export function rand(s) {
  s.r = (s.r + 0x6d2b79f5) | 0;
  let t = s.r;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, list) => list[Math.floor(rand(s) * list.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angle = (x, y, cx, cy) => Math.atan2(y - cy, x - cx) * 180 / Math.PI; // degrees, clockwise on screen
const wrap = d => ((d + 540) % 360) - 180;

// ---------- the repairs
// Each has make(s, spot), down(r, x, y) -> touched something, move(r, x, y, s), up(r), tick(r, dt, s), guide(r) for hints and bots.
const K = {
  // Loose screw: circle a finger round it. Three turns either way drive it home; a click every quarter turn.
  screw: {
    make: (s, spot = [50, 56]) => ({ cx: spot[0], cy: spot[1], turned: 0, need: 1080, last: null, quarter: 0, slot: rand(s) * 180 }),
    down(r, x, y) {
      const d = dist(x, y, r.cx, r.cy);
      if (d > HIT.screw) return false;
      r.grab = true;
      r.last = d >= 5 ? angle(x, y, r.cx, r.cy) : null;
      return true;
    },
    move(r, x, y, s) {
      if (!r.grab) return;
      if (dist(x, y, r.cx, r.cy) < 5) { r.last = null; return; }
      const a = angle(x, y, r.cx, r.cy);
      if (r.last !== null) {
        const d = clamp(wrap(a - r.last), -60, 60);
        r.turned += d;
        r.slot += d;
        const p = Math.min(1, Math.abs(r.turned) / r.need);
        if (p > r.p) r.p = p;
        const q = Math.floor(r.p * r.need / 90);
        if (q > r.quarter) { r.quarter = q; s.events.push({ e: 'click', n: q }); }
      }
      r.last = a;
    },
    up(r) { r.grab = false; },
    tick() {},
    guide: r => ({ type: 'circle', cx: r.cx, cy: r.cy, r: 24 }),
  },
  // Bent pin: grab it and pull it out of its hole. It is stiff, so it comes out at its own pace while you hold it.
  pin: {
    make: () => ({ hx: 50, hy: 64, tx: 50, ty: 40, need: 46, pull: 0, want: 0, ox: 0, oy: 0, creak: 0 }),
    down(r, x, y) {
      if (dist(x, y, r.tx, r.ty - r.pull * 30) > HIT.pin) return false;
      r.grab = true; r.ox = x; r.oy = y;
      return true;
    },
    move(r, x, y) {
      if (!r.grab) return;
      r.want = clamp(dist(x, y, r.ox, r.oy) / r.need, 0, 1);
    },
    up(r) { r.grab = false; r.want = 0; },
    tick(r, dt, s) {
      if (r.grab && r.want > r.pull) r.pull = Math.min(r.want, r.pull + 1.1 * dt);
      else if (!r.grab) r.pull = Math.max(0, r.pull - 0.6 * dt); // let go too soon and it slides back in
      const c = Math.floor(r.pull * 6);
      if (c > r.creak) s.events.push({ e: 'creak', n: c });
      r.creak = c;
      if (r.pull > r.p) r.p = r.pull;
      if (r.pull >= 1) r.p = 1;
    },
    guide: r => ({ type: 'drag', from: [r.tx, r.ty - r.pull * 30], to: [r.tx, r.ty - r.pull * 30 - r.need], hold: true }),
  },
  // Dents: tap each one and it pops out with a ping.
  dent: {
    make(s) {
      const n = s.cust?.tutor ? 3 : [3, 3, 4, 4, 5, 5][level(s)];
      const spots = DENTS.slice();
      for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
      return { dents: spots.slice(0, n).map(([x, y]) => ({ x, y, out: false })), popped: 0 };
    },
    down(r, x, y, s) {
      let best = null, bd = HIT.dent;
      for (const d of r.dents) if (!d.out) { const e = dist(x, y, d.x, d.y); if (e <= bd) { bd = e; best = d; } }
      if (!best) return false;
      best.out = true; r.popped++;
      r.p = r.popped / r.dents.length;
      s.events.push({ e: 'ping', n: r.popped, x: best.x, y: best.y });
      return true;
    },
    move() {}, up() {}, tick() {},
    guide: r => { const d = r.dents.find(d => !d.out); return { type: 'tap', at: d ? [d.x, d.y] : [50, 50], all: r.dents.filter(d => !d.out).map(d => [d.x, d.y]) }; },
  },
  // Wobbly wheel: flick it round. It seats only while it spins fast; the wobble shrinks as it seats.
  wheel: {
    make: s => ({ cx: 50, cy: 54, R: 34, w: 0, ang: rand(s) * 360, seat: 0, last: null, acc: 0, win: [0, 0, 0, 0, 0, 0], tickN: 0, rev: 0 }),
    down(r, x, y) {
      if (dist(x, y, r.cx, r.cy) > HIT.wheel) return false;
      r.grab = true;
      r.last = dist(x, y, r.cx, r.cy) >= 8 ? angle(x, y, r.cx, r.cy) : null;
      return true;
    },
    move(r, x, y) {
      if (!r.grab) return;
      if (dist(x, y, r.cx, r.cy) < 8) { r.last = null; return; }
      const a = angle(x, y, r.cx, r.cy);
      if (r.last !== null) { const d = clamp(wrap(a - r.last), -90, 90); r.acc += Math.abs(d); r.ang += d; }
      r.last = a;
    },
    up(r) { r.grab = false; r.last = null; },
    tick(r, dt, s) {
      // finger speed over the last six ticks, so it does not matter how the page batches ticks
      r.win[r.tickN++ % r.win.length] = r.acc; r.acc = 0;
      const speed = r.win.reduce((a, b) => a + b, 0) / (r.win.length * dt);
      r.w *= Math.exp(-0.6 * dt);
      if (r.grab) r.w = Math.max(r.w, speed);
      if (!r.grab || speed < r.w) r.ang += r.w * dt;
      const SEAT = 360; // one turn a second seats it at full rate
      r.seat = Math.min(1, r.seat + dt * Math.min(1, (r.w / SEAT) ** 2) / 1.1);
      r.p = r.seat;
      const rev = Math.floor(r.ang / 120);
      if (rev !== r.rev && r.w > 60) s.events.push({ e: 'whirr', w: r.w });
      r.rev = rev;
    },
    guide: r => ({ type: 'flick', cx: r.cx, cy: r.cy, r: 30 }),
  },
  // Dead lamp: rub the dirty contacts back and forth until they shine.
  rub: {
    make: () => ({ cx: 50, cy: 74, w: 34, travel: 0, need: 600, lx: 0, ly: 0, spark: 0 }),
    down(r, x, y) {
      if (dist(x, y, r.cx, r.cy) > HIT.rub) return false;
      r.grab = true; r.lx = x; r.ly = y;
      return true;
    },
    move(r, x, y, s) {
      if (!r.grab) return;
      const seg = dist(x, y, r.lx, r.ly);
      r.lx = x; r.ly = y;
      if (dist(x, y, r.cx, r.cy) > HIT.rub + 6) return;
      r.travel += Math.min(seg, 25);
      r.p = Math.min(1, r.travel / r.need);
      const k = Math.floor(r.p * 10);
      if (k > r.spark) { r.spark = k; s.events.push({ e: 'shine', n: k }); }
    },
    up(r) { r.grab = false; },
    tick() {},
    guide: r => ({ type: 'rub', cx: r.cx, cy: r.cy, w: r.w }),
  },
  // Stopped clock: push the minute hand round (it only goes forward) to the star.
  clock: {
    make: s => { const a0 = -90 + Math.floor(rand(s) * 4) * 30; return { cx: 50, cy: 50, R: 38, a0, hand: a0, want: a0, target: a0 + 210 + Math.floor(rand(s) * 4) * 30, last: null, tickA: 0 }; },
    down(r, x, y) {
      const d = dist(x, y, r.cx, r.cy);
      if (d > HIT.clock) return false;
      r.grab = true;
      r.last = d >= 6 ? angle(x, y, r.cx, r.cy) : null;
      return true;
    },
    move(r, x, y, s) {
      if (!r.grab) return;
      if (dist(x, y, r.cx, r.cy) < 6) { r.last = null; return; }
      const a = angle(x, y, r.cx, r.cy);
      if (r.last !== null) {
        const d = clamp(wrap(a - r.last), -60, 60);
        if (d > 0) r.want = Math.min(r.target + 20, r.want + d);
        else if (d < -4) s.events.push({ e: 'ratchet' }); // backwards does nothing, and says so
      }
      r.last = a;
    },
    up(r) { r.grab = false; },
    tick(r, dt, s) {
      if (r.want > r.hand) r.hand = Math.min(r.want, r.hand + 240 * dt); // the gears turn at their own pace
      const k = Math.floor((r.hand - r.a0) / 30);
      if (k > r.tickA) { r.tickA = k; s.events.push({ e: 'tick', n: k }); }
      r.p = clamp((r.hand - r.a0) / (r.target - r.a0), 0, 1);
      if (r.hand >= r.target - 5) r.p = 1;
    },
    guide: r => ({ type: 'arc', cx: r.cx, cy: r.cy, r: 28, from: r.hand, to: r.target }),
  },
  // Slipped chain: drag the hanging loop up onto the front gear. The chain is heavy, so the loop trails
  // behind the finger (and stays in sight beside it) and must itself reach the gear.
  chain: {
    make: () => ({ gx: 68, gy: 34, gr: 18, rx: 30, ry: 66, sx: 34, sy: 88, lx: 34, ly: 88, fx: 34, fy: 88, hooked: false, d0: Math.hypot(34, 54) - 18 }),
    down(r, x, y) {
      if (dist(x, y, r.lx, r.ly) > HIT.chain && dist(x, y, r.sx, r.sy) > HIT.chain) return false;
      r.grab = true; r.fx = x; r.fy = y;
      return true;
    },
    move(r, x, y) {
      if (!r.grab || r.hooked) return;
      r.fx = x; r.fy = y;
    },
    up(r) { r.grab = false; },
    tick(r, dt, s) {
      if (r.hooked) return;
      const tx = r.grab ? r.fx : r.sx, ty = r.grab ? r.fy : r.sy, d = dist(tx, ty, r.lx, r.ly), v = (r.grab ? 95 : 160) * dt;
      if (d > 0) { const k = Math.min(1, v / d); r.lx += (tx - r.lx) * k; r.ly += (ty - r.ly) * k; }
      r.p = Math.max(r.p, clamp(0.9 * (1 - (dist(r.lx, r.ly, r.gx, r.gy) - r.gr) / r.d0), 0, 0.9) - 1e-6);
      if (dist(r.lx, r.ly, r.gx, r.gy) <= r.gr + 6) { r.hooked = true; r.p = 1; s.events.push({ e: 'clank' }); }
    },
    guide: r => ({ type: 'drag', from: [r.lx, r.ly], to: [r.gx, r.gy], hold: true }),
  },
  // Cracked vase: push the loose half back on, then hold it while the glue sets.
  glue: {
    make: () => ({ fx: 56, fy: 56, ox: 18, oy: 6, o0: Math.hypot(18, 6), joined: false, set: 0, hold: false, gx: 0, gy: 0 }),
    down(r, x, y) {
      if (r.joined) {
        if (dist(x, y, 46, 56) > HIT.glue + 22) return false;
        r.hold = true;
        return true;
      }
      if (dist(x, y, r.fx + r.ox, r.fy + r.oy) > HIT.glue) return false;
      r.grab = true; r.gx = x - r.ox; r.gy = y - r.oy;
      return true;
    },
    move(r, x, y, s) {
      if (!r.grab || r.joined) return;
      r.ox = x - r.gx; r.oy = y - r.gy;
      const off = Math.hypot(r.ox, r.oy);
      r.p = Math.max(r.p, 0.5 * clamp(1 - off / r.o0, 0, 1));
      if (off < 9) { r.joined = true; r.ox = r.oy = 0; r.hold = true; r.grab = false; r.p = 0.5; s.events.push({ e: 'snap' }); }
    },
    up(r) { r.grab = false; r.hold = false; },
    tick(r, dt) {
      if (r.joined && r.hold) r.set = Math.min(1, r.set + dt / 1.0);
      if (r.joined) r.p = 0.5 + 0.5 * r.set;
    },
    guide: r => ({ type: 'drag', from: [r.fx + r.ox, r.fy + r.oy], to: [r.fx, r.fy], hold: true }),
  },
  // Blunt knife: long swipes along the blade. Six strokes, either way.
  sharpen: {
    make: () => ({ y: 50, x0: 12, x1: 88, strokes: 0, need: 6, run: 0, dir: 0, lx: 0 }),
    down(r, x, y) {
      if (Math.abs(y - r.y) > HIT.sharpen || x < -5 || x > 105) return false;
      r.grab = true; r.lx = x; r.run = 0; r.dir = 0;
      return true;
    },
    move(r, x, y, s) {
      if (!r.grab) return;
      const dx = x - r.lx; r.lx = x;
      if (Math.abs(y - r.y) > HIT.sharpen + 12 || dx === 0) return;
      const sign = Math.sign(dx);
      if (r.dir === 0 || sign === r.dir) r.run += Math.abs(dx);
      else r.run = Math.abs(dx);
      r.dir = sign;
      if (r.run >= 48) {
        r.run = 0; r.strokes++;
        r.p = Math.min(1, r.strokes / r.need);
        s.events.push({ e: 'shing', n: r.strokes, dir: sign });
      }
    },
    up(r) { r.grab = false; },
    tick() {},
    guide: r => ({ type: 'swipe', from: [18, r.y], to: [82, r.y] }),
  },
};

// The torn teddy's seam, a zigzag down its tummy, as a polyline in local units.
const SEAM = [[40, 46], [58, 53], [42, 60], [58, 67], [42, 74], [56, 82]];
const SEAM_LEN = [0]; for (let i = 1; i < SEAM.length; i++) SEAM_LEN.push(SEAM_LEN[i - 1] + dist(...SEAM[i - 1], ...SEAM[i]));
export const SEAM_POINTS = SEAM;
export function seamAt(u) {
  u = clamp(u, 0, SEAM_LEN.at(-1));
  let i = 1; while (i < SEAM.length - 1 && SEAM_LEN[i] < u) i++;
  const k = (u - SEAM_LEN[i - 1]) / (SEAM_LEN[i] - SEAM_LEN[i - 1]);
  return [SEAM[i - 1][0] + (SEAM[i][0] - SEAM[i - 1][0]) * k, SEAM[i - 1][1] + (SEAM[i][1] - SEAM[i - 1][1]) * k];
}
// The point on the seam nearest (x, y), not more than `back` units behind u0: [u, distance].
function seamNear(x, y, u0, back) {
  let best = [u0, Infinity];
  for (let i = 1; i < SEAM.length; i++) {
    if (SEAM_LEN[i] < u0 - back) continue;
    const [ax, ay] = SEAM[i - 1], [bx, by] = SEAM[i], L = SEAM_LEN[i] - SEAM_LEN[i - 1];
    const k = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L), 0, 1);
    const u = SEAM_LEN[i - 1] + k * L, d = dist(x, y, ax + (bx - ax) * k, ay + (by - ay) * k);
    if (u >= u0 - back && d < best[1]) best = [u, d];
  }
  return best;
}
K.sew = {
  // Torn teddy: drag the needle along the dotted seam. The thread is slow, so the needle follows the finger at its
  // own pace (always in sight, never under the finger) and leaves stitches behind it.
  make: () => ({ u: 0, L: SEAM_LEN.at(-1), fx: 0, fy: 0, st: 0 }),
  down(r, x, y) {
    const [nx, ny] = seamAt(r.u);
    if (dist(x, y, nx, ny) > HIT.sew) return false;
    r.grab = true; r.fx = x; r.fy = y;
    return true;
  },
  move(r, x, y) { if (r.grab) { r.fx = x; r.fy = y; } },
  up(r) { r.grab = false; },
  tick(r, dt, s) {
    if (!r.grab) return;
    const [u, d] = seamNear(r.fx, r.fy, r.u, 2);
    if (d <= 18 && u > r.u) r.u = Math.min(u, r.u + 40 * dt);
    const n = Math.floor(r.u / 12);
    if (n > r.st) { r.st = n; s.events.push({ e: 'stitch', n }); }
    r.p = r.u >= r.L - 0.5 ? 1 : r.u / r.L;
  },
  guide: r => ({ type: 'path', pts: [seamAt(r.u), ...SEAM.filter((_, i) => SEAM_LEN[i] > r.u + 0.5)], hold: (r.L - r.u) / 40 + 0.25 }),
};
const PUMP_RATE = 140; // local units a second the pump handle can go down
K.pump = {
  // Flat ball: push the pump handle down and pull it up. Each full push puts in a puff of air; the handle
  // goes down only as fast as the air will go.
  make: () => ({ x: 74, h: 22, want: 22, gy: 0, armed: true, strokes: 0, need: 6 }),
  down(r, x, y) {
    if (Math.abs(x - r.x) > HIT.pump || y < r.h - 18 || y > r.h + 44) return false;
    r.grab = true; r.gy = y - r.h; r.want = r.h;
    return true;
  },
  move(r, x, y) { if (r.grab) r.want = clamp(y - r.gy, 22, 50); },
  up(r) { r.grab = false; r.want = r.h; },
  tick(r, dt, s) {
    if (r.want > r.h) r.h = Math.min(r.want, r.h + PUMP_RATE * dt); // pushing down: the air resists
    else r.h = Math.max(r.want, r.h - 400 * dt);
    if (r.h <= 27) r.armed = true;
    if (r.armed && r.h >= 46) { r.armed = false; r.strokes++; r.p = Math.min(1, r.strokes / r.need); s.events.push({ e: 'puff', n: r.strokes }); }
  },
  guide: r => ({ type: 'pump', x: r.x, top: 20, bottom: 52, at: [r.x, r.h + 6], n: r.need - r.strokes, rate: PUMP_RATE }),
};

// ---------- round 3: four more repairs, each a gesture the first eleven do not use

// Squeaky door: it swings open and shut by itself. Tap the oil can while the door is wide open and a drop lands in the
// hinge; one drop per swing, three drops and it swings quietly. A tap while it is shut splashes and does no harm.
export const OIL_PERIOD = 1.0; // seconds for one swing
export const OIL_OPEN = 0.6; // how far open the door must be (0 shut, 1 wide open) for a drop to land
const oilOpen = r => 0.5 - 0.5 * Math.cos(2 * Math.PI * r.ph);
K.oil = {
  make: s => ({ ph: rand(s) * 0.25, cx: 72, cy: 80, drops: 0, need: 3, used: -1, wasOpen: false }),
  down(r, x, y, s) {
    if (dist(x, y, r.cx, r.cy) > HIT.oil) return false;
    const swing = Math.floor(r.ph);
    if (oilOpen(r) >= OIL_OPEN && r.used !== swing) {
      r.used = swing; r.drops++; r.p = r.drops / r.need;
      s.events.push({ e: 'drip', n: r.drops });
    } else s.events.push({ e: 'splat' });
    return true;
  },
  move() {}, up() {},
  tick(r, dt, s) {
    r.ph += dt / OIL_PERIOD;
    const open = oilOpen(r) >= OIL_OPEN;
    if (open && !r.wasOpen && r.drops < r.need) s.events.push({ e: 'squeak', n: r.drops });
    r.wasOpen = open;
  },
  // mid: seconds to the middle of the next swing that can still take a drop
  guide(r) {
    const f = r.ph - Math.floor(r.ph), swing = Math.floor(r.ph);
    const mid = (f <= 0.5 && r.used !== swing ? 0.5 - f : 1.5 - f) * OIL_PERIOD;
    return { type: 'timing', at: [r.cx, r.cy], mid, period: OIL_PERIOD, open: oilOpen(r), n: r.need - r.drops };
  },
};

// Stuck zip on a jacket: hold the pull tab (it hangs below the slider, so the finger never covers the teeth) and drag it
// up. It sticks at each snag; wiggle side to side to free it, then go on up to the collar.
export const ZIP_RATE = 150; // local units a second the slider can climb
const ZIP_TAB = 12; // the tab hangs this far below the slider
K.zip = {
  make: s => ({ x: 50, y: 84, y0: 84, top: 24, snags: [64 + Math.floor(rand(s) * 3) * 3, 42 + Math.floor(rand(s) * 3) * 3], wig: 0, dir: 0, run: 0, lx: 0, fy: 84, gy: 0 }),
  down(r, x, y) {
    if (dist(x, y, r.x, r.y + ZIP_TAB) > HIT.zip) return false;
    r.grab = true; r.gy = y - r.y; r.lx = x; r.dir = 0; r.run = 0; r.fy = r.y;
    return true;
  },
  move(r, x, y, s) {
    if (!r.grab) return;
    r.fy = y - r.gy;
    const dx = x - r.lx; r.lx = x;
    if (!r.snags.length || r.y > r.snags[0] + 0.5 || !dx) return;
    // stuck at a snag: each change of direction after at least 4 units of travel is one wiggle
    const sign = Math.sign(dx);
    if (r.dir === 0 || sign === r.dir) r.run += Math.abs(dx);
    else { if (r.run >= 4) { r.wig++; s.events.push({ e: 'wiggle', n: r.wig }); } r.run = Math.abs(dx); }
    r.dir = sign;
    if (r.wig >= 4) { r.snags.shift(); r.wig = 0; r.run = 0; r.dir = 0; s.events.push({ e: 'unsnag', left: r.snags.length }); }
  },
  up(r) { r.grab = false; },
  tick(r, dt) {
    if (r.grab) {
      const stop = r.snags.length ? r.snags[0] : r.top, want = clamp(r.fy, stop, r.y0);
      if (want < r.y) r.y = Math.max(want, r.y - ZIP_RATE * dt); // it only goes up: a zip stays where you leave it
    }
    r.p = r.y <= r.top + 0.01 ? 1 : clamp((r.y0 - r.y + r.wig * 0.6) / (r.y0 - r.top), 0, 0.99);
  },
  guide: r => ({ type: 'zip', at: [r.x, r.y + ZIP_TAB], top: r.top + ZIP_TAB, snags: r.snags.map(v => v + ZIP_TAB), stuck: r.snags.length > 0 && r.y <= r.snags[0] + 0.5, rate: ZIP_RATE }),
};

// Wind-up toy car: hold it and pull it back. The spring resists, so the car comes back at its own pace and stays in sight
// beside the finger; when the key glows, let go and it zooms off. Let go too soon and it rolls back unwound.
export const SPRING_RATE = 75; // local units a second the car can be pulled back
K.spring = {
  make: () => ({ x0: 64, x: 64, y: 60, need: 34, w: 0, fx: 64, gx: 0, zoom: 0, ready: false }),
  down(r, x, y) {
    if (r.zoom || dist(x, y, r.x - 8, r.y) > HIT.spring) return false;
    r.grab = true; r.gx = x - r.x; r.fx = x;
    return true;
  },
  move(r, x) { if (r.grab) r.fx = x; },
  up(r, s, type) {
    if (!r.grab) return;
    r.grab = false;
    if (type === 'up' && r.w >= 1) { r.zoom = 1; r.p = 1; s.events.push({ e: 'zoom' }); }
    else if (r.w > 0.05) s.events.push({ e: 'unwind' });
  },
  tick(r, dt, s) {
    if (r.zoom) return;
    if (r.grab) {
      const want = clamp(r.fx - r.gx, r.x0 - r.need - 6, r.x0);
      r.x = want < r.x ? Math.max(want, r.x - SPRING_RATE * dt) : Math.min(want, r.x + 200 * dt);
    } else r.x = Math.min(r.x0, r.x + 120 * dt); // let go: it rolls back to where it was, unwound
    const w = clamp((r.x0 - r.x) / r.need, 0, 1);
    if (Math.floor(w * 4) > Math.floor(r.w * 4)) s.events.push({ e: 'wind', n: Math.floor(w * 4) });
    if (w >= 1 && !r.ready) s.events.push({ e: 'ready' });
    r.ready = w >= 1; r.w = w; r.p = 0.9 * w;
  },
  guide: r => ({ type: 'drag', from: [r.x - 8, r.y], to: [r.x0 - r.need - 12, r.y], hold: Math.max(0, r.x - (r.x0 - r.need)) / SPRING_RATE + 0.2 }),
};

// Needle: hold the thread's end (its tip stands up above the finger) and steer the tip into the needle's eye, then hold
// still while it goes through. Moving while it is in the eye pulls it back out.
export const THREAD_HOLD = 1.0; // seconds of holding still in the eye
const THREAD_UP = 16; // the tip stands this far above the finger
K.thread = {
  make: s => ({ tx: 26, ty: 56, fx: 26, fy: 72, ex: 64, ey: 28, ph: rand(s), jit: 0, inEye: 0, lx: 0, ly: 0, was: false, d0: Math.hypot(38, 28) - 4, held: false }),
  down(r, x, y) {
    if (dist(x, y, r.tx, r.ty + THREAD_UP) > HIT.thread) return false;
    r.grab = true; r.held = true; r.fx = r.lx = x; r.fy = r.ly = y;
    return true;
  },
  move(r, x, y) {
    if (!r.grab) return;
    r.jit += dist(x, y, r.lx, r.ly); r.lx = x; r.ly = y; r.fx = x; r.fy = y;
  },
  up(r) { r.grab = false; },
  tick(r, dt, s) {
    r.ph += dt / 2.4; r.ex = 64 + 2 * Math.sin(r.ph * 2 * Math.PI); // the needle sways a little
    r.jit *= Math.exp(-dt / 0.1);
    if (r.grab) { // the thread is floppy: its tip follows the finger at its own pace
      const tx = r.fx, ty = r.fy - THREAD_UP, d = dist(tx, ty, r.tx, r.ty), v = 110 * dt;
      if (d > 0) { const k = Math.min(1, v / d); r.tx += (tx - r.tx) * k; r.ty += (ty - r.ty) * k; }
    }
    const d = dist(r.tx, r.ty, r.ex, r.ey), near = d <= 6;
    if (near && !r.was) s.events.push({ e: 'eye' });
    r.was = near;
    const before = Math.floor(r.inEye * 5);
    if (near && r.grab && r.jit < 3) r.inEye = Math.min(1, r.inEye + dt / THREAD_HOLD);
    else r.inEye = Math.max(0, r.inEye - dt * (near ? 0.5 : 2));
    if (Math.floor(r.inEye * 5) > before) s.events.push({ e: 'through', n: Math.floor(r.inEye * 5) });
    r.p = r.inEye >= 1 ? 1 : r.held ? 0.4 * clamp(1 - (d - 6) / r.d0, 0, 1) + 0.6 * r.inEye : 0;
  },
  guide: r => ({ type: 'drag', from: [r.tx, r.ty + THREAD_UP], to: [r.ex, r.ey + THREAD_UP], hold: dist(r.tx, r.ty, r.ex, r.ey) / 110 + (1 - r.inEye) * THREAD_HOLD + 0.35, eye: [r.ex, r.ey] }),
};

function makeRepair(s, kind, spot) {
  const r = K[kind].make(s, spot);
  r.kind = kind; r.p = 0; r.idle = 0; r.best = 0; r.done = false; r.grab = false; r.spot = spot ?? null;
  return r;
}
export const guide = r => K[r.kind].guide(r);
export const level = s => s.lv ? s.lv.ramp : Math.min(LEVELS - 1, Math.floor(s.clock / RAMP)); // a map level sets its own step
export const multiplier = s => 1 + Math.min(2, Math.floor(s.streak / 4)); // x2 after four quick jobs in a row, x3 after eight

// ---------- the shift: the open stall (a day of random customers) or a map level (levels.js) when `lv` is given
export function create({ seed = 1, unlocked = TUTOR, tutorial = false, hearts = 3, newJob = null, only = null, regular = -1, two = true, day = DAY, startLevel = 0, golden = GOLDEN_CHANCE, goldenFrom = GOLDEN_FROM, lv = null } = {}) {
  if (lv) { // a map level brings its own seed, jobs, pace and goal
    seed = lv.seed; unlocked = lv.pool; tutorial = false; newJob = lv.intro; two = lv.two; day = Infinity; startLevel = 0;
    golden = lv.golden; goldenFrom = 4; regular = lv.regular && !lv.goal.list ? 0 : -1;
  }
  const s = {
    seed, r: seed | 0, t: 0, clock: startLevel * RAMP, day, over: null, events: [],
    hearts, maxHearts: hearts, coins: 0, served: 0, lost: 0, streak: 0, bestStreak: 0, log: [],
    unlocked: unlocked.filter(k => KINDS.includes(k)), tutorial, newJob, only, regular, two, golden, goldenFrom, made: 0, lastKind: null,
    queue: [], cust: null, reps: [], rep: null, stepN: 0, phase: 'work', phaseT: 0,
    finger: { down: false, blocked: false, x: 0, y: 0 },
    lv, cleared: false, clearT: null,
  };
  if (!s.unlocked.length) s.unlocked = TUTOR.slice();
  for (let i = 0; i < 4; i++) { const c = customer(s); if (c) s.queue.push(c); }
  nextCustomer(s);
  return s;
}

function customer(s) {
  const lv = s.lv, list = lv?.goal.list;
  if (list && s.made >= list.length) return null; // a set list has no more customers after its last
  const n = s.made++;
  const c = { n, look: Math.floor(rand(s) * 2 ** 30), tutor: false, fresh: false, regular: false, golden: false, kinds: null };
  const g = rand(s); // drawn for every customer, so the golden chance never shifts the rest of the queue
  // The queue's random numbers are drawn here and only here, so every player of a seed meets the same customers
  // with the same repairs, however fast they play: the two-repair roll and the repairs' own layout come with them.
  c.roll = rand(s); c.rs = Math.floor(rand(s) * 2 ** 31);
  if (s.only) c.kinds = [s.only];
  else if (list) { c.kinds = [list[n]]; c.fresh = n === 0 && list[0] === lv.intro; }
  else if (lv?.intro && (n % 2 === 0 || s.unlocked.length === 1)) { c.kinds = [lv.intro]; c.fresh = n === 0; } // a new job: every other customer
  else if (s.tutorial && n < TUTOR.length) { c.kinds = [TUTOR[n]]; c.tutor = true; }
  else if (!lv && s.newJob && !s.newJobMade) { c.kinds = [s.newJob]; c.fresh = true; s.newJobMade = true; }
  else {
    let pool = s.unlocked.length > 1 ? s.unlocked.filter(k => k !== s.lastKind) : s.unlocked;
    if (lv?.intro && pool.length > 1) pool = pool.filter(k => k !== lv.intro);
    c.kinds = [pick(s, pool)];
  }
  if (s.regular >= 0 && n === (s.tutorial ? TUTOR.length : 0) + REGULAR_AT) c.regular = true;
  else if (!c.tutor && !c.fresh && n >= (s.tutorial ? TUTOR.length : 0) + s.goldenFrom && g < s.golden) c.golden = true;
  s.lastKind = c.kinds[0];
  return c;
}

function nextCustomer(s) {
  const c = s.queue.shift();
  const more = customer(s);
  if (more) s.queue.push(more);
  const L = level(s), lv = s.lv;
  // A second job is decided when the customer steps up; in the open stall it follows the ramp, in a level it is fixed.
  const chance = lv ? lv.two : typeof s.two === 'number' ? s.two : s.two ? TWO_CHANCE[L] : 0;
  if ((!c.tutor && !c.fresh && c.roll < chance) || c.golden) c.kinds = [c.kinds[0], c.kinds[0] === 'screw' ? 'dent' : 'screw'];
  const base = lv ? lv.patience : PATIENCE[L];
  c.patience = c.tutor ? TUTOR_PATIENCE : c.fresh ? NEW_PATIENCE : c.golden ? base * GOLDEN_PATIENCE : base * (c.kinds.length > 1 ? TWO_PATIENCE : 1) * (c.regular ? 1.4 : 1);
  c.left = c.patience;
  s.cust = c;
  const queueR = s.r; s.r = c.rs; // the repairs draw from the customer's own numbers
  s.reps = c.kinds.map((k, i) => makeRepair(s, k, i === 0 ? undefined : k === 'screw' ? SCREW_SPOT[c.kinds[0]] : undefined));
  s.r = queueR;
  s.stepN = 0; s.rep = s.reps[0];
  s.phase = 'work'; s.phaseT = 0;
  s.finger.blocked = s.finger.down; // a finger still down from the last job must lift before it touches this one
  s.events.push({ e: 'next', kinds: c.kinds, regular: c.regular, fresh: c.fresh, tutor: c.tutor, golden: c.golden });
}

// A map level's goal: how far along each part is, and whether it is met.
export function goalState(s) {
  const g = s.lv?.goal;
  if (!g) return null;
  const parts = [];
  if (g.list) parts.push({ kind: 'list', have: s.served, need: g.list.length });
  if (g.fix) parts.push({ kind: 'fix', have: s.served, need: g.fix });
  if (g.coins) parts.push({ kind: 'coins', have: s.coins, need: g.coins });
  return { parts, met: parts.every(p => p.have >= p.need), time: g.time ?? null, safe: !!(g.safe || g.list) };
}
// Stars for a cleared level: 3 at or under the first star time, 2 at or under the second, else 1. 0 when not cleared.
export function stars(s) {
  if (!s.lv || !s.cleared) return 0;
  const [t3, t2] = s.lv.stars;
  return s.clearT <= t3 + 1e-9 ? 3 : s.clearT <= t2 + 1e-9 ? 2 : 1;
}

export function input(s, ev) {
  if (s.over) return;
  const f = s.finger;
  const { type, x, y } = ev;
  if (type === 'down') { f.down = true; f.blocked = false; }
  else if (type === 'up' || type === 'cancel') {
    const was = f.blocked; f.down = false; f.blocked = false;
    if (was) return;
  } else if (!f.down || f.blocked) return; // a mouse moving with no button pressed, or a finger left over from the last job
  f.x = x; f.y = y;
  if (s.phase !== 'work' || !s.rep) return;
  const r = s.rep, k = K[r.kind];
  if (type === 'down') {
    const hit = k.down(r, x, y, s);
    if (!hit) { s.events.push({ e: 'miss', x, y }); r.idle = Math.max(r.idle, HINT_AFTER); } // a wasted tap shows the hint at once
    else s.events.push({ e: 'grab', kind: r.kind, x, y });
  } else if (type === 'move') k.move(r, x, y, s);
  else { k.up(r, s, type); s.events.push({ e: 'lift', kind: r.kind }); }
  settle(s);
}

// After input or a tick: progress resets the idle clock; a finished repair moves the job on.
function settle(s) {
  const r = s.rep;
  if (!r || s.phase !== 'work') return;
  if (r.p > r.best + 1e-9) { r.best = r.p; r.idle = 0; }
  if (r.p >= 1 && !r.done) {
    r.done = true;
    s.events.push({ e: 'fixed', kind: r.kind, step: s.stepN });
    if (s.stepN + 1 < s.reps.length) {
      s.stepN++; s.rep = s.reps[s.stepN];
      s.finger.blocked = s.finger.down;
      s.events.push({ e: 'step', kind: s.rep.kind });
    } else pay(s);
  }
}

function pay(s) {
  const c = s.cust;
  let base = c.kinds.reduce((a, k) => a + COIN[k], 0);
  const quick = c.left / c.patience >= 0.5;
  if (quick) { s.streak++; base += QUICK_BONUS; } else s.streak = 0;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  const coins = base * multiplier(s) * (c.regular ? 2 : 1) * (c.golden ? GOLDEN_PAY : 1);
  s.coins += coins; s.served++;
  s.log.push({ kind: c.kinds.join('+'), ms: Math.round((c.patience - c.left) * 1000), ok: true, ...(c.golden ? { golden: true } : {}) });
  s.phase = 'works'; s.phaseT = WORKS;
  s.events.push({ e: 'paid', coins, quick, kinds: c.kinds, mult: multiplier(s), regular: c.regular, golden: c.golden, streak: s.streak });
  if (s.lv && !s.cleared && goalState(s).met) { // the level's clock stops the moment the goal is met
    s.cleared = true; s.clearT = s.clock;
    s.events.push({ e: 'goal', secs: s.clearT, stars: stars(s) });
  }
}

export function step(s) {
  if (s.over) return;
  s.t += DT;
  const c = s.cust;
  if (!c.tutor && !s.cleared) s.clock += DT;
  if (s.clock >= s.day && s.phase === 'work') { end(s, 'time'); return; }
  const limit = s.lv?.goal.time;
  if (limit && !s.cleared && s.clock >= limit) { end(s, 'time'); return; }
  if (s.phase === 'work') {
    const r = s.rep;
    K[r.kind].tick(r, DT, s);
    r.idle += DT;
    c.left -= DT;
    settle(s);
    if (s.phase === 'work' && c.left <= 0) {
      c.left = 0; s.hearts--; s.lost++; s.streak = 0;
      s.log.push({ kind: c.kinds.join('+'), ms: Math.round(c.patience * 1000), ok: false, ...(c.golden ? { golden: true } : {}) });
      s.phase = 'leave'; s.phaseT = LEAVE;
      s.events.push({ e: 'lost', hearts: s.hearts });
    }
    return;
  }
  s.phaseT -= DT;
  if (s.phaseT > 0) return;
  if (s.cleared) { end(s, 'clear'); return; }
  if (s.hearts <= 0) { end(s, 'hearts'); return; }
  if (s.lv && s.lost > 0 && goalState(s).safe) { end(s, 'lost'); return; } // a set list, or "nobody walks off"
  if (s.clock >= s.day) { end(s, 'time'); return; }
  if (!s.queue.length) { end(s, 'lost'); return; } // a set list ran out with someone not fixed
  nextCustomer(s);
}

function end(s, why) {
  s.over = why;
  s.events.push({ e: 'over', why, stars: stars(s) });
}

// For the page: whether a hint should show, and how strongly. `seen` is how many times this kind was shown before.
export function hint(s, seen) {
  const r = s.rep;
  if (!r || s.phase !== 'work') return 0;
  if (seen < 2 && r.best < 0.05) return 1; // the first two times: the ghost finger until the job starts moving
  if (seen < 2 && r.idle > 0.6) return 1;
  return r.idle > HINT_AFTER ? 0.5 : 0;
}
