// Thumb Duel: the bots. Pure, like sim.js: the page's solo opponent and the test bots in bots.mjs are the same code.
// A bot sees the duel late (its reaction time), through the same view a person has, and answers with the same input
// a finger gives. Its own seeded stream decides its lapses and mistakes, apart from the rules' RNG.
import { DT, rand, mirror, blank, PADS, HOCKEY } from './sim.js';

// The fastest a thumb taps (per second) and the quickest reaction (s). No bot goes past these.
export const THUMB = { rate: 8.5, react: 0.18 };
// react: s before it sees anything; jit: extra random reaction; rate: taps per second; early: chance of jumping the gun;
// miss: chance of letting a chance go; err: chance of a wrong pad; speed: paddle speed (board units/s); lead: how far
// ahead it reads a rolling drop (s); smart: how often it plays the clever move in sumo; lapse: daydreams per second.
export const SKILLS = {
  easy:    { react: 0.62, jit: 0.25, rate: 3.6, early: 0.22, miss: 0.25, err: 0.12, speed: 1.6, lead: 0.12, smart: 0.15, lapse: 0.35 },
  clumsy:  { react: 0.48, jit: 0.2,  rate: 4.8, early: 0.15, miss: 0.15, err: 0.08, speed: 2.4, lead: 0.2,  smart: 0.3,  lapse: 0.25 },
  medium:  { react: 0.45, jit: 0.18, rate: 5.05, early: 0.13, miss: 0.13, err: 0.07, speed: 2.65, lead: 0.22, smart: 0.36, lapse: 0.21 },
  hard:    { react: 0.33, jit: 0.12, rate: 6.3, early: 0.06, miss: 0.05, err: 0.035, speed: 3.9, lead: 0.31, smart: 0.7,  lapse: 0.08 },
  careful: { react: 0.21, jit: 0.07, rate: 8.0, early: 0.015, miss: 0.01, err: 0.012, speed: 5.6, lead: 0.38, smart: 0.95, lapse: 0.02 },
  'slow-human': { react: 0.35, jit: 0.25, rate: 3.9, early: 0.22, miss: 0.25, err: 0.12, speed: 1.8, lead: 0.12, smart: 0.24, lapse: 0.35 },
};
export const STRENGTHS = ['easy', 'medium', 'hard']; // the page's three bots, in order: the solo levels

// What a player on `side` sees of the duel, in that side's own frame (y > 0 is toward them).
const VIEW = {
  tug: () => ({}),
  draw: (d) => ({ st: d.st, n: d.flashes }),
  sumo: (d, side) => ({ held: d.held[side], oppHeld: d.held[1 - side], oppStun: d.stun[1 - side] > 0, stam: d.stam[side], stun: d.stun[side] > 0 }),
  catch: (d, side) => { const [x, y] = mirror(side, d.x, d.y); return { x, y, hidden: d.mode === 'hidden', stun: d.stun[side] > 0 }; },
  hockey: (d, side) => {
    const [x, y] = mirror(side, d.puck.x, d.puck.y), s = side === 0 ? 1 : -1;
    const [ox] = mirror(side, d.pads[1 - side].x, d.pads[1 - side].y);
    return { x, y, vx: d.puck.vx * s, vy: d.puck.vy * s, ox };
  },
  memory: (d) => ({ st: d.st, round: d.round, seq: d.seq }),
  balance: (d, side) => ({ x: d.x[side], v: d.v[side], fall: d.fall[side] > 0 }),
  swipe: () => ({}),
  launch: (d, side) => ({ shot: d.shots[side], target: d.targets[d.shots[side]] }),
};

