import { FIELD_BOTTOM, HAZARD_TIME, PEN, WORLD, leftEdge, rightEdge } from './sim.js';

const { width, height } = WORLD;
const ink = '#181f28';
const paper = '#f3dfb4';
const gold = '#e6b578';
const crescent = 'M86 10A12.3 12.3 0 1 0 100 26A12.7 12.7 0 0 1 86 10Z';
const palettes = {
  pine: {
    sky: ['#292d44', '#65516b', '#bb796d'],
    ridge: ['#926b76', '#665b71', '#46495b', '#2a3d4b'],
    grass: ['#374d4b', '#3d5e55', '#2b504b', '#24413f'],
    hills: ['#557568', '#668275', '#234b46', '#1e3b3b'],
    woods: ['#3d5552', '#304944', '#283f3d', '#203432', '#1c2e30'],
    river: ['#485f70', '#4e7278', '#243f4a'],
    bank: '#577568', glint: '#b3c6ae', flowers: '#b79b66',
  },
  heather: {
    sky: ['#332d49', '#795775', '#d88d7b'],
    ridge: ['#af7a88', '#856482', '#5b4f6e', '#403e55'],
    grass: ['#514c58', '#66566b', '#56465e', '#413948'],
    hills: ['#8b707e', '#997985', '#51405a', '#372e45'],
    woods: ['#65576b', '#524a5b', '#443f52', '#362f43', '#29293b'],
    river: ['#655b83', '#636d8a', '#373b56'],
    bank: '#877283', glint: '#c9b2be', flowers: '#d39eae',
  },
};
const landscapes = new WeakMap();

function random(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function fill(ctx, color, path) {
  ctx.fillStyle = color;
  ctx.fill(new Path2D(path));
}

function line(ctx, color, weight, path) {
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.stroke(new Path2D(path));
}

function ellipse(ctx, color, x, y, rx, ry, rotation = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, 2 * Math.PI);
  ctx.fill();
}

function gradient(ctx, y1, y2, colors) {
  const value = ctx.createLinearGradient(0, y1, 0, y2);
  colors.forEach((color, i) => value.addColorStop(i / (colors.length - 1), color));
  return value;
}

function sky(ctx, colors, rng) {
  ctx.fillStyle = gradient(ctx, 0, 90, colors.sky);
  ctx.fillRect(0, 0, width, 93);
  fill(ctx, '#ecd3ac', 'M0 42Q38 39 50 42Q30 44 0 45Z M264 56Q309 50 360 52V54Q322 55 264 56Z');
  ctx.globalAlpha = .2;
  fill(ctx, paper, 'M0 60Q50 56 112 61L126 63Q59 62 0 65Z M305 36Q345 32 360 33V35Z');
  ctx.globalAlpha = 1;
  for (let i = 0; i < 46; i++) {
    ctx.globalAlpha = .17 + rng() * .54;
    const x = rng() * width;
    const y = 4 + rng() * 42;
    const size = .35 + rng() * .42;
    ellipse(ctx, paper, x, y, size, size);
  }
  ctx.globalAlpha = .64;
  fill(ctx, paper, 'M53 17l.7 2.8 2.5.7-2.5.7-.7 2.8-.7-2.8-2.5-.7 2.5-.7Z M311 21l.65 2.1 2.1.65-2.1.65-.65 2.1-.65-2.1-2.1-.65 2.1-.65Z');
  ctx.globalAlpha = 1;
  fill(ctx, paper, crescent);
  fill(ctx, colors.ridge[0], 'M0 68L20 48 29 51 39 39 52 46 65 59 70 58 87 69 111 56 129 64 144 45 157 49 179 68 201 47 229 57 242 45 251 49 281 32 299 47 309 43 326 56 344 50 360 60V115H0Z');
  ctx.globalAlpha = .29;
  fill(ctx, paper, 'M39 39L53 47 65 60 53 56 50 57 44 51 33 55 37 48 30 50Z M281 32L302 49 290 45 286 48 277 44 266 46 274 41Z M144 45L157 49 171 63 157 54 149 57 152 53 145 53 139 56Z');
  ctx.globalAlpha = 1;
  fill(ctx, colors.ridge[1], 'M0 80L18 65 42 69 53 62 71 71 83 70 100 65 122 76 146 64 165 69 187 78 222 61 234 64 253 73 276 66 300 72 321 62 343 64 360 57V125H0Z');
  fill(ctx, colors.ridge[2], 'M0 92L20 75 31 76 42 81 64 78 84 85 101 75 119 77 140 84 158 78 174 80 192 89 213 79 239 76 254 82 270 78 292 81 314 74 348 81 360 75V143H0Z');
  fill(ctx, colors.ridge[3], 'M0 94Q43 87 66 98Q82 102 115 93Q161 80 192 91Q218 98 248 89Q274 79 288 91Q315 104 360 81V151H0Z');
  ctx.globalAlpha = .22;
  line(ctx, colors.sky[2], .65, 'M2 89L25 82l26 7m11 3 19 2 19-7m147 1 14-4 17 4m18 6 31-6m8 1 17-3');
  ctx.globalAlpha = 1;
}

