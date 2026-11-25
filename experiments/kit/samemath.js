// The same bits on every phone. `Math.exp`, `Math.sin` and `Math.hypot` are allowed to differ in the last bit between
// JavaScript engines, and they do: on 2026-11-24 WebKit (iPhone) and Chromium each differed from Node's V8 on 5-37% of
// 20,000 arguments. Two phones that run one seeded game in lockstep must compute every number the same way, or the
// game slowly comes apart. These versions use only + - * / and Math.sqrt, which every engine rounds the same way
// (IEEE 754, round to nearest), plus Math.floor. They follow fdlibm (Sun, 1993) and agree with Math to within a few
// units in the last place, so a game's rules do not change; the point is that they agree with each other everywhere.
// Pure: no window, no document. A game's sim takes them through its own switch (Thumb Duel: `useMath` in sim.js).
//   import { sameMath } from '../kit/samemath.js';   sameMath.exp(x) · sameMath.sin(x) · sameMath.cos(x) · sameMath.hypot(x, y)

const LN2_HI = 6.93147180369123816490e-01, LN2_LO = 1.90821492927058770002e-10, INV_LN2 = 1.44269504088896338700e+00;
const P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05,
  P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08;

// 2^k exactly, by writing the exponent bits (k from -1022 to 1023).
const bits = new DataView(new ArrayBuffer(8));
function pow2(k) { bits.setUint32(0, ((k + 1023) << 20) >>> 0); bits.setUint32(4, 0); return bits.getFloat64(0); }
function scale(y, k) { // y * 2^k without leaving the exact range of pow2
  if (k > 1023) return y * pow2(1023) * pow2(k - 1023);
  if (k < -1022) return y * pow2(k + 1000) * pow2(-1000);
  return y * pow2(k);
}

export function exp(x) {
  if (x !== x) return NaN;
  if (x > 7.09782712893383973096e+02) return Infinity;
  if (x < -7.45133219101941108420e+02) return 0;
  const ax = x < 0 ? -x : x, neg = x < 0;
  let hi = 0, lo = 0, k = 0;
  if (ax > 0.34657359027997264) { // |x| > ln2 / 2: reduce to x = k ln2 + r
    if (ax < 1.03972077083991796) { hi = neg ? x + LN2_HI : x - LN2_HI; lo = neg ? -LN2_LO : LN2_LO; k = neg ? -1 : 1; }
    else { k = Math.trunc(INV_LN2 * x + (neg ? -0.5 : 0.5)); hi = x - k * LN2_HI; lo = k * LN2_LO; }
    x = hi - lo;
  } else if (ax < 3.725290298461914e-9) return 1 + x;
  const t = x * x, c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2) - x);
  return scale(1 - ((lo - (x * c) / (2 - c)) - hi), k);
}

const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04,
  S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05,
  C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
const kSin = x => { const z = x * x, v = z * x, r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6))); return x + v * (S1 + z * r); };
const kCos = x => { const z = x * x, r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6))))); return 1 - (0.5 * z - z * r); };
// pi/2 in three parts (fdlibm's pio2_1, pio2_2, pio2_2t), so r = x - n pi/2 keeps its bits for the arguments a game uses.
const PIO2_1 = 1.57079632673412561417e+00, PIO2_2 = 6.07710050630396597660e-11, PIO2_2T = 2.02226624879595063154e-21, INV_PIO2 = 6.36619772367581382433e-01;
function quadrant(x, shift) {
  if (x !== x || x === Infinity || x === -Infinity) return NaN;
  const n = Math.floor(x * INV_PIO2 + 0.5), r = ((x - n * PIO2_1) - n * PIO2_2) - n * PIO2_2T;
  switch ((((n + shift) % 4) + 4) % 4) { case 0: return kSin(r); case 1: return kCos(r); case 2: return -kSin(r); default: return -kCos(r); }
}
export const sin = x => quadrant(x, 0);
export const cos = x => quadrant(x, 1);
export const hypot = (x, y) => Math.sqrt(x * x + y * y);

export const sameMath = Object.freeze({ exp, sin, cos, hypot });