export function makeBot(skill, seed = 1) {
  if (typeof skill === 'string') skill = SKILLS[skill];
  const box = { r: (Math.imul(seed + 1, 2654435761) >>> 0) || 3 };
  const react = Math.max(THUMB.react, skill.react), rate = Math.min(THUMB.rate, skill.rate);
  let duel = null, hist = [], m = {};
  const seen = (extra = 0) => { const k = hist.length - 1 - Math.round(react / DT) - extra; return k >= 0 ? hist[k] : null; };
  const jitter = () => Math.round(rand(box) * skill.jit / DT);
  const out = (side, held, tap, px = null, py = null) => {
    const inp = blank(); inp.held = held;
    if (tap) { const [x, y] = tap === true ? mirror(side, 0.5, 0.5) : mirror(side, tap[0], tap[1]); inp.taps.push({ x, y }); }
    if (px !== null) { const [x, y] = mirror(side, px, py); inp.px = x; inp.py = y; }
    return inp;
  };
  const lapsing = () => {
    if (m.lapse > 0) { m.lapse -= DT; return true; }
    if (rand(box) < skill.lapse * DT) { m.lapse = 0.3 + rand(box) * 0.4; return true; }
    return false;
  };
  const POLICY = {
    tug(s, side) {
      if (m.next === undefined) m.next = react + rand(box) * skill.jit;
      m.next -= DT;
      if (lapsing() || m.next > 0) return out(side, false, null);
      m.next = (0.75 + 0.5 * rand(box)) / rate;
      return out(side, false, true);
    },
    draw(s, side) {
      const v = seen(m.extra ?? 0), now = s.d;
      if (m.n !== now.flashes) { // a new flash: decide now whether this one jumps the gun, and when
        m.n = now.flashes; m.fired = false; m.extra = jitter();
        m.earlyAt = rand(box) < skill.early ? 0.6 + rand(box) * 2.4 : null; m.waited = 0;
      }
      if (now.st === 'wait') m.waited += DT;
      if (m.fired) return out(side, false, null);
      if (m.earlyAt !== null && now.st === 'wait' && m.waited >= m.earlyAt) { m.fired = true; return out(side, true, true); }
      if (v && v.n === now.flashes && v.st === 'lit') {
        m.fired = true; return out(side, true, true);
      }
      return out(side, false, null);
    },
    sumo(s, side) {
      const v = seen(); if (!v) return out(side, false, null);
      const me = s.d, held = me.held[side];
      m.t = (m.t ?? 0) + DT;
      if (m.plan === 'tap') { m.plan = null; return out(side, false, null); } // let go for one tick: the next press is a shove
      if (m.rest > 0) { m.rest -= DT; if (m.rest > 0) return out(side, false, null); }
      if (lapsing()) return out(side, held, null);
      const smart = rand(box) < skill.smart;
      if (v.oppStun && held && smart && !m.punished) { m.punished = true; m.plan = 'tap'; return out(side, false, null); } // shove the dazed beetle
      if (!v.oppStun) m.punished = false;
      if (!held) { // not holding: press when the other is braced (a shove lands), or when being pushed
        if (v.oppHeld || !smart || m.t > 1.0) { m.t = 0; return out(side, true, null); }
        return out(side, false, null);
      }
      if (v.stam < 0.12 && (!v.oppHeld || !smart)) { m.rest = 0.5 + rand(box) * 0.4; return out(side, false, null); }
      // now and then let go briefly: a dodge if the other shoves just then, and a fresh shove after it
      if (m.t > 0.9 + rand(box) * 1.4 && v.stam > 0.3 && (v.oppHeld || !smart)) { m.t = 0; m.rest = smart ? 0.12 + rand(box) * 0.1 : 0.3 + rand(box) * 0.4; return out(side, false, null); }
      return out(side, true, null);
    },
    catch(s, side) {
      const v = seen(m.extra ?? 0); if (!v) return out(side, false, null);
      const mine = !v.hidden && v.y > 0.04;
      if (!mine) { m.visit = false; m.extra = jitter(); m.skip = rand(box) < skill.miss; }
      if (v.stun || lapsing()) return out(side, false, null);
      if (mine && !m.visit) { m.visit = true; if (!m.skip) return out(side, false, true); }
      // jumping the gun: the firefly is coming close to the middle, so tap a moment early
      if (!mine && !v.hidden && v.y > -0.14 && rand(box) < skill.early * DT * 6) return out(side, false, true);
      return out(side, false, null);
    },
    hockey(s, side) {
      const v = seen();
      if (!m.pad) m.pad = [0.5, 0.78];
      if (!v) return out(side, true, null, m.pad[0], m.pad[1]);
      const ahead = react * Math.min(1, skill.lead * 2.6); // how far ahead it guesses where the seed will be
      let x = v.x + v.vx * ahead, y = v.y + v.vy * ahead;
      if (x < 0) x = -x; if (x > 1) x = 2 - x;
      let tx, ty;
      if (y > -0.05) {
        if (m.pad[1] > y + 0.03) { // behind the seed: strike through it toward the far goal
          const aimX = v.ox < 0.5 ? 0.5 + HOCKEY.goal * 0.55 : 0.5 - HOCKEY.goal * 0.55; // the side of the goal the keeper is not on
          const gx = aimX - x, gy = -1 - y, gl = Math.hypot(gx, gy);
          tx = x + gx / gl * 0.1; ty = y + gy / gl * 0.1;
        } else { tx = x + (x < 0.5 ? 0.12 : -0.12); ty = y + 0.2; } // get round behind it
      } else { tx = 0.5 + (x - 0.5) * 0.45; ty = 0.8; } // guard the goal
      if (m.aimT === undefined || (m.aimT -= DT) <= 0) { m.aimT = 0.3; m.aim = [(rand(box) - 0.5) * (1 - skill.smart) * 0.25, (rand(box) - 0.5) * (1 - skill.smart) * 0.25]; }
      tx += m.aim[0]; ty += m.aim[1];
      if (lapsing()) { tx = m.pad[0]; ty = m.pad[1]; }
      const dx = tx - m.pad[0], dy = ty - m.pad[1], dl = Math.hypot(dx, dy), mx = skill.speed * DT, k = dl > mx ? mx / dl : 1;
      m.pad = [Math.max(HOCKEY.pad, Math.min(1 - HOCKEY.pad, m.pad[0] + dx * k)), Math.max(HOCKEY.pad * 0.6, Math.min(1 - HOCKEY.pad, m.pad[1] + dy * k))];
      return out(side, true, null, m.pad[0], m.pad[1]);
    },
    memory(s, side) {
      const v = seen(); if (!v) return out(side, false, null);
      if (v.st !== 'answer' || s.d.st !== 'answer') { m.i = 0; m.wait = jitter() * DT + 0.25; return out(side, false, null); }
      if (m.round !== v.round) { m.round = v.round; m.i = 0; }
      if (m.i >= v.seq.length) return out(side, false, null);
      m.wait -= DT;
      if (m.wait > 0) return out(side, false, null);
      m.wait = (1.3 + rand(box) * 0.9) / rate;
      let pad = v.seq[m.i++];
      if (rand(box) < skill.err) pad = (pad + 1 + Math.floor(rand(box) * 3)) % 4;
      const p = PADS[pad];
      return out(side, true, [p.x + (rand(box) - 0.5) * 0.08, p.y + (rand(box) - 0.5) * 0.08]);
    },
    balance(s, side) {
      const v = seen(); if (!v || v.fall) return out(side, false, null);
      if (lapsing()) return out(side, m.held ?? false, null);
      const xp = v.x + v.v * (skill.lead + react); // where the drop will be by the time a change takes hold
      if (xp < -0.06) m.held = true; else if (xp > 0.06) m.held = false;
      if (rand(box) < (1 - skill.smart) * DT * 2) m.held = !m.held;
      return out(side, m.held ?? false, null);
    },
    swipe(s, side) {
      const inp = blank();
      if (m.next === undefined) m.next = react + rand(box) * skill.jit;
      m.next -= DT;
      if (m.stroke === undefined && m.next <= 0 && !lapsing()) {
        m.stroke = 0; m.travel = 0.12 + rand(box) * 0.11;
        m.flick = rand(box) >= skill.miss;
      }
      if (m.stroke === undefined) return inp;
      m.stroke += DT;
      const [x0, y0] = mirror(side, 0.5, 0.77);
      const [x, y] = mirror(side, 0.5, 0.77 - (m.flick ? 0.4 : 0.13) * Math.min(1, m.stroke / m.travel));
      if (m.stroke < m.travel) return { ...inp, held: true, px: x, py: y, heldFor: m.stroke };
      inp.releases.push({ x0, y0, x, y, seconds: m.stroke });
      m.stroke = undefined;
      m.next = 0.18 + 1.35 / rate + react * 0.34 + rand(box) * skill.jit;
      return inp;
    },
    launch(s, side) {
      const inp = blank(), v = seen();
      if (!v || v.target === undefined || v.shot === m.shot) return inp;
      if (m.charge === undefined) {
        m.charge = 0;
        m.duration = v.target + (rand(box) * 2 - 1) * (0.055 + (1 - skill.smart) * 0.38);
      }
      m.charge += DT;
      if (m.charge < m.duration) return { ...inp, held: true, heldFor: m.charge };
      inp.releases.push({ seconds: m.charge });
      m.charge = undefined; m.shot = v.shot;
      return inp;
    },
  };
  return {
    skill,
    act(s, side) {
      if (s.phase !== 'play' || !s.d) { if (s.d !== duel) { duel = s.d; hist = []; m = {}; } return blank(); }
      if (s.d !== duel) { duel = s.d; hist = []; m = {}; }
      hist.push(VIEW[s.kind](s.d, side));
      if (hist.length > 120) hist.shift(); // keep the buffer short; seen() counts from the end
      return POLICY[s.kind](s, side);
    },
  };
}
