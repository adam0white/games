import * as lantern from '../../lantern/sim.js';

export const { DT, GOAL, boat, centre, half } = lantern;
export const FIRST_SEED = 11;
export const SECOND_SEED = 255;
export const VIEW_AHEAD = 2.2;
const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };

export function create(seed, stage = 1, tide = true) {
  const river = tide
    ? lantern.create(seed, stage, false, [], { hearts: stage === 1 ? 2 : 1 })
    : lantern.create(seed, stage);
  const distance = tide && stage === 1 ? 44 : GOAL;
  // Lantern already supports crediting distance towards dawn independently of y.
  river.bonus = GOAL - distance;
  return { river, distance, tide, flow: null, rested: 0, ridden: 0 };
}

export function progress({ river, distance }) {
  return Math.min(1, (river.y + river.bonus - (GOAL - distance)) / distance);
}

// The flood shifts the main channel from side to side. Rock shoulders squeeze
// it and the lee opens into quieter water just downstream.
export function jet(s, y) {
  return 0.46 * Math.sin(y * 0.72 + s.p1) + 0.14 * Math.sin(s.t * 0.46 + y * 0.31 + s.p2);
}

export function current(s, x, y) {
  const width = half(s, y);
  const u = (x - centre(s, y)) / width;
  let rush = smooth(1 - Math.abs(u - jet(s, y)) / 0.52);
  let lee = 0;
  const hull = boat(s);
  let blocked = (1 - Math.abs(u)) * width < hull + 0.012;
  for (const rock of s.rocks) {
    if (!rock.on) continue;
    const down = y - rock.y;
    if (down < -0.46 || down > 0.66) continue;
    const across = x - rock.x;
    const clearance = rock.rad + hull + 0.012;
    if (Math.abs(down) < clearance && Math.abs(across) < clearance) {
      blocked ||= across * across + down * down < clearance * clearance;
    }
    const shoulder = smooth(1 - Math.abs(Math.abs(across) - rock.rad - 0.042) / 0.11);
    rush = Math.max(rush, 0.88 * shoulder * smooth(1 - Math.abs(down + 0.12) / 0.34));

    // By the time the water can relight the wick, the hull has cleared the rock.
    const leeWidth = rock.rad + 0.04;
    const wake = smooth(1 - Math.abs(across) / leeWidth)
      * smooth((down - rock.rad - 0.03) / 0.10) * smooth((0.66 - down) / 0.20);
    lee = Math.max(lee, wake);
  }
  if (blocked) lee = 0;
  rush *= 1 - lee;
  return { rush, lee, rate: 1.52 + (s.stage === 1 ? 1.20 : 1.68) * rush - 0.48 * lee };
}

export function step(game, target) {
  const s = game.river;
  if (!game.tide || s.over) {
    lantern.step(s, target);
    return game;
  }

  const flow = current(s, s.x, s.y);
  const calm = s.calm, wick = s.st.wick, previous = s.light;
  s.calm = calm * flow.rate;
  // The tide supplies the light budget while Lantern handles ember caps, graze,
  // collision and terminal ordering. A 12.5 wick level zeroes its base decay.
  s.st.wick = 12.5;
  const burn = (0.22 - 0.208 * flow.rush) * (s.warm > DT ? 0.72 : 1);
  const relight = 0.32 * flow.lee;
  s.light = clamp(previous + (relight - burn) * DT, -1, 1);
  try {
    lantern.step(s, target);
  } finally {
    s.calm = calm;
    s.st.wick = wick;
  }

  s.light = Math.max(0, s.light);
  game.flow = flow;
  game.rested += Math.max(0, Math.min(1, previous + (relight - burn) * DT) - previous);
  game.ridden += flow.rush > 0.5 ? DT : 0;
  return game;
}