function meadow(ctx, colors, rng) {
  fill(ctx, gradient(ctx, 87, height, colors.grass), 'M0 113Q56 100 106 94Q162 77 199 89Q242 105 281 96Q337 93 360 104V520H0Z');
  ctx.globalAlpha = .26;
  fill(ctx, colors.hills[0], 'M0 143Q78 113 132 121Q202 143 270 125Q296 114 360 120V146Q302 131 255 145Q180 174 125 148Q74 128 0 170Z');
  fill(ctx, colors.hills[1], 'M0 208Q63 189 111 201Q163 216 219 200Q291 178 360 208V235Q281 194 212 224Q158 242 97 217Q64 202 0 233Z M0 336Q76 306 135 326Q176 342 222 324Q298 295 360 321V348Q298 319 214 353Q161 376 115 353Q70 328 0 371Z');
  fill(ctx, colors.hills[2], 'M0 265Q79 215 138 237Q192 257 249 234Q308 215 360 252V283Q306 244 243 265Q191 291 125 258Q72 236 0 290Z M0 403Q61 365 122 389Q190 414 242 389Q309 357 360 381V424Q291 391 227 423Q174 455 109 419Q57 392 0 442Z');
  fill(ctx, colors.hills[3], 'M0 491Q67 438 143 469Q194 488 232 465Q284 441 360 457V520H0Z');
  line(ctx, colors.hills[1], .7, 'M30 145Q67 135 108 138M119 144q46 19 94 4m13-4q42-13 75-9M18 230q63-26 123-3m18 7q47 11 105-9M76 258q33-6 60 1m8 4q36 18 68 11m9 72q54-20 96-12M25 357q51-22 101-10m16 6q39 20 62 12M110 407q60 25 105 6m26-10q32-13 59-7M48 471q53-17 103 5m8 2q43 13 72-3');
  ctx.globalAlpha = 1;

  for (let i = 0; i < 580; i++) {
    const x = rng() * width;
    const y = 95 + rng() * 425;
    const size = .38 + 4.3 * rng() * (y / height);
    ctx.globalAlpha = .08 + rng() * .19;
    line(ctx, i % 3 ? colors.hills[1] : colors.hills[3], .6,
      `M${x} ${y}q${size * .45} ${-size * .3} ${size} ${-size * .4}`);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 30; i++) {
    const x = 72 + rng() * 216;
    const y = 142 + rng() * 339;
    const size = .25 + .47 * y / height;
    ctx.globalAlpha = .27 + .15 * rng();
    tussock(ctx, x, y, size, i % 4 === 0 ? colors.flowers : colors.bank, colors.hills[3]);
  }
  ctx.globalAlpha = 1;
}

function tussock(ctx, x, y, scale, tips, leaves) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  line(ctx, leaves, 1.25, 'M0 0Q-1-7-9-11M0 0Q-4-16-2-19M0 0Q1-13 7-17M1 0Q5-5 12-7M-3 0Q-5-5-13-5');
  fill(ctx, tips, 'M-9-11q-3-2-4-6 4 1 5 5ZM-2-18q-3-3-1-7 3 4 1 7ZM7-16q1-5 5-6-1 4-5 6ZM12-7q1-4 5-4-1 3-5 4Z');
  ctx.restore();
}

function stream(ctx, colors, rng) {
  const trace = [];
  for (let y = 111; y <= height + 1; y += 3) trace.push(`L${rightEdge(y)} ${y}`);
  const yEnd = height + 1;
  const bank = `M${width} 93Q337 94 ${rightEdge(111)} 111${trace.join('')}L${rightEdge(yEnd)} ${yEnd}`;
  fill(ctx, gradient(ctx, 109, height, colors.river), `${bank}H${width}V93Z`);
  ctx.globalAlpha = .49;
  line(ctx, colors.bank, 2, bank);
  ctx.globalAlpha = .4;
  line(ctx, colors.glint, .65, bank);
  for (let i = 0; i < 220; i++) {
    const y = 109 + rng() * 410;
    const x = rightEdge(y) + 3 + rng() * (width - rightEdge(y));
    const run = .8 + rng() * (4 + y / 30);
    ctx.globalAlpha = .09 + rng() * (i % 6 === 0 ? .48 : .21);
    line(ctx, i % 6 === 0 ? paper : colors.glint, i % 3 === 0 ? 1.05 : .55,
      `M${x} ${y}q${run * .55} ${-run * .09} ${run} 0`);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 56; i++) {
    const y = 120 + rng() * 404;
    const x = rightEdge(y) - 2 + rng() * 3;
    if (i % 3 === 0) {
      const scale = .5 + y / 400;
      ellipse(ctx, colors.hills[3], x + 1, y + 1, scale * 4, scale * 1.5, .15);
      ellipse(ctx, colors.bank, x, y, scale * 3.7, scale * 1.25, .16);
    } else {
      tussock(ctx, x - 1, y, .28 + rng() * .4 * y / height, colors.flowers, colors.hills[3]);
    }
  }
}

function fir(ctx, x, ground, h, w, color, detail, lean, rng) {
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(w, h);
  ctx.transform(1, 0, lean, 1, 0, 0);
  const left = [];
  const right = [];
  for (let i = 1; i <= 5; i++) {
    const y = -1 + i * .166;
    const reach = .08 + .084 * i;
    left.push(`L${-reach * (.73 + .3 * rng())} ${y} l${reach * .39} -.019`);
    right.unshift(`L${reach * .62} ${y - .028} L${reach * (.78 + .36 * rng())} ${y + .013}`);
  }
  fill(ctx, color, `M0-1${left.join('')}L-.072 -.18V0H.056V-.15${right.join('')}Z`);
  fill(ctx, detail, 'M0-.88L-.008-.21-.33-.18-.086-.32-.27-.29-.054-.45-.185-.41-.025-.59-.11-.56Z');
  ctx.restore();
}

function woodland(ctx, colors, rng) {
  const edge = [];
  for (let y = 110; y <= height + 1; y += 4) edge.push(`L${leftEdge(y)} ${y}`);
  const slope = `M0 80Q24 78 ${leftEdge(110)} 110${edge.join('')}L${leftEdge(height + 1)} ${height + 1}`;
  fill(ctx, gradient(ctx, 80, height, colors.woods), `${slope}H0Z`);
  ctx.globalAlpha = .47;
  line(ctx, colors.bank, .8, slope);
  ctx.globalAlpha = 1;
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 31; i++) {
      const y = 107 + i * 13.9 + rng() * 10;
      const reach = leftEdge(y);
      const x = reach - 6 - row * 15 - rng() * 13;
      const tall = (20 + 25 * y / height) * (.64 + rng() * .62) * (1 + row * .14);
      const w = tall * (.42 + rng() * .29);
      const color = colors.woods[row + 1 + (i % 4 === 0 ? 1 : 0)];
      fir(ctx, x, y, tall, w, color, colors.woods[row], (rng() - .53) * .27, rng);
    }
  }
  for (let i = 0; i < 30; i++) {
    const y = 139 + rng() * 394;
    const x = leftEdge(y) - 2 + 6 * rng();
    tussock(ctx, x, y, .34 + .41 * rng(), colors.flowers, colors.woods[4]);
  }
}

