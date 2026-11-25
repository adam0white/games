// The plates. Plates 1–6 keep the glass, cut and lamp of the first version; their receivers moved so that every
// receiver on a plate is fed at one setting (the chord rule). Each later plate adds one idea from real optics.
// answer: the hidden control values the receivers are placed from (the tracer puts each receiver where its colour
// lands), so every plate is solvable by construction. start: where the controls begin. width: receiver half-width
// in radians. receivers: [band (-1 white), { src, order, swing, period, width }].
const C = [180, 196];
const lamp = (dy = 0, extra = {}) => ({ at: [13, 196 + dy], ...extra });
const prism = (cut, extra = {}) => ({ kind: 'prism', cut, at: C, ...extra });
const EQ = [0, 120, 240];

export const LEVELS = [
  { id: 1, key: 'p1', idea: 'dispersion', sources: [lamp()], parts: [prism(EQ, { turn: [27.48, 56.92] })], receivers: [[-1]], width: .20, answer: [.79], start: [.08] },
  { id: 2, key: 'p2', idea: 'chord', sources: [lamp(-9)], parts: [prism(EQ, { turn: [-57, 71] })], receivers: [[0], [5]], width: .09, answer: [.715], start: [.08] },
  { id: 3, key: 'p3', idea: 'tir', sources: [lamp(8)], parts: [prism([-5, 92, 224], { turn: [-57, 71] })], receivers: [[1], [5]], width: .085, answer: [.735], start: [.08] },
  { id: 4, key: 'p4', idea: 'three', sources: [lamp(-11)], parts: [prism([8, 132, 240], { turn: [-57, 71] })], receivers: [[0], [4], [5]], width: .075, answer: [.70], start: [.08] },
  { id: 5, key: 'p5', idea: 'facets', sources: [lamp(14)], parts: [prism([0, 26, 120, 240], { turn: [-57, 71] })], receivers: [[1], [5]], width: .075, answer: [.256], start: [.86] },
  { id: 6, key: 'p6', idea: 'edge', sources: [lamp(2)], parts: [prism([-11, 105, 228], { turn: [-57, 71] })], receivers: [[1], [5]], width: .075, answer: [.279], start: [.95] },
  { id: 7, key: 'p7', idea: 'mirror', sources: [lamp(-40)], parts: [
    { kind: 'mirror', at: [96, 156], len: 34, turn: [2, 34] },
    prism(EQ, { angle: 10 }),
  ], receivers: [[0], [5]], width: .08, answer: [.55], start: [.08] },
  { id: 8, key: 'p8', idea: 'mirrorPrism', sources: [lamp(-40)], parts: [
    { kind: 'mirror', at: [96, 156], len: 34, turn: [2, 34] },
    prism(EQ, { turn: [-57, 71] }),
  ], receivers: [[1], [5]], width: .12, answer: [.646, .54], start: [.15, .9] },
  { id: 9, key: 'p9', idea: 'twoBeams', sources: [lamp(-26), lamp(30)], parts: [prism(EQ, { turn: [-57, 71] })],
    receivers: [[0, { src: 0 }], [5, { src: 1 }]], width: .08, answer: [.72], start: [.08] },
  { id: 10, key: 'p10', idea: 'filter', sources: [lamp(-26), lamp(30)], parts: [
    { kind: 'filter', band: 2, at: [52, 226], len: 22, angle: 90 },
    prism(EQ, { turn: [-57, 71] }),
  ], receivers: [[0, { src: 0 }], [2, { src: 1 }], [5, { src: 0 }]], width: .075, answer: [.72], start: [.3] },
  { id: 11, key: 'p11', idea: 'slide', sources: [lamp()], parts: [prism(EQ, { at: [180, 150], slide: [180, 242], turn: [-57, 71] })],
    receivers: [[0], [5]], width: .08, answer: [.724, .434], start: [.23, .13] },
  { id: 12, key: 'p12', idea: 'porro', sources: [lamp(-136)], parts: [
    prism([0, 90, 180], { at: [180, 60], r: 30, turn: [38, 52] }),
    prism(EQ, { turn: [-57, 71] }),
  ], receivers: [[0], [5]], width: .08, answer: [.78, .538], start: [.4, .22] },
  { id: 13, key: 'p13', idea: 'lens', sources: [lamp()], parts: [
    { kind: 'lens', at: [86, 150], slide: [86, 242], len: 60, f: 60, angle: 90 },
    prism(EQ, { angle: 30 }),
  ], receivers: [[1], [5]], width: .08, answer: [.44], start: [.75] },
  { id: 14, key: 'p14', idea: 'recombine', sources: [lamp()], parts: [
    prism(EQ, { at: [110, 196], r: 40, angle: 48 }),
    prism(EQ, { at: [178, 252], r: 40, turn: [78, 138] }),
  ], receivers: [[-1]], width: .065, answer: [.59], start: [.24] },
  { id: 15, key: 'p15', idea: 'grating', sources: [lamp()], parts: [{ kind: 'grating', at: C, len: 80, pitch: 1700, turn: [50, 130] }],
    receivers: [[0, { order: 1 }], [5, { order: -1 }]], width: .045, answer: [.112], start: [.55] },
  { id: 16, key: 'p16', idea: 'moving', sources: [lamp(-9)], parts: [prism(EQ, { turn: [-57, 71] })],
    receivers: [[0], [5, { swing: .3, period: 6 }]], width: .08, answer: [.715], start: [.08] },
  { id: 17, key: 'p17', idea: 'gratingMirror', sources: [lamp(-40)], parts: [
    { kind: 'mirror', at: [96, 156], len: 34, turn: [2, 34] },
    { kind: 'grating', at: [190, 206], len: 80, pitch: 1700, turn: [60, 140] },
  ], receivers: [[0, { order: 1 }], [5, { order: 1 }], [-1, { order: 0 }]], width: .12, answer: [.236, .162], start: [.7, .3] },
  { id: 18, key: 'p18', idea: 'orders', sources: [lamp(-40)], parts: [
    { kind: 'mirror', at: [96, 156], len: 34, turn: [2, 34] },
    { kind: 'grating', at: [190, 206], len: 80, pitch: 1800, orders: [-2, -1, 0, 1, 2], turn: [60, 140] },
  ], receivers: [[-1, { order: 0 }], [0, { order: 1 }], [5, { order: 2 }]], width: .07, answer: [.178, .231], start: [.66, .59] },
];
