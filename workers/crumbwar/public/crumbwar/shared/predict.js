// Client-side prediction for the player's own ant. The page (and the load-test client) steps this 20 times a
// second. It moves the ant at once with move.js, sends an input only when it changed, and after each snapshot
// rebuilds the ant from the server's state plus the inputs the server had not yet applied.
//
// How the two clocks are matched without sharing one: every input has a sequence number. A snapshot says which
// input the server used last (ackSeq) and for how many ticks it has used it (applied). The page knows the
// local tick on which it first used that input, so the server's state equals the page's own state after local
// tick `first + applied - 1`. Every local tick after that is replayed.
import { stepMove, angleOf } from './move.js';
import { writeInput } from './proto.js';

export class Predictor {
  constructor(mode = 'classic') {
    this.mode = mode;
    this.tick = 0; this.seq = 0; this.sent = -1; this.hist = new Uint16Array(256); this.ringSeq = new Int32Array(256).fill(-1); this.ringTick = new Int32Array(256);
    this.me = { mode, mass: 10, x: 0, y: 0, heading: 0, stamina: 100, tier: 0, carry: 0, alive: false };
    this.ex = 0; this.ey = 0; // what is left of the last correction, for the page to fade out
    this.cur = 0; this.replayed = 0; this.corrected = 0;
  }
  // One local tick. Returns the bytes to send, or null when the input is the one already sent.
  step(angle, move, sprint) {
    this.tick++;
    let out = null;
    const last = this.cur, da = Math.abs(((angle - (last & 255) + 128) & 255) - 128);
    const flags = (move ? 1 : 0) | (sprint ? 2 : 0);
    // A turn of one step (1.4 degrees) is not worth a message; the ant keeps the angle it sent.
    if (this.sent < 0 || flags !== last >> 8 || (move && da >= 2)) {
      this.cur = angle | flags << 8; this.seq = this.seq % 65535 + 1; this.sent = this.seq;
      this.ringSeq[this.seq & 255] = this.seq; this.ringTick[this.seq & 255] = this.tick;
      out = writeInput(this.seq, angle, move, sprint);
    }
    this.hist[this.tick & 255] = this.cur;
    if (this.me.alive) stepMove(this.me, this.cur & 255, !!(this.cur >> 8 & 1), !!(this.cur >> 8 & 2));
    return out;
  }
  onSnap(s) {
    const m = this.me, px = m.x, py = m.y, was = m.alive;
    m.mass = s.mass ?? 10; m.boost = (s.boostLeft ?? 0) > 0; m.x = s.x; m.y = s.y; m.heading = angleOf(s.heading); m.stamina = s.stamina; m.tier = s.tier; m.carry = s.carry; m.alive = s.alive;
    let n = 0;
    if (s.alive && this.ringSeq[s.ackSeq & 255] === s.ackSeq && s.ackSeq > 0) {
      const from = this.ringTick[s.ackSeq & 255] + s.applied;
      if (this.tick - from < 60) for (let t = from; t <= this.tick; t++, n++) { const i = this.hist[t & 255]; stepMove(m, i & 255, !!(i >> 8 & 1), !!(i >> 8 & 2)); }
    }
    this.replayed = n;
    const dx = px - m.x, dy = py - m.y, d = Math.hypot(dx, dy);
    this.corrected = was && s.alive ? d : 0;
    if (was && s.alive && d < 120) { this.ex += dx; this.ey += dy; } else { this.ex = 0; this.ey = 0; }
  }
}
