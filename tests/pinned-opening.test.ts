import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/engine';

describe('pinned HF4 opening provenance', () => {
  it('refuses unbound person caches without mutating them or substituting authored replicas', () => {
    const people = structuredClone(createGame(42).people);
    people.nora!.traits.honesty = 0.91;
    const before = JSON.stringify(people);
    expect(() => createGame(42, 'current', people)).toThrow('recorded source chapter');
    expect(JSON.stringify(people)).toBe(before);
  });
});
