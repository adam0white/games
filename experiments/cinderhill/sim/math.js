// Integer maths for the sim. Every value here is the same on every JavaScript engine.
//
// Angles are 0..255 for a full turn: 0 points along +x, 64 along +y (y grows downward on both layers).
// The tables are committed literals, generated once outside the sim; computing them at load with Math.sin
// would bring back the cross-engine differences the sim exists to avoid.

export const ANGLES = 256;
export const TRIG_ONE = 4096; // SIN and COS are scaled by this

// sin(i * pi / 128) * 4096, rounded, for i = 0..64 (a quarter turn).
const QUARTER = [0, 101, 201, 301, 401, 501, 601, 700, 799, 897, 995, 1092, 1189, 1285, 1380, 1474, 1567, 1660, 1751, 1842,
  1931, 2019, 2106, 2191, 2276, 2359, 2440, 2520, 2598, 2675, 2751, 2824, 2896, 2967, 3035, 3102, 3166, 3229, 3290, 3349, 3406,
  3461, 3513, 3564, 3612, 3659, 3703, 3745, 3784, 3822, 3857, 3889, 3920, 3948, 3973, 3996, 4017, 4036, 4052, 4065, 4076, 4085,
  4091, 4095, 4096];

export const SIN = new Int16Array(ANGLES);
export const COS = new Int16Array(ANGLES);
for (let a = 0; a < ANGLES; a++) {
  const q = a & 63, quadrant = a >> 6;
  const s = quadrant === 0 ? QUARTER[q] : quadrant === 1 ? QUARTER[64 - q] : quadrant === 2 ? -QUARTER[q] : -QUARTER[64 - q];
  SIN[a] = s;
}
for (let a = 0; a < ANGLES; a++) COS[a] = SIN[(a + 64) & 255];

// atan(t / 32) in angle units (256 a turn), rounded, for t = 0..32.
const ATAN = [0, 1, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 25, 26, 27, 28, 29, 29, 30, 31, 31, 32];

/** Direction of (dx, dy) in angle units 0..255, from integers only. (0, 0) gives 0. Accurate to about 1 unit. */
export function angleOf(dx, dy) {
  const ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy;
  if (ax === 0 && ay === 0) return 0;
  // a: angle of (ax, ay) in the first quadrant, 0..64.
  let a;
  if (ax >= ay) a = ATAN[Math.floor((ay * 32 + (ax >> 1)) / ax)];
  else a = 64 - ATAN[Math.floor((ax * 32 + (ay >> 1)) / ay)];
  if (dx >= 0 && dy >= 0) return a & 255;
  if (dx < 0 && dy >= 0) return (128 - a) & 255;
  if (dx < 0) return (128 + a) & 255;
  return (256 - a) & 255;
}

/** Signed shortest turn from angle a to angle b, -128..127. */
export function turnTo(a, b) {
  return ((b - a + 128) & 255) - 128;
}
