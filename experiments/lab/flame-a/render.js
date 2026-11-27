// All distances passed to the painter are seconds upstream; the simulation owns contact.
const palettes = {
  paper: {
    sky: '#101B32',
    dusk: '#82615d',
    sun: '#FFC34D',
    mountain: '#36445b',
    ridge: '#223a49',
    forest: '#182f39',
    river: '#203849',
    bank: '#162c36',
    moss: '#367C77',
    edge: '#839788',
    white: '#F3E6C8',
    hull: '#CD4838',
    ink: '#101B32',
  },
  thermal: {
    sky: '#050C16',
    dusk: '#132344',
    sun: '#FF682B',
    mountain: '#172946',
    ridge: '#102037',
    forest: '#091526',
    river: '#091424',
    bank: '#070f1c',
    moss: '#244D93',
    edge: '#62E4EC',
    white: '#FFF3CF',
    hull: '#FF682B',
    ink: '#050C16',
  },
  storm: {
    sky: '#22292A',
    dusk: '#6e7775',
    sun: '#E8AB50',
    mountain: '#526672',
    ridge: '#374c50',
    forest: '#283a39',
    river: '#123E40',
    bank: '#222f30',
    moss: '#415958',
    edge: '#97a49a',
    white: '#edddba',
    hull: '#AF302B',
    ink: '#22292A',
  },
};
const TAU = Math.PI * 2;
const clamp = (n) => Math.max(0, Math.min(1, n));
const ease = (n) => {
  n = clamp(n);
  return n * n * (3 - 2 * n);
};
const noise = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const wave = (v) => Math.sin(v) * 0.62 + Math.sin(v * 2.3 + 0.6) * 0.26 + Math.sin(v * 4.1) * 0.12;

