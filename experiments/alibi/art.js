import { CRIME_ROOM } from './sim.js';

export const W = 360;
export const H = 640;
export const INK = '#342538';
export const CREAM = '#fff1ce';
export const GOLD = '#f7be69';
// The room sign in each room's top-left corner: centre offset and diameter.
export const SIGN = { x: 20, y: 20, size: 34 };
const WOOD = '#744654';
const roomWalls = ['#ffdbac', '#efb7ae', '#bcd6ac', '#b9cfda', '#d2be9e', '#d0badb'];
const roomFloors = ['#cb8265', '#ac7184', '#78a18b', '#779eaa', '#ab826a', '#9786af'];
const sets = [
  { sky: ['#221d36', '#795562', '#271f35'], walls: roomWalls, floors: roomFloors, edge: '#563645', trim: '#d69c85' },
  { sky: ['#3b2037', '#a45157', '#3b2434'], walls: ['#ffe3a3', '#ffd0ad', '#d7d1a3', '#f4bda3', '#e7bc91', '#e9c8b6'],
    floors: ['#b87e55', '#bd7865', '#8e996e', '#b47b64', '#ae825f', '#b1807f'], edge: '#753d43', trim: '#e6ae83' },
  { sky: ['#15283f', '#3c7d90', '#142a48'], walls: ['#ecd6ae', '#b5ccdb', '#b2ded1', '#b3cbdc', '#e9cc96', '#bbc4d8'],
    floors: ['#a28567', '#6b90a2', '#6b9d9f', '#6889a3', '#b19163', '#7a8da8'], edge: '#294a63', trim: '#e9c586' },
  { sky: ['#102c36', '#497563', '#172d34'], walls: ['#d0dcab', '#e0e0af', '#c3dfb5', '#c3d8ce', '#dcde99', '#bdd4a6'],
    floors: ['#819775', '#939f72', '#65977b', '#6c958b', '#969a6d', '#829776'], edge: '#315950', trim: '#d3d990' },
];

const animalColors = {
  rabbit: '#e9d3f6', fox: '#e59a55', bear: '#9e7163', owl: '#d9b37d',
  frog: '#95c879', cat: '#a6b5e8', mouse: '#a9ced1', hedgehog: '#ba8d6b',
};

export function rect(g, x, y, w, h, r, fill, line, weight = 1.5) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  paint(g, fill, line, weight);
}

function paint(g, fill, line, weight) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (line) { g.strokeStyle = line; g.lineWidth = weight; g.stroke(); }
}

function oval(g, x, y, rx, ry, fill, line, weight = 1.5) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  paint(g, fill, line, weight);
}

function path(g, points, fill, line, weight = 1.5) {
  g.beginPath();
  g.moveTo(...points[0]);
  for (const end of points.slice(1)) g.lineTo(...end);
  if (fill) g.closePath();
  paint(g, fill, line, weight);
}

