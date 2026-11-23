import type { Action, Cell, Observation, WorldObject, WorldState } from './types.ts';

/** Extra world bookkeeping is serialized with the state, never exposed as sight. */
interface IslandState extends WorldState {
  sight: number;
  events: string[];
  ringArrangements: string[];
}

const DIRECTIONS = [
  { id: 'N', dx: 0, dy: -1, word: 'north' },
  { id: 'S', dx: 0, dy: 1, word: 'south' },
  { id: 'E', dx: 1, dy: 0, word: 'east' },
  { id: 'W', dx: -1, dy: 0, word: 'west' },
] as const;

function draw(state: { rng: number }): number {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let value = state.rng;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function heightAt(state: WorldState, cell: Cell): number {
  return state.height[cell.y]?.[cell.x] ?? 0;
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

function distance(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function stackAt(state: WorldState, cell: Cell): WorldObject[] {
  return state.objects
    .filter((thing) => thing.at !== null && sameCell(thing.at, cell))
    .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
}

function topLevel(state: WorldState, cell: Cell): number {
  return stackAt(state, cell).at(-1)?.level ?? -1;
}

function offset(dx: number, dy: number): string {
  const parts: string[] = [];
  if (dx !== 0) parts.push(`${Math.abs(dx)} ${dx > 0 ? 'east' : 'west'}`);
  if (dy !== 0) parts.push(`${Math.abs(dy)} ${dy > 0 ? 'south' : 'north'}`);
  return parts.join(' and ') || 'here';
}

function countWord(count: number): string {
  return (
    ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][count] ??
    String(count)
  );
}

/** Build the same terrain, body and objects for every episode of a seed. */
export function createWorld(seed: number): WorldState {
  if (!Number.isSafeInteger(seed)) throw new Error('Seed must be a safe integer.');
  const random = { rng: seed >>> 0 };
  const hillCount = 2 + Math.floor(draw(random) * 2);
  // Separate peak regions prevent a seed from collapsing all hills into one plateau.
  const regions = [
    { x: 3, y: 3 },
    { x: 10, y: 4 },
    { x: 6, y: 10 },
  ];
  const hills = regions.slice(0, hillCount).map((region) => ({
    x: region.x + (draw(random) - 0.5) * 1.2,
    y: region.y + (draw(random) - 0.5) * 1.2,
    spread: 1.8 + draw(random) * 0.7,
  }));
  const phaseX = draw(random) * Math.PI * 2;
  const phaseY = draw(random) * Math.PI * 2;
  const height: number[][] = [];
  let highest = -Infinity;
  let spire: Cell = { x: 1, y: 1 };
  for (let y = 0; y < 14; y++) {
    const row: number[] = [];
    for (let x = 0; x < 14; x++) {
      if (x === 0 || y === 0 || x === 13 || y === 13) {
        row.push(0);
        continue;
      }
      const noise = 0.18 * Math.sin(x * 0.7 + phaseX) * Math.cos(y * 0.6 + phaseY);
      const peak = Math.max(
        ...hills.map(
          (hill) => 3 * Math.exp(-((x - hill.x) ** 2 + (y - hill.y) ** 2) / (2 * hill.spread ** 2)),
        ),
      );
      const elevation = 1 + peak + noise;
      row.push(Math.max(1, Math.min(4, Math.round(elevation))));
      if (elevation > highest) {
        highest = elevation;
        spire = { x, y };
      }
    }
    height.push(row);
  }
  const spireRow = height[spire.y];
  if (spireRow) spireRow[spire.x] = 4;

  // Start at the southwestern shore. Sample object cells without replacement.
  const me = { x: 1, y: 12 };
  const cells: Cell[] = [];
  for (let y = 1; y < 13; y++)
    for (let x = 1; x < 13; x++) {
      if (!sameCell({ x, y }, me) && !sameCell({ x, y }, spire)) cells.push({ x, y });
    }
  const objects: WorldObject[] = [];
  for (let i = 0; i < 12; i++) {
    const index = Math.floor(draw(random) * cells.length);
    const at = cells.splice(index, 1)[0];
    if (!at) throw new Error('Island has no object placement cell.');
    const kind = i < 10 ? 'cube' : i === 10 ? 'rock' : 'ring';
    objects.push({ id: kind === 'cube' ? `cube-${i + 1}` : kind, kind, at, level: 0 });
  }
  const state: IslandState = {
    seed,
    rng: random.rng,
    size: 14,
    height,
    spire,
    me,
    carrying: null,
    objects,
    episode: 0,
    step: 0,
    found: { rockMakesCube: 0, ringGlow: 0 },
    sight: 4,
    events: [],
    ringArrangements: [],
  };
  return state;
}

/** Legal actions depend only on the current body, terrain, stack tops and hands. */
export function legalActions(state: WorldState): Action[] {
  const actions: Action[] = [];
  const currentHeight = heightAt(state, state.me);
  for (const direction of DIRECTIONS) {
    const cell = { x: state.me.x + direction.dx, y: state.me.y + direction.dy };
    const elevation = heightAt(state, cell);
    if (elevation > 0 && elevation <= currentHeight + 1) {
      actions.push({ id: `move ${direction.id}`, kind: 'move', label: `Walk one cell ${direction.word}.` });
    }
    if (state.carrying === null && elevation > 0 && elevation <= currentHeight + 2) {
      actions.push({ id: `jump ${direction.id}`, kind: 'climb', label: `Jump one cell ${direction.word}.` });
    }
  }
  if (state.carrying === null) {
    for (const thing of state.objects) {
      if (
        thing.at &&
        heightAt(state, thing.at) > 0 &&
        distance(state.me, thing.at) <= 1 &&
        stackAt(state, thing.at).at(-1)?.id === thing.id
      ) {
        actions.push({ id: `pick ${thing.id}`, kind: 'pick', label: `Pick up ${thing.id}.` });
      }
    }
  } else {
    actions.push({ id: 'place here', kind: 'place', label: `Put ${state.carrying} on this cell's stack.` });
    for (const direction of DIRECTIONS) {
      const cell = { x: state.me.x + direction.dx, y: state.me.y + direction.dy };
      if (heightAt(state, cell) > 0) {
        actions.push({
          id: `place ${direction.id}`,
          kind: 'place',
          label: `Put ${state.carrying} on the stack ${direction.word}.`,
        });
      }
      for (const strength of ['soft', 'hard']) {
        actions.push({
          id: `throw ${direction.id} ${strength}`,
          kind: 'throw',
          label: `Throw ${state.carrying} ${direction.word}, ${strength}.`,
        });
      }
    }
  }
  actions.push({ id: 'rest', kind: 'rest', label: 'Rest for one step.' });
  actions.push({ id: 'look', kind: 'look', label: 'Look farther around for one step.' });
  return actions;
}

/** Text and structured sight are made from the same visible facts (Manhattan radius). */
export function observe(state: WorldState, task = ''): Observation {
  const memory = state as Partial<IslandState>;
  const hereHeight = heightAt(state, state.me);
  const onSpire = sameCell(state.me, state.spire);
  const terrain = onSpire
    ? 'the Spire'
    : hereHeight === 1
      ? 'shore'
      : hereHeight === 2
        ? 'grass'
        : hereHeight === 3
          ? 'hillside'
          : 'hilltop';
  const radius = memory.sight ?? 4;
  const ring = state.objects.find((thing) => thing.kind === 'ring' && thing.at !== null);
  const things: Observation['seen']['things'] = state.objects
    .filter((thing) => thing.at && distance(state.me, thing.at) <= radius)
    .map((thing) => ({
      id: thing.id,
      kind: thing.kind,
      dx: (thing.at?.x ?? state.me.x) - state.me.x,
      dy: (thing.at?.y ?? state.me.y) - state.me.y,
      level: thing.level,
      inRing: thing.kind !== 'ring' && ring?.at != null && thing.at !== null && sameCell(thing.at, ring.at),
    }));
  // The Spire is the island's tallest point, a landmark visible from anywhere (lead, 2026-10-20: the task must be
  // reachable by every mind without a map).
  const spire = { dx: state.spire.x - state.me.x, dy: state.spire.y - state.me.y };
  const lines = [`You stand on ${terrain}, at terrain height ${hereHeight}.`];
  lines.push(
    onSpire
      ? 'You are on the Spire.'
      : `The Spire is ${offset(spire.dx, spire.dy)}, ${distance(state.me, state.spire)} cells away.`,
  );
  for (const thing of things) {
    const cell = { x: state.me.x + thing.dx, y: state.me.y + thing.dy };
    const stack = stackAt(state, cell);
    const position = stack.at(-1)?.id === thing.id ? 'on top of' : 'below the top of';
    lines.push(
      `${thing.id} (${thing.kind}), ${offset(thing.dx, thing.dy)}, at stack level ${thing.level}, ${position} a stack of ${countWord(stack.length)}${thing.inRing ? ', in the ring' : ''}${thing.kind === 'ring' ? ', lying flat' : ''}.`,
    );
  }
  lines.push(state.carrying === null ? 'Your hands are empty.' : `You carry ${state.carrying}.`);
  return {
    episode: state.episode,
    step: state.step,
    stepsLeft: Math.max(0, 60 - state.step),
    text: lines.join('\n'),
    events: [...(memory.events ?? [])],
    actions: legalActions(state),
    task,
    seen: { here: { height: hereHeight, onSpire, terrain }, spire, things, carrying: state.carrying },
  };
}

function glow(state: IslandState): void {
  const ring = state.objects.find((thing) => thing.kind === 'ring');
  if (!ring?.at) return;
  const cubes = stackAt(state, ring.at).filter((thing) => thing.kind === 'cube');
  if (cubes.length < 3) return;
  const arrangement = JSON.stringify([ring.at.x, ring.at.y, cubes.map((thing) => [thing.id, thing.level])]);
  if (state.ringArrangements.includes(arrangement)) return;
  state.ringArrangements.push(arrangement);
  state.found.ringGlow++;
  state.events.push('The ring glows.');
}

/** Apply exactly one legal action, leaving the input state untouched. */
export function apply(state: WorldState, actionId: string): { state: WorldState; events: string[] } {
  if (!legalActions(state).some((action) => action.id === actionId)) {
    throw new Error(`Illegal action: ${actionId}`);
  }
  const next = structuredClone(state) as IslandState;
  next.sight = 4;
  next.events = [];
  next.ringArrangements ??= [];
  next.step++;
  const [verb, argument, strength] = actionId.split(' ');
  const direction = DIRECTIONS.find((candidate) => candidate.id === argument);
  if ((verb === 'move' || verb === 'jump') && direction) {
    next.me.x += direction.dx;
    next.me.y += direction.dy;
    next.events.push(`You ${verb === 'move' ? 'walk' : 'jump'} ${direction.word}.`);
  } else if (verb === 'pick') {
    const thing = next.objects.find((candidate) => candidate.id === argument);
    if (!thing) throw new Error('Legal pick has no object.');
    thing.at = null;
    thing.level = 0;
    next.carrying = thing.id;
    next.events.push(`You pick up ${thing.id}.`);
  } else if (verb === 'place' || verb === 'throw') {
    const thing = next.objects.find((candidate) => candidate.id === next.carrying);
    if (!thing) throw new Error('Carried object is missing.');
    let landing = { ...next.me };
    if (verb === 'place' && direction) {
      landing = { x: landing.x + direction.dx, y: landing.y + direction.dy };
    } else if (verb === 'throw' && direction) {
      const launchHeight = heightAt(next, next.me);
      for (let i = 0; i < (strength === 'soft' ? 2 : 4); i++) {
        const target = { x: landing.x + direction.dx, y: landing.y + direction.dy };
        if (heightAt(next, target) > launchHeight) break;
        landing = target;
        if (heightAt(next, landing) === 0) break;
      }
    }
    next.carrying = null;
    if (heightAt(next, landing) === 0) {
      next.objects = next.objects.filter((candidate) => candidate.id !== thing.id);
      next.events.push(`You throw ${thing.id} into the water. It is lost.`);
    } else {
      const level = topLevel(next, landing) + 1;
      // A ring always lies flat under the other objects on its cell.
      if (thing.kind === 'ring') {
        for (const other of stackAt(next, landing)) other.level++;
        thing.level = 0;
      } else thing.level = level;
      thing.at = landing;
      next.events.push(
        verb === 'place'
          ? `You place ${thing.id} ${argument === 'here' ? 'here' : direction?.word}.`
          : `You throw ${thing.id} ${direction?.word}. It lands ${offset(landing.x - next.me.x, landing.y - next.me.y)}.`,
      );
      const cubeCount = next.objects.filter((candidate) => candidate.kind === 'cube').length;
      if (verb === 'throw' && strength === 'hard' && thing.kind === 'rock' && cubeCount < 20) {
        const largestId = Math.max(
          10,
          ...next.objects
            .filter((candidate) => candidate.kind === 'cube')
            .map((candidate) => Number(candidate.id.slice(5))),
        );
        const id = `cube-${Math.max(largestId + 1, 11 + next.found.rockMakesCube)}`;
        next.objects.push({ id, kind: 'cube', at: { ...landing }, level: topLevel(next, landing) + 1 });
        next.found.rockMakesCube++;
        next.events.push('The rock cracks, and a small cube breaks off.');
      }
    }
  } else if (verb === 'look') {
    next.sight = 7;
    next.events.push('You look farther around.');
  } else {
    next.events.push('You rest.');
  }
  glow(next);
  return { state: next, events: [...next.events] };
}

/** Reset discoveries and physical state; only the mind carries memory across episodes. */
export function reset(state: WorldState): WorldState {
  return { ...createWorld(state.seed), episode: state.episode + 1 };
}
