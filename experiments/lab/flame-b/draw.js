// Pass the Flame: the river drawn on a 2D canvas, in three looks. Pure drawing: it reads the scene and keeps only its
// own effects (wake, rain rings, sparks, pleats). Nothing here changes the rules.
import { radius } from './sim.js';
// The pool of light around the lantern, in metres: wide with a full flame, a small circle near the end.
export const pool = flame => 7 + 25 * Math.max(0, Math.min(1, flame));

export const LOOKS = {
  paper: {
    water: '#101B32', fiber: 'rgba(243,230,200,0.16)', dark: '7,12,26', night: [0.82, 0.5], edge: '243,230,200',
    bank: ['#F3E6C8', '#367C77', '#0c152b'], foam: '243,230,200', rock: '#F3E6C8', rockShade: '#2a3654', ember: '#FFC34D', emberCore: '#fff3cf',
    hull: '#0a1020', trim: '#CD4838', deck: '#172036', flame: '#FFC34D', glass: '255,195,77', text: '#F3E6C8', line: 'rgba(243,230,200,0.28)', wake: '243,230,200', pleat: ['#E9A23B', '#FFC34D', '#d98a2b'],
    hard: true, rockTop: '#fffaf0', wakeRock: '243,230,200',
  },
  thermal: {
    water: '#050C16', dark: '2,6,12', night: [0.8, 0.42], edge: '98,228,236', bank: ['#244D93', '#0a1730', '#071022'], current: '98,228,236', foam: '98,228,236', rock: '#1d3f78', rockShade: '#0b1a2f', rockTop: '#62E4EC', wakeRock: '98,228,236',
    ember: '#FF682B', emberCore: '#FFF3CF', hull: '#08101d', trim: '#FF682B', deck: '#122038', flame: '#FFF3CF', glass: '255,104,43', text: '#e9f6f8', line: 'rgba(98,228,236,0.3)', wake: '98,228,236',
  },
  storm: {
    water: '#123E40', dark: '6,20,21', night: [0.82, 0.48], edge: '160,180,190', bank: ['#526672', '#22292A', '#1a2021'], foam: '150,170,178', rock: '#22292A', rockShade: '#141a1b', rockTop: '#8da1ab', wakeRock: '190,205,212', rain: '138,158,168', rainLit: '214,228,234',
    ember: '#E8AB50', emberCore: '#fff0cf', hull: '#111515', trim: '#AF302B', deck: '#262e2f', flame: '#E8AB50', glass: '232,171,80', text: '#efe6d3', line: 'rgba(232,171,80,0.3)', wake: '200,210,205',
  },
};

const H = [0.34, -0.62];                       // one metre of height on screen, in units of k: up and a little right
const jag = (d, l) => 0.6 * Math.sin(d * 0.83 + l * 7.1) + 0.38 * Math.sin(d * 2.17 + l * 3.3) + 0.26 * Math.sin(d * 5.3 + l * 11.7);
const hash = n => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, u) => a + (b - a) * u;

