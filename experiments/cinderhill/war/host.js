// Runs the war sim at a fixed 20 ticks a second for a page or a test: takes the seats' orders, lets the rival think,
// keeps the order log and a hash trail, and holds each ant's last position so a page can draw between ticks.

import { Sim, TICK_HZ, TEAMS } from './sim.js';
import { think, THINK_EVERY } from './ai.js';

export const TICK_MS = 1000 / TICK_HZ;

export class Host {
  /** options: the sim's, plus ai: { [team]: mood } for the seats the machine plays (default: team 1, steady). */
  constructor(options = {}) {
    const { ai = { 1: 1 }, ...cfg } = options;
    this.sim = new Sim(cfg); this.ai = ai;
    this.log = []; this.hashes = []; this.events = [];
    this.acc = 0; this.alpha = 0; this.nextOrder = 1;
    const A = this.sim.cfg.maxAnts;
    this.px = new Uint16Array(A); this.py = new Uint16Array(A); this.pid = new Int32Array(A); this.pl = new Uint8Array(A); this.pn = 0;
  }

  /** Queue an order for the next tick and log it. Returns its id. */
  order(o) {
    const e = this.sim.order({ ...o, id: this.nextOrder++ });
    this.log.push(e);
    return e.id;
  }

  tick() {
    const s = this.sim;
    if (s.tick % THINK_EVERY === 0) for (let t = 0; t < TEAMS; t++) if (this.ai[t] != null) for (const o of think(s, t, this.ai[t])) this.order(o);
    this.px.set(s.x.subarray(0, s.n)); this.py.set(s.y.subarray(0, s.n)); this.pid.set(s.id.subarray(0, s.n)); this.pl.set(s.layer.subarray(0, s.n)); this.pn = s.n;
    s.step();
    if (s.tick % 600 === 0) this.hashes.push([s.tick, s.hash()]);
    const ev = s.drainEvents();
    for (let k = 0; k < ev.length; k++) this.events.push(ev[k]);
  }

  /** Advance by real time; at most `max` ticks a call. Returns the ticks run. */
  advance(ms, speed = 1, max = 8) {
    if (this.sim.result) { this.alpha = 1; return 0; }
    this.acc += ms * speed;
    let ran = 0;
    while (this.acc >= TICK_MS && ran < max && !this.sim.result) { this.tick(); this.acc -= TICK_MS; ran++; }
    if (this.acc > TICK_MS) this.acc = TICK_MS;
    this.alpha = this.acc / TICK_MS;
    return ran;
  }

  run(ticks) { for (let k = 0; k < ticks && !this.sim.result; k++) this.tick(); return this; }
  drain() { const e = this.events; this.events = []; return e; }
}
