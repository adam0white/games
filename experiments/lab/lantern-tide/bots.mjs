import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as lantern from '../../lantern/sim.js';

if (process.argv.includes('--mutate')) {
  const url = new URL('./sim.js', import.meta.url).href;
  registerHooks({
    load(specifier, context, next) {
      const loaded = next(specifier, context);
      if (specifier !== url) return loaded;
      const source = String(loaded.source);
      const burn = '0.22 - 0.208 * flow.rush';
      assert.ok(source.includes(burn));
      return { ...loaded, source: source.replace(burn, '0.22 + 0.208 * flow.rush') };
    },
  });
}
const { create, current, step, FIRST_SEED, SECOND_SEED, DT, VIEW_AHEAD, jet } = await import('./sim.js');

const HOLD = 6;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

// Both policies issue the same relative-drag targets at 10 Hz, using the same
// visible rocks, embers and banks. Only the reader scores water along a route.
export function steer(game, readsWater) {
  const s = game.river;
  const base = lantern.speed(s);
  const rate = game.flow?.rate ?? (game.tide ? 1.52 : 1);
  const v = base * rate;
  const rocks = s.rocks.filter(rock => rock.on && rock.y > s.y - 0.1 && rock.y < s.y + VIEW_AHEAD);
  const embers = s.embers.filter(ember => !ember.got && ember.y > s.y && ember.y < s.y + VIEW_AHEAD);
  const reach = 0.95 * lantern.nightPace(s.stage);
  let chosen = s.x, best = -Infinity;
  for (let i = -7; i <= 7; i++) {
    const goal = clamp(s.x + i * 0.04, 0, 1);
    let quality = -0.11 * Math.abs(goal - s.x);
    let y = s.y, x = s.x, lastEmber = null;
    for (let sample = 1; sample <= 12; sample++) {
      const at = sample * 0.045;
      const flow = readsWater ? current(s, x, y) : null;
      y += (flow ? base * flow.rate : v) * 0.045;
      if (y - s.y > VIEW_AHEAD) break;
      x += clamp(goal - x, -reach * 0.045, reach * 0.045);
      const bank = lantern.half(s, y) - Math.abs(x - lantern.centre(s, y)) - lantern.BOAT;
      const weight = 1 - at * 0.85;
      if (bank < 0.026) quality -= weight * (0.026 - bank) * (bank < 0 ? 55 : 10);
      for (const rock of rocks) {
        const rx = rock.a ? rock.x0 + rock.a * Math.sin((s.t + at) * rock.w + rock.ph) : rock.x;
        const ry = rock.y + rock.vy * at * rate;
        const distance = Math.hypot(x - rx, y - ry) - rock.rad - lantern.BOAT;
        if (distance < 0.034) quality -= weight * (0.034 - distance) * (distance < 0 ? 65 : 12);
      }
      for (const ember of embers) {
        if (ember !== lastEmber && Math.hypot(x - ember.x, y - ember.y) < 0.047) {
          quality += weight * (0.09 + 0.17 * (1 - s.light));
          lastEmber = ember;
        }
      }
      if (flow) quality += weight * (0.065 * flow.rush + 0.25 * flow.lee * (1 - s.light));
      quality -= Math.abs(x - lantern.centre(s, y)) * 0.08;
    }
    if (quality > best) { best = quality; chosen = goal; }
  }
  return chosen;
}

function ride(seed, readsWater, night = 1, delay = 0) {
  const game = create(seed, night);
  let target = game.river.x;
  const commands = [];
  for (let tick = 0; !game.river.over && tick < 120 / DT; tick++) {
    if (tick % HOLD === 0) commands.push(steer(game, readsWater));
    if (commands.length > delay && tick % HOLD === 0) target = commands.shift();
    step(game, target);
  }
  const { over, t, y, light, taken, grazes, hearts } = game.river;
  return { over, t, y, light, taken, grazes, hearts, rested: game.rested, ridden: game.ridden };
}

if (import.meta.main) measure();