function homesteadHill(ctx, y, colors) {
  fill(ctx, gradient(ctx, 35, y + 38, [colors.grass[0], colors.grass[0], colors.grass[1]]),
    'M32 118Q58 102 81 73Q104 42 140 35Q167 29 198 32Q239 33 258 52Q275 68 292 95Q301 109 322 122Q281 146 248 137Q214 130 175 142Q105 164 32 118Z');
  ctx.globalAlpha = .28;
  fill(ctx, colors.hills[1],
    'M42 121Q78 94 89 70Q108 47 133 43L135 47Q107 62 98 84Q81 114 55 127Z M254 54Q267 58 280 81Q290 102 319 117L303 124Q278 109 268 82Z');
  line(ctx, colors.hills[1], .7, 'M59 116q23-19 33-41m0 14q11-21 23-30m147 18q11 12 14 25m-11-11q8 18 24 26');
  ctx.globalAlpha = 1;
}

function stoneLedges(ctx, y, colors, rng) {
  for (const [start, end] of [[leftEdge(y) + 2, PEN.left], [PEN.right, rightEdge(y) - 1]]) {
    line(ctx, '#262e37', 3.2, `M${start} ${y - 1}q${(end - start) * .5} -2 ${end - start} .2`);
    for (let x = start + 1; x < end - 2;) {
      const span = 3 + rng() * 4;
      const top = y - 2 - rng() * 4;
      fill(ctx, colors.grass[0], `M${x} ${y}l.8 ${top - y + 1} ${span * .54} -1 ${span * .42} 2-.6 ${y - top - 2}Z`);
      line(ctx, colors.hills[1], .7, `M${x + 1.5} ${top + .8}l${span * .53} -.6`);
      x += span + .7;
    }
  }
}

function fold(ctx, gate, colors, rng) {
  const { x, y, width: opening } = gate;
  const { left, right, top } = PEN;
  const gateLeft = x - opening / 2;
  const gateRight = x + opening / 2;
  const inside = ctx.createRadialGradient(x + 28, 47, 5, x, 80, 106);
  inside.addColorStop(0, '#9c8063');
  inside.addColorStop(.56, colors.hills[0]);
  inside.addColorStop(1, colors.grass[0]);
  const back = top + 2;
  const floor = `M${left + 9} ${back + 3}Q${x} ${back - 5} ${right - 11} ${back + 1}L${right} ${y}H${left}Z`;
  fill(ctx, inside, floor);
  ctx.globalAlpha = .3;
  for (let i = 0; i < 50; i++) {
    const fx = left + 5 + rng() * 137;
    const fy = 48 + rng() * 66;
    line(ctx, i % 3 ? gold : colors.hills[3], .6, `M${fx} ${fy}l${1 + rng() * 5} -.35`);
  }
  ctx.globalAlpha = 1;
  const glow = ctx.createLinearGradient(0, y - 20, 0, y + 63);
  glow.addColorStop(0, '#f3c08d00');
  glow.addColorStop(.24, '#f3c08d5e');
  glow.addColorStop(.53, '#e6b5782e');
  glow.addColorStop(1, '#e6b57800');
  fill(ctx, glow, `M${gateLeft + 13} ${y - 20}H${gateRight - 13}Q${gateRight + 7} ${y + 26} ${gateRight + 37} ${y + 63}H${gateLeft - 37}Q${gateLeft - 7} ${y + 26} ${gateLeft + 13} ${y - 20}Z`);

  stoneLedges(ctx, y, colors, rng);
  const segments = [
    [left + 9, back + 3, x + 5, back - 1], [x + 5, back - 1, right - 11, back + 1],
    [left + 9, back + 3, left + 3, y - 32], [left + 3, y - 32, left, y],
    [right - 11, back + 1, right - 4, y - 31], [right - 4, y - 31, right, y],
    [left, y, gateLeft - 2, y - 1], [gateRight + 2, y - 1, right, y],
  ];
  for (const [x1, y1, x2, y2] of segments) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const count = Math.ceil(length / 7);
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
    line(ctx, '#263638', 7.3, `M0 0H${length}`);
    const brick = length / count;
    for (let i = 0; i < count; i++) {
      const start = i * brick;
      const high = -2.3 - rng() * .9;
      const tone = ['#6d685a', '#837460', '#766f5f', '#65635a'][i % 4];
      fill(ctx, tone, `M${start} .65l.5 ${high - .65} ${brick - 1.6} .28 .8 ${-high - .28}Z M${start + .6} 1.1l${brick - 1.4} -.2-.2 2.45-${brick - 1.9} -.25Z`);
      line(ctx, i % 3 === 0 ? '#bd9f78' : '#a7997a', .6, `M${start + .85} ${high + .4}l${brick - 2.35} .21`);
    }
    ctx.restore();
  }
  drawCroft(ctx, x + 38);
  for (const post of [gateLeft - 1, gateRight + 1]) {
    fill(ctx, '#322d32', `M${post - 3} ${y + 2}v-14l3-4 3 4v14Z`);
    line(ctx, '#cba47d', 1, `M${post - 2} ${y + 1}v-13l2-3`);
    fill(ctx, '#f8d78e', `M${post - 2} ${y - 15}h4v4h-4Z`);
  }
  line(ctx, '#e7bc82', 1.45, `M${gateLeft + 4} ${y + 1}Q${x} ${y + 4} ${gateRight - 4} ${y + 1}`);
  line(ctx, '#eed6aa', .6, `M${gateLeft + 9} ${y + 3}Q${x} ${y + 6} ${gateRight - 9} ${y + 3}`);
}

function drawCroft(ctx, x) {
  ctx.save();
  ctx.translate(x, 8);
  fill(ctx, '#292a35', 'M-23 37L16 33 32 42 10 47-22 44Z');
  fill(ctx, '#8e746d', 'M-26 21L11 21V43L-26 40Z');
  fill(ctx, '#574955', 'M11 21L24 13 33 26 33 39 11 43Z');
  fill(ctx, '#363343', 'M-30 24L-21 12 21 10 11 26Z');
  fill(ctx, '#514453', 'M-26 20L-21 12 21 10 17 15Z');
  fill(ctx, '#292b39', 'M11 26L21 10 36 27 33 28 23 16 14 28Z');
  fill(ctx, '#49404a', 'M6 14V6L10 5 12 7V14Z');
  line(ctx, '#ad8480', .8, 'M-29 23L12 24 21 10m-42 6 36-1m-39 4 37-1M-22 27l5 .5m-9 6 7 1m15-5 6 .5m-27 8 10 1m32-6 8-1');
  fill(ctx, '#fbce91', 'M-17 28h7v7h-7Z M23 26l4-.6v7l-4 .6Z');
  line(ctx, '#755454', .65, 'M-13.5 28v7m-3.5-3.5h7m15-2v13m17-13 4-.7');
  fill(ctx, '#584956', 'M1 43V30Q5 28 9 31v12Z');
  ellipse(ctx, '#eab680', 6.5, 36.5, .6, .6);
  ctx.restore();
}

