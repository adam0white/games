// Rules shared by the page, simulation and measurement tools. Time is in seconds.
export const MODES = Object.freeze({
  classic: Object.freeze({ name: 'classic', id: 0, roundSeconds: 360, breakSeconds: 12, minAnts: 32, colonies: true }),
  feast: Object.freeze({ name: 'feast', id: 1, roundSeconds: 240, breakSeconds: 10, minAnts: 24, colonies: false, eatRatio: 1.25, retain: 0.6, gain: 0.5, respawnSeconds: 2, protectionSeconds: 4, crumbGrowth: 1, cakeGrowth: 10, shrink: 0.015 }),
  rush: Object.freeze({ name: 'rush', id: 2, roundSeconds: 120, breakSeconds: 8, minAnts: 32, colonies: true, hillRadius: 140, hillEvery: 4, frenzySeconds: 20, goalSkipSeconds: 30, crowdedAt: 120, crowdedSnapEvery: 4 }),
});
export const getMode = name => Object.hasOwn(MODES, name) ? MODES[name] : null;
export const RANKS = ['Egg', 'Worker', 'Forager', 'Soldier', 'Major', 'Queen'];
export const RANK_AT = [10, 16, 28, 46, 75, 120];
export const rankOf = mass => { let r = 0; while (r < RANK_AT.length - 1 && mass >= RANK_AT[r + 1]) r++; return r; };
export const GRASS = [[1260, 1420, 90], [1940, 1780, 90], [1420, 1940, 80]];
export const inGrass = (x, y) => GRASS.some(([gx, gy, r]) => (x - gx) ** 2 + (y - gy) ** 2 < r * r);

// Only the dense Rush lane reduces network cadence. Simulation and inputs remain 20 Hz.
export const snapshotEvery = (rules, ants) => rules.name === 'rush' && ants > rules.crowdedAt ? rules.crowdedSnapEvery : 2;