export function river(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const fibers = document.createElement('canvas');
  fibers.width = fibers.height = 100;
  const grain = fibers.getContext('2d');
  for (let i = 0; i < 1600; i++) {
    grain.fillStyle = i % 2 ? 'rgba(246,224,185,.065)' : 'rgba(4,12,25,.11)';
    grain.fillRect(noise(i) * 100, noise(i + 1620) * 100, i % 14 === 0 ? 3 : 1, 1);
  }
  const paper = ctx.createPattern(fibers, 'repeat');
  let w,
    h,
    unit,
    t,
    p,
    style,
    horizon,
    boatY,
    boatX,
    span,
    world,
    shore,
    skylayer,
    skyKey = '';
  let trail = [],
    lastTrail = -1,
    lastScreen = '',
    donorAhead = 1;
  function shape(points, color) {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function line(points, color, width = 1) {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function ellipse(x, y, rx, ry, color, start = 0, end = TAU, stroke = false, width = 1) {
    if (rx <= 0 || ry <= 0) return;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, start, end);
    if (stroke) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  function scale(ahead) {
    return 1 / (1 + Math.max(-1.65, ahead) * 0.26);
  }
  function center(s) {
    return w * 0.5 + (1 - s) * Math.sin(2.7 * s + 0.33 * Math.sin(world * 0.12)) * w * 0.105;
  }
  function position(x, ahead) {
    const s = scale(ahead);
    return { x: center(s) + span * s * x, y: horizon + (boatY - horizon) * s, s };
  }
  function sky() {
    const key = [w, h, style].join('/');
    if (key !== skyKey) {
      const height = Math.ceil(horizon + 2);
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, p.sky);
      grad.addColorStop(0.58, p.sky);
      grad.addColorStop(1, p.dusk);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, height);
      for (let i = 0; i < 74; i++) {
        const x = w * noise(i + 17),
          y = horizon * noise(i + 76);
        ctx.globalAlpha = 0.17 + noise(i + 74) * 0.55;
        ctx.fillStyle = p.white;
        ctx.fillRect(x, y, i % 11 === 0 ? 2 : 1, 1);
      }
      ctx.globalAlpha = 1;
      const r = unit * 0.073,
        mx = w * 0.61,
        my = horizon * 0.83 - r * 0.4;
      ellipse(mx, my, r, r, p.sun);
      ctx.save();
      ctx.clip();
      for (let i = 0; i < 9; i++)
        line(
          [mx - r, my + r * (0.07 + i * 0.117), mx + r, my + r * (0.07 + i * 0.117)],
          p.dusk,
          unit * 0.002 + i * 0.1,
        );
      ctx.restore();
      for (let row = 0; row < 3; row++) {
        const contour = [];
        for (let i = 0; i <= 84; i++) {
          const u = i / 84;
          const peaks =
            Math.abs(Math.sin(u * (5 + row * 2.7) + row * 2)) * 0.47 + Math.abs(wave(u * 12 + row)) * 0.53;
          contour.push(
            u * w,
            horizon - (0.02 + peaks * 0.31) * (1 - row * 0.3) * horizon + noise(i + row * 93) * 2,
          );
        }
        shape([...contour, w, height, 0, height], [p.mountain, p.ridge, p.forest][row]);
        if (row === 2)
          for (let i = 0; i < 80; i++) {
            const x = noise(i + 221) * w,
              idx = Math.min(83, Math.floor((x / w) * 84)),
              y = contour[idx * 2 + 1] + 2;
            const k = 2 + noise(i + 25) * 4;
            shape([x - k, y, x, y - k * 2.7, x + k, y], p.forest);
          }
      }
      skylayer = document.createElement('canvas');
      skylayer.width = canvas.width;
      skylayer.height = Math.ceil((height * canvas.height) / h);
      skylayer
        .getContext('2d')
        .drawImage(canvas, 0, 0, skylayer.width, skylayer.height, 0, 0, skylayer.width, skylayer.height);
      skyKey = key;
    } else ctx.drawImage(skylayer, 0, 0, w, (skylayer.height * h) / canvas.height);
  }
  function bank(side) {
    const lip = [],
      shelf = [],
      rim = [];
    for (let i = 0; i <= 60; i++) {
      const s = 0.004 + (i / 60) * 1.65;
      const a = (1 / s - 1) / 0.26;
      const offset = shore ? shore(a) : 0;
      const jag = 0.045 * wave(a * 0.7 + world * 0.7 + side * 4) + 0.012 * Math.sin(a * 5 + world * 5);
      const x = center(s) + span * s * (offset + side * (1 + jag));
      const y = horizon + (boatY - horizon) * s;
      lip.push(x, y);
      shelf.push(x + side * s * unit * 0.028, y - s * 5);
      rim.push(x + side * s * unit * 0.055, y - s * 9);
    }
    const edge = side < 0 ? 0 : w;
    for (const [contour, color] of [
      [lip, p.edge],
      [shelf, p.moss],
      [rim, p.bank],
    ]) {
      shape([...contour, edge, h * 1.7, edge, horizon], color);
    }
    // Spear-shaped reeds and broken stone faces grow from the moving shoreline.
    for (let i = 0; i < 30; i++) {
      const a = ((((i * 0.89 - world) % 26.7) + 26.7) % 26.7) - 1.4;
      const s = scale(a);
      const q = position((shore ? shore(a) : 0) + side * (1.07 + 0.18 * noise(i + 5)), a);
      const k = unit * s * (0.009 + noise(i) * 0.031);
      if (i % 4 === 0) {
        shape(
          [q.x - k, q.y, q.x - k * 0.2, q.y - k * 0.63, q.x + k * 0.67, q.y - k * 0.5, q.x + k, q.y],
          p.moss,
        );
      } else
        for (let j = -1; j <= 1; j++) {
          const dx = (j + 0.35) * k;
          shape(
            [q.x - 1.5 * s, q.y, q.x + dx, q.y - k * (1.9 - Math.abs(j) * 0.6), q.x + 2 * s, q.y],
            i % 3 ? p.moss : p.ridge,
          );
        }
    }
  }
  // Broad seams in the current read from across the room. Their short broken
  // edges move downstream independently of the camera, even at the landing.
  function currentBands(objects) {
    const flow = world + t * 0.24;
    const rays = style === 'thermal' ? 4 : 7;
    for (let lane = 0; lane < rays; lane++) {
      const base = -0.96 + (lane * 1.92) / (rays - 1);
      for (let j = 0; j < 5; j++) {
        const depth = ((((j * 4.7 + noise(lane) * 4.7 - flow) % 23.5) + 23.5) % 23.5) - 1.7;
        const length = 1.6 + noise(j + lane) * 1.7;
        const points = [];
        const widths = [];
        for (let k = 0; k <= 8; k++) {
          const u = k / 8;
          const a = depth + u * length;
          let x = base + 0.09 * wave((a + flow) * 0.65 + lane * 1.15);
          if (style === 'thermal') {
            for (const rock of objects) {
              if (rock.kind !== 'rock') continue;
              const d = Math.abs(rock.x - x);
              if (d < 0.28)
                x += (x < rock.x ? -1 : 1) * (0.28 - d) * Math.max(0, 1 - Math.abs(rock.ahead - a) / 1.4);
            }
          }
          const q = position(x, a);
          points.push(q.x, q.y);
          widths.push(Math.sin(u * Math.PI) * unit * q.s * (style === 'thermal' ? 0.0025 : 0.015));
        }
        ctx.globalAlpha = style === 'thermal' ? 0.39 : style === 'paper' ? 0.46 : 0.31;
        const ribbon = points.slice();
        for (let k = widths.length - 1; k >= 0; k--)
          ribbon.push(points[k * 2] + widths[k], points[k * 2 + 1]);
        shape(ribbon, lane % 2 ? p.moss : p.ridge);
        if ((j + lane) % 3 === 0) {
          ctx.globalAlpha = style === 'thermal' ? 0.74 : 0.38;
          line(points.slice(2, 12), p.edge, Math.max(0.5, scale(depth) * 1.2));
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  function reflectedSky() {
    const wash = ctx.createLinearGradient(0, horizon, 0, h);
    wash.addColorStop(0, p.dusk);
    wash.addColorStop(0.28, p.river);
    wash.addColorStop(0.9, p.ink);
    ctx.fillStyle = wash;
    ctx.fillRect(0, horizon, w, h - horizon);
    for (let i = 0; i < 38; i++) {
      const s = 0.035 + ((i + 0.5) / 38) ** 1.4 * 1.47;
      const y = horizon + s * (boatY - horizon);
      const x = center(s) + span * s * (0.18 + 0.2 * wave(i * 0.44 + t * 0.18));
      const spread = unit * s * (0.034 + noise(i + 440) * 0.11);
      const jitter = wave(i + t * (1 + i * 0.017));
      const length = spread * (0.6 + 0.32 * jitter);
      const thick = (0.6 + s * 0.87) * (style === 'storm' ? 0.72 : 1);
      ctx.globalAlpha = (0.32 + 0.18 * jitter) * (1 - s * 0.44);
      const tint = style === 'thermal' ? p.edge : i % 4 === 0 ? p.white : p.sun;
      if (style === 'storm') {
        ellipse(x, y, length, Math.max(0.8, thick * 2), tint, 0.12, 2.97, true, thick);
      } else {
        shape(
          [
            x - length,
            y,
            x - length * 0.31,
            y - thick * 0.7,
            x + length * 0.38,
            y - thick,
            x + length,
            y + thick * 0.2,
            x + length * 0.25,
            y + thick * 0.5,
          ],
          tint,
        );
      }
    }
    ctx.globalAlpha = 1;
  }
  function water(objects) {
    reflectedSky();
    currentBands(objects);
    const lanes = style === 'thermal' ? 19 : 48;
    for (let i = 0; i < lanes; i++) {
      const a = ((((i * 0.671 - world) % 19) + 19) % 19) - 1.65;
      const x = (noise(i + 70) * 2 - 1) * 1.15;
      const q = position(x, a);
      const len = (0.014 + noise(i) * 0.089) * unit * q.s;
      ctx.globalAlpha = 0.16 + noise(i + 33) * 0.24;
      if (style === 'thermal') {
        const rock = objects.find(
          (o) => o.kind === 'rock' && Math.abs(o.ahead - a) < 1.5 && Math.abs(o.x - x) < 0.45,
        );
        const bend = rock ? (x < rock.x ? -1 : 1) * len * 0.8 : 0;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.quadraticCurveTo(q.x + bend + 3 * q.s, q.y + len * 0.8, q.x + bend + 6 * q.s, q.y + len * 1.3);
        ctx.strokeStyle = p.edge;
        ctx.lineWidth = q.s;
        ctx.stroke();
      } else if (style === 'storm') {
        const phase = (t * 0.64 + noise(i + 80)) % 1;
        ctx.globalAlpha = (1 - phase) * 0.55;
        const near = objects.some(
          (o) => o.kind === 'rock' && Math.abs(o.ahead - a) < 0.55 && Math.abs(o.x - x) < 0.19,
        );
        ellipse(
          q.x,
          q.y,
          len * phase + 1,
          len * phase * 0.32 + 1,
          Math.abs(q.x - boatX) < span * 0.38 ? p.sun : p.edge,
          near ? 0.8 : 0.1,
          near ? 3.1 : 5.95,
          true,
          0.8 * q.s,
        );
      } else {
        shape(
          [q.x - len, q.y, q.x + len * 0.33, q.y - q.s, q.x + len, q.y, q.x - len * 0.45, q.y + q.s],
          p.edge,
        );
      }
    }
    ctx.globalAlpha = 1;
    bank(-1);
    bank(1);
  }
  function pool(x, y, level, k) {
    if (level <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    for (let j = 3; j > 0; j--) {
      const r = unit * (0.045 + 0.19 * level) * (0.22 + j * 0.26) * k;
      ctx.globalAlpha = [0, 0.26, 0.16, 0.08][j];
      if (style === 'paper') {
        const pts = [];
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * TAU;
          pts.push(Math.cos(a) * r * (0.96 + 0.06 * noise(i + j)), Math.sin(a) * r * 0.44);
        }
        shape(pts, p.sun);
      } else ellipse(0, 0, r, r * 0.43, p.sun);
    }
    ctx.restore();
  }
  function fire(x, y, size) {
    const f = 1 + 0.1 * Math.sin(t * 8.3);
    shape(
      [
        x - size * 0.65,
        y,
        x - size * 0.48,
        y - size * 0.72,
        x + size * 0.16,
        y - size * 1.68 * f,
        x + size * 0.21,
        y - size * 0.92,
        x + size * 0.63,
        y - size * 0.52,
        x + size * 0.56,
        y,
      ],
      p.sun,
    );
    shape([x - size * 0.28, y, x + size * 0.1, y - size * 0.85, x + size * 0.31, y], p.white);
  }
  function reflection(x, y, k, level) {
    for (let i = 0; i < 10; i++) {
      const jitter = Math.sin(t * (2 + i * 0.17) + i * 1.2);
      const width = (12 - i * 0.85 + 3 * jitter) * k;
      ctx.globalAlpha = level * (0.53 - i * 0.042);
      line(
        [x - width + jitter * k * 2, y + i * k * 3, x + width + jitter * k * 2, y + i * k * 3],
        i % 3 ? p.sun : p.white,
        k * 1.35,
      );
    }
    ctx.globalAlpha = 1;
  }
  function boat(x, y, k, level, dir = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k * dir, k);
    ellipse(0, 2, 38, 5, p.ink);
    shape([-43, -11, -31, -5, 18, -7, 34, -16, 40, -25, 39, -11, 23, 1, -13, 4, -33, 0], p.ink);
    shape([-42, -12, -25, -7, 16, -9, 30, -16, 40, -25, 35, -13, 21, -5, -10, -2, -34, -5], p.hull);
    line([-40, -12, -24, -8, 16, -10, 30, -17, 39, -25], p.white, 1.3);
    line([-17, -5, -9, 0, 16, -4], p.hull, 1);
    // Bent mast suspends a square lantern above the gunwale.
    line([-9, -8, -9, -36, -5, -40, 5, -40, 5, -35], p.ink, 2.8);
    line([-8, -35, -5, -39, 4, -39], p.edge, 0.8);
    ctx.fillStyle = p.ink;
    ctx.fillRect(-2, -35, 14, 16);
    ctx.fillStyle = level > 0 ? p.sun : p.moss;
    ctx.fillRect(0, -33, 10, 11);
    if (level > 0) fire(5, -24, 4 + 3 * level);
    line([-3, -35, 13, -35], p.white, 1.2);
    line([1, -21, 10, -21], p.hull, 1);
    ctx.restore();
  }
  function object(o) {
    const { x, y, s } = position(o.x, o.ahead);
    const k = (s * unit) / 420;
    if (o.kind === 'rock') {
      ellipse(x, y + 1, 25 * k, 6 * k, p.edge, 0.08, 3.21, true, 1.8 * k);
      ellipse(x, y + 2 * k, 31 * k, 8 * k, p.moss, 0.45, 2.64, true, 1.2 * k);
      shape(
        [
          x - 21 * k,
          y,
          x - 13 * k,
          y - 11 * k,
          x - 4 * k,
          y - 17 * k,
          x + 9 * k,
          y - 15 * k,
          x + 20 * k,
          y - 2 * k,
          x + 9 * k,
          y + 2 * k,
        ],
        p.ink,
      );
      shape(
        [
          x - 21 * k,
          y,
          x - 13 * k,
          y - 11 * k,
          x - 4 * k,
          y - 17 * k,
          x + 9 * k,
          y - 15 * k,
          x - 2 * k,
          y - 10 * k,
        ],
        p.edge,
      );
      shape(
        [x - 2 * k, y - 10 * k, x + 9 * k, y - 15 * k, x + 20 * k, y - 2 * k, x + 8 * k, y - 4 * k],
        p.ridge,
      );
    } else if (o.kind === 'ember') {
      const bob = Math.sin(t * 3 + o.x) * k * 2;
      reflection(x, y + 2 * k, k * 0.36, 0.65);
      ellipse(x, y - 8 * k + bob, k * 13, k * 13, p.sun, 0, TAU, true, k * 0.9);
      fire(x, y - 3 * k + bob, 8 * k);
      const phase = (t * 0.6 + o.x + 1) % 1;
      ctx.globalAlpha = 1 - phase;
      ellipse(x + Math.sin(t + o.x) * 2 * k, y - (19 + 9 * phase) * k, 1.6 * k, 1.6 * k, p.white);
      ctx.globalAlpha = 1;
    } else if (o.kind === 'buoy') {
      reflection(x, y, k * 0.6, 1);
      shape([x - 10 * k, y, x - 6 * k, y - 10 * k, x + 6 * k, y - 10 * k, x + 10 * k, y], p.hull);
      line([x, y - 9 * k, x, y - 36 * k], p.white, 2 * k);
      shape([x, y - 37 * k, x + 18 * k, y - 32 * k, x, y - 27 * k], p.sun);
    }
  }
  function carrierLights(state, drop) {
    const history = state.history || [];
    const count = state.chain || 0;
    const visible = Math.min(count, 64);
    for (let j = visible - 1; j >= 0; j--) {
      const a = 1.35 + j * 0.88 + (state.screen === 'arrival' ? 4.5 * (1 - ease(state.age / 4)) : 0);
      const known = history[history.length - 1 - j];
      const side = j % 2 === 0 ? -1 : 1;
      const q = position(side * 0.73, a);
      const k = (q.s * unit) / 420;
      const extinguished = drop && state.age >= 0.22 + j * Math.min(0.32, 2.6 / visible);
      if (!extinguished) {
        reflection(q.x, q.y, k * 0.62, 0.88);
        pool(q.x, q.y, 0.48, k * 0.62);
        fire(q.x, q.y - 3 * k, 6.2 * k);
      } else ellipse(q.x, q.y, 2.3 * k, 1.4 * k, p.edge);
      if (j < 8 && known && known.name && k > 0.18) {
        ctx.fillStyle = extinguished ? p.moss : p.white;
        ctx.textAlign = side < 0 ? 'left' : 'right';
        ctx.font = 'italic ' + Math.max(9, Math.min(15, 16 * k)) + 'px Georgia,serif';
        ctx.fillText(known.name, q.x + side * -8 * k, q.y - 6 * k);
      }
    }
  }
  function draw(state) {
    const { screen = 'leg', age = 0, x = 0, flame = 1, objects = [], look = 'paper' } = state;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    w = rect.width;
    h = rect.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      skyKey = '';
    }
    ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    ctx.globalAlpha = 1;
    style = look;
    p = palettes[look] || palettes.paper;
    t = state.time || 0;
    unit = Math.min(w, h, 620);
    horizon = h * 0.34;
    boatY = h * 0.77;
    span = Math.min(w * 0.49, unit * 0.79);
    world = screen === 'leg' ? (state.progress || 0) * 60 : screen === 'arrival' ? ease(age / 4) * 4 : 60;
    shore = state.shore;
    boatX = position(x, 0).x;
    if (screen !== lastScreen) {
      skyKey = '';
      trail = [];
      lastTrail = -1;
      lastScreen = screen;
    }
    sky();
    water(objects);
    if (screen === 'drop') {
      ctx.globalAlpha = ease(age / 2.6) * 0.52;
      ctx.fillStyle = p.ink;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (screen !== 'leg') carrierLights(state, screen === 'drop');
    if (screen === 'leg' || screen === 'handoff') {
      if (lastTrail < 0 || t - lastTrail > 0.055) {
        trail.unshift({ x: boatX, t });
        trail = trail.filter((v) => t - v.t < 1.8).slice(0, 33);
        lastTrail = t;
      }
      for (let i = trail.length - 1; i > 0; i--) {
        const v = trail[i],
          u = trail[i - 1],
          a = t - v.t,
          old = t - u.t;
        ctx.globalAlpha = clamp(1 - a / 1.9) * 0.7;
        const col = style === 'thermal' ? (a < 0.32 ? p.white : a < 0.85 ? p.sun : p.moss) : p.edge;
        for (const d of [-1, 1])
          line(
            [
              u.x + d * (0.013 + old * 0.045) * unit,
              boatY + unit * (0.009 + old * 0.14),
              v.x + d * (0.013 + a * 0.045) * unit,
              boatY + unit * (0.009 + a * 0.14),
            ],
            col,
            Math.max(1, ((1.7 - a) * unit) / 360),
          );
      }
      ctx.globalAlpha = 1;
    }
    const k = unit / 420;
    const bob = Math.sin(t * 2.25) * 1.2 * k;
    let local = flame;
    if (screen === 'arrival') {
      donorAhead = 1 + (1 - ease(age / 3.6)) * 6;
      const q = position(-0.42, donorAhead);
      pool(q.x, q.y, flame, q.s);
      reflection(q.x, q.y, q.s * k, 1);
      boat(q.x, q.y, q.s * k, flame);
      local = 0;
    }
    if (screen === 'leg' && state.transferAge < 0.85) {
      const f = ease(state.transferAge / 0.85),
        q = position(-0.42, donorAhead + f * 1.2);
      boat(q.x, q.y, q.s * k, 0);
      const arc = (u) => [
        q.x + (boatX - q.x) * u,
        q.y + (boatY - q.y) * u - 30 * k - Math.sin(u * Math.PI) * unit * 0.22,
      ];
      const [xx, yy] = arc(f);
      for (let i = 1; i <= 9; i++) {
        const [sx, sy] = arc(Math.max(0, f - i * 0.013));
        ctx.globalAlpha = (1 - i / 10) * Math.sin(Math.PI * f);
        ellipse(sx, sy, (5 - i * 0.39) * k, (3 - i * 0.24) * k, p.sun);
      }
      ctx.globalAlpha = 1;
      for (let i = 4; i > 0; i--) {
        ctx.globalAlpha = 0.1;
        ellipse(xx, yy, i * k * 4, i * k * 4, p.sun);
      }
      ctx.globalAlpha = 1;
      fire(xx, yy, 9 * k);
      local = flame * f;
    }
    const ordered = objects.filter((o) => o.ahead >= -1.6 && o.ahead <= 18);
    const remaining = (1 - (state.progress || 0)) * 60;
    if (screen === 'handoff' || (screen === 'leg' && remaining < 8)) {
      ordered.push({ kind: 'buoy', ahead: screen === 'handoff' ? 0 : remaining, x: 0.78 });
    }
    ordered.sort((a, b) => b.ahead - a.ahead);
    for (const o of ordered) if (o.ahead >= 0) object(o);
    pool(boatX, boatY, local, 1);
    reflection(boatX, boatY + 3 * k, k, local);
    boat(boatX, boatY + bob, k, local);
    for (const o of ordered) if (o.ahead < 0) object(o);
    if (screen === 'leg' && state.emberAge < 0.7) {
      const v = state.emberAge / 0.7;
      ctx.globalAlpha = 1 - v;
      for (let i = -2; i <= 2; i++) {
        const dx = i * unit * 0.027 * Math.sin((v * Math.PI) / 2);
        shape(
          [
            boatX + 22 * k,
            boatY - 12 * k,
            boatX + dx * (1 + v),
            boatY - (0.1 + 0.13 * v) * unit,
            boatX + dx + 6 * k,
            boatY - (0.07 + 0.12 * v) * unit,
          ],
          i % 2 ? p.sun : p.white,
        );
      }
      ctx.globalAlpha = 1;
    }
    if (state.hitAge < 0.22) {
      ctx.fillStyle = p.hull;
      ctx.globalAlpha = 0.16 * (1 - state.hitAge / 0.22);
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (style === 'paper') {
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, w, h);
    }
  }
  draw.aim = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    const riverWidth = Math.min(rect.width * 0.49, Math.min(rect.width, rect.height, 620) * 0.79);
    return Math.max(-1, Math.min(1, (clientX - rect.left - rect.width * 0.5) / riverWidth));
  };
  return draw;
}
