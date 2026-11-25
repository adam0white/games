import { centre, half, current, jet, boat, progress, VIEW_AHEAD } from './sim.js';
import { speed } from '../../lantern/sim.js';

const PALETTES = {
  ink: {
    sky: '#0c172c', horizon: '#766164', dawn: '#ed9f73', morning: '#35466a',
    land: '#111f2c', ridge: '#26383e', water: '#122c40', far: '#4b5563',
    stream: '#6ed3c1', mark: '172,225,196', stone: '#172735', facet: '#5c6470', mist: '#666270',
  },
  mauve: {
    sky: '#20192f', horizon: '#896274', dawn: '#f3ab9c', morning: '#65435e',
    land: '#271e32', ridge: '#4c3549', water: '#2b2b43', far: '#6b526d',
    stream: '#b9cbee', mark: '224,204,232', stone: '#2b2032', facet: '#886777', mist: '#80647c',
  },
};

const ROW = 0.65;
const BEHIND = 1.35;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
function grain(n) {
  let v = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  v = Math.imul(v ^ (v >>> 16), 0x45d9f3b);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
function line(ctx, points) {
  ctx.beginPath();
  for (const [i, [x, y]] of points.entries()) {
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
}
function fill(ctx, color, points) {
  line(ctx, points);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
function gradient(ctx, x, y, dx, dy, stops) {
  const paint = ctx.createLinearGradient(x, y, dx, dy);
  for (const [at, color] of stops) paint.addColorStop(at, color);
  return paint;
}

export function riverView(ctx, look = 'ink') {
  const p = PALETTES[look] ?? PALETTES.ink;
  const texture = document.createElement('canvas');
  texture.width = texture.height = 192;
  const paper = texture.getContext('2d');
  const pixels = paper.createImageData(192, 192);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const g = grain(i);
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = g > 0.5 ? 232 : 6;
    pixels.data[i + 3] = Math.abs(g - 0.5) * 28;
  }
  paper.putImageData(pixels, 0, 0);
  const pattern = ctx.createPattern(texture, 'repeat');

  let w, h, middle, scale, game, s;
  let particles = [], lastRiver, lastClock;
  const position = (x, y) => {
    const dy = y - s.y;
    const depth = Math.exp(-dy * 0.30);
    return [w / 2 + (x - middle) * scale * depth ** 1.55, h * (ROW - 1.02 * (1 - depth))];
  };
  const edge = (y, side) => position(centre(s, y) + half(s, y) * side, y);

  function sky(light) {
    ctx.fillStyle = gradient(ctx, 0, 0, 0, h * .22, [[0, p.sky], [1, p.horizon]]);
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = light;
    ctx.fillStyle = gradient(ctx, 0, 0, 0, h * .22, [[0, p.morning], [1, p.dawn]]);
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1 - light;
    for (let i = 0; i < 37; i++) {
      const x = grain(i * 3 + 9) * w;
      const y = grain(i * 5 + 17) * h * .205;
      ctx.fillStyle = i % 5 ? '#eacbae76' : '#fff0c5c9';
      ctx.fillRect(x, y, i % 5 ? 1 : 2, i % 5 ? 1 : 2);
    }
    ctx.globalAlpha = 1;
    const x = w * mix(.70, .56, light), y = h * mix(.095, .157, light);
    const r = Math.min(w * .072, h * .039, 48);
    const halo = ctx.createRadialGradient(x, y, r * .7, x, y, r * 3);
    halo.addColorStop(0, '#edc59350');
    halo.addColorStop(1, '#edc59300');
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    ctx.fillStyle = '#ffdfac';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#8c656047';
    for (let i = 0; i < 19; i++) {
      const at = y - r + i * r / 9;
      ctx.fillRect(x - r, at, r * 2, i > 10 ? 1.6 : 0.5);
    }
    ctx.restore();
  }

  function headlands() {
    const horizon = position(middle, s.y + VIEW_AHEAD)[1];
    for (let ridge = 0; ridge < 2; ridge++) {
      const path = [[0, horizon + h * .035]];
      for (let i = 0; i <= 36; i++) {
        const x = i / 36;
        const opening = Math.max(0, 1 - 3.4 * Math.abs(x - .51));
        const summit = -0.031 + ridge * .018 + .019 * Math.sin(x * 11 + ridge * 1.7)
          + .011 * Math.sin(x * 23 + ridge) + .006 * grain(i * 351 + ridge) + opening * .026;
        path.push([x * w, horizon + h * summit]);
      }
      path.push([w, horizon + h * .035]);
      fill(ctx, ridge ? p.land : p.ridge, path);
    }
  }

  function banks() {
    const edges = [[], []];
    const far = s.y + VIEW_AHEAD;
    for (let i = 0; i <= 54; i++) {
      const y = mix(far, s.y - BEHIND - 0.2, i / 54);
      edges[0].push(edge(y, -1));
      edges[1].push(edge(y, 1));
    }
    const [left, right] = edges;
    for (const [side, margin] of [[left, 0], [right, w]]) {
      fill(ctx, p.land, [[margin, side[0][1]], ...side, [margin, h + 5]]);
    }
    ctx.save();
    line(ctx, [...left, ...right.slice().reverse()]);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = gradient(ctx, 0, h * .16, 0, h, [[0, p.far], [.29, p.water], [1, p.sky]]);
    ctx.fillRect(0, 0, w, h);
    const depth = progress(game);
    if (depth > .81) {
      ctx.globalAlpha = (depth - .81) * 2;
      ctx.fillStyle = gradient(ctx, 0, h * .16, 0, h * .65, [[0, p.dawn], [1, '#ed9f7300']]);
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (game.tide) {
      const band = [[], []];
      for (let i = 0; i <= 48; i++) {
        const y = mix(far, s.y - BEHIND - .2, i / 48);
        const u = jet(s, y);
        band[0].push(position(centre(s, y) + half(s, y) * (u - .35), y));
        band[1].push(position(centre(s, y) + half(s, y) * (u + .35), y));
      }
      ctx.globalAlpha = .12;
      fill(ctx, p.stream, [...band[0], ...band[1].reverse()]);
      ctx.globalAlpha = 1;
    }
    streams();
    if (game.tide) for (const k of s.rocks) {
      const center = k.y + k.rad + .21;
      if (center >= s.y - BEHIND && center <= far && current(s, k.x, center).lee > .5) eddy(k);
    }
    ctx.restore();
    for (const side of edges) {
      line(ctx, side);
      ctx.strokeStyle = p.ridge;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = '#e4b98e51';
      ctx.lineWidth = .8;
      ctx.stroke();
    }
    reeds();
  }

  function streams() {
    ctx.lineCap = 'round';
    for (const m of particles) {
      const x = centre(s, m.y) + m.u * half(s, m.y);
      const rush = game.tide ? current(s, x, m.y).rush : 0;
      const length = .022 + (.24 + m.width * .08) * rush + .039 * m.width;
      const [a, b] = position(x, m.y);
      const [c, d] = position(centre(s, m.y - length) + half(s, m.y - length) * m.u, m.y - length);
      ctx.strokeStyle = `rgba(${p.mark},${(0.18 + rush * .57) * (.4 + m.width * .6)})`;
      ctx.lineWidth = .65 + rush * .85;
      ctx.beginPath();
      ctx.moveTo(c, d);
      ctx.quadraticCurveTo(mix(a, c, .5) + .6, mix(b, d, .5), a, b);
      ctx.stroke();
    }
  }

  function reeds() {
    const first = Math.floor((s.y - BEHIND) * 29);
    const last = Math.floor((s.y + VIEW_AHEAD) * 29);
    for (let i = last; i >= first; i--) {
      const y = (i + grain(i * 371)) / 29;
      for (const side of [-1, 1]) {
        const luck = grain(i * 211 + side);
        const x = centre(s, y) + side * (half(s, y) + .014 + luck * .12);
        const [sx, sy] = position(x, y);
        const size = (3 + luck * luck * 25) * Math.exp((s.y - y) * .24);
        const angle = side * size * (.24 + grain(i * 321 + side) * .42);
        ctx.fillStyle = i % 3 ? p.ridge : '#ab8a6645';
        ctx.beginPath();
        ctx.moveTo(sx - 1.5, sy);
        ctx.quadraticCurveTo(sx - 2, sy - size * .67, sx + angle, sy - size);
        ctx.quadraticCurveTo(sx + 2.1, sy - size * .36, sx + 1.7, sy);
        ctx.fill();
      }
    }
  }

  function eddy(k) {
    const offset = k.rad + .21;
    const [x, y] = position(k.x, k.y + offset);
    const [a] = position(k.x + k.rad + .045, k.y + offset);
    const radius = a - x;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, .65);
    ctx.lineWidth = 1.05;
    ctx.strokeStyle = p.stream;
    for (let i = 0; i < 3; i++) {
      const angle = s.t * (2.0 - i * .3) + i * 2.55;
      ctx.globalAlpha = .63 - i * .15;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (.40 + i * .31), angle, angle + Math.PI * 1.19);
      ctx.stroke();
    }
    ctx.restore();
  }

  function rock(k) {
    const [x, y] = position(k.x, k.y);
    const [a] = position(k.x + k.rad, k.y);
    const r = a - x;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r, r);
    ctx.fillStyle = '#0815228f';
    ctx.beginPath();
    ctx.ellipse(0, .25, 1.25, .57, 0, 0, 2 * Math.PI);
    ctx.fill();
    const angles = grain(Math.floor(k.y0 * 1400));
    fill(ctx, p.stone, [[-1, .34], [-.91, -.27], [-.57, -.64 - angles * .20], [.27, -.78],
      [.72, -.45], [1, .11], [.68, .57], [-.4, .65]]);
    fill(ctx, k.ice ? '#97c0ca' : p.facet, [[-.96, .32], [-.91, -.27], [-.57, -.64 - angles * .20],
      [.27, -.78], [.72, -.45], [.12, -.2], [-.28, -.39]]);
    ctx.strokeStyle = '#f1d1a66d';
    ctx.lineWidth = 1 / Math.max(1, r);
    line(ctx, [[-.83, -.29], [-.56, -.57 - angles * .19], [.26, -.69]]);
    ctx.stroke();
    ctx.strokeStyle = '#c9e3e488';
    line(ctx, [[-1.25, -.03], [-1.15, .34], [-.85, .59], [-.55, .7]]);
    ctx.stroke();
    line(ctx, [[.48, .72], [.91, .53], [1.23, .18], [1.27, -.05]]);
    ctx.stroke();
    ctx.restore();
  }

  function glow(x, y, radius, inner, outer = '#f49d4c00') {
    const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, inner);
    light.addColorStop(1, outer);
    ctx.fillStyle = light;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawBoat(clock, turning, ending) {
    const [x, y] = position(s.x, s.y);
    const size = clamp(boat(s) * scale, 7, 19);
    const lit = Math.max(0, s.light);
    const crashed = s.over && s.over !== 'dawn';
    const sinking = crashed ? clamp(ending / .62) : 0;
    const flicker = .9 + .1 * Math.sin(clock * 23);
    const lamp = lit * flicker * (1 - sinking);
    glow(x, y + 7, size * (2.8 + 5 * lit), lamp > .26 ? '#eda65879' : '#cb693b2e');
    if (game.flow?.lee > .28 && !crashed) {
      ctx.strokeStyle = p.stream;
      ctx.globalAlpha = clamp(game.flow.lee * 1.2);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.ellipse(x, y + size * .53, size * 2, size * 1.25, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const phase = (clock * .67 + i / 6) % 1;
        ctx.globalAlpha = (1 - phase) * game.flow.lee;
        ctx.fillStyle = '#fff1bc';
        ctx.fillRect(x + Math.sin(i * 15 + clock * 9) * (22 - 14 * phase), y + 13 - 35 * phase, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(x, y + sinking * size * .7);
    ctx.rotate(turning * .35 + sinking * .68);
    ctx.scale(size, size);
    ctx.globalAlpha = 1 - sinking * .74;
    for (let i = 0; i < 6; i++) {
      const phase = (clock * (.7 + (game.flow?.rush ?? 0) * .38) + i / 6) % 1;
      ctx.strokeStyle = `rgba(244,194,128,${(1 - phase) * lamp * .55})`;
      ctx.lineWidth = 1 / size;
      ctx.beginPath();
      ctx.ellipse(0, .30 + phase * 3.5, .75 + phase * 1.55, .22 + phase * .16, 0, .24, Math.PI - .24);
      ctx.stroke();
    }
    fill(ctx, '#ab6763', [[0, -1.32], [1.1, .22], [.79, .91], [0, 1.29], [-.79, .91], [-1.1, .22]]);
    fill(ctx, '#f1bc88', [[0, -1.32], [1.1, .22], [0, .87], [-1.1, .22]]);
    fill(ctx, '#ffe3ab', [[0, -1.32], [0, .87], [-1.1, .22]]);
    fill(ctx, '#52333e', [[0, -.85], [.65, .17], [0, .68], [-.65, .17]]);
    if (lamp > .015) {
      glow(0, -.35, 1.7, '#ffbf65bb');
      const height = .23 + .66 * lamp;
      const lean = Math.sin(clock * 16) * .12 - turning * .30;
      ctx.fillStyle = '#ffd399';
      ctx.beginPath();
      ctx.moveTo(-.33, .19);
      ctx.quadraticCurveTo(-.42, -.16, lean, -height);
      ctx.quadraticCurveTo(.43, -.26, .29, .15);
      ctx.quadraticCurveTo(0, .42, -.33, .19);
      ctx.fill();
      fill(ctx, '#fff7cb', [[-.20, .14], [lean * .5, -height * .52], [.17, .12], [0, .28]]);
    }
    ctx.restore();
  }

  function advance(clock) {
    if (lastRiver !== s) {
      particles = Array.from({ length: 208 }, (_, i) => ({
        i, u: grain(i * 2309 + 9) * 1.98 - .99, y: s.y + mix(-BEHIND, VIEW_AHEAD, grain(i * 131 + 11)),
        width: grain(i * 17 + 112), cycle: 0,
      }));
      lastRiver = s;
      lastClock = clock;
    }
    const dt = clamp(clock - lastClock, 0, .05);
    lastClock = clock;
    if (!dt) return;
    const base = speed(s);
    for (const m of particles) {
      const x = centre(s, m.y) + half(s, m.y) * m.u;
      m.y += base * dt * (game.tide ? current(s, x, m.y).rate : 1);
      if (m.y < s.y - BEHIND || m.y > s.y + VIEW_AHEAD) {
        const ahead = m.y < s.y - BEHIND;
        m.y = ahead ? s.y + VIEW_AHEAD - .03 : s.y - BEHIND + .03;
        m.u = grain(m.i * 739 + ++m.cycle * 2999) * 1.98 - .99;
      }
    }
  }

  return {
    draw(state, width, height, clock, turning, ending) {
      game = state;
      s = game.river;
      w = width;
      h = height;
      middle = centre(s, s.y);
      scale = Math.min(w * 1.25, h * .90);
      advance(clock);
      const dawn = clamp((progress(game) - .72) / .28);
      sky(dawn);
      banks();
      headlands();
      const horizon = position(middle, s.y + VIEW_AHEAD)[1];
      ctx.fillStyle = gradient(ctx, 0, horizon, 0, horizon + h * .15, [[0, 'transparent'], [.12, p.mist + '85'], [1, p.mist + '00']]);
      ctx.fillRect(0, horizon, w, h * .15);
      const visible = y => y >= s.y - BEHIND && y <= s.y + VIEW_AHEAD;
      for (const ember of s.embers) {
        if (ember.got || !visible(ember.y)) continue;
        const [x, y] = position(ember.x, ember.y);
        const r = (2.5 + Math.sin(ember.y * 41 + clock * 6) * .65) * Math.exp(-(ember.y - s.y) * .21);
        glow(x, y, r * 6, '#ffc777a3');
        fill(ctx, '#ffdb9f', [[x, y - r * 1.5], [x + r, y], [x, y + r * 1.5], [x - r, y]]);
      }
      for (const k of s.rocks) if (visible(k.y)) rock(k);
      drawBoat(clock, turning, ending);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    },
    boatPosition: () => position(s.x, s.y),
    pixelsPerUnit: () => scale,
  };
}