function foreground(ctx, colors, rng) {
  ctx.globalAlpha = .61;
  fill(ctx, colors.hills[3], `M0 ${FIELD_BOTTOM + 4}q26-5 47 6q32 5 68 2q23-8 63 1q52 6 82-2q41-12 100 0V${height}H0Z`);
  ctx.globalAlpha = 1;
  for (let i = 0; i < 23; i++) {
    const x = rng() * width;
    const y = 508 + rng() * 16;
    tussock(ctx, x, y, .39 + rng() * .62, i % 5 ? colors.bank : colors.flowers, colors.woods[4]);
  }
  ctx.globalAlpha = .18;
  ctx.strokeStyle = paper;
  ctx.lineWidth = .65;
  ctx.strokeRect(4.5, 4.5, width - 9, height - 9);
  ctx.globalAlpha = 1;
  fill(ctx, '#f4d6a588', 'M4.5 22V4.5H22L5.6 5.6Z M355.5 22V4.5H338L354.4 5.6Z M4.5 498V515.5H22L5.6 514.4Z M355.5 498V515.5H338L354.4 514.4Z');
}

function landscape(ctx, gate, look) {
  let saved = landscapes.get(ctx.canvas);
  const key = `${look}:${gate.x}:${gate.y}:${gate.width}`;
  if (saved?.key === key) return saved.canvas;
  const canvas = ctx.canvas.ownerDocument?.createElement('canvas') ?? new OffscreenCanvas(1, 1);
  canvas.width = width * 2;
  canvas.height = height * 2;
  const layer = canvas.getContext('2d');
  layer.scale(2, 2);
  layer.lineCap = 'round';
  layer.lineJoin = 'round';
  const colors = palettes[look] ?? palettes.pine;
  const rng = random(4875432);
  sky(layer, colors, rng);
  meadow(layer, colors, rng);
  homesteadHill(layer, gate.y, colors);
  stream(layer, colors, rng);
  woodland(layer, colors, rng);
  fold(layer, gate, colors, rng);
  foreground(layer, colors, rng);
  for (let i = 0; i < 6500; i++) {
    const x = rng() * width;
    const y = rng() * height;
    layer.globalAlpha = .018 + .048 * rng();
    layer.fillStyle = i % 2 ? paper : ink;
    layer.fillRect(x, y, .35 + rng() * .64, .35 + rng() * .65);
  }
  layer.globalAlpha = 1;
  saved = { key, canvas };
  landscapes.set(ctx.canvas, saved);
  return canvas;
}

const spritePaths = new Map();

function sprite(ctx, color, data, weight = 0) {
  let path = spritePaths.get(data);
  if (!path) {
    path = new Path2D(data);
    spritePaths.set(data, path);
  }
  if (weight) {
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.stroke(path);
  } else {
    ctx.fillStyle = color;
    ctx.fill(path);
  }
}

function posture(ctx, animal, scale, stride, shadowWidth) {
  const turn = animal.angle ?? 0;
  const direction = Math.cos(turn) >= 0 ? 1 : -1;
  const pitch = Math.sin(turn);
  ellipse(ctx, '#151c2a55', animal.x, animal.y + 1, shadowWidth * scale, 3 * scale);
  ctx.translate(animal.x, animal.y + stride * -.8);
  ctx.scale(direction * scale * (.76 + .24 * Math.abs(Math.cos(turn))), scale);
  ctx.rotate(.18 * pitch);
}

function lengthwiseSheep(ctx, animal, scale, step) {
  const up = Math.sin(animal.angle) < 0;
  ellipse(ctx, '#151c2a55', animal.x, animal.y + 1, 7.6 * scale, 3 * scale);
  ctx.translate(animal.x, animal.y - Math.abs(step) * .7);
  ctx.scale(scale, scale);
  ctx.rotate(Math.cos(animal.angle) * (up ? .65 : -.65));
  ctx.strokeStyle = '#282835';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-4.9, -6); ctx.lineTo(-5.7, .5 + 1.4 * step);
  ctx.moveTo(4.9, -6); ctx.lineTo(5.7, .5 - 1.4 * step);
  ctx.moveTo(-3.7, -9); ctx.lineTo(-4.2, -2.7 - 2 * step);
  ctx.moveTo(3.7, -9); ctx.lineTo(4.2, -2.7 + 2 * step);
  ctx.stroke();
  if (up) {
    sprite(ctx, '#3b353e', 'M-4.2-14.1l-3-1.9 1.2-1.6 3.8 1.6Q0-21 2.9-16.6l3.4-1.2 1 1.9-3.1 1.6Z');
    sprite(ctx, '#9b7c6a', 'M-2.7-17.8q2.9-1.6 5.3 0l-.9.9-3.2-.1Z');
  }
  sprite(ctx, '#b9a48c', 'M-6.5-11.9Q-8.1-15.3-4.1-16.1Q-.8-18.1 1.7-16.6Q5.2-17.6 6.8-13.7Q8.3-11.4 6.8-9.7Q8.7-7 6.2-5.9Q5.9-3 2.7-3.4Q0-1.6-2.4-3.5Q-5.8-2.7-6.8-5.9Q-9.1-8.2-6.5-11.9Z');
  sprite(ctx, animal.status === 'home' ? '#f4d6a3' : '#f3e4bf', 'M-6.4-12Q-8-15.2-4.2-16.2Q-.8-18.2 1.7-16.6Q5.2-17.7 6.8-13.8Q8.1-11.7 6.1-10.7Q7-7.6 4.2-7.1Q2-5.3 0-6.7Q-2.4-5.3-4.1-7.1Q-7.6-7.6-6.4-12Z');
  sprite(ctx, '#af997d', 'M-4.2-12.6q1.1-1.4 2.6-.5m1.7-1.4q1.3-1.1 2.5.1m.6 3.2q1.4-1 2.1-.4m-6.6.8q1.4-1.2 2.6-.2', .6);
  if (up) {
    sprite(ctx, '#eadabd', 'M0-6.5q-3.2 1.2-2 3.5q2.4 2.1 4-.5 1-1.8-2-3Z');
  } else {
    sprite(ctx, '#33323a', 'M-4.3-7.9l-3.2-1.3-.1 2.4 2.7 1.3Q-4.8-2.7-2-1.8Q0-.1 2-1.8Q4.9-3 4.9-5.5l2.8-1.3-.1-2.4-3.5 1.3Q0-10.6-4.3-7.9Z');
    ellipse(ctx, '#e5c191', -2.6, -5.8, .52, .46);
    ellipse(ctx, '#e5c191', 2.6, -5.8, .52, .46);
    ellipse(ctx, '#191f2b', 0, -2.9, 1.4, .71);
  }
  if (animal.kind === 'ram') {
    const horn = up ? 'M-4.5-14.6q-4.9-2.4-3.6-5.2 1.6-2.2 4.1.3m8.5 4.9q4.9-2.4 3.6-5.2-1.6-2.2-4.1.3'
      : 'M-4.5-6.9q-4.9.4-3.6-4.4 1.6-2.2 4.1.3m8.5 4.1q4.9.4 3.6-4.4-1.6-2.2-4.1.3';
    sprite(ctx, '#ab7c59', horn, 2.4);
    sprite(ctx, '#eed1a1', horn, .8);
  }
}