function waterProbes() {
  function sample(xInChannel) {
    const game = create(FIRST_SEED);
    const s = game.river;
    s.x = lantern.centre(s, 0) + xInChannel(s) * lantern.half(s, 0);
    const from = s.light;
    step(game, s.x);
    return { forward: s.y / DT, burn: (from - s.light) / DT };
  }
  const fast = sample(s => jet(s, 0));
  const slack = sample(s => -Math.sign(jet(s, 0)) * .88);
  assert.ok(fast.forward > slack.forward * 1.65, 'fast water increases forward speed');
  assert.ok(fast.burn < slack.burn * 0.15, 'fast water saves flame');

  const game = create(FIRST_SEED);
  const s = game.river;
  step(game, s.x);
  const [rock] = s.rocks;
  const at = rock.y + rock.rad + .21;
  s.x = rock.x;
  s.y = at;
  s.light = .5;
  const water = current(s, s.x, at);
  assert.ok(water.lee > .85 && water.rate < 1.15, 'the water in the lee is slow');
  assert.equal(current(s, s.x, rock.y - .20).lee, 0, 'the approach does not relight the wick');
  const obstacle = { ...rock, x: rock.x, y: at };
  s.rocks.push(obstacle);
  assert.equal(current(s, s.x, at).lee, 0, 'another rock cancels rest where it blocks the lee');
  s.rocks.pop();
  step(game, s.x);
  assert.ok(!s.over && s.light > .5 && game.rested > 0, 'safe lee water relights the wick');
  console.log('Core and slack:', fast, slack, 'lee rate', +water.rate.toFixed(3),
    'light restored per second', +(game.rested / DT).toFixed(3));
}

function measure() {
  waterProbes();
  const snapshot = state => ({ ...state, q: undefined, r: undefined });
  let parityTicks = 0;
  for (const stage of [1, 2, 7, 19]) {
    for (const seed of [1, 7, 51, 201]) {
      const reference = lantern.create(seed, stage);
      const game = create(seed, stage, false);
      let target = reference.x, tick = 0;
      while (!reference.over && reference.t < 120) {
        if (tick++ % HOLD === 0) target = steer(game, false);
        lantern.step(reference, target);
        step(game, target);
        assert.deepEqual(snapshot(game.river), snapshot(reference));
        parityTicks++;
      }
    }
  }
  console.log(`Tide off matches Lantern for ${parityTicks} ticks across 16 runs.`);

  const first = ride(FIRST_SEED, true);
  const replay = ride(FIRST_SEED, true);
  assert.deepEqual(first, replay, 'a seeded crossing replays exactly');
  assert.equal(first.over, 'dawn', 'the opening seed reaches dawn');
  assert.ok(first.t > 15 && first.t < 60, 'the opening crossing lasts 15 to 60 seconds');
  assert.ok(first.rested > .08 && first.ridden > 8, 'the opening crosses fast water and relights in eddies');
  const delayed = [1, 2, 3].map(delay => ride(FIRST_SEED, true, 1, delay));
  assert.ok(delayed.every(run => run.over === 'dawn' && run.t < 60), 'the opening tolerates up to 300 ms of command delay');
  console.log('Opening crossing:', first);
  console.log('Opening with 100, 200 and 300 ms command delay:', delayed.map(run => [run.over, +run.t.toFixed(2)]));

  const seeds = Array.from({ length: 48 }, (_, index) => (Math.imul(index + 1, 0x9e3779b9) >>> 0));
  const second = ride(SECOND_SEED, true, 2);
  assert.equal(second.over, 'dawn', 'the unlocked seed reaches dawn');
  console.log('Unlocked crossing:', +second.t.toFixed(2), 'seconds');

  for (const night of [1, 2]) {
    const results = [true, false].map(policy => seeds.map(seed => ride(seed, policy, night)));
    const winsByPolicy = results.map(runs => runs.filter(run => run.over === 'dawn').length);
    if (night === 2) assert.ok(winsByPolicy[0] >= winsByPolicy[1] + 10, 'the reader gains at least 10 of 48 dawns on the full river');
    for (const [index, runs] of results.entries()) {
      const wins = runs.filter(run => run.over === 'dawn');
      const ends = Object.fromEntries(['dawn', 'dark', 'rock', 'bank', 'ice', 'null'].map(end =>
        [end, runs.filter(run => String(run.over) === end).length]));
      console.log(`Night ${night}, ${index === 0 ? 'reader' : 'plain'}`, ends,
        'dawn seconds', wins.length ? [Math.min(...wins.map(run => run.t)), Math.max(...wins.map(run => run.t))].map(n => +n.toFixed(2)) : [],
        'mean current seconds', +(runs.reduce((sum, run) => sum + run.ridden, 0) / runs.length).toFixed(2),
        'mean light regained', +(runs.reduce((sum, run) => sum + run.rested, 0) / runs.length).toFixed(3));
    }
  }
}
