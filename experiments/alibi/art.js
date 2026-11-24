export const W = 360;
export const H = 640;
export const INK = '#342538';
export const CREAM = '#fff1ce';
export const GOLD = '#f7be69';
const WOOD = '#744654';
const roomWalls = ['#ffdbac', '#efb7ae', '#bcd6ac', '#b9cfda', '#d2be9e', '#d0badb'];
const roomFloors = ['#cb8265', '#ac7184', '#78a18b', '#779eaa', '#ab826a', '#9786af'];
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

export function place(g, x, y, size, room, disc = true) {
  g.save();
  g.translate(x, y);
  g.scale(size / 30, size / 30);
  if (disc) oval(g, 0, 0, 14, 14, roomWalls[room], INK, 1.5);
  if (room === 0) {
    rect(g, -8, -1, 16, 8, 2, '#fff1ce', INK);
    path(g, [[-11, -1], [11, -1]], null, INK);
    path(g, [[-4, -4], [-6, -7], [-4, -10]], null, INK, 1.2);
    path(g, [[3, -4], [1, -7], [3, -10]], null, INK, 1.2);
  } else if (room === 1) {
    rect(g, -6, -8, 12, 11, 3, '#f5d5ad', INK);
    rect(g, -9, -1, 18, 7, 2, '#c56f79', INK);
    path(g, [[-7, 6], [-7, 9], [7, 9], [7, 6]], null, INK);
  } else if (room === 2) {
    path(g, [[-8, 4], [8, 4], [4, 10], [-4, 10]], GOLD, INK);
    oval(g, -4, -2, 3, 5, '#80a66c', INK);
    oval(g, 4, -4, 3, 6, '#80a66c', INK);
    path(g, [[0, 4], [1, -2]], null, INK);
  } else if (room === 3) {
    path(g, [[-7, 8], [0, -6], [7, 8]], null, INK);
    rect(g, -7, -7, 14, 12, 1, CREAM, INK);
    path(g, [[-5, 2], [1, -4], [5, 2]], '#658994');
  } else if (room === 4) {
    path(g, [[-8, -5], [0, -10], [8, -5]], null, INK);
    rect(g, -6, -5, 12, 13, 1, GOLD, INK);
    path(g, [[0, -4], [0, 7]], null, INK);
  } else {
    rect(g, -9, -5, 18, 12, 2, GOLD, INK);
    path(g, [[-8, 0], [8, 0]], null, INK);
    rect(g, -2, -2, 4, 5, 1, CREAM, INK);
  }
  g.restore();
}