function sheep(ctx, animal, clock, index) {
  const { x, y, kind, status } = animal;
  const atHome = status === 'home';
  const scale = (kind === 'lamb' ? .77 : kind === 'ram' ? 1.12 : 1) * (atHome ? .82 : .88 + .15 * y / height);
  const moving = Math.min(1, Math.hypot(animal.vx ?? 0, animal.vy ?? 0) / 28);
  const phase = clock * 15 + index * 2.1;
  const step = Math.sin(phase) * moving;
  if (animal.stray && status === 'field') {
    const pulse = .5 + .5 * Math.sin(clock * 11);
    ctx.globalAlpha = .53 + pulse * .31;
    ellipse(ctx, '#e4a66c55', x, y, 12 + pulse * 4, 5 + pulse * 1.5);
    line(ctx, '#f0a675', 1.3, `M${x - 17} ${y - 2}l-2 -3m35 1 3-3`);
    ctx.globalAlpha = 1;
  }
  if (status === 'field' && animal.hazardFor > 0) {
    ctx.strokeStyle = '#f39a78';
    ctx.lineWidth = 1.65;
    ctx.globalAlpha = .49 + .24 * Math.sin(clock * 14);
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 13, 8, 0, -Math.PI * .5,
      Math.min(1, animal.hazardFor / HAZARD_TIME) * Math.PI * 2 - Math.PI * .5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.save();
  if (status === 'lost') ctx.globalAlpha = .4;
  if (Math.abs(Math.sin(animal.angle)) > .77) {
    lengthwiseSheep(ctx, animal, scale, step);
    ctx.restore();
    return;
  }
  posture(ctx, animal, scale, Math.abs(step), 12);
  ctx.strokeStyle = '#252731';
  ctx.lineWidth = 2.35;
  ctx.beginPath();
  ctx.moveTo(-7, -5); ctx.lineTo(-7 - 2.8 * step, .15);
  ctx.moveTo(-4.1, -4); ctx.lineTo(-4.1 + 2.9 * step, 1.2);
  ctx.moveTo(3.6, -4.1); ctx.lineTo(3.6 - 2.4 * step, 1);
  ctx.moveTo(7.1, -5.4); ctx.lineTo(7.1 + 2.8 * step, -.4);
  ctx.stroke();
  sprite(ctx, '#cfbd9d', 'M-9.4-10.8Q-12-13-13.8-10.8Q-13-8-10.4-8Z');
  sprite(ctx, '#2c2a34', 'M-10-13Q-8-16.8-3.9-16Q-.7-18.5 2.6-16Q6.5-17.3 8.7-13.1Q12.7-13.2 13.3-9.6Q12.1-6.2 8.9-6.8Q7.2-3.5 3.4-4.4Q.7-2.8-2.7-4.7Q-7-2.4-8.7-5.5Q-12.4-5.6-11.6-9.2Q-13-11.6-10-13Z');
  sprite(ctx, '#c5ad93', 'M-10-12Q-8-16-4-15Q-.7-18 2.5-15.2Q6.6-16.5 8.7-11.7L8.4-6.8Q6.8-4.7 3.4-5.5Q.5-3.6-2.7-5.5Q-7-3.5-8.2-6.3Q-11.3-6-10.6-9Q-12-11.1-10-12Z');
  sprite(ctx, atHome ? '#f4d6a3' : '#f3e4bf', 'M-10.2-12.3Q-8.3-16.1-4.1-15Q-.5-17.5 2.4-15.2Q6.3-16.5 8.3-12.7L7.4-9.4Q5.6-7.2 3.1-8Q.3-6.2-2.5-7.9Q-6.1-6.6-8.1-8.1Q-11.6-8-10.2-12.3Z');
  sprite(ctx, '#b7a083aa', 'M-7.4-11.5q1.6-1.9 3.2-.5m2.1-.9q1.4-1.7 3.3-.4m1.8 2.9q1.2-1.8 3.2-.7m-12.2 1.6q1.1-1 2.5-.1', .6);
  sprite(ctx, '#33323a', 'M5.5-12.2Q7.1-14.7 9.3-12.2L12-11.1Q15.1-10.2 14.2-7.1Q12.7-4.5 9.7-6.2Q6.6-7.2 6.7-10L4.6-10.8Z');
  sprite(ctx, '#6a5052', 'M6.4-12.4L4.1-11.5 6.2-10.8 8.2-11.5Z');
  ellipse(ctx, '#f1c28a', 10.25, -9.9, .59, .52);
  ellipse(ctx, '#191f2b', 13.15, -7.6, 1.05, .75);
  if (kind === 'ram') {
    sprite(ctx, '#ab7c59', 'M8.7-11.4c4.6-1.1 3.2-6.9-.8-6.9-4.6 0-5.4 4.7-2.7 6.1 2.7 1.5 4.8-1.9 2.2-2.4', 2.2);
    sprite(ctx, '#eed1a1', 'M8.1-12.1c3.9-.9 2.8-5.6-.1-5.6-3.9 0-4.6 3.8-2.3 4.9 1.8.9 3.5-1.5 1.6-1.9', .8);
  }
  ctx.restore();
}

function lengthwiseCollie(ctx, dog, clock, bend, movement) {
  const up = Math.sin(dog.angle) < 0;
  ellipse(ctx, '#151c2a61', dog.x, dog.y + 1, 9.6, 4.5);
  ctx.translate(dog.x, dog.y - Math.abs(bend) * 1.5);
  ctx.rotate(Math.cos(dog.angle) * (up ? .7 : -.7));
  ctx.strokeStyle = '#d7c2a9';
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.moveTo(-5.6, -7); ctx.lineTo(-6.5 - bend, .8 + bend * 2.5);
  ctx.moveTo(5.6, -7); ctx.lineTo(6.5 + bend, .8 - bend * 2.5);
  ctx.moveTo(-3.9, -10); ctx.lineTo(-4.9, -3 - bend * 3.8);
  ctx.moveTo(3.9, -10); ctx.lineTo(4.9, -3 + bend * 3.8);
  ctx.stroke();
  const tail = up ? 'M0-5Q5 2 1 9Q-1 12-4 11Q-1 4-3-4Z' : 'M1-14Q3-22 9-24Q12-25 14-23Q7-19 6-12Z';
  const tip = up ? 'M3.2 6Q1 12-4 11Q-2.8 9-2.2 6Z' : 'M9-24Q12-25 14-23L10.1-20.4 8.6-22Z';
  ctx.save();
  ctx.translate(1.15 * Math.sin(clock * (movement > .05 ? 14 : 4)), 0);
  sprite(ctx, '#222932', tail);
  sprite(ctx, '#eadbc1', tip);
  ctx.restore();
  if (up) {
    sprite(ctx, '#1c2530', 'M-6.5-14.4-7.7-19.3-5.5-20.9-3.2-17.8-2.1-20.3-.6-22.7 1.6-23.1 3.8-20.5 4.4-17.8 5.9-21.1 8.3-19.5 6.8-14.2Z');
    sprite(ctx, '#d6c2a8', 'M-1-21.7l2.6-.8 1.3 2.5-.3 2.5-1.8-2.5Z');
  }
  sprite(ctx, '#1d2631', 'M-6.3-13.9Q-3.8-16.6 0-16.9Q4-16.6 6.8-13.9L8.1-10.1Q6.1-7.4 6.8-5.8L3.8-2.9-.5-3.4-4.9-2.5-7.2-5.6Q-6.6-9.8-8.1-10.3Z');
  sprite(ctx, '#515c5d', 'M-6.5-11.7l2.3-3.3 4.4-1 4.7 1.4 1 1.9q-5.4-1.6-8.4.9l-2.3 2.8-2.8.6Z');
  if (up) {
    sprite(ctx, '#ede0c6', 'M-7.1-13.6l3.8-2.3 1.1-1.5 4.4-.5 3.4 1.5 1.4 2-2.3.7-1.5 1.6-2.4-1.5-2.2 1.7-2.9-1.2-2.1 1.9Z');
    sprite(ctx, '#ad7464', 'M-4.1-15.6q4-2.2 8.4-.7', .8);
  } else {
    sprite(ctx, '#ede0c6', 'M-7.1-10.9l2.1-1.9 3.2 1.6 2.5-1.6 2.9 1.7 2.5-2 2.1 2.3-1.6 3.2L4-5.5.1-6.7-3-5.4-6.1-7Z');
    sprite(ctx, '#262c36', 'M-4.5-8.2-7.1-12.4-8.4-11.1-7.3-5.9-4.2-4.4-3.8-2.6 0-1.1 3.7-2.6 4.4-4.4 7.3-5.9 8.5-11.1 7.1-12.4 4.5-8.2 2.4-9.6-.5-10.1-3.5-9.4Z');
    sprite(ctx, '#e9dbc3', 'M-.7-8.8l2 .1 1 3-.5 1.8 1.1 1.1L0-1.3-2.8-3l1.1-2.5Z');
    ellipse(ctx, '#e4a775', -2.9, -6.3, .68, .52);
    ellipse(ctx, '#e4a775', 2.9, -6.3, .68, .52);
    ellipse(ctx, '#151f2a', 0, -2.5, 1.35, .76);
  }
}

function collie(ctx, dog, clock, ghost = false) {
  const movement = Math.min(1, Math.hypot(dog.vx ?? 0, dog.vy ?? 0) / 64);
  const phase = clock * 19;
  const bend = Math.sin(phase) * movement;
  const sway = Math.cos(phase) * movement;
  ctx.save();
  if (Math.abs(Math.sin(dog.angle)) > .77) {
    lengthwiseCollie(ctx, dog, clock, bend, movement);
    ctx.restore();
    return;
  }
  posture(ctx, dog, 1.05, Math.abs(sway) * 1.65, 16);
  ctx.beginPath();
  ctx.moveTo(-10.4, -6.9);
  ctx.quadraticCurveTo(-10 - 4 * bend, -1, -12 - 6 * bend, 1.2);
  ctx.moveTo(6.2, -7.1);
  ctx.quadraticCurveTo(5 - 6 * bend, -2.1, 4.4 - 7 * bend, 1);
  ctx.strokeStyle = '#282a32';
  ctx.lineWidth = 2.75;
  ctx.stroke();
  ctx.save();
  ctx.translate(-11, -10);
  ctx.rotate(.27 * Math.sin(clock * (movement > .1 ? 12 : 4)));
  sprite(ctx, '#202731', 'M1 2Q-4 3-7.2 .3L-13.3-5.2-16-8.3Q-11.2-9.2-6.2-5.3Q-3.1-2.6 1-2.1Z');
  sprite(ctx, '#ebdbc3', 'M-16-8.3Q-12.6-8.8-9.5-6.9L-10.9-3.2-13.4-5.3Z');
  ctx.restore();
  sprite(ctx, '#1c2630', 'M-12.7-13Q-8.4-16.7-1.8-14.5L4.4-15.1 8.4-17.4 11.4-17.8 12-20.5 14.3-21.7 15-17.2 17.3-15.8 20.6-14.6 21.8-13 19.1-10.7 13.8-10.1 11.5-6.4 7.8-7.9 4.8-6.1-2.5-7.3-8.9-5.3Q-13.9-5.4-14.2-9.3Z');
  sprite(ctx, '#4b5356', 'M-11.4-13Q-7.4-15.2-2.2-14.2L5.3-14.3 2.5-12.2Q-2.7-10.9-7.3-11.2L-11.8-10.3Z');
  sprite(ctx, '#efe1c0', 'M4.3-15L8.8-17.4 10.3-16Q9-13.3 11.1-11L12.8-10.4 11.5-7.2 8.3-7.8 6.8-6.8 4.2-9 5.5-11.5 3.8-13.3Z M14.2-17.7L15.9-16.6 17.4-15.4 20.7-14.6 20.4-12.2 16.4-12.5 14.2-13.7 15.2-15.1Z');
  sprite(ctx, '#bb8a6b', 'M13.1-15.3q1.1-1.4 2-.7l-.7.9Z M13-12.8l1.7-.4.8 1.2-2 .2Z');
  ellipse(ctx, '#e7b076', 14.4, -15.2, .64, .55);
  ellipse(ctx, '#131e24', 20.9, -13.75, .92, 1.05);
  ctx.beginPath();
  ctx.moveTo(-10, -6.3);
  ctx.quadraticCurveTo(-7.4 + 5.4 * bend, -2, -8.2 + 7 * bend, .6);
  ctx.lineTo(-9.5 + 7 * bend, 1.2);
  ctx.moveTo(8.9, -8.2);
  ctx.quadraticCurveTo(7.1 + 5.8 * bend, -2.4, 8.3 + 8 * bend, .7);
  ctx.lineTo(9.8 + 8 * bend, 1.2);
  ctx.strokeStyle = '#dcc9ad';
  ctx.lineWidth = 2.3;
  ctx.stroke();
  if (!ghost) sprite(ctx, '#b47661', 'M9.2-16.1l2.2 4.1 1.2.1-2.2-4.7Z');
  ctx.restore();
}

function wolf(ctx, animal, clock) {
  const { x, y, phase } = animal;
  const breath = .7 + .3 * Math.sin(clock * 8);
  if (phase === 'eyes') {
    ctx.save();
    ctx.globalAlpha = breath;
    ellipse(ctx, '#151a27b0', x, y, 15, 9);
    ellipse(ctx, '#e7896a', x - 4.3, y - 1, 1.75, 1.13, .26);
    ellipse(ctx, '#e7896a', x + 4.3, y - 1, 1.75, 1.13, -.26);
    ctx.restore();
    return;
  }
  ctx.save();
  const phaseStep = Math.sin(clock * 17);
  posture(ctx, animal, 1.25, Math.abs(phaseStep), 18);
  ctx.strokeStyle = '#2c2937';
  ctx.lineWidth = 2.7;
  ctx.beginPath();
  ctx.moveTo(-9, -7); ctx.lineTo(-10 - 6 * phaseStep, 0);
  ctx.moveTo(-7, -5.8); ctx.lineTo(-8 + 6 * phaseStep, .8);
  ctx.moveTo(7, -7); ctx.lineTo(8 + 7 * phaseStep, .75);
  ctx.moveTo(9, -7); ctx.lineTo(10 - 6 * phaseStep, .4);
  ctx.stroke();
  sprite(ctx, '#181f2b', 'M-11-14Q-18-16-28-10Q-17-8-13-10L-10-6-4.6-6.6 3-7.8 7-5.7 10-9 15-9.1 22.1-11.1 21.1-13.2 15.6-14.7 13.4-17.3 13.1-21.9 10.6-22.8 8-18.1 3.8-16.3Q-2-16.2-6-16Z');
  sprite(ctx, '#645866', 'M-27-10.3Q-17-15.5-11-13.7L-6-15.7 4.2-15.9 8.5-18.1 10.6-22.1 11.4-18.5 13.4-16.5 10.4-14.6 13.9-12.4 18.8-12.1 11-10.5 7.6-12.2 4.9-10.1 1.3-12.2-7.5-12.5-11.4-11-14-12Z');
  sprite(ctx, '#aa7770', 'M-5-15.4q4.1-.7 8.8-.2l4.7-1.8m4.3 3.2 5.2 1.4', .65);
  ellipse(ctx, '#f39a70', 14.4, -13.1, .92, .64);
  ellipse(ctx, '#1b1b28', 21.15, -12.55, .94, .67);
  ctx.restore();
}

function guideGesture(ctx, game, clock) {
  const sheepInField = game.sheep.filter(animal => animal.status === 'field');
  if (!sheepInField.length) return;
  const { dog, gate } = game;
  const groupX = sheepInField.reduce((total, animal) => total + animal.x, 0) / sheepInField.length;
  const groupY = sheepInField.reduce((total, animal) => total + animal.y, 0) / sheepInField.length;
  const under = Math.min(groupY + 34, dog.y - 17);
  const progress = (clock % 5.8) / 5.8;
  const fade = Math.min(1, progress * 10, (1 - progress) * 9);
  ctx.save();
  ctx.globalAlpha = fade * .63;
  ctx.setLineDash([1, 6]);
  line(ctx, paper, 1.65, `M${dog.x} ${dog.y - 3}Q${dog.x + 8} ${under + 8} ${groupX} ${under}`);
  line(ctx, gold, 1.4, `M${groupX} ${groupY - 22}Q${groupX - 4} ${(groupY + gate.y) / 2} ${gate.x} ${gate.y + 21}`);
  ctx.setLineDash([]);
  line(ctx, gold, 1.65, `M${gate.x - 6} ${gate.y + 28}l6 -7 6 7`);
  const t = Math.min(1, Math.max(0, (progress - .13) / .78));
  const glide = t * t * (3 - 2 * t);
  const x = dog.x + (gate.x - dog.x) * glide + 4 * Math.sin(glide * Math.PI);
  const y = dog.y + (gate.y + 34 - dog.y) * glide;
  if (dog.y - y > 14) {
    ctx.globalAlpha = fade * .44;
    collie(ctx, { x, y, vx: 5, vy: -56, angle: -1.21 }, clock, true);
    const lead = y - (dog.y - groupY) * (1 - glide) - 31 * glide;
    if (groupY - lead > 22) {
      ctx.globalAlpha = fade * .32;
      for (const [index, offset] of [-11, 0, 11].entries()) {
        sheep(ctx, { x: x + offset, y: lead + Math.abs(offset) * .4, vy: -26, angle: -Math.PI / 2 }, clock, index);
      }
    }
  }
  const radius = 6 + 2 * Math.sin(progress * Math.PI);
  ctx.globalAlpha = fade * .8;
  ctx.strokeStyle = paper;
  ctx.lineWidth = .9;
  ctx.beginPath();
  ctx.arc(x, y - 4, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.translate(x + 1.8, y - .5);
  sprite(ctx, '#3a353e', 'M-.4-1.6c.4-2.1 3.5-2.4 4.4-.3l2 7.2 1.9-.7 7.1 3.1.9 3.4-1.6 6.4-9 2.3-4.6-6.9-3.4-3c-2-1.9.2-4 2.3-2.7l2.5 1.5Z');
  sprite(ctx, paper, 'M.6-1.3c-.2-1.3 1.8-1.9 2.4-.6l2.3 8.3 2.7-1 6.2 3 .8 2.8-1.4 5.4-7.5 2-4.5-6.9-3.5-3c-1-1.1 0-2.2 1.2-1.5l4.4 2.8Z');
  ctx.restore();
}

const lateStars = [[17, 15], [26, 27], [38, 19], [53, 21], [64, 13], [110, 9],
  [127, 19], [140, 13], [157, 19], [171, 8], [208, 11], [258, 13], [273, 21],
  [291, 12], [305, 23], [311, 21], [323, 12], [342, 23], [349, 9]];

function nightfall(ctx, game, clock) {
  const progress = Math.min(1, game.time / game.limit);
  if (progress <= 0) return 0;
  const dark = progress ** 1.25;
  ctx.globalAlpha = dark;
  ctx.fillStyle = gradient(ctx, 0, height, ['#11142bd6', '#14243a54', '#111d2b62']);
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = dark * .76;
  sprite(ctx, paper, crescent);
  for (const [index, [x, y]] of lateStars.entries()) {
    const twinkle = .58 + .3 * Math.sin(index * 3 + clock * 1.65);
    ctx.globalAlpha = dark * twinkle;
    ellipse(ctx, paper, x, y, index % 4 ? .49 : .9, index % 4 ? .49 : .9);
  }
  ctx.globalAlpha = dark * .72;
  const croft = game.gate.x + 38;
  sprite(ctx, '#ffcd8d', `M${croft - 17} 36h7v7h-7Z M${croft + 23} 34l4-.6v7l-4 .6Z`);
  sprite(ctx, '#775454', `M${croft - 13.5} 36v7m-3.5-3.5h7m33-4.5 4-.7`, .65);
  ctx.globalAlpha = 1;
  return dark;
}

function lightAndWater(ctx, game, colors, clock, dark) {
  const glints = [141, 169, 197, 225, 251, 286, 319, 337, 374, 391, 427, 458, 477, 497];
  for (const [i, y] of glints.entries()) {
    const x = rightEdge(y) + 10 + i * 7 % 30 + Math.sin(clock + i) * 2;
    const shine = .5 + .5 * Math.sin(clock * 2.16 + i * 1.11);
    ctx.globalAlpha = .09 + shine * (.3 + dark * .14);
    const size = 3 + 7 * shine;
    ctx.strokeStyle = colors.glint;
    ctx.lineWidth = .65;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + size * .58, y - .5, x + size, y);
    ctx.stroke();
  }
  const { x, y, width: opening } = game.gate;
  const pulse = .4 + .6 * Math.sin(clock * 2.5) ** 2;
  for (const post of [x - opening / 2 - 1, x + opening / 2 + 1]) {
    const halo = ctx.createRadialGradient(post, y - 13, 1, post, y - 13, 14 + dark * 9);
    halo.addColorStop(0, '#ffdc8e');
    halo.addColorStop(.25, '#f9c88665');
    halo.addColorStop(1, '#f9c88600');
    ctx.globalAlpha = .34 + pulse * .28 + dark * .37;
    ellipse(ctx, halo, post, y - 13, 15 + dark * 9, 15 + dark * 9);
    ctx.globalAlpha = dark;
    ellipse(ctx, '#ffe0a0', post, y - 13.3, 1.9, 2);
  }
  ctx.globalAlpha = dark * .52;
  line(ctx, '#e7bc82', 1.45, `M${x - opening / 2 + 4} ${y + 1}Q${x} ${y + 4} ${x + opening / 2 - 4} ${y + 1}`);
  ctx.globalAlpha = 1;
}

function arrival(ctx, animal, time, index) {
  const age = time - animal.homeAt;
  if (animal.status !== 'home' || !Number.isFinite(age) || age < 0 || age > .85) return;
  const fade = 1 - age / .85;
  ctx.globalAlpha = fade * .95;
  for (let i = 0; i < 6; i++) {
    const turn = i * Math.PI / 3 + index * 1.1;
    const x = animal.x + Math.cos(turn) * (8 + age * 24);
    const y = animal.y - 6 + Math.sin(turn) * (5 + age * 18);
    ellipse(ctx, i % 2 ? paper : gold, x, y, 1.2 * fade, 1.2 * fade);
  }
  ctx.globalAlpha = 1;
}

export function draw(ctx, game, { clock = 0, look = 'pine', guide = false, pressed = false } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.drawImage(landscape(ctx, game.gate, look), 0, 0, width, height);
  const dark = nightfall(ctx, game, clock);
  lightAndWater(ctx, game, palettes[look] ?? palettes.pine, clock, dark);
  if (guide) guideGesture(ctx, game, clock);
  if (pressed && Number.isFinite(pressed.x) && Number.isFinite(pressed.y)) {
    const dx = pressed.x - game.dog.x;
    const dy = pressed.y - game.dog.y;
    const gap = Math.hypot(dx, dy);
    if (gap > 18) {
      const reach = Math.min(1, 44 / gap);
      ctx.setLineDash([1, 5]);
      line(ctx, '#edd3a195', 1.1, `M${game.dog.x} ${game.dog.y}l${dx * reach} ${dy * reach}`);
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = '#edcf9c9e';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(pressed.x, pressed.y, 8, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ellipse(ctx, '#f3dfb4c9', pressed.x, pressed.y, 1, 1);
  }
  const actors = game.sheep.map((animal, index) => ({ animal, index, paint: sheep }));
  actors.push({ animal: game.dog, paint: collie });
  if (game.wolf) actors.push({ animal: game.wolf, paint: wolf });
  actors.sort((a, b) => a.animal.y - b.animal.y);
  for (const { animal, index, paint } of actors) {
    paint(ctx, animal, clock, index);
    if (paint === sheep) arrival(ctx, animal, game.time, index);
  }
  ctx.restore();
}
