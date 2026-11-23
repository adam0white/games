import { describe, expect, it } from 'vitest';
import type { WorldObject, WorldState } from '../src/types.ts';
import { apply, createWorld, legalActions, observe, reset } from '../src/world.ts';

function flat(): WorldState {
  const state = createWorld(17);
  state.height = Array.from({ length: 14 }, (_, y) =>
    Array.from({ length: 14 }, (_, x) => (x === 0 || y === 0 || x === 13 || y === 13 ? 0 : 1)),
  );
  state.me = { x: 5, y: 5 };
  state.spire = { x: 10, y: 10 };
  state.objects = [];
  return state;
}

function object(id: string, x: number | null, y = 5, level = 0): WorldObject {
  return {
    id,
    kind: id.startsWith('cube-') ? 'cube' : id === 'rock' ? 'rock' : 'ring',
    at: x === null ? null : { x, y },
    level,
  };
}

function ids(state: WorldState): string[] {
  return legalActions(state).map((action) => action.id);
}

function setHeight(state: WorldState, x: number, y: number, height: number): void {
  const row = state.height[y];
  if (!row) throw new Error('Missing test terrain row');
  row[x] = height;
}

describe('world', () => {
  it('builds a seeded 14-cell island with water rim, land, a Spire and twelve objects', () => {
    const state = createWorld(1);
    expect(state.size).toBe(14);
    expect(state.objects.filter((thing) => thing.kind === 'cube')).toHaveLength(10);
    expect(state.objects.filter((thing) => thing.kind === 'rock')).toHaveLength(1);
    expect(state.objects.filter((thing) => thing.kind === 'ring')).toHaveLength(1);
    expect(state.height[state.spire.y]?.[state.spire.x]).toBe(4);
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 14; x++) {
        const height = state.height[y]?.[x];
        if (x === 0 || y === 0 || x === 13 || y === 13) expect(height).toBe(0);
        else expect(height).toBeGreaterThanOrEqual(1);
      }
    expect(createWorld(2)).not.toEqual(state);
  });

  it('replays actions identically after every state is serialized to JSON', () => {
    let first = createWorld(45);
    let second = createWorld(45);
    for (let i = 0; i < 120; i++) {
      const action = legalActions(first)[i % legalActions(first).length];
      if (!action) throw new Error('No legal actions');
      const before = JSON.stringify(first);
      const result = apply(first, action.id);
      expect(JSON.stringify(first)).toBe(before);
      first = result.state;
      second = apply(JSON.parse(JSON.stringify(second)), action.id).state;
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    }
  });

  it('keeps two or three separate hilltops instead of merging every peak', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = createWorld(seed);
      const visited = new Set<string>();
      let hilltops = 0;
      for (let y = 1; y < 13; y++)
        for (let x = 1; x < 13; x++) {
          if (state.height[y]?.[x] !== 4 || visited.has(`${x},${y}`)) continue;
          hilltops++;
          const pending = [{ x, y }];
          while (pending.length) {
            const cell = pending.pop();
            if (!cell) break;
            const key = `${cell.x},${cell.y}`;
            if (visited.has(key) || state.height[cell.y]?.[cell.x] !== 4) continue;
            visited.add(key);
            pending.push(
              { x: cell.x + 1, y: cell.y },
              { x: cell.x - 1, y: cell.y },
              { x: cell.x, y: cell.y + 1 },
              { x: cell.x, y: cell.y - 1 },
            );
          }
        }
      expect(hilltops, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(hilltops, `seed ${seed}`).toBeLessThanOrEqual(3);
    }
  });

  it('allows walking up one level and down any height but never into water', () => {
    const state = flat();
    setHeight(state, 5, 4, 2);
    setHeight(state, 6, 5, 3);
    setHeight(state, 5, 6, 0);
    expect(ids(state)).toContain('move N');
    expect(ids(state)).not.toContain('move E');
    expect(ids(state)).not.toContain('move S');
    expect(apply(state, 'move N').state.me).toEqual({ x: 5, y: 4 });
    setHeight(state, 5, 5, 4);
    expect(ids(state)).toContain('move W');
  });

  it('allows a one-cell jump up two levels only with empty hands', () => {
    const state = flat();
    setHeight(state, 5, 4, 3);
    setHeight(state, 6, 5, 4);
    expect(ids(state)).toContain('jump N');
    expect(ids(state)).not.toContain('jump E');
    expect(apply(state, 'jump N').state.me).toEqual({ x: 5, y: 4 });
    state.objects = [object('cube-1', null)];
    state.carrying = 'cube-1';
    expect(ids(state).some((id) => id.startsWith('jump '))).toBe(false);
  });

  it('picks only the top object here or orthogonally adjacent with empty hands', () => {
    const state = flat();
    state.objects = [
      object('cube-1', 5),
      object('cube-2', 5, 5, 1),
      object('rock', 6),
      object('cube-3', 6, 6),
      object('cube-4', 8),
    ];
    expect(ids(state).filter((id) => id.startsWith('pick '))).toEqual(['pick cube-2', 'pick rock']);
    const result = apply(state, 'pick cube-2');
    expect(result.state.carrying).toBe('cube-2');
    expect(result.state.objects.find((thing) => thing.id === 'cube-2')?.at).toBeNull();
    expect(result.events).toContain('You pick up cube-2.');
    expect(ids(result.state).some((id) => id.startsWith('pick '))).toBe(false);
  });

  it('places the carried object here or on adjacent land, on top of the stack', () => {
    const state = flat();
    state.objects = [object('cube-1', null), object('cube-2', 6), object('cube-3', 6, 5, 1)];
    state.carrying = 'cube-1';
    setHeight(state, 5, 4, 0);
    expect(ids(state)).toContain('place here');
    expect(ids(state)).not.toContain('place N');
    const result = apply(state, 'place E');
    expect(result.state.objects.find((thing) => thing.id === 'cube-1')).toMatchObject({
      at: { x: 6, y: 5 },
      level: 2,
    });
    expect(result.state.carrying).toBeNull();
    expect(ids(result.state).some((id) => id.startsWith('place '))).toBe(false);
  });

  it.each([
    ['soft', 7],
    ['hard', 9],
  ] as const)('throws %s the specified distance', (strength, x) => {
    const state = flat();
    state.objects = [object('cube-1', null)];
    state.carrying = 'cube-1';
    expect(ids(state)).toContain(`throw E ${strength}`);
    const next = apply(state, `throw E ${strength}`).state;
    expect(next.objects[0]?.at).toEqual({ x, y: 5 });
    expect(next.carrying).toBeNull();
  });

  it('stops throws before higher ground and drops into water until reset', () => {
    const state = flat();
    state.objects = [object('cube-1', null)];
    state.carrying = 'cube-1';
    setHeight(state, 7, 5, 2);
    expect(apply(state, 'throw E hard').state.objects[0]?.at).toEqual({ x: 6, y: 5 });
    state.me.x = 1;
    const lost = apply(state, 'throw W soft');
    expect(lost.state.objects).toHaveLength(0);
    expect(lost.events.join(' ')).toContain('water');
    expect(reset(lost.state).objects).toHaveLength(12);
  });

  it('offers rest and look with or without a carried object and rejects illegal ids', () => {
    const state = flat();
    expect(ids(state)).toEqual(expect.arrayContaining(['rest', 'look']));
    expect(() => apply(state, 'teleport')).toThrow(/illegal/i);
    expect(apply(state, 'rest').state.step).toBe(1);
    expect(apply(state, 'rest').state.me).toEqual(state.me);
  });

  it('reveals seven cells for one observation after look, then returns to four', () => {
    const state = flat();
    state.objects = [object('cube-1', 10)];
    expect(observe(state, '').seen.things).toHaveLength(0);
    const looking = apply(state, 'look').state;
    expect(observe(looking, '').seen.things.map((thing) => thing.id)).toEqual(['cube-1']);
    expect(observe(apply(looking, 'rest').state, '').seen.things).toHaveLength(0);
  });

  it('makes a cube when a hard-thrown rock lands on land, but not on soft throws', () => {
    const state = flat();
    state.objects = [object('rock', null)];
    state.carrying = 'rock';
    const result = apply(state, 'throw E hard');
    expect(result.events).toContain('The rock cracks, and a small cube breaks off.');
    expect(result.state.found.rockMakesCube).toBe(1);
    expect(result.state.objects.filter((thing) => thing.kind === 'cube')).toHaveLength(1);
    expect(result.state.objects.every((thing) => thing.at?.x === 9 && thing.at.y === 5)).toBe(true);
    expect(apply(state, 'throw E soft').state.found.rockMakesCube).toBe(0);
    state.me.x = 1;
    expect(apply(state, 'throw W hard').state.found.rockMakesCube).toBe(0);
  });

  it('caps cubes at twenty', () => {
    const state = flat();
    state.objects = [
      object('rock', null),
      ...Array.from({ length: 20 }, (_, i) => object(`cube-${i + 1}`, 4)),
    ];
    state.carrying = 'rock';
    expect(apply(state, 'throw E hard').state.objects.filter((thing) => thing.kind === 'cube')).toHaveLength(
      20,
    );
  });

  it('can replace a lost cube after ten previous rock discoveries', () => {
    const state = flat();
    state.objects = [
      object('rock', null),
      ...Array.from({ length: 19 }, (_, i) => object(`cube-${i + 1}`, 4, 5, i)),
    ];
    state.carrying = 'rock';
    state.found.rockMakesCube = 10;
    const next = apply(state, 'throw E hard').state;
    expect(next.objects.filter((thing) => thing.kind === 'cube')).toHaveLength(20);
    expect(next.found.rockMakesCube).toBe(11);
    expect(next.objects.some((thing) => thing.id === 'cube-21')).toBe(true);
  });

  it('glows once for each new arrangement of three or more cubes in the ring', () => {
    const state = flat();
    state.objects = [
      object('ring', 5),
      object('cube-1', 5, 5, 1),
      object('cube-2', 5, 5, 2),
      object('cube-3', null),
    ];
    state.carrying = 'cube-3';
    const glowing = apply(state, 'place here');
    expect(glowing.events).toContain('The ring glows.');
    expect(glowing.state.found.ringGlow).toBe(1);
    const resting = apply(glowing.state, 'rest');
    expect(resting.events).not.toContain('The ring glows.');
    const lifted = apply(resting.state, 'pick cube-3');
    const replaced = apply(lifted.state, 'place here');
    expect(replaced.events).not.toContain('The ring glows.');
    const changed = structuredClone(replaced.state);
    changed.objects.push(object('cube-4', null));
    changed.carrying = 'cube-4';
    expect(apply(changed, 'place here').state.found.ringGlow).toBe(2);
  });

  it('restores terrain, objects, RNG and body on reset while advancing the episode', () => {
    const initial = createWorld(3);
    const changed = apply(apply(initial, 'look').state, 'rest').state;
    const restored = reset(changed);
    expect(restored).toEqual({ ...initial, episode: 1 });
    expect(reset(restored).episode).toBe(2);
  });

  it('describes every seen id and no unseen id, including carrying, offsets and stack facts', () => {
    const state = flat();
    state.objects = [
      object('cube-1', 7, 4),
      object('cube-2', 7, 4, 1),
      object('ring', 7, 4),
      object('rock', null),
      object('cube-10', 12),
    ];
    state.carrying = 'rock';
    state.spire = { x: 5, y: 3 };
    const obs = observe(state, 'A task.');
    const textIds = [...new Set(obs.text.match(/cube-\d+|\brock\b|\bring\b/g))].sort();
    expect(textIds).toEqual(
      [...obs.seen.things.map((thing) => thing.id), obs.seen.carrying].filter(Boolean).sort(),
    );
    expect(obs.seen.spire).toEqual({ dx: 0, dy: -2 });
    expect(obs.text).toContain('2 east and 1 north');
    expect(obs.text).toContain('in the ring');
    expect(obs.seen.things.find((thing) => thing.id === 'cube-2')).toMatchObject({ level: 1, inRing: true });
    expect(obs.text).toContain(String(obs.seen.here.height));
    expect(obs.text).toContain(obs.seen.here.terrain);
    expect(obs.task).toBe('A task.');
  });
});
