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
    lanternLevel,
    skylayer,
    skyKey = '';
  let trail = [],
    lastTrail = -1,
    lastScreen = '',
    donorAhead = 1,
    heading = 0, previousX = 0, previousTime = 0;
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
      for (let i = 0; style !== 'storm' && i < 74; i++) {
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
      if (style === 'paper') {
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
      } else if (style === 'thermal') {
        ellipse(mx, my, r * 0.72, r * 0.72, p.mountain);
      }
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
    } else {
      const fullHeight = skylayer.height * h / canvas.height;
      ctx.drawImage(skylayer, 0, horizon + 2 - fullHeight, w, fullHeight);
    }
    if (style === 'storm') {
      for (let band = 0; band < 3; band++) {
        const hem = [];
        for (let i = 60; i >= 0; i--) {
          const u = i / 60;
          const swell = wave(u * 7 + band * 2 - t * (0.08 + band * 0.02));
          hem.push(w * u, horizon * (0.61 - band * 0.15 + swell * 0.19));
        }
        shape([0, 0, w, 0, ...hem], ['#465457', '#303d40', '#202c31'][band]);
      }
    }
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
      const tint = style === 'paper' ? (i % 4 === 0 ? p.white : p.sun) : p.edge;
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
        const phase = (t * 1.18 + noise(i + 80)) % 1;
        const near = objects.find(
          o => o.kind === 'rock' && Math.abs(o.ahead - a) < 0.85 && Math.abs(o.x - x) < 0.23,
        );
        const lit = Math.hypot(q.x - boatX, (q.y - boatY) * 0.78) < span * (0.10 + 0.85 * lanternLevel);
        const tint = lit ? p.sun : p.edge;
        ctx.globalAlpha = (1 - phase) * (lit ? 0.93 : 0.65);
        const rx = 1 + len * phase, ry = 0.8 + rx * 0.28;
        if (near) {
          ellipse(q.x - rx * 0.13, q.y, rx, ry, tint, 1.8, 4.5, true, 0.8 + q.s * 0.5);
          ellipse(q.x + rx * 0.13, q.y, rx, ry, tint, -1.1, 1.2, true, 0.8 + q.s * 0.5);
        } else ellipse(q.x, q.y, rx, ry, tint, 0.1, 5.95, true, 0.7 + q.s * 0.4);
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
  // Stern nearest the viewer. The keel, benches and foredeck share an oblique axis.
  function boat(x, y, k, level, yaw = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.rotate(yaw);
    ellipse(1, 0, 22, 7, p.ink);
    shape([-22,-3, -19,-21, -4,-42, 15,-67, 16,-49, 23,-27, 19,-7, 8,3, -12,5], p.ink);
    shape([-21,-7, -16,-22, -4,-41, 15,-66, 10,-44, -1,-26, -8,-12, -11,0], p.hull);
    shape([-16,-12, -8,-29, 12,-54, 17,-32, 17,-17, 10,-10, -8,-7], p.bank);
    shape([10,-44, 15,-62, 19,-35, 13,-29, 3,-32], p.hull);
    shape([-14,-18, -11,-23, 16,-27, 17,-23], p.moss);
    shape([-22,-8, -11,-3, 10,-5, 20,-13, 18,-5, 7,2, -11,4, -21,0], p.hull);
    line([-21,-8, -14,-25, 0,-45, 15,-66], p.white, 1.45);
    line([-21,-8, -11,-3, 10,-5, 20,-13, 20,-31, 15,-58], p.edge, 1.15);
    line([-10,-2, -8,2, 6,0], p.ink, 1);
    // Lantern hangs off the port quarter, clear of the deck and stern.
    line([-11,-12, -12,-40, -16,-44, -24,-43, -24,-36], p.ink, 3.1);
    line([-12,-39, -16,-43, -23,-42], p.edge, 1.2);
    ctx.fillStyle = p.ink;
    ctx.fillRect(-31,-37,14,16);
    ctx.fillStyle = level > 0 ? p.sun : p.moss;
    ctx.fillRect(-29,-35,10,11);
    if (level > 0) fire(-24,-26,3.8 + 2.6 * level);
    line([-32,-37,-16,-37], p.white, 1.4);
    line([-29,-22,-20,-22], p.hull, 1);
    ctx.restore();
  }
  function lantern(x, y, k, yaw) {
    return [x + k * (-24 * Math.cos(yaw) + 30 * Math.sin(yaw)),
            y + k * (-24 * Math.sin(yaw) - 30 * Math.cos(yaw))];
  }
  function object(o) {
    const { x, y, s } = position(o.x, o.ahead);
    const k = (s * unit) / 420;
    if (o.kind === 'rock') {
      const size = Math.max(0.34, k);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size, size);
      // The two streaks begin at the waterline and separate downstream.
      line([-15,-2, -21,3, -25,12, -31,18], p.edge, 1.8);
      line([18,-2, 22,3, 24,9, 28,13], p.moss, 2);
      shape([-21,0, -16,-13, -6,-27, 6,-25, 18,-9, 21,-1, 8,3, -9,2], p.ink);
      shape([-16,-13, -6,-27, 6,-25, 2,-18, -7,-17, -18,-5], p.edge);
      shape([2,-18, 6,-25, 18,-9, 21,-1, 9,-4], p.ridge);
      line([-16,-13, -6,-27, 6,-25], p.white, 1.6);
      ctx.restore();
    } else if (o.kind === 'ember') {
      const size = Math.max(4.5, 9.5 * k);
      const fy = y - 3 * k + Math.sin(t * 3 + o.x) * k * 2;
      reflection(x, y + 2 * k, k * 0.5, 0.86);
      for (let ring = 3; ring >= 1; ring--) {
        ctx.globalAlpha = 0.06 + (3 - ring) * 0.055;
        ellipse(x, fy - size * 0.72, size * ring, size * ring * 1.04, p.sun);
      }
      ctx.globalAlpha = 1;
      fire(x, fy, size);
      const phase = (t * 0.8 + o.x + 1) % 1;
      ctx.globalAlpha = 1 - phase;
      ellipse(x + Math.sin(t + o.x) * size * 0.3, fy - (1.65 + phase) * size, size * 0.16, size * 0.23, p.white);
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
    const tilt = screen === 'leg' ? ease((age - 0.80) / 1.15) : 0;
    horizon = h * (0.34 - 0.19 * tilt);
    lanternLevel = flame;
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
      heading = 0;
      previousX = x;
    }
    const dt = t - previousTime;
    if (dt > 0 && dt < 0.25) {
      const yaw = Math.max(-0.47, Math.min(0.47, (x - previousX) / dt * 0.38));
      heading += (yaw - heading) * (1 - Math.exp(-dt * 8));
    }
    previousX = x;
    previousTime = t;
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
      const f = ease((state.transferAge - 0.07) / 0.70);
      const q = position(-0.42, donorAhead + f * 1.2);
      ctx.globalAlpha = 1 - ease((state.transferAge - 0.50) / 0.35);
      boat(q.x, q.y, q.s * k, f === 0 ? flame : 0);
      ctx.globalAlpha = 1;
      const from = lantern(q.x, q.y, q.s * k, 0);
      const to = lantern(boatX, boatY + bob, k, heading);
      const arc = u => [
        from[0] + (to[0] - from[0]) * u,
        from[1] + (to[1] - from[1]) * u - Math.sin(u * Math.PI) * unit * 0.23,
      ];
      const [xx, yy] = arc(f);
      const ribbon = [], lower = [];
      for (let j = 0; j <= 16; j++) {
        const u = j / 16;
        const [px, py] = arc(Math.max(0, f - (1 - u) * 0.28));
        const width = Math.sin(Math.PI * u) * k * 3;
        ribbon.push(px, py - width);
        lower.unshift(px, py + width);
      }
      ctx.globalAlpha = 0.80 * Math.sin(Math.PI * f);
      shape([...ribbon, ...lower], p.sun);
      ctx.globalAlpha = 1;
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
      local = f < 0.96 ? 0 : flame * ease((f - 0.96) / 0.04);
    }
    const ordered = state.transferAge < 0.85 ? [] : objects.filter(o => o.ahead >= -1.6 && o.ahead <= 18);
    const remaining = (1 - (state.progress || 0)) * 60;
    if (screen === 'handoff' || (screen === 'leg' && remaining < 8)) {
      ordered.push({ kind: 'buoy', ahead: screen === 'handoff' ? 0 : remaining, x: 0.78 });
    }
    ordered.sort((a, b) => b.ahead - a.ahead);
    if (screen === 'leg' && state.transferAge >= 0.85) {
      // Dark adaptation still leaves the banks and crests visible outside the beam.
      const reach = (0.17 + 1.24 * Math.sqrt(clamp(flame))) * (boatY - horizon);
      ctx.save();
      ctx.translate(boatX, boatY - unit * 0.08);
      ctx.scale(0.78, 1);
      const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
      shade.addColorStop(0, 'rgba(255,198,95,0.09)');
      shade.addColorStop(0.44, 'rgba(3,9,18,0.045)');
      shade.addColorStop(0.79, 'rgba(3,9,18,0.32)');
      shade.addColorStop(1, 'rgba(3,9,18,0.65)');
      ctx.fillStyle = shade;
      ctx.fillRect(-w * 2, horizon - boatY + unit * 0.08, w * 4, h - horizon);
      ctx.restore();
    }
    for (const o of ordered) if (o.ahead >= 0) object(o);
    pool(boatX, boatY, local, 1);
    reflection(boatX, boatY + 3 * k, k, local);
    boat(boatX, boatY + bob, k, local, heading);
    for (const o of ordered) if (o.ahead < 0) object(o);
    if (screen === 'leg' && state.transferAge >= 0.71 && state.transferAge < 1.27) {
      const bloom = clamp((state.transferAge - 0.71) / 0.56);
      const [lx, ly] = lantern(boatX, boatY + bob, k, heading);
      ctx.globalAlpha = Math.sin(bloom * Math.PI) * (1 - bloom);
      ellipse(lx, ly, k * (7 + 25 * bloom), k * (7 + 25 * bloom), p.sun, 0, TAU, true, k * 1.7);
      for (let i = 0; i < 7; i++) {
        const angle = i / 7 * TAU;
        const radius = k * (10 + 30 * bloom);
        const sx = lx + radius * Math.cos(angle), sy = ly + radius * Math.sin(angle);
        line([sx, sy, sx + 3 * k * Math.cos(angle), sy + 3 * k * Math.sin(angle)], p.white, 1.5 * k);
      }
      ctx.globalAlpha = 1;
    }
    if (screen === 'leg' && state.emberAge < 0.7) {
      const v = state.emberAge / 0.7;
      ctx.globalAlpha = 1 - v;
      for (let i = -2; i <= 2; i++) {
        const dx = i * unit * 0.027 * Math.sin((v * Math.PI) / 2);
        shape(
          [
            boatX + (15 + heading * 53) * k,
            boatY - 58 * k,
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
    if (style === 'storm') {
      ctx.save();
      for (let layer = 0; layer < 2; layer++) {
        ctx.strokeStyle = layer ? 'rgba(191,213,207,.32)' : 'rgba(163,193,192,.18)';
        ctx.lineWidth = layer ? 1.15 : 0.7;
        ctx.beginPath();
        for (let i = layer; i < 104; i += 2) {
          const speed = layer ? 1.18 : 0.68;
          const rx = ((noise(i + 401) - t * speed * 0.31) % 1 + 1) % 1 * (w + 28);
          const ry = (noise(i + 553) + t * speed * 0.87) % 1 * (h + 44) - 44;
          const length = (layer ? 0.065 : 0.03) * unit;
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - length * 0.5, ry + length);
        }
        ctx.stroke();
      }
      ctx.restore();
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