export function createView(canvas) {
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas'), dctx = dark.getContext('2d');
  // The boat sits at A of the height. k (px a metre) is chosen so that AHEAD metres of river show above the boat in
  // portrait and in landscape alike (the same reaction time), and the river's width fits across a phone held upright.
  const AHEAD = 96;
  let W = 1, Hh = 1, dpr = 1, k = 6, A = 0.72;
  const fx = { wake: [], sparks: [], pleats: [], rain: [], rings: [], smoke: [], shake: 0, hit: -9, ember: -9, lastWake: 0 };
  const streaks = Array.from({ length: 46 }, (_, i) => ({ x: hash(i * 3 + 1), y: hash(i * 7 + 2), s: 0.6 + hash(i * 11 + 3) * 0.8 }));

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; Hh = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hh * dpr);
    dark.width = Math.max(1, Math.round(W / 2)); dark.height = Math.max(1, Math.round(Hh / 2));
    A = W > Hh * 1.15 ? 0.8 : 0.72;
    k = clamp(Math.min(W / 64, Hh * A / AHEAD), 2.4, 11);
  }
  resize();

  // effects the page reports
  function event(type, data = {}) {
    if (type === 'ember') { fx.ember = data.t; for (let i = 0; i < 18; i++) { const a = Math.random() * 6.283, v = 4 + Math.random() * 9; fx.sparks.push({ d: data.d, x: data.x, vd: Math.sin(a) * v, vx: Math.cos(a) * v, life: 0.5 + Math.random() * 0.5, age: 0 }); } fx.pleats.push({ age: 0 }); fx.rings.push({ d: data.d, x: data.x, age: 0, kind: 'ember' }); }
    if (type === 'hit') { fx.hit = data.t; fx.shake = data.what === 'rock' ? 1 : 0.45; for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283; fx.sparks.push({ d: data.d, x: data.x, vd: Math.sin(a) * 6, vx: Math.cos(a) * 6, life: 0.4, age: 0, ash: true }); } }
    if (type === 'drop') { for (let i = 0; i < 26; i++) fx.smoke.push({ d: data.d, x: data.x, age: -i * 0.07, vx: (Math.random() - 0.5) * 1.6, r: 0.6 + Math.random() * 0.8 }); }
    if (type === 'lit') { for (let i = 0; i < 22; i++) { const a = Math.random() * 6.283, v = 5 + Math.random() * 10; fx.sparks.push({ d: data.d, x: data.x, vd: Math.sin(a) * v, vx: Math.cos(a) * v, life: 0.5 + Math.random() * 0.6, age: 0 }); } fx.rings.push({ d: data.d, x: data.x, age: 0 }); }
    if (type === 'out') { for (let i = 0; i < 6; i++) fx.smoke.push({ d: data.d, x: data.x, age: -i * 0.06, vx: (Math.random() - 0.5) * 1.2, r: 0.3 + Math.random() * 0.4, small: true }); }
    if (type === 'reset') { fx.wake.length = 0; fx.sparks.length = 0; fx.pleats.length = 0; fx.rings.length = 0; fx.smoke.length = 0; fx.shake = 0; }
  }

  function draw(sc) {
    const L = LOOKS[sc.look] ?? LOOKS.paper, t = sc.t, dt = sc.dt ?? 1 / 60, s = sc.sim, rv = s.river;
    const z = sc.cam.z, kk = k * z, ay = Hh * A;
    fx.shake = Math.max(0, fx.shake - dt * 3);
    const shx = fx.shake ? (Math.random() - 0.5) * fx.shake * 7 : 0, shy = fx.shake ? (Math.random() - 0.5) * fx.shake * 7 : 0;
    const X = (d, x) => W / 2 + (x - sc.cam.x) * kk + shx, Y = d => ay - (d - sc.cam.d) * kk + shy;
    const dTop = sc.cam.d + ay / kk + 6, dBot = sc.cam.d - (Hh - ay) / kk - 6;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = L.water; ctx.fillRect(0, 0, W, Hh);

    // samples of the river on screen
    const step = clamp(2.6 / z, 2.2, 8), n = Math.ceil((dTop - dBot) / step) + 1, rows = [];
    for (let i = 0; i < n; i++) { const d = dBot + i * step; rows.push({ d, c: rv.center(d), h: rv.half(d), y: Y(d) }); }

    // water texture
    if (sc.look === 'paper') {
      // small cut-paper wave crescents, fixed in the water, drifting slowly
      ctx.fillStyle = L.fiber; ctx.beginPath();
      for (let cell = Math.floor(dBot / 6); cell <= dTop / 6; cell++) for (let j = 0; j < 3; j++) {
        const d = cell * 6 + hash(cell * 5 + j) * 6 - t * 1.5, f = hash(cell * 13 + j * 7) * 2 - 1, w = (0.9 + hash(cell * 17 + j) * 1.6) * kk;
        const xx = X(d, rv.center(d) + f * (rv.half(d) - 2)), yy = Y(d), th = Math.max(1.2, kk * 0.28);
        ctx.moveTo(xx - w, yy); ctx.quadraticCurveTo(xx, yy + th * 2.6, xx + w, yy); ctx.quadraticCurveTo(xx, yy + th * 1.1, xx - w, yy);
      }
      ctx.fill();
    } else if (sc.look === 'thermal') {
      const near = s.rocks.filter(q => q.d > dBot - 10 && q.d < dTop + 10);
      ctx.lineWidth = 1.1; ctx.setLineDash([10, 16]); ctx.lineDashOffset = t * 34;
      for (let f = -0.78; f <= 0.8; f += 0.26) {
        ctx.beginPath();
        for (let i = 0; i < rows.length; i += 1) {
          const r = rows[i]; let x = r.c + f * (r.h - 2);
          for (const q of near) { const dd = (r.d - q.d) / (q.r + 6), dx = x - (rv.center(q.d) + q.o); const push = (q.r + 3.2) * Math.exp(-dd * dd) * Math.exp(-(dx * dx) / ((q.r + 7) ** 2)); x += (dx >= 0 ? 1 : -1) * push; }
          i ? ctx.lineTo(X(r.d, x), r.y) : ctx.moveTo(X(r.d, x), r.y);
        }
        ctx.strokeStyle = `rgba(${L.current},${0.42 + 0.1 * Math.sin(f * 9 + t)})`; ctx.stroke();
      }
      ctx.setLineDash([]);
    } else {
      // rain rings, in the world; they split around rocks and catch the lantern
      while (fx.rain.length < 70) fx.rain.push({ d: mix(dBot, dTop, Math.random()), f: Math.random() * 2 - 1, age: -Math.random() * 1.2 });
      for (const r of fx.rain) { r.age += dt; if (r.age > 1 || r.d < dBot - 4) { r.d = mix(dBot, dTop, Math.random()); r.f = Math.random() * 2 - 1; r.age = 0; } }
    }

    // wake history
    if (sc.boat && sc.wake) {
      if (t - fx.lastWake > 0.04) { fx.wake.push({ d: sc.boat.d, x: sc.boat.x, t }); fx.lastWake = t; }
      while (fx.wake.length && t - fx.wake[0].t > 1.9) fx.wake.shift();
    }
    drawWake(L, sc, X, Y, kk, t);

    if (sc.look === 'storm') drawRain(L, sc, s, rv, X, Y, kk, t);

    // rocks and their ripples
    for (const q of s.rocks) {
      if (q.d < dBot - 6 || q.d > dTop + 6) continue;
      drawRock(L, sc.look, q, X(q.d, rv.center(q.d) + q.o), Y(q.d), kk, s.t);   // q.hit is in sim time
    }
    drawBanks(L, sc.look, rows, X, kk);

    // embers (bodies; their glow comes after the dark)
    for (const e of s.embers) if (!e.taken && e.d > dBot && e.d < dTop) drawEmber(L, X(e.d, rv.center(e.d) + e.o), Y(e.d) + Math.sin(t * 3 + e.d) * 1.2, kk, t, e.d, false);

    // things on the water
    const lights = [];
    for (const c of sc.chain ?? []) {
      const sx = X(c.d, c.x), sy = Y(c.d);
      const fk = Math.max(kk, c.small ? 3.6 : 4.6);
      drawFloat(L, sx, sy, fk, c.lit, t + c.d);
      if (c.lit > 0.02) lights.push([sx + H[0] * 1.6 * fk, sy + H[1] * 1.6 * fk, (c.small ? 4 : 7) * fk * c.lit, c.lit]);
    }
    if (sc.buoy && sc.buoy.d > dBot - 10 && sc.buoy.d < dTop + 20) {
      const sx = X(sc.buoy.d, sc.buoy.x), sy = Y(sc.buoy.d);
      drawBuoy(L, sx, sy, kk, sc.buoy.lit, t);
      lights.push([sx + H[0] * 3.4 * kk, sy + H[1] * 3.4 * kk, (6 + 26 * sc.buoy.lit) * kk, Math.max(0.35, sc.buoy.lit)]);
    }
    if (sc.dock) { const sx = X(sc.dock.d, sc.dock.x), sy = Y(sc.dock.d); drawPost(L, sx, sy, kk, sc.dock.lit, t); if (sc.dock.lit > 0.02) lights.push([sx + H[0] * 3 * kk, sy + H[1] * 3 * kk, 22 * kk * sc.dock.lit, sc.dock.lit]); }
    if (sc.sam) { const p = drawBoat(L, X(sc.sam.d, sc.sam.x), Y(sc.sam.d), kk, sc.sam.ang ?? 0, sc.sam.flame, t, true); if (sc.sam.flame > 0.01) lights.push([p.lx, p.ly, radius(sc.sam.flame) * kk * 0.8 * Math.min(1, sc.sam.flame * 3), Math.min(1, sc.sam.flame * 2)]); }
    let lantern = null;
    if (sc.boat) {
      const b = sc.boat, hitAgo = t - fx.hit;
      lantern = drawBoat(L, X(b.d, b.x), Y(b.d), kk, b.ang, b.flame, t, false, hitAgo);
      const R = b.flame > 0 ? pool(b.flame) * kk * (1 + 0.025 * Math.sin(t * 9) + 0.02 * Math.sin(t * 23)) * (hitAgo < 0.3 ? 0.82 + hitAgo * 0.6 : 1) : 0;
      if (R > 0) lights.push([lantern.lx, lantern.ly, R, 1, true]);
    }
    for (const e of s.embers) if (!e.taken && e.d > dBot && e.d < dTop) lights.push([X(e.d, rv.center(e.d) + e.o), Y(e.d), 5.5 * kk, 0.7]);
    if (sc.jump) lights.push([sc.jump.x, sc.jump.y, 10 * kk, 1]);

    // the dark, with holes where the light is
    drawDark(L, lights, sc.ambient ?? 0, sc.boat ? sc.boat.flame : 0);
    drawEdges(L, rows, X, sc.ambient ?? 0);

    // after the dark: what must stay readable, and what gives light
    if (sc.boat && sc.threats) drawThreats(L, sc, s, rv, X, Y, kk, t);
    for (const e of s.embers) if (!e.taken && e.d > dBot && e.d < dTop) drawEmber(L, X(e.d, rv.center(e.d) + e.o), Y(e.d) + Math.sin(t * 3 + e.d) * 1.2, kk, t, e.d, true);
    drawRings(L, X, Y, kk, dt);
    drawSparks(L, X, Y, kk, dt);
    if (lantern && sc.boat.flame > 0) { drawReflection(L, lantern, kk, t, t - fx.hit, sc.boat.vo ?? 0); drawGlow(L, lantern.lx, lantern.ly, kk, sc.boat.flame, t); }
    if (lantern && sc.look === 'paper') drawPleats(L, lantern, sc.boat, X, Y, kk, dt);
    if (sc.sam && sc.sam.flame > 0.01) { const [sx, sy] = boatLantern(X(sc.sam.d, sc.sam.x), Y(sc.sam.d), kk, sc.sam.ang ?? 0); drawGlow(L, sx, sy, kk, sc.sam.flame, t + 2); }
    for (const c of sc.chain ?? []) { const fk = Math.max(kk, c.small ? 3.6 : 4.6); if (c.lit > 0.02) drawGlow(L, X(c.d, c.x) + H[0] * 1.6 * fk, Y(c.d) + H[1] * 1.6 * fk, fk * 0.6, c.lit, t + c.d); }
    if (sc.cue && lantern) drawCue(L, lantern, kk, t, sc.cue);
    if (sc.dock && sc.dock.lit > 0.02) drawGlow(L, X(sc.dock.d, sc.dock.x) + H[0] * 3 * kk, Y(sc.dock.d) + H[1] * 3 * kk, kk * 0.7, sc.dock.lit, t);
    if (sc.buoy && sc.buoy.lit > 0.02) drawGlow(L, X(sc.buoy.d, sc.buoy.x) + H[0] * 3.4 * kk, Y(sc.buoy.d) + H[1] * 3.4 * kk, kk * 0.8, sc.buoy.lit, t);
    drawSmoke(L, X, Y, kk, dt);
    if (sc.jump) drawJump(L, sc.jump, kk, t);
    // names
    // names beside the lights (right of a float, flipped left near the edge) and under the stern of the boat that brings it
    for (const c of sc.chain ?? []) if (c.label) { const fk = Math.max(kk, 4.6); label(L, c.label, c.sub, X(c.d, c.x) + 1.7 * fk + 8, Y(c.d) + H[1] * 1.6 * fk + 4, 0.4 + 0.6 * Math.max(c.lit, 0.2), 'side', X(c.d, c.x) - 1.4 * fk - 8); }
    if (sc.sam?.label) { const bk = boatK(kk); label(L, sc.sam.label, sc.sam.sub, X(sc.sam.d, sc.sam.x), Y(sc.sam.d) + 3.7 * bk + 16, sc.sam.labelA ?? 1, 'center'); }
    if (sc.look === 'storm') drawStreaks(L, t, lantern);
    if (sc.progress !== null && sc.progress !== undefined) drawProgress(L, sc.progress, sc.flameNow ?? 0, sc.top ?? 0);
    if (sc.fade) { ctx.fillStyle = `rgba(0,0,0,${sc.fade})`; ctx.fillRect(0, 0, W, Hh); }
  }

  // the waterline of both banks, drawn over the dark: the river's shape stays readable upriver at any flame
  function drawEdges(L, rows, X, ambient) {
    ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      rows.forEach((r, i) => { const x = X(r.d, r.c + side * r.h); i ? ctx.lineTo(x, r.y) : ctx.moveTo(x, r.y); });
      ctx.strokeStyle = `rgba(${L.edge},${0.28 * (1 - ambient)})`; ctx.stroke();
    }
  }

  function drawBanks(L, look, rows, X, kk) {
    const sides = [-1, 1];
    const layers = look === 'paper' ? [[0, 0], [1.7, 1], [4.8, 2]] : look === 'thermal' ? [[0, 1]] : [[0, 1]];
    for (const side of sides) {
      for (const [off, ci] of layers) {
        ctx.beginPath();
        const edgeX = side < 0 ? -20 : W + 20;
        ctx.moveTo(edgeX, rows[0].y + 20);
        for (const r of rows) {
          const j = look === 'paper' ? jag(r.d + side * 31, ci + (side > 0 ? 5 : 0)) * (0.6 + ci * 0.25) : look === 'storm' ? 0.35 * Math.sin(r.d * 1.3 + side) : 0;
          ctx.lineTo(X(r.d, r.c + side * (r.h + off + j)), r.y);
        }
        ctx.lineTo(edgeX, rows[rows.length - 1].y - 20); ctx.closePath();
        ctx.fillStyle = L.bank[ci]; ctx.fill();
        if (look === 'paper' && ci === 1) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.save(); ctx.clip(); ctx.translate(side * 2, 3); ctx.fill(); ctx.restore(); }
      }
      if (look === 'thermal') {
        for (const [off, a] of [[0, 0.75], [3.2, 0.4], [7.5, 0.22], [13, 0.12]]) {
          ctx.beginPath();
          rows.forEach((r, i) => { const x = X(r.d, r.c + side * (r.h + off + Math.sin(r.d * 0.05 + off) * off * 0.25)); i ? ctx.lineTo(x, r.y) : ctx.moveTo(x, r.y); });
          ctx.strokeStyle = `rgba(36,77,147,${a})`; ctx.lineWidth = off ? 1.2 : 2.2; ctx.stroke();
        }
      }
      if (look === 'storm') {
        ctx.beginPath();
        rows.forEach((r, i) => { const x = X(r.d, r.c + side * (r.h + 0.35 * Math.sin(r.d * 1.3 + side))); i ? ctx.lineTo(x, r.y) : ctx.moveTo(x, r.y); });
        ctx.strokeStyle = L.bank[0]; ctx.lineWidth = 2; ctx.stroke();
        // grass on the bank
        ctx.beginPath();
        for (const r of rows) { if (hash(Math.floor(r.d) * 3 + side) > 0.45) continue; const x = X(r.d, r.c + side * (r.h + 1.2 + hash(Math.floor(r.d)) * 3)); ctx.moveTo(x, r.y); ctx.lineTo(x + side * 3, r.y - 7); ctx.moveTo(x + 2, r.y); ctx.lineTo(x + 2 + side * 5, r.y - 5); }
        ctx.strokeStyle = 'rgba(82,102,114,0.7)'; ctx.lineWidth = 1; ctx.stroke();
      }
      if (look === 'paper') {
        // reeds: short teal cuts standing on the bank
        ctx.fillStyle = L.bank[1];
        for (const r of rows) {
          const cell = Math.floor(r.d / 2.2); if (hash(cell * 7 + (side > 0 ? 1 : 0)) > 0.35) continue;
          const x = X(r.d, r.c + side * (r.h + 0.6)), hgt = (1.4 + hash(cell) * 2) * kk;
          ctx.beginPath(); ctx.moveTo(x - 1.5, r.y); ctx.lineTo(x + side * hgt * 0.25, r.y - hgt); ctx.lineTo(x + 1.5, r.y); ctx.fill();
        }
      }
    }
  }

  function drawRock(L, look, q, x, y, kk, t) {
    const rr = q.r * kk, seed = Math.floor(q.d * 10);
    // the wake: two lines of broken water trailing downstream (up the screen), and the cushion on the upstream side
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const u = i / 6, wx = x + side * (rr * (0.75 + 0.9 * u)) + Math.sin(t * 4 + i + q.spin) * kk * 0.25 * u, wy = y - rr * 0.3 - u * rr * 3.4; i ? ctx.lineTo(wx, wy) : ctx.moveTo(wx, wy); }
      ctx.strokeStyle = `rgba(${L.wakeRock},0.5)`; ctx.lineWidth = Math.max(1.2, kk * 0.28);
      if (look === 'paper') ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    for (let i = 0; i < 2; i++) { const u = (t * 0.9 + q.spin + i * 0.5) % 1; ctx.beginPath(); ctx.moveTo(x - rr * 0.4, y - rr * (1.1 + u * 2.2)); ctx.lineTo(x + rr * 0.4, y - rr * (1.1 + u * 2.2)); ctx.strokeStyle = `rgba(${L.wakeRock},${0.45 * (1 - u)})`; ctx.lineWidth = Math.max(1, kk * 0.22); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(x, y + rr * 0.35, rr * 1.3, rr * 0.85, 0, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.strokeStyle = `rgba(${L.foam},0.6)`; ctx.lineWidth = Math.max(1.5, kk * 0.35); ctx.stroke();
    ctx.lineCap = 'butt';
    // the rock: an irregular crown of ten points, a shade under it and a lit top facet
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + q.spin, m = 0.72 + 0.4 * hash(seed + i * 13); pts.push([x + Math.cos(a) * rr * m, y + Math.sin(a) * rr * m * 0.86]); }
    const path = (dx, dy, sc = 1) => { ctx.beginPath(); pts.forEach(([px, py], i) => { const X2 = x + (px - x) * sc + dx, Y2 = y + (py - y) * sc + dy; i ? ctx.lineTo(X2, Y2) : ctx.moveTo(X2, Y2); }); ctx.closePath(); };
    path(rr * 0.12, rr * 0.22); ctx.fillStyle = L.rockShade; ctx.fill();
    path(0, 0); ctx.fillStyle = L.rock; ctx.fill();
    ctx.strokeStyle = look === 'thermal' ? 'rgba(98,228,236,0.95)' : look === 'storm' ? 'rgba(170,190,200,0.75)' : 'rgba(16,27,50,0.45)'; ctx.lineWidth = look === 'paper' ? 1 : 1.6; ctx.stroke();
    path(-rr * 0.12, -rr * 0.16, 0.52); ctx.fillStyle = L.rockTop; ctx.globalAlpha = look === 'paper' ? 0.9 : 0.55; ctx.fill(); ctx.globalAlpha = 1;
    if (q.hit && t - q.hit >= 0 && t - q.hit < 0.5) { ctx.beginPath(); ctx.arc(x, y, rr + (t - q.hit) * 30, 0, 6.283); ctx.strokeStyle = `rgba(${L.foam},${0.8 * (1 - (t - q.hit) * 2)})`; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function drawThreats(L, sc, s, rv, X, Y, kk, t) {
    // a rock out past the light still shows its water break and outline, early enough to react
    const R = radius(sc.boat.flame);
    for (const q of s.rocks) {
      const ahead = q.d - sc.boat.d; if (ahead < R * 0.55 || ahead > 135) continue;
      const a = clamp(1 - (ahead - 70) / 65, 0.25, 1) * (sc.look === 'thermal' ? 0.85 : 0.7);
      const x = X(q.d, rv.center(q.d) + q.o), y = Y(q.d), rr = q.r * kk;
      ctx.beginPath(); ctx.ellipse(x, y + rr * 0.35, rr * 1.3, rr * 0.9, 0, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.strokeStyle = `rgba(${L.foam},${a})`; ctx.lineWidth = Math.max(1.5, kk * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, rr * 0.95, rr * 0.8, 0, 0, 6.283);
      ctx.strokeStyle = `rgba(${L.foam},${a * 0.6})`; ctx.lineWidth = 1; ctx.stroke();
    }
  }

  function drawEmber(L, x, y, kk, t, seed, glow) {
    const p = 0.75 + 0.25 * Math.sin(t * 7 + seed);
    if (!glow) { ctx.beginPath(); ctx.arc(x, y, kk * 1.3, 0, 6.283); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); return; }
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, kk * 3.2 * p);
    g.addColorStop(0, L.ember); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.globalAlpha = 0.55; ctx.fillRect(x - kk * 4, y - kk * 4, kk * 8, kk * 8); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    kk = Math.max(kk, 4.4);
    if (L === LOOKS.paper) { ctx.beginPath(); ctx.moveTo(x, y - kk * 1.1); ctx.lineTo(x + kk * 0.75, y); ctx.lineTo(x, y + kk * 1.1); ctx.lineTo(x - kk * 0.75, y); ctx.closePath(); ctx.fillStyle = L.ember; ctx.fill(); ctx.beginPath(); ctx.moveTo(x, y - kk * 0.5); ctx.lineTo(x + kk * 0.3, y); ctx.lineTo(x, y + kk * 0.5); ctx.lineTo(x - kk * 0.3, y); ctx.fillStyle = L.emberCore; ctx.fill(); }
    else if (L === LOOKS.thermal) {
      // a white-hot four-point spark that turns slowly
      const a0 = t * 1.5 + seed, o = kk * 1.25 * p, i2 = kk * 0.32;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = a0 + i * Math.PI / 4, m = i % 2 ? i2 : o; ctx.lineTo(x + Math.cos(a) * m, y + Math.sin(a) * m); } ctx.closePath(); ctx.fillStyle = L.ember; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, kk * 0.32, 0, 6.283); ctx.fillStyle = L.emberCore; ctx.fill();
    } else {
      // a brass teardrop, point up, like a small flame on the water
      const hgt = kk * 1.5 * p, wd = kk * 0.7;
      ctx.beginPath(); ctx.moveTo(x, y - hgt); ctx.quadraticCurveTo(x + wd * 1.2, y - hgt * 0.1, x, y + wd * 0.8); ctx.quadraticCurveTo(x - wd * 1.2, y - hgt * 0.1, x, y - hgt); ctx.fillStyle = L.ember; ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y + wd * 0.05, wd * 0.32, wd * 0.5, 0, 0, 6.283); ctx.fillStyle = L.emberCore; ctx.fill();
    }
  }

  // the boat: dark hull, high prow, a square lantern hung from a crook with a gap above the hull
  const BOAT = 1.45, LAN_H = 3.1;
  const boatK = kk => Math.max(kk, 4.2) * BOAT;   // never smaller than this on screen (landscape, wide arrival)
  function boatLantern(x, y, kk, ang) { kk = boatK(kk); const c = Math.cos(ang), s = Math.sin(ang), px = 0.7, py = 0.6; return [x + (px * c - py * s) * kk + H[0] * LAN_H * kk, y + (px * s + py * c) * kk + H[1] * LAN_H * kk]; }
  function drawBoat(L, x, y, kk0, ang, flame, t, other, hitAgo = 9) {
    const kk = boatK(kk0);
    const c = Math.cos(ang), s = Math.sin(ang), P = (px, py) => [x + (px * c - py * s) * kk, y + (px * s + py * c) * kk];
    const up = (p, h) => [p[0] + H[0] * h * kk, p[1] + H[1] * h * kk];
    const bob = Math.sin(t * 2.1) * 0.06;
    const bow = P(0, -3.7), mast = P(0.3, 2.5);
    const rim = L === LOOKS.thermal ? 'rgba(98,228,236,0.7)' : L === LOOKS.storm ? 'rgba(200,215,222,0.55)' : 'rgba(243,230,200,0.75)';
    // shadows on the water, thrown down and left: hull, then the prow and lantern that stand up above it
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x - 0.5 * kk, y + 0.9 * kk, 1.5 * kk, 3.9 * kk, ang, 0, 6.283); ctx.fill();
    ctx.fillRect(x - 2.4 * kk, y + 0.4 * kk, 0.9 * kk, 0.9 * kk);
    // hull
    const hull = () => { ctx.beginPath(); const pts = [[0, -3.7], [1.6, -1.9, 1.45, 0.9], [1.3, 3.2, 0, 3.45], [-1.3, 3.2, -1.45, 0.9], [-1.6, -1.9, 0, -3.7]];
      ctx.moveTo(...P(...pts[0])); for (let i = 1; i < pts.length; i++) ctx.quadraticCurveTo(...P(pts[i][0], pts[i][1]), ...P(pts[i][2], pts[i][3])); };
    hull(); ctx.fillStyle = L.hull; ctx.fill();
    ctx.lineWidth = Math.max(1.5, kk * 0.24); ctx.strokeStyle = other ? 'rgba(243,230,200,0.35)' : L.trim; ctx.stroke();
    // a lit edge on the side away from the shadow
    ctx.save(); hull(); ctx.clip(); ctx.beginPath(); ctx.ellipse(...P(0.35, 0), 1.45 * kk, 3.7 * kk, ang, 0, 6.283); ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1, kk * 0.14); ctx.globalAlpha = other ? 0.4 : 0.8; ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
    // deck well and thwarts
    ctx.beginPath(); ctx.ellipse(...P(0, 0.6), 0.7 * kk, 2.0 * kk, ang, 0, 6.283); ctx.fillStyle = L.deck; ctx.fill();
    ctx.strokeStyle = L.hull; ctx.lineWidth = Math.max(1, kk * 0.2); ctx.beginPath(); ctx.moveTo(...P(-1.2, -0.7)); ctx.lineTo(...P(1.2, -0.7)); ctx.moveTo(...P(-1.25, 1.7)); ctx.lineTo(...P(1.25, 1.7)); ctx.stroke();
    // the high prow: a dark neck that rises from the bow and curls back
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const p1 = up(P(0, -4.3), 1.6), p2 = up(P(0, -4.1), 3.4), p3 = up(P(0, -3.4), 3.6), p4 = up(P(0, -3.35), 3.0);
    ctx.beginPath(); ctx.moveTo(...bow); ctx.quadraticCurveTo(...p1, ...p2); ctx.quadraticCurveTo(...p3, ...p4);
    ctx.strokeStyle = L.hull; ctx.lineWidth = Math.max(4, kk * 0.85); ctx.stroke();
    ctx.strokeStyle = other ? 'rgba(243,230,200,0.4)' : L.trim; ctx.lineWidth = Math.max(1, kk * 0.14); ctx.stroke();
    // the crook, and the lantern hanging from it: a clear gap between lantern and hull
    const sway = Math.sin(t * 2.6) * 0.1 + (hitAgo < 0.6 ? Math.sin(hitAgo * 30) * (0.6 - hitAgo) * 0.7 : 0);
    const c1 = up(mast, 4.2 + bob), c2 = up(P(0.45, 1.4), 5.0 + bob), c3 = up(P(0.7, 0.6), 4.7 + bob);
    ctx.beginPath(); ctx.moveTo(...mast); ctx.lineTo(...c1); ctx.quadraticCurveTo(...c2, ...c3);
    ctx.strokeStyle = L.hull; ctx.lineWidth = Math.max(2, kk * 0.26); ctx.stroke();
    const lan = up(P(0.7, 0.6), LAN_H + bob), lx = lan[0] + sway * kk, ly = lan[1], sq = 1.35 * kk;
    ctx.beginPath(); ctx.moveTo(...c3); ctx.lineTo(lx, ly - sq * 0.75); ctx.strokeStyle = L.hull; ctx.lineWidth = Math.max(1, kk * 0.1); ctx.stroke();
    // cap, frame, glass
    ctx.fillStyle = L.hull;
    ctx.beginPath(); ctx.moveTo(lx - sq * 0.7, ly - sq * 0.5); ctx.lineTo(lx, ly - sq * 0.82); ctx.lineTo(lx + sq * 0.7, ly - sq * 0.5); ctx.fill();
    ctx.fillRect(lx - sq / 2 - 1.5, ly - sq / 2 - 1, sq + 3, sq + 2.5);
    if (flame > 0.005) {
      const g = ctx.createLinearGradient(lx, ly + sq / 2, lx, ly - sq / 2);
      g.addColorStop(0, `rgba(${L.glass},${0.6 + 0.4 * flame})`); g.addColorStop(1, `rgba(${L.glass},${0.3 + 0.4 * flame})`);
      ctx.fillStyle = g; ctx.fillRect(lx - sq / 2 + 1, ly - sq / 2 + 1, sq - 2, sq - 2);
      const fh = (0.3 + 0.5 * flame) * sq * (1 + 0.12 * Math.sin(t * 17) + 0.08 * Math.sin(t * 29)), fw = sq * (0.16 + 0.12 * flame);
      ctx.beginPath(); ctx.moveTo(lx, ly + sq * 0.36 - fh); ctx.quadraticCurveTo(lx + fw, ly + sq * 0.2, lx, ly + sq * 0.38); ctx.quadraticCurveTo(lx - fw, ly + sq * 0.2, lx, ly + sq * 0.36 - fh);
      ctx.fillStyle = '#fff8e0'; ctx.fill();
    } else { ctx.fillStyle = 'rgba(58,60,70,0.9)'; ctx.fillRect(lx - sq / 2 + 1, ly - sq / 2 + 1, sq - 2, sq - 2); }
    ctx.lineCap = 'butt';
    return { lx, ly, bx: bow[0], by: bow[1], x, y };
  }

  function drawFloat(L, x, y, kk, lit, t) {
    const b = Math.sin(t * 1.7) * 0.15, top = [x + H[0] * 1.6 * kk, y + H[1] * (1.6 + b) * kk];
    ctx.beginPath(); ctx.ellipse(x, y, 1.1 * kk, 0.8 * kk, 0, 0, 6.283); ctx.fillStyle = L.hull; ctx.fill(); ctx.strokeStyle = `rgba(${L.foam},0.4)`; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(top[0], top[1] + 0.5 * kk); ctx.strokeStyle = L.hull; ctx.lineWidth = Math.max(1, kk * 0.2); ctx.stroke();
    const sq = 0.9 * kk; ctx.fillStyle = L.hull; ctx.fillRect(top[0] - sq / 2 - 1, top[1] - sq / 2 - 1, sq + 2, sq + 2);
    ctx.fillStyle = lit > 0.02 ? `rgba(${L.glass},${0.3 + 0.7 * lit})` : 'rgba(70,70,80,0.7)'; ctx.fillRect(top[0] - sq / 2, top[1] - sq / 2, sq, sq);
  }
  function drawPost(L, x, y, kk, lit, t) {
    const top = [x + H[0] * 3 * kk, y + H[1] * 3 * kk];
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(...top); ctx.strokeStyle = L.hull; ctx.lineWidth = Math.max(2, kk * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, 1.3 * kk, 0.6 * kk, 0, 0, 6.283); ctx.strokeStyle = `rgba(${L.foam},0.35)`; ctx.lineWidth = 1; ctx.stroke();
    const sq = 1.2 * kk; ctx.fillStyle = L.hull; ctx.fillRect(top[0] - sq / 2 - 1.5, top[1] - sq / 2 - 1.5, sq + 3, sq + 3);
    ctx.fillStyle = lit > 0.02 ? `rgba(${L.glass},${0.3 + 0.7 * lit})` : 'rgba(70,70,80,0.7)'; ctx.fillRect(top[0] - sq / 2, top[1] - sq / 2, sq, sq);
  }
  function drawBuoy(L, x, y, kk, lit, t) {
    const b = Math.sin(t * 1.4) * 0.12, top = [x + H[0] * 3.4 * kk, y + H[1] * (3.4 + b) * kk];
    ctx.beginPath(); ctx.ellipse(x, y, 2.2 * kk, 1.6 * kk, 0, 0, 6.283); ctx.fillStyle = L.trim; ctx.fill(); ctx.lineWidth = Math.max(1.5, kk * 0.3); ctx.strokeStyle = L.hull; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, 1.2 * kk, 0.85 * kk, 0, 0, 6.283); ctx.fillStyle = L.text; ctx.fill();
    for (let i = 0; i < 2; i++) { const u = (t * 0.4 + i * 0.5) % 1; ctx.beginPath(); ctx.ellipse(x, y, (2.4 + u * 4) * kk, (1.8 + u * 3) * kk, 0, 0, 6.283); ctx.strokeStyle = `rgba(${L.foam},${0.35 * (1 - u)})`; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(top[0], top[1] + 0.6 * kk); ctx.strokeStyle = L.hull; ctx.lineWidth = Math.max(2, kk * 0.32); ctx.stroke();
    const sq = 1.4 * kk; ctx.fillStyle = L.hull; ctx.fillRect(top[0] - sq / 2 - 1.5, top[1] - sq / 2 - 1.5, sq + 3, sq + 3);
    ctx.fillStyle = lit > 0.02 ? `rgba(${L.glass},${0.35 + 0.65 * lit})` : 'rgba(80,80,90,0.8)'; ctx.fillRect(top[0] - sq / 2, top[1] - sq / 2, sq, sq);
  }

  function drawWake(L, sc, X, Y, kk, t) {
    const w = fx.wake; if (w.length < 2) return;
    const thermal = sc.look === 'thermal';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i < w.length; i++) { const p = w[i], age = t - p.t, off = 1.3 + age * 3.4; const x = X(p.d - 3, p.x + side * off), y = Y(p.d - 3); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = thermal ? 'rgba(36,77,147,0.55)' : `rgba(${L.wake},${sc.look === 'paper' ? 0.22 : 0.18})`; ctx.lineWidth = sc.look === 'paper' ? 2 : 1.4;
      if (sc.look === 'paper') ctx.setLineDash([7, 5]); ctx.stroke(); ctx.setLineDash([]);
    }
    if (thermal) {
      // the curved wake cools from white through orange to blue
      ctx.lineCap = 'round';
      for (let i = w.length - 1; i > 0; i--) {
        const a = w[i], b = w[i - 1], age = (t - a.t) / 1.9;
        const col = age < 0.18 ? [255, 243, 207] : age < 0.5 ? [255, Math.round(mix(243, 104, (age - 0.18) / 0.32)), Math.round(mix(207, 43, (age - 0.18) / 0.32))] : [Math.round(mix(255, 36, (age - 0.5) / 0.5)), Math.round(mix(104, 77, (age - 0.5) / 0.5)), Math.round(mix(43, 147, (age - 0.5) / 0.5))];
        ctx.beginPath(); ctx.moveTo(X(a.d - 3.4, a.x), Y(a.d - 3.4)); ctx.lineTo(X(b.d - 3.4, b.x), Y(b.d - 3.4));
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.9 * (1 - age)})`; ctx.lineWidth = Math.max(1, kk * (0.9 - age * 0.6)); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
  }

  function drawRain(L, sc, s, rv, X, Y, kk, t) {
    const lan = sc.boat ? { d: sc.boat.d, x: sc.boat.x, R: radius(sc.boat.flame) } : null;
    const near = s.rocks;
    for (const r of fx.rain) {
      if (r.age < 0) continue;
      const hw = rv.half(r.d), x = rv.center(r.d) + r.f * (hw - 1), u = r.age, rad = 0.3 + u * 2.6;
      let lit = 0; if (lan) { const dist = Math.hypot(r.d - lan.d, x - lan.x); lit = clamp(1 - dist / lan.R, 0, 1); }
      const col = lit > 0.05 ? L.rainLit : L.rain, a = (1 - u) * (0.28 + 0.6 * lit);
      const sx = X(r.d, x), sy = Y(r.d);
      // split around a rock: leave out the arc that faces it
      let gapA = null;
      for (const q of near) { if (Math.abs(q.d - r.d) > q.r + 4) continue; const qx = rv.center(q.d) + q.o, dx = qx - x, dd = q.d - r.d, dist = Math.hypot(dx, dd); if (dist < q.r + rad + 0.4) { gapA = Math.atan2(-dd, dx); break; } }
      ctx.beginPath();
      if (gapA === null) ctx.ellipse(sx, sy, rad * kk, rad * kk * 0.8, 0, 0, 6.283);
      else { ctx.ellipse(sx, sy, rad * kk, rad * kk * 0.8, 0, gapA + 0.9, gapA + 6.283 - 0.9); }
      ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  function drawStreaks(L, t, lantern) {
    ctx.strokeStyle = 'rgba(160,180,186,0.16)'; ctx.lineWidth = 1; ctx.beginPath();
    for (const p of streaks) { const y = ((p.y + t * 1.3 * p.s) % 1) * (Hh + 40) - 20, x = ((p.x + t * 0.18 * p.s) % 1) * (W + 40) - 20; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16 * p.s); }
    ctx.stroke();
  }

  // The dark: a night that lets the river be read upriver (darker as the flame weakens), and a local pool of light around
  // the lantern whose size is the flame. Paper cuts the pool in two hard tones; thermal and storm fade it.
  function drawDark(L, lights, ambient, flame) {
    const dw = dark.width, dh = dark.height, sx = dw / W, sy = dh / Hh;
    const night = mix(L.night[0], L.night[1], clamp(flame, 0, 1)) * (1 - ambient);
    dctx.globalCompositeOperation = 'source-over'; dctx.clearRect(0, 0, dw, dh);
    dctx.fillStyle = `rgba(${L.dark},${night})`; dctx.fillRect(0, 0, dw, dh);
    dctx.globalCompositeOperation = 'destination-out';
    for (const [x, y, r, a, main] of lights) {
      if (r < 1) continue;
      const cx = x * sx, cy = y * sy, rr = r * sx, g = dctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      if (L.hard && main) { g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.58, `rgba(0,0,0,${a})`); g.addColorStop(0.585, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(0.99, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)'); }
      else { g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.45, `rgba(0,0,0,${a * 0.8})`); g.addColorStop(1, 'rgba(0,0,0,0)'); }
      dctx.fillStyle = g; dctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    ctx.imageSmoothingEnabled = true; ctx.drawImage(dark, 0, 0, W, Hh);
    // a faint warm tint inside the pool
    const main = lights.find(l => l[4]);
    if (main) {
      const [x, y, r] = main;
      ctx.globalCompositeOperation = 'lighter';
      if (L.hard) { ctx.beginPath(); ctx.arc(x, y, r * 0.58, 0, 6.283); ctx.fillStyle = 'rgba(255,195,77,0.05)'; ctx.fill(); }
      else { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${L.glass},0.12)`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // the arrival's one cue: a ring that breathes around your own dark lantern
  function drawCue(L, lan, kk, t, a) {
    const u = (t * 0.8) % 1, r = Math.max(kk, 4.2) * (1.6 + u * 3);
    ctx.beginPath(); ctx.arc(lan.lx, lan.ly, r, 0, 6.283); ctx.strokeStyle = `rgba(${L.glass},${a * 0.8 * (1 - u)})`; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawGlow(L, x, y, kk, flame, t) {
    const r = kk * (2.2 + 2.8 * flame) * (1 + 0.06 * Math.sin(t * 13));
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${L.glass},${0.5 * Math.min(1, flame + 0.3)})`); g.addColorStop(0.4, `rgba(${L.glass},${0.16 * flame + 0.04})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawReflection(L, lan, kk, t, hitAgo, vo) {
    // the lantern's reflection on the water below it, broken by speed and by a blow
    const breakA = 0.15 + Math.min(1, Math.abs(vo) / 18) * 0.5 + (hitAgo < 1 ? (1 - hitAgo) * 1.6 : 0);
    const baseX = lan.lx - H[0] * 2.75 * kk, baseY = lan.ly - H[1] * 2.75 * kk;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const yy = baseY + (1.2 + i * 0.55) * kk, w = (0.9 - i * 0.08) * kk * (1 + 0.3 * Math.sin(t * 5 + i));
      const off = Math.sin(t * 6.3 + i * 1.9) * breakA * kk * 0.9;
      ctx.fillStyle = `rgba(${L.glass},${0.22 * (1 - i / 7)})`;
      ctx.fillRect(baseX - w / 2 + off, yy, w, Math.max(1, kk * 0.22));
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawPleats(L, lan, boat, X, Y, kk, dt) {
    // an amber paper pleat unfolds from the bow on each ember
    for (const p of fx.pleats) p.age += dt;
    while (fx.pleats.length && fx.pleats[0].age > 1.1) fx.pleats.shift();
    for (const p of fx.pleats) {
      const u = Math.min(1, p.age / 0.35), fade = p.age < 0.6 ? 1 : 1 - (p.age - 0.6) / 0.5;
      const n = 7, spread = u * 2.4, len = (2.5 + 2.5 * u) * kk;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + boat.ang + (i - (n - 1) / 2) / (n - 1) * spread, a2 = a + spread / (n - 1);
        ctx.beginPath(); ctx.moveTo(lan.bx, lan.by); ctx.lineTo(lan.bx + Math.cos(a) * len, lan.by + Math.sin(a) * len); ctx.lineTo(lan.bx + Math.cos(a2) * len * 0.92, lan.by + Math.sin(a2) * len * 0.92); ctx.closePath();
        ctx.fillStyle = L.pleat[i % 3]; ctx.globalAlpha = 0.85 * fade; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawRings(L, X, Y, kk, dt) {
    for (const r of fx.rings) r.age += dt;
    while (fx.rings.length && fx.rings[0].age > 0.9) fx.rings.shift();
    for (const r of fx.rings) { ctx.beginPath(); ctx.arc(X(r.d, r.x), Y(r.d), (1 + r.age * 14) * kk, 0, 6.283); ctx.strokeStyle = `rgba(${L.glass},${0.5 * (1 - r.age / 0.9)})`; ctx.lineWidth = 2; ctx.stroke(); }
  }
  function drawSparks(L, X, Y, kk, dt) {
    for (const p of fx.sparks) { p.age += dt; p.d += p.vd * dt + 30 * dt * 0.9; p.x += p.vx * dt; p.vd *= 0.94; p.vx *= 0.94; }
    for (let i = fx.sparks.length - 1; i >= 0; i--) if (fx.sparks[i].age > fx.sparks[i].life) fx.sparks.splice(i, 1);
    for (const p of fx.sparks) { const u = p.age / p.life; ctx.fillStyle = p.ash ? `rgba(30,30,34,${1 - u})` : `rgba(${L.glass},${1 - u})`; ctx.fillRect(X(p.d, p.x) - 1.5, Y(p.d) - 1.5, 3, 3); }
  }
  function drawSmoke(L, X, Y, kk, dt) {
    for (const p of fx.smoke) p.age += dt;
    for (let i = fx.smoke.length - 1; i >= 0; i--) if (fx.smoke[i].age > 2.6) fx.smoke.splice(i, 1);
    for (const p of fx.smoke) { if (p.age < 0) continue; const u = p.age / 2.6; ctx.beginPath(); ctx.arc(X(p.d, p.x + p.vx * p.age) + H[0] * (2.8 + p.age * 3) * kk, Y(p.d) + H[1] * (2.8 + p.age * 3) * kk, (p.r + u * 2.4) * kk, 0, 6.283); ctx.fillStyle = `rgba(150,150,160,${0.28 * (1 - u)})`; ctx.fill(); }
  }
  function drawJump(L, j, kk, t) {
    ctx.globalCompositeOperation = 'lighter';
    const kj = Math.max(kk, 4.4), lift = Math.max(5 * kj, Math.hypot(j.bx - j.ax, j.by - j.ay) * 0.45);
    for (let i = 0; i < 10; i++) {
      const u = Math.max(0, j.u - i * 0.03), x = mix(j.ax, j.bx, u), y = mix(j.ay, j.by, u) - Math.sin(u * Math.PI) * lift;
      ctx.beginPath(); ctx.arc(x, y, kj * (1.5 - i * 0.12), 0, 6.283); ctx.fillStyle = `rgba(${L.glass},${0.9 - i * 0.08})`; ctx.fill();
    }
    const hx = mix(j.ax, j.bx, j.u), hy = mix(j.ay, j.by, j.u) - Math.sin(j.u * Math.PI) * lift;
    ctx.beginPath(); ctx.arc(hx, hy, kj * 0.7, 0, 6.283); ctx.fillStyle = '#fff8e0'; ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // align 'center' at x, or 'side': left-aligned at x, or right-aligned at alt when it would run off the screen
  function label(L, name, sub, x, y, a, align = 'center', alt = x) {
    ctx.font = '15px "Iowan Old Style", Palatino, Georgia, serif';
    const w = Math.max(ctx.measureText(name).width, sub ? 60 : 0);
    if (align === 'side') { if (x + w > W - 8) { ctx.textAlign = 'right'; x = alt; } else ctx.textAlign = 'left'; } else ctx.textAlign = 'center';
    ctx.globalAlpha = a; ctx.fillStyle = L.text; ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 6;
    ctx.fillText(name, x, y);
    if (sub) { ctx.font = '11px system-ui, sans-serif'; ctx.globalAlpha = a * 0.75; ctx.fillText(sub, x, y + 14); }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'center';
  }
  function drawProgress(L, p, flame, top) {
    const x0 = 18, x1 = W - 60, y = Math.max(10, top) + 21;
    ctx.fillStyle = L.line; ctx.fillRect(x0, y, x1 - x0, 1.5);
    ctx.fillStyle = L.flame; ctx.fillRect(x0, y - 0.5, (x1 - x0) * p, 2.5);
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * p, y + 0.5, 2.5 + flame * 2, 0, 6.283); ctx.fill();
    ctx.fillStyle = L.trim; ctx.fillRect(x1 - 1.5, y - 4, 3, 9);
  }

  return { resize, draw, event, lantern: (cam, d, x, ang = 0) => boatLantern(W / 2 + (x - cam.x) * k * cam.z, Hh * A - (d - cam.d) * k * cam.z, k * cam.z, ang), get k() { return k; }, get ay() { return Hh * A; }, get ahead() { return AHEAD; }, get size() { return { W, H: Hh } }, project: (cam, d, x) => ({ x: W / 2 + (x - cam.x) * k * cam.z, y: Hh * A - (d - cam.d) * k * cam.z }) };
}