export function text(g, value, x, y, size, color = CREAM, font = 'system-ui', align = 'center') {
  g.font = `700 ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(value, x, y);
}

export function star(g, x, y, size, fill, line) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI * i / 5 - Math.PI / 2;
    const r = i % 2 ? size * 0.48 : size;
    return [x + r * Math.cos(a), y + r * Math.sin(a)];
  });
  path(g, points, fill, line);
}

export function clock(g, x, y, r, minute) {
  oval(g, x, y, r, r, CREAM, INK, 1.7);
  for (let n = 0; n < 4; n++) {
    const a = n * Math.PI / 2;
    oval(g, x + r * .76 * Math.cos(a), y + r * .76 * Math.sin(a), .75, .75, '#976861');
  }
  const hand = (a, span, weight) => {
    path(g, [[x, y], [x + r * span * Math.sin(a), y - r * span * Math.cos(a)]], null, INK, weight);
  };
  hand((minute % 720) / 720 * 2 * Math.PI, .41, 2.4);
  hand((minute % 60) / 60 * 2 * Math.PI, .68, 1.6);
  oval(g, x, y, 1.6, 1.6, '#cb695d');
}

export function place(g, x, y, size, room, site = 0) {
  g.save();
  g.translate(x, y);
  g.scale(size / 30, size / 30);
  oval(g, 0, 0, 14, 14, sets[site].walls[room], INK, 1.5);
  if (room === 0) {
    rect(g, -8, -1, 16, 8, 2, '#fff1ce', INK);
    path(g, [[-11, -1], [11, -1]], null, INK);
    path(g, [[-4, -4], [-6, -7], [-4, -10]], null, INK, 1.2);
    path(g, [[3, -4], [1, -7], [3, -10]], null, INK, 1.2);
  } else if (room === 1) {
    // A low, wide sofa with round arms.
    rect(g, -9, -5, 18, 8, 3, '#c56f79', INK);
    rect(g, -9, 1, 18, 6, 2, '#de8a8f', INK);
    oval(g, -10, 2, 3.4, 5, '#a85465', INK, 1.3);
    oval(g, 10, 2, 3.4, 5, '#a85465', INK, 1.3);
    path(g, [[-8, 7], [-8, 9]], null, INK, 1.4);
    path(g, [[8, 7], [8, 9]], null, INK, 1.4);
  } else if (room === 2) {
    path(g, [[-8, 4], [8, 4], [4, 10], [-4, 10]], GOLD, INK);
    oval(g, -4, -2, 3, 5, '#80a66c', INK);
    oval(g, 4, -4, 3, 6, '#80a66c', INK);
    path(g, [[0, 4], [1, -2]], null, INK);
  } else if (room === 3) {
    // A painter's palette with three paints and a brush.
    g.beginPath();
    g.ellipse(-1, 1, 10.5, 8, -.3, 0, Math.PI * 2);
    paint(g, '#f2d39f', INK, 1.5);
    oval(g, -4, 5, 2.2, 2, sets[site].walls[room], INK, 1);
    oval(g, -5, -3, 2.1, 2.1, '#d6524f');
    oval(g, 1, -5, 2.1, 2.1, '#4f86c9');
    oval(g, 5, -1, 2.1, 2.1, '#5ea860');
    path(g, [[3, 9], [11, -8]], null, '#7a4a35', 2);
    path(g, [[10.5, -7], [12, -11]], null, INK, 2.4);
  } else if (room === 4) {
    // Books upright on a shelf.
    path(g, [[-10, 8], [10, 8]], null, INK, 1.8);
    rect(g, -9, -6, 5, 14, 1, '#4f86c9', INK, 1.2);
    rect(g, -4, -9, 5, 17, 1, GOLD, INK, 1.2);
    g.save(); g.translate(5, 1); g.rotate(.28);
    rect(g, -2.5, -8, 5, 15, 1, '#d6524f', INK, 1.2);
    g.restore();
  } else {
    rect(g, -9, -5, 18, 12, 2, GOLD, INK);
    path(g, [[-8, 0], [8, 0]], null, INK);
    rect(g, -2, -2, 4, 5, 1, CREAM, INK);
  }
  g.restore();
}

export function animal(g, x, y, size, species, { head = false, phase = 0, walk = 0, mask = null, mood = null, activity = null, facing = 1 } = {}) {
  const color = animalColors[species] || '#c98f86';
  g.save();
  g.translate(x, y);
  g.scale(size / 40 * facing, size / 40);
  const bob = head ? 0 : Math.sin(phase * 2) * (walk ? 2 : .6);
  g.translate(0, bob + (mood === 'hurt' ? 2 : 0));
  if (mood === 'hurt') g.rotate(-.13);
  if (!head) {
    oval(g, 0, 17 - bob, 13, 3, '#38233735');
    oval(g, -6 + walk * Math.sin(phase) * 2.5, 14, 4, 3, INK);
    oval(g, 6 - walk * Math.sin(phase) * 2.5, 14, 4, 3, INK);
    oval(g, 0, 8, 10.5, 9, species === 'frog' ? '#5d7c65' : '#a15961', INK);
    path(g, [[-5, 4], [0, 9], [6, 4]], '#f8d99e');
    if (activity !== null) idle(g, activity, phase);
    else {
      const swing = walk * Math.sin(phase) * 3;
      oval(g, -9, 8 - swing, 3, 3, color, INK, .9);
      oval(g, 9, 8 + swing, 3, 3, color, INK, .9);
    }
  }
  g.translate(0, head ? 2 : -5);
  if (mask !== null) {
    costume(g, 0, 0, 34, mask);
    g.restore();
    return;
  }
  if (species === 'rabbit') {
    for (const side of [-1, 1]) {
      oval(g, side * 6, -15, 4, 10, color, INK);
      oval(g, side * 6, -16, 1.6, 6, '#d594b1');
    }
  } else if (species === 'fox' || species === 'cat') {
    for (const side of [-1, 1]) {
      path(g, [[side * 5, -6], [side * 13, -19], [side * 16, -3]], color, INK);
      path(g, [[side * 9, -7], [side * 12, -14], [side * 14, -6]], '#975b69');
    }
  } else if (species === 'bear' || species === 'mouse') {
    const big = species === 'mouse';
    for (const side of [-1, 1]) {
      oval(g, side * 10, -8, big ? 7.7 : 5, big ? 7.7 : 5, color, INK);
      oval(g, side * 10, -8, big ? 4.7 : 2.1, big ? 4.7 : 2.1, '#e5a99e');
    }
  } else if (species === 'owl') {
    path(g, [[-13, -3], [-13, -14], [-3, -8], [3, -8], [13, -14], [13, -3]], color, INK);
  } else if (species === 'frog') {
    oval(g, -8, -7, 6.5, 7, color, INK);
    oval(g, 8, -7, 6.5, 7, color, INK);
  } else {
    path(g, [[-16, 4], [-19, -4], [-14, -4], [-16, -11], [-9, -9], [-8, -16], [-2, -11],
      [4, -16], [8, -11], [14, -11], [18, -3], [15, 5], [7, 10], [-8, 10]], '#997065', INK);
  }
  if (species === 'fox') {
    path(g, [[-16, -2], [-10, -9], [10, -9], [16, -2], [13, 5], [0, 11], [-13, 5]], color, INK);
    path(g, [[-13, 2], [-6, 1], [0, 5], [6, 1], [13, 2], [0, 10]], CREAM);
  } else {
    const skin = species === 'hedgehog' ? '#f3ca92' : color;
    oval(g, species === 'hedgehog' ? 2 : 0, species === 'frog' ? 3 : 1, species === 'mouse' ? 11 : 13,
      species === 'frog' ? 8 : 11, skin, INK);
    if (species === 'bear' || species === 'mouse') oval(g, 0, 5, 7, 4.6, '#ebc4a1');
    if (species === 'owl') for (const side of [-1, 1]) oval(g, side * 5.7, -1, 6, 7, '#fff1c8');
  }
  const blink = !head && phase % 37 > 36.5;
  for (const side of [-1, 1]) {
    const eye = species === 'frog' ? -7 : -1;
    oval(g, side * 5.8, eye, 1.5, blink ? .55 : 2, INK);
  }
  if (mood === 'hurt') {
    for (const side of [-1, 1]) path(g, [[side * 3, -5], [side * 9, -3]], null, INK, 1.35);
    path(g, [[-3, 8], [0, 6], [3, 8]], null, INK, 1.25);
    oval(g, 8, 4, 1.7, 2.7, '#bce0ef');
  } else if (mood === 'caught') {
    for (const side of [-1, 1]) oval(g, side * 5.8, -1, 3.5, 3.7, CREAM, INK, .9);
    for (const side of [-1, 1]) oval(g, side * 5.8, -.5, 1.4, 1.8, INK);
    oval(g, 0, 6, 2.4, 3, INK);
  } else if (species === 'owl') {
    path(g, [[-2.4, 2], [2.4, 2], [0, 6]], '#d48147', INK, .75);
  } else if (species === 'frog') {
    g.beginPath();
    g.arc(0, 2, 4, .2, Math.PI - .2);
    paint(g, null, INK, 1.15);
  } else {
    oval(g, species === 'hedgehog' ? 4 : 0, 4, 2.2, 1.4, INK);
    if (species === 'cat') {
      for (const side of [-1, 1]) {
        path(g, [[side * 8, 4], [side * 16, 3]], null, INK, .85);
        path(g, [[side * 8, 6], [side * 15, 8]], null, INK, .85);
      }
    }
  }
  g.restore();
}

export function costume(g, x, y, size, type) {
  g.save();
  g.translate(x, y);
  g.scale(size / 30, size / 30);
  const forms = [
    [[-13, -7], [-8, -15], [0, -8], [8, -15], [13, -7], [12, 6], [0, 12], [-12, 6]],
    [[-13, -6], [0, -13], [13, -6], [14, 4], [0, 14], [-14, 4]],
    [[-13, -11], [13, -11], [13, 5], [7, 10], [-7, 10], [-13, 5]],
    [[-13, -3], [-9, -12], [9, -12], [13, -3], [9, 8], [0, 12], [-9, 8]],
  ];
  forms.push(
    [[-13, -8], [-8, -13], [-4, -10], [4, -10], [8, -13], [13, -8], [13, 5], [5, 12], [-5, 12], [-13, 5]],
    [[-14, 0], [-10, -12], [10, -12], [14, 0], [8, 9], [-8, 9]],
    [[-14, -7], [0, -14], [14, -7], [10, 2], [14, 10], [-14, 10], [-10, 2]],
    [[-14, -8], [0, -8], [7, -15], [13, -10], [12, 9], [0, 14], [-12, 9]],
  );
  const colors = ['#ad648f', '#6ca99d', '#d18a52', '#b0a6d6', '#ce6769', '#8cb771', '#deb868', '#6b9dc3'];
  path(g, forms[type], colors[type], INK, 1.6);
  for (const sign of [-1, 1]) oval(g, sign * 5, -1, 2.5, 1.7, CREAM, INK, 1);
  if (type % 2) oval(g, 0, 6, 1.75, 1.75, INK);
  else path(g, [[-3, 5], [0, 7], [3, 5]], null, INK);
  g.restore();
}

export function eventIcon(g, x, y, size, crime, happened = true) {
  g.save();
  g.translate(x, y);
  g.scale(size / 40, size / 40);
  if (crime === 0) {
    oval(g, 0, 9, 16, 5.5, '#e5cdc3', INK);
    if (!happened) {
      path(g, [[-13, 0], [13, 0], [10, 10], [-10, 10]], '#d98950', INK);
      oval(g, 0, 0, 13, 5.5, '#fac879', INK);
      for (const dx of [-6, 0, 6]) path(g, [[dx - 2, 1], [dx + 2, -2]], null, WOOD, 1.2);
    } else {
      for (const [dx, dy] of [[-6, 7], [1, 10], [6, 6]]) oval(g, dx, dy, 1.8, 1.2, '#a15e44');
    }
  } else if (crime === 1) {
    oval(g, 0, 9, 16, 6, '#648b92', INK);
    oval(g, 0, 7, 13, 4, happened ? '#ee82ac' : '#a8d2d4', INK);
    path(g, [[-3, 7], [0, -10], [3, 7]], happened ? '#d5578c' : '#7daab4', INK);
    g.beginPath();
    g.moveTo(-9, 2); g.quadraticCurveTo(-6, -13, 0, -9); g.quadraticCurveTo(6, -13, 9, 2);
    paint(g, null, happened ? '#fff0e2' : '#edf5e6', 1.65);
  } else if (crime === 2) {
    rect(g, -11, 6, 22, 7, 1, '#b5a5b4', INK);
    path(g, [[-8, 6], [-4, -1], [-5, -9], [1, -11], [5, -7], [5, 0], [9, 6]], '#cbc1c0', INK);
    if (!happened) {
      path(g, [[-7, -11], [-3, -18], [7, -17], [8, -9]], '#bd566a', INK);
      oval(g, 1, -10, 12, 2.6, '#e78e89', INK);
    }
  } else if (crime === 3) {
    rect(g, -17, 7, 34, 7, 3, '#a37754', INK);
    if (!happened) {
      path(g, [[-16, 4], [-12, -5], [-6, -11], [6, -11], [12, -5], [16, 4],
        [11, 7], [5, 1], [-5, 1], [-11, 7]], '#efb85f', INK);
      for (const x of [-8, 0, 8]) path(g, [[x - 2, -7], [x + 1, -1]], null, '#a55e45');
    } else for (const x of [-8, 0, 8]) oval(g, x, 5 - x % 3, 2, 1.5, GOLD);
  } else if (crime === 4) {
    rect(g, -13, 5, 26, 10, 3, '#9b745d', INK);
    if (!happened) {
      oval(g, 0, -2, 13, 13, '#dca466', INK);
      oval(g, 0, -2, 9, 9, '#faecc9', INK);
      path(g, [[-4, 3], [4, -7], [2, 1]], '#bd5958', INK, 1);
    } else oval(g, 0, 7, 8, 2, '#664a4e');
  } else if (crime === 6) {
    // A honey jar on a shelf.
    rect(g, -15, 9, 30, 5, 2, '#a37754', INK);
    if (!happened) {
      rect(g, -9, -6, 18, 15, 5, '#f0a93a', INK);
      rect(g, -10, -11, 20, 6, 2, '#b0704c', INK);
      oval(g, 0, 2, 5, 3.5, '#fff0c4', INK, 1);
    } else for (const x of [-6, 1, 7]) oval(g, x, 7 - Math.abs(x) % 3, 2.4, 1.6, '#f0a93a', '#a0662d', .8);
  } else if (crime === 7) {
    // A spyglass on a three-legged stand.
    path(g, [[0, 0], [-9, 14]], null, WOOD, 2);
    path(g, [[0, 0], [9, 14]], null, WOOD, 2);
    path(g, [[0, 0], [0, 14]], null, WOOD, 2);
    if (!happened) {
      g.save(); g.rotate(-.35);
      rect(g, -14, -9, 24, 8, 2, '#d3a15b', INK);
      rect(g, 8, -10.5, 7, 11, 2, '#8b6a3e', INK);
      path(g, [[-4, -9], [-4, -1]], null, INK, 1);
      g.restore();
    } else oval(g, 0, -1, 3, 2, '#8b6a3e');
  } else if (crime === 8) {
    // A prize pumpkin on a crate.
    rect(g, -14, 8, 28, 7, 2, '#a37754', INK);
    if (!happened) {
      oval(g, 0, -1, 14, 10, '#e98a3c', INK);
      for (const x of [-6, 0, 6]) path(g, [[x, -10], [x * 1.3, 8]], null, '#b9592a', 1);
      path(g, [[0, -10], [2, -15]], null, '#4f7a3f', 2.4);
    } else for (const x of [-7, 3]) oval(g, x, 6, 4, 1.8, '#7fa66a', '#4f7a3f', .8);
  } else {
    path(g, [[-10, 5], [10, 5], [6, 14], [-6, 14]], '#c47a60', INK);
    path(g, [[0, 5], [0, -9], [7, -13]], null, '#456953', 2);
    oval(g, -4, 0, 6, 2.4, '#84ab74', '#456953', 1);
    if (!happened) {
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * .4;
        oval(g, 6 + Math.cos(angle) * 4.7, -12 + Math.sin(angle) * 4.7, 4, 3.3, '#ec9bb6', '#984a77', .9);
      }
      oval(g, 6, -12, 2.4, 2.4, GOLD);
    } else path(g, [[-2, -10], [2, -7]], null, '#fbdead', 1.4);
  }
  g.restore();
}

export function heldItem(g, x, y, size, crime) {
  if ([1, 2, 5, 6, 7, 8].includes(crime)) {
    g.save();
    g.translate(x, y);
    g.scale(size / 24, size / 24);
    if (crime === 1) {
      rect(g, -5, -7, 10, 14, 3, '#e385ac', INK);
      rect(g, -3, -11, 6, 5, 1, GOLD, INK, 1);
      path(g, [[-2, 1], [2, 1]], null, CREAM, 1.4);
    } else if (crime === 2) {
      rect(g, -6, -9, 12, 13, 3, '#bd566a', INK);
      oval(g, 0, 4, 10, 3.5, '#e78e89', INK);
    } else if (crime === 6) {
      rect(g, -6, -5, 12, 12, 4, '#f0a93a', INK);
      rect(g, -7, -9, 14, 5, 2, '#b0704c', INK);
    } else if (crime === 7) {
      g.rotate(-.5);
      rect(g, -11, -3.5, 19, 7, 2, '#d3a15b', INK);
      rect(g, 6, -5, 6, 10, 2, '#8b6a3e', INK);
    } else if (crime === 8) {
      oval(g, 0, 1, 10, 7.5, '#e98a3c', INK);
      path(g, [[0, -6], [2, -10]], null, '#4f7a3f', 2.2);
    } else {
      path(g, [[0, 10], [0, -3]], null, '#527851', 2);
      for (const [dx, dy] of [[-4, -3], [0, -8], [4, -3], [0, 1]]) oval(g, dx, dy, 4, 3, '#ed9ab8', INK, .8);
      oval(g, 0, -3, 2, 2, GOLD);
    }
    g.restore();
  } else eventIcon(g, x, y, size, crime, false);
}

function idle(g, room, phase) {
  const lift = Math.sin(phase * .72) * 1.5;
  const x = 9;
  const y = 9 + lift;
  if (room === 0) {
    path(g, [[x - 6, y], [x + 7, y], [x + 4, y + 5], [x - 3, y + 5]], '#f6c882', INK, .9);
    path(g, [[x + 1 + lift, y + 1], [x + 7, y - 5]], null, '#f9dfb3', 1.45);
  } else if (room === 1) {
    path(g, [[x - 7, y - 3], [x, y - 1], [x + 6, y - 4], [x + 6, y + 3],
      [x, y + 5], [x - 7, y + 3]], '#fff0cb', INK, .95);
    path(g, [[x, y - 1], [x, y + 4]], null, '#986c63', .8);
  } else if (room === 2) {
    rect(g, x - 5, y - 3, 9, 8, 2, '#a9d6cc', INK, .9);
    path(g, [[x + 3, y + 2], [x + 8, y - 2]], null, INK, 1.6);
    for (let i = 0; i < 2; i++) oval(g, x + 8 + i * 2, y + 1 + (phase * 2 + i * 2) % 6, .85, 1.2, '#c9ebef');
  } else if (room === 3) {
    oval(g, x, y + 1, 6, 3.7, '#efbd8c', INK, .9);
    path(g, [[x, y + 1], [x + 6, y - 6 - lift]], null, '#62504b', 1.2);
  } else {
    rect(g, x - 4, y, 9, 5, 1, '#daaa76', INK, .9);
    path(g, [[x, y + 3], [x + 5, y - 5 - lift]], null, '#efe2b0', 1.1);
  }
}

// Different shapes for eight sounds. The same glyph appears beside the
// animal's portrait and in the dark room the sound came from.
export function signature(g, x, y, size, number) {
  g.save();
  g.translate(x, y);
  g.scale(size / 30, size / 30);
  const bright = '#fff0cd';
  path(g, [[-13, -3], [-10, -3], [-7, -7], [-7, 7], [-10, 3], [-13, 3]], GOLD);
  const cx = 4;
  if (number === 0) oval(g, cx, 0, 4, 4, bright);
  else if (number === 1) {
    oval(g, cx - 3, 0, 2.4, 2.4, bright);
    oval(g, cx + 4, 0, 2.4, 2.4, bright);
  } else if (number === 2) path(g, [[cx, -6], [cx + 6, 5], [cx - 6, 5]], bright);
  else if (number === 3) rect(g, cx - 4.5, -4.5, 9, 9, 1, bright);
  else if (number === 4) path(g, [[cx, -6], [cx + 5.5, 0], [cx, 6], [cx - 5.5, 0]], bright);
  else if (number === 5) path(g, [[cx - 6, 0], [cx + 1, -6], [cx, -1], [cx + 7, -1], [cx, 6], [cx + 1, 1]], bright);
  else if (number === 6) {
    path(g, [[cx - 4, 0], [cx + 4, 0]], null, bright, 2.8);
    path(g, [[cx, -4], [cx, 4]], null, bright, 2.8);
  } else {
    g.beginPath();
    g.arc(cx, 0, 4.7, 0, 2 * Math.PI);
    paint(g, null, bright, 2.2);
  }
  g.restore();
}
export function sky(g, site, phase) {
  const dusk = g.createLinearGradient(0, 0, 0, H);
  const palette = sets[site].sky;
  dusk.addColorStop(0, palette[0]); dusk.addColorStop(.54, palette[1]); dusk.addColorStop(1, palette[2]);
  g.fillStyle = dusk;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 42; i++) {
    const x = (i * 107 + 24) % 359, y = (i * 67 + 88) % 420;
    const r = i % 9 === 0 ? 1.4 : .7;
    oval(g, x, y, r, r, i % 3 === 0 ? '#ffdda87c' : '#fff1ce43');
  }
  oval(g, 288, 110, 46, 46, '#ffda8e0b');
  oval(g, 288, 110, 34, 34, '#ffda8e10');
  oval(g, 288, 110, 24, 24, '#ffe0a6');
  oval(g, 279, 103, 5, 3.2, '#eac588');
  oval(g, 295, 120, 7.4, 4.7, '#eac588');
  if (site === 2) {
    for (let i = 0; i < 5; i++) {
      const y = 351 + i * 15;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= W; x += 10) g.lineTo(x, y + Math.sin(x / 18 + i + phase) * 3);
      paint(g, null, i % 2 ? '#b1ded266' : '#2b506f', 2);
    }
    return;
  }
  for (let i = 0; i < 7; i++) {
    const x = 5 + 56 * i, height = 31 + (i * 19 % 52);
    path(g, [[x - 37, 414], [x - 24, 414 - height], [x - 7, 397 - height],
      [x + 11, 413 - height], [x + 25, 413 - height], [x + 33, 429]], '#30263879');
    if (i % 2 === 0) rect(g, x - 13, 417 - height, 6, 10, 2, '#e0a87b50');
  }
  for (const [x, base] of [[8, 410], [348, 410]]) {
    path(g, [[x, base], [x - 2, base - 61], [x - 11, base - 73]], null, '#34293e', 2);
    for (let i = 0; i < 5; i++) {
      const dx = 3 * Math.sin(phase / 2 + i);
      oval(g, x + (i % 2 ? 7 : -7) + dx, base - 41 - i * 8, 7, 3.2, '#4b4756');
    }
  }
}

export function roomLayout(count) {
  const columns = count <= 4 ? 2 : 3;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns);
    const n = Math.min(count - row * columns, columns);
    const w = 310 / columns;
    return { x: 25 + (310 - w * n) / 2 + (i % columns) * w, y: 173 + row * 113, w, h: 113 };
  });
}

export function roomPoint(room, slot) {
  const offsets = [-1.15, 0, 1.15, .53];
  return { x: room.x + room.w / 2 + offsets[slot] * Math.min(32, (room.w - 16) / 3),
    y: room.y + [86, 95, 85, 74][slot] };
}

function window(g, x, y, w = 31, h = 31) {
  rect(g, x, y, w, h, 7, '#66546a', '#8e5b59', 2);
  path(g, [[x + w / 2, y + 2], [x + w / 2, y + h - 2]], null, '#c29381', 1.2);
  path(g, [[x + 2, y + h * .54], [x + w - 2, y + h * .54]], null, '#c29381', 1.2);
  oval(g, x + w * .31, y + h * .3, 2.5, 2.5, '#fbd194');
  path(g, [[x - 3, y + h], [x + w + 3, y + h]], null, '#8e5b59', 2.9);
}

function decor(g, room, i, crime, happened, site) {
  const { x, y, w } = room;
  const center = x + w / 2;
  if (i === 0) {
    rect(g, center + 8, y + 26, 28, 24, 2, '#b77766', WOOD);
    rect(g, center + 11, y + 33, 22, 12, 3, '#6f5057', WOOD, 1);
    for (const dx of [14, 22, 30]) oval(g, center + dx, y + 29, 1.2, 1.2, CREAM);
    window(g, center - 25, y + 19, 19, 25);
  } else if (i === 1) {
    rect(g, center + 13, y + 28, 24, 22, 7, '#a75d76', WOOD);
    rect(g, center + 10, y + 42, 30, 11, 3, '#c17b82', WOOD);
    rect(g, center - 19, y + 20, 15, 17, 2, GOLD, WOOD);
    oval(g, center - 11.5, y + 28, 4, 5, '#9b667a');
  } else if (i === 2) {
    path(g, [[center + 32, y + 49], [center + 30, y + 22]], null, '#557a69', 1.9);
    for (let j = 0; j < 4; j++) {
      oval(g, center + 30 + (j % 2 ? -5 : 6), y + 22 + j * 6, 6, 3.5, '#76a377', '#557a69', .9);
    }
    path(g, [[center + 22, y + 43], [center + 39, y + 43], [center + 35, y + 56], [center + 26, y + 56]], '#d89376', WOOD);
    window(g, center - 26, y + 20, 20, 24);
  } else if (i === 3) {
    path(g, [[center - 13, y + 53], [center - 2, y + 27], [center + 10, y + 53]], null, WOOD, 2);
    rect(g, center - 13, y + 23, 24, 21, 1, '#ffedca', WOOD);
    path(g, [[center - 9, y + 40], [center - 2, y + 30], [center + 6, y + 40]], '#7c9a99');
    oval(g, center + 28, y + 43, 9, 3, '#db9c84', WOOD);
  } else if (i === 4) {
    rect(g, center + 5, y + 20, 27, 35, 8, '#a77d76', WOOD, 2);
    oval(g, center + 25, y + 41, 2, 2, GOLD);
    path(g, [[center - 6, y + 28], [center - 13, y + 45], [center - 8, y + 51]], null, WOOD, 2);
    path(g, [[center - 18, y + 32], [center - 9, y + 24], [center + 1, y + 30]], '#c46e7e', WOOD);
  } else {
    rect(g, center - 12, y + 31, 30, 22, 3, '#ac8295', WOOD);
    path(g, [[center - 10, y + 39], [center + 16, y + 39]], null, WOOD, 2);
    rect(g, center, y + 37, 6, 7, 1, GOLD, WOOD, 1);
    window(g, center + 24, y + 21, 15, 23);
  }
  if (site === 2) {
    oval(g, x + w - 24, y + 30, 9, 9, '#84adbf', '#6d635f', 1.75);
    path(g, [[x + w - 30, y + 31], [x + w - 18, y + 31]], null, '#f1dfb9', 1.05);
  } else if (site === 3) {
    for (const dx of [-15, 0, 15]) {
      path(g, [[center + dx, y + 10], [center + dx, y + 53]], null, '#71978b80', 1);
      oval(g, center + dx, y + 54, 6, 3, '#7fa177');
    }
  } else if (site === 1) {
    for (const dx of [-9, 0, 9]) oval(g, center + dx, y + 59, 4, 2, '#edbd72', '#a27555', .7);
  }
  if (i === CRIME_ROOM[crime]) {
    oval(g, center - 15, y + 61, 18, 4, '#a7746b75');
    if (crime === 0) {
      path(g, [[center - 24, y + 55], [center - 24, y + 62], [center - 7, y + 62], [center - 7, y + 55]], null, WOOD, 2);
      rect(g, center - 34, y + 50, 38, 6, 2, '#9c665c', WOOD, 1.3);
    }
    eventIcon(g, center - 15, y + (crime === 0 ? 43 : 51), 37, crime, happened);
  }
}

export function house(g, rooms, frame, crime, claimRoom, site = 0) {
  const palette = sets[site];
  oval(g, 180, 410, 169, 14, '#261e2b89');
  rect(g, 22, 394, 316, 13, 3, '#583e4b', INK, 2);
  for (let i = 0; i < 13; i++) {
    const x = 28 + i * 24;
    path(g, [[x, 401], [x + 18, 401]], null, '#a67472', .9);
  }
  if (rooms.length % (rooms.length <= 4 ? 2 : 3)) {
    const edge = rooms[rooms.length - 1];
    const right = edge.x + edge.w;
    for (const [left, w] of [[25, edge.x - 25], [right, 335 - right]]) {
      if (w < 20) continue;
      if (site === 2) {
        rect(g, left + 2, 285, w - 4, 110, 2, '#456a7d', '#294a63', 2);
        for (let y = 296; y < 395; y += 12) path(g, [[left + 3, y], [left + w - 3, y]], null, '#afc6bd40', 1);
        const x = left + w / 2;
        oval(g, x, 326, 16, 16, '#c19c6f', '#294a63', 2);
        oval(g, x, 326, 11, 11, '#6ea8b1', '#294a63', 1.6);
        path(g, [[x - 7, 329], [x + 8, 322]], null, '#c8ddd0', 1.4);
        continue;
      }
      if (site === 3) {
        rect(g, left + 2, 285, w - 4, 110, 2, '#486f63', '#304b46', 2);
        path(g, [[left + w * .5, 292], [left + w * .5, 394]], null, '#9eb896', 1.8);
        path(g, [[left + 4, 345], [left + w - 4, 345]], null, '#9eb896', 1.8);
        for (let i = 0; i < 7; i++) {
          const x = left + 11 + i * (w - 22) / 6;
          oval(g, x, 380 - i % 3 * 8, 7, 13 - i % 3 * 2, '#789460', '#537657', .9);
        }
        continue;
      }
      rect(g, left + 2, 284, w - 4, 110, 2, site === 1 ? '#9c5d60' : '#806670', '#543e50', 2);
      for (let y = 302; y < 394; y += 13) {
        path(g, [[left + 3, y], [left + w - 3, y]], null, '#604b5d', .9);
        for (let x = left + (y % 2 ? 18 : 10); x < left + w - 6; x += 22) {
          path(g, [[x, y], [x, y + 12]], null, '#604b5d', .85);
        }
      }
      const x = left + w / 2;
      rect(g, x - 17, 304, 34, 48, [16, 16, 4, 4], '#df9d7e', '#5b414e', 2.4);
      window(g, x - 12, 310, 24, 34);
      rect(g, x - 15, 383, 30, 11, 2, '#aa7969', '#584553');
      for (let n = 0; n < 6; n++) {
        oval(g, x + n * 5 - 13, 383 - (n % 2) * 5, 6.7, 5.2, n % 2 ? '#658770' : '#769275', '#456357', .75);
      }
    }
  }
  if (site) exterior(g, site);
  else {
  const roof = [[14, 171], [83, 125], [277, 125], [346, 171]];
  rect(g, 265, 109, 22, 44, 1, '#99636d', INK, 2.5);
  rect(g, 261, 106, 30, 8, 2, '#e1a68c', INK, 2);
  path(g, roof, '#ac667b', INK, 3);
  path(g, [[32, 159], [326, 159]], null, '#d28b8d', 2.3);
  path(g, [[52, 146], [307, 146]], null, '#d28b8d', 2.3);
  path(g, [[71, 135], [289, 135]], null, '#d28b8d', 2.3);
  path(g, [[17, 168], [342, 168]], null, '#e0a087', 2.2);
  for (const [row, y, n] of [[0, 135, 7], [1, 146, 9], [2, 159, 11]]) {
    for (let i = 0; i < n; i++) {
      const x = 180 + (i - (n - 1) / 2) * 24 + (row % 2) * 6;
      path(g, [[x - 2, y - 8], [x, y - 1]], null, '#824b64', 1);
    }
  }
  oval(g, 180, 147, 16, 16, '#edb285', INK, 2.6);
  oval(g, 180, 147, 10, 10, '#66516b', INK, 1.35);
  path(g, [[171, 147], [189, 147]], null, '#dcb296', 1.4);
  path(g, [[180, 138], [180, 156]], null, '#dcb296', 1.4);
  }
  for (const [i, room] of rooms.entries()) {
    const { x, y, w, h } = room;
    rect(g, x, y, w, h, 0, palette.walls[i], palette.edge, 3);
    rect(g, x + 1.5, y + 66, w - 3, 44, 0, palette.floors[i]);
    const floorLight = g.createLinearGradient(0, y + 67, 0, y + 110);
    floorLight.addColorStop(0, '#2e263b20');
    floorLight.addColorStop(.55, '#fff1d00d');
    floorLight.addColorStop(1, '#2e263b39');
    rect(g, x + 1.5, y + 67, w - 3, 43, 0, floorLight);
    path(g, [[x + 3, y + 67], [x + w - 3, y + 67]], null, WOOD, 1.5);
    for (let k = 0; k < 5; k++) {
      const up = x + w / 2 + (k - 2) * w / 6;
      path(g, [[up, y + 68], [x + w / 2 + (up - x - w / 2) * 1.45, y + 110]], null, '#593e4a32', 1);
    }
    path(g, [[x + 2, y + 101], [x + w - 2, y + 101]], null, '#593e4a2a', 1);
    // An oval or woven mat grounds the foreground without masking the evidence.
    const cx = x + w * .49;
    if (i % 3 === 1) {
      oval(g, cx, y + 87, w * .34, 11, '#f3c7ac38', '#75465962', 1);
      oval(g, cx, y + 87, w * .29, 8, null, '#f1c6ab68', 1);
    } else if (i % 3 === 2) {
      for (let k = 0; k < 8; k++) {
        const tx = x + 9 + (k * 31) % (w - 18);
        const ty = y + 71 + (k * 17) % 21;
        path(g, [[tx, ty], [tx + 2, ty - 2]], null, '#e1ebbe5c', 1);
      }
    }
    const light = g.createRadialGradient(x + w * .5, y + 8, 1, x + w * .5, y + 11, 75);
    light.addColorStop(0, '#fff2c99f');
    light.addColorStop(1, '#fff2c900');
    rect(g, x + 3, y + 3, w - 6, h - 7, 1, light);
    decor(g, room, i, crime, frame.incident, site);
    const lamp = g.createRadialGradient(x + w - 12, y + 19, 1, x + w - 12, y + 19, 27);
    lamp.addColorStop(0, '#fff1a5bb');
    lamp.addColorStop(1, '#fff1a500');
    rect(g, x + w - 38, y + 4, 35, 41, 3, lamp);
    place(g, x + SIGN.x, y + SIGN.y, SIGN.size, i, site);
    path(g, [[x + w - 12, y + 5], [x + w - 12, y + 15]], null, WOOD, 1.2);
    path(g, [[x + w - 16, y + 17], [x + w - 14, y + 14], [x + w - 10, y + 14], [x + w - 8, y + 17]], '#b4816c', WOOD, .8);
    oval(g, x + w - 12, y + 19.5, 2.5, 2.7, '#fff3c6', WOOD, .75);
    if (i === claimRoom && !frame.blackout) {
      rect(g, x + 3.5, y + 4, w - 7, h - 8, 4, null, '#fff5cb', 3.1);
    }
  }
  for (const y of [169, 282, 395]) {
    rect(g, 20, y + 2, 320, 6, 2, palette.edge, INK, 1.6);
    path(g, [[23, y + 3], [336, y + 3]], null, palette.trim, 1.6);
  }
  if (rooms.length > 3) {
    for (const x of [17, 343]) {
      lineOfStairs(g, x, palette.trim + 'a0');
    }
  }
  if (site === 2) {
    path(g, [[14, 398], [346, 398], [319, 420], [47, 420]], '#244c64', INK, 2);
    path(g, [[29, 405], [333, 405]], null, '#e3c78a', 1.6);
    for (let i = 0; i < 8; i++) oval(g, 65 + i * 33, 413, 3.3, 2.1, '#aac5c5', INK, .8);
  }
  if (frame.blackout) {
    for (const [i, { x, y, w, h }] of rooms.entries()) {
      rect(g, x + 1, y + 5, w - 2, h - 7, 1, i === claimRoom ? '#382b43' : '#292439', i === claimRoom ? GOLD : WOOD);
      place(g, x + SIGN.x, y + SIGN.y, SIGN.size, i, site);
    }
  }
}


function lineOfStairs(g, x, color) {
  path(g, [[x - 4, 260], [x - 4, 374]], null, color, 1.2);
  path(g, [[x + 4, 260], [x + 4, 374]], null, color, 1.2);
  for (let y = 263; y < 374; y += 7) path(g, [[x - 4, y], [x + 4, y]], null, color, .8);
}

function exterior(g, site) {
  if (site === 1) {
    for (const x of [58, 258]) {
      rect(g, x, 126, 42, 42, 5, '#9d5257', INK, 2);
      window(g, x + 7, 131, 28, 29);
    }
    rect(g, 113, 118, 134, 52, [18, 18, 2, 2], '#733e4a', INK, 2.5);
    oval(g, 180, 143, 22, 17, '#f5cd95', '#432d40', 2);
    eventIcon(g, 180, 141, 25, 3, false);
    for (let i = 0; i < 14; i++) {
      const x = 20 + i * 23;
      path(g, [[x + 3, 154], [x + 23, 154], [x + 21, 173], [x - 2, 173]], i % 2 ? '#eac497' : '#bd666b', '#783f52', .8);
    }
  } else if (site === 2) {
    path(g, [[24, 170], [48, 149], [318, 149], [345, 170]], '#345d75', INK, 2.5);
    rect(g, 104, 124, 134, 27, [6, 6, 0, 0], '#e8c999', INK, 2.5);
    for (const x of [123, 144, 165, 186, 207]) rect(g, x, 132, 12, 10, 2, '#5a858e', INK, .9);
    path(g, [[245, 150], [248, 117], [266, 117], [270, 150]], '#bb6c60', INK, 2.3);
    rect(g, 245, 116, 25, 6, 2, '#345d75', INK, 1.4);
    path(g, [[77, 150], [77, 118], [98, 125], [77, 132]], '#e6a083', INK, 1.4);
    path(g, [[28, 159], [331, 159]], null, '#d9c581', 1.65);
  } else {
    const shape = [[17, 170], [92, 125], [268, 125], [343, 170]];
    path(g, shape, '#9bd2af80', '#d3dca7', 2.6);
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      path(g, [[92 + 176 * t, 126], [17 + 326 * t, 170]], null, '#d2e5bba0', 1.35);
    }
    path(g, [[49, 150], [309, 150]], null, '#c9d7a5', 1.2);
    path(g, [[23, 168], [74, 159], [107, 164], [140, 153]], null, '#436d57', 2);
    for (let i = 0; i < 12; i++) oval(g, 30 + i * 9, 158 + i % 3 * 3, 6, 2.8, i % 2 ? '#8eb97e' : '#639c70');
  }
}

export function trace(g, room, kind) {
  const x = room.x + room.w / 2 + 12;
  const y = room.y + 102;
  if (kind === 'prints' || kind === 'crumbs') {
    for (let i = 0; i < 4; i++) {
      const dx = x - 17 + i * 8, dy = y + (i % 2) * 4;
      if (kind === 'prints') {
        oval(g, dx, dy, 2.4, 2, '#5e4144');
        for (let k = -1; k <= 1; k++) oval(g, dx + k * 1.8, dy - 2.7, .9, 1.1, '#5e4144');
      } else path(g, [[dx, dy], [dx + 3, dy + 2], [dx - 2, dy + 3]], '#ffce82', '#804d4c', .65);
    }
  } else if (kind === 'splash') {
    for (let i = 0; i < 4; i++) oval(g, x - 7 + i * 6, y + i % 2 * 4, 4, 1.9, '#e482a8', '#9e496e', .9);
  } else if (kind === 'honey') {
    for (let i = 0; i < 4; i++) oval(g, x - 9 + i * 6, y + i % 2 * 3, 2.6, 1.8, '#f0a93a', '#a0662d', .7);
  } else if (kind === 'leaves') {
    for (let i = 0; i < 3; i++) oval(g, x + 6 * i - 6, y + i % 2 * 3, 3.6, 1.7, '#7fa66a', '#4f7a3f', .75);
  } else if (kind === 'petals') {
    for (let i = 0; i < 3; i++) oval(g, x + 5 * i - 5, y + i % 2 * 3, 3, 1.6, '#eb9cb5', '#984e70', .75);
  } else if (kind === 'feather') {
    g.save(); g.translate(x, y); g.rotate(-.45);
    oval(g, 2, -2, 6, 2.6, '#fff3d4', WOOD, .75);
    path(g, [[-7, 0], [6, -2]], null, WOOD, .85);
    g.restore();
  } else {
    oval(g, x, y + 3, 11, 2.3, '#9ac8c3', WOOD, .9);
    path(g, [[x - 6, y], [x - 2, y - 10], [x + 4, y - 9], [x + 6, y - 6], [x - 6, y]], '#af697a', WOOD);
    path(g, [[x - 6, y], [x - 10, y + 2], [x - 11, y]], null, INK, 1.2);
  }
}

export function stamp(g, x, y, scale = 1, active = false) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  oval(g, 0, 16, 25, 4, '#27192765');
  rect(g, -24, 8, 48, 10, 4, '#8d435b', INK, 2);
  rect(g, -22, 3, 44, 11, 5, active ? '#ffd391' : '#d68075', INK, 2);
  path(g, [[-9, 5], [-5, -3], [-7, -8], [7, -8], [5, -3], [9, 5]], '#c4896a', INK, 1.7);
  oval(g, 0, -11, 12, 8, '#eebc87', INK, 1.7);
  path(g, [[-6, -13], [4, -14]], null, '#ffe2ad', 1.75);
  path(g, [[-14, 16], [14, 16]], null, '#f3a78d', 1.5);
  g.restore();
}

export function hand(g, x, y, angle = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.globalAlpha *= .89;
  path(g, [[-6, 20], [-12, 13], [-9, 9], [-5, 12], [-5, 1], [-3, -3], [1, -3], [3, 0], [3, 8],
    [6, 6], [10, 8], [13, 12], [13, 21], [8, 27], [-2, 27]], '#fff0cc', '#674152', 1.7);
  g.restore();
}
