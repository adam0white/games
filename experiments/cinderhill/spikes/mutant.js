// The planted fault for spike S2: floating-point Math inside the ant step, the kind of code the lint bans
// from sim/. After each ant's step it reads the last mantissa bit of Math.sin(...) and, when set, turns the
// ant one angle unit. Engines whose sin differs by one unit in the last place for some argument then
// diverge. It lives outside sim/ on purpose; plant() patches the class and returns the undo.
import { Sim } from '../sim/sim.js';

const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);

export function plant() {
  const original = Sim.prototype.stepAnt;
  Sim.prototype.stepAnt = function (i) {
    original.call(this, i);
    f64[0] = Math.sin(i * 0.7310585786300049 + this.g[0] * 1.3700000000000001 + 0.5);
    if (u32[0] & 1) this.heading[i] = (this.heading[i] + 1) & 255;
  };
  return () => { Sim.prototype.stepAnt = original; };
}