export function animal(g, x, y, size, species, { head = false, phase = 0, walk = 0, mask = null } = {}) {
  const color = animalColors[species] || '#c98f86';
  g.save();
  g.translate(x, y);
  g.scale(size / 40, size / 40);
  const bob = head ? 0 : Math.sin(phase * 2) * (walk ? 2 : .6);
  g.translate(0, bob);
  if (!head) {
    oval(g, 0, 17 - bob, 13, 3, '#38233735');
    oval(g, -6 + walk * Math.sin(phase) * 2.5, 14, 4, 3, INK);
    oval(g, 6 - walk * Math.sin(phase) * 2.5, 14, 4, 3, INK);
    oval(g, 0, 8, 10.5, 9, species === 'frog' ? '#5d7c65' : '#a15961', INK);
    path(g, [[-5, 4], [0, 9], [6, 4]], '#f8d99e');
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
  if (species === 'owl') {
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
  path(g, forms[type], ['#ad648f', '#6ca99d', '#d18a52', '#b0a6d6'][type], INK, 1.6);
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
  } else {
    rect(g, -11, 6, 22, 7, 1, '#b5a5b4', INK);
    path(g, [[-8, 6], [-4, -1], [-5, -9], [1, -11], [5, -7], [5, 0], [9, 6]], '#cbc1c0', INK);
    if (happened) {
      path(g, [[-7, -11], [-3, -18], [7, -17], [8, -9]], '#bd566a', INK);
      oval(g, 1, -10, 12, 2.6, '#e78e89', INK);
    }
  }
  g.restore();
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
export function sky(g, chapter, phase) {
  const dusk = g.createLinearGradient(0, 0, 0, H);
  const palette = [['#221d36', '#795562', '#271f35'], ['#242538', '#5d5c76', '#2d243f'], ['#231e33', '#825969', '#322037']][chapter - 1];
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
  return { x: room.x + room.w / 2 + (slot - 1) * Math.min(32, (room.w - 10) / 3),
    y: room.y + 84 + (slot % 2) * 5 };
}

function window(g, x, y, w = 31, h = 31) {
  rect(g, x, y, w, h, 7, '#66546a', '#8e5b59', 2);
  path(g, [[x + w / 2, y + 2], [x + w / 2, y + h - 2]], null, '#c29381', 1.2);
  path(g, [[x + 2, y + h * .54], [x + w - 2, y + h * .54]], null, '#c29381', 1.2);
  oval(g, x + w * .31, y + h * .3, 2.5, 2.5, '#fbd194');
  path(g, [[x - 3, y + h], [x + w + 3, y + h]], null, '#8e5b59', 2.9);
}

function decor(g, room, i, crime, happened) {
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
  if (i === [0, 2, 1][crime]) {
    oval(g, center - 15, y + 61, 18, 4, '#a7746b75');
    if (crime === 0) {
      path(g, [[center - 24, y + 55], [center - 24, y + 62], [center - 7, y + 62], [center - 7, y + 55]], null, WOOD, 2);
      rect(g, center - 34, y + 50, 38, 6, 2, '#9c665c', WOOD, 1.3);
    }
    eventIcon(g, center - 15, y + (crime === 0 ? 43 : 51), 37, crime, happened);
  }
}

export function house(g, rooms, frame, crime, claimRoom) {
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
      rect(g, left + 2, 284, w - 4, 110, 2, '#806670', '#543e50', 2);
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
  for (const [i, room] of rooms.entries()) {
    const { x, y, w, h } = room;
    rect(g, x, y, w, h, 0, roomWalls[i], WOOD, 3);
    rect(g, x + 1.5, y + 66, w - 3, 44, 0, roomFloors[i]);
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
    decor(g, room, i, crime, frame.incident);
    const lamp = g.createRadialGradient(x + w - 12, y + 19, 1, x + w - 12, y + 19, 27);
    lamp.addColorStop(0, '#fff1a5bb');
    lamp.addColorStop(1, '#fff1a500');
    rect(g, x + w - 38, y + 4, 35, 41, 3, lamp);
    place(g, x + 17, y + 17, 24, i);
    path(g, [[x + w - 12, y + 5], [x + w - 12, y + 15]], null, WOOD, 1.2);
    path(g, [[x + w - 16, y + 17], [x + w - 14, y + 14], [x + w - 10, y + 14], [x + w - 8, y + 17]], '#b4816c', WOOD, .8);
    oval(g, x + w - 12, y + 19.5, 2.5, 2.7, '#fff3c6', WOOD, .75);
    if (i === claimRoom && !frame.blackout) {
      rect(g, x + 3.5, y + 4, w - 7, h - 8, 4, null, '#fff5cb', 3.1);
    }
  }
  for (const y of [169, 282, 395]) {
    rect(g, 20, y + 2, 320, 6, 2, '#563645', INK, 1.6);
    path(g, [[23, y + 3], [336, y + 3]], null, '#d69c85', 1.6);
  }
  if (frame.blackout) {
    for (const [i, { x, y, w, h }] of rooms.entries()) {
      rect(g, x + 1, y + 5, w - 2, h - 7, 1, i === claimRoom ? '#382b43' : '#292439', i === claimRoom ? GOLD : WOOD);
      place(g, x + 17, y + 17, 24, i);
    }
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
