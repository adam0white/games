import { describe, expect, it } from 'vitest';
import type { Frame, Recording } from '../src/types.ts';
import '../viewer/viewer.js';

const { buildTimeline, frameAt, indexPaths, sparklinePoints, trailAt } = Reflect.get(
  globalThis,
  'IslandReplay',
) as {
  buildTimeline: (runs: Recording[]) => { e: number; s: number }[];
  frameAt: (run: Recording, point: { e: number; s: number }) => Frame | null;
  trailAt: (run: Recording, point: { e: number; s: number }) => { x: number; y: number }[];
  indexPaths: (value: unknown) => string[];
  sparklinePoints: (values: (number | undefined)[], width: number, height: number) => string[];
};

const frame = (e: number, s: number, x = 1): Frame => ({
  e,
  s,
  me: { x, y: 1 },
  carrying: null,
  objects: [],
  action: 'rest',
  events: [],
});
const run = (frames: Frame[]) => ({ frames }) as Recording;

describe('replay alignment', () => {
  it('aligns by episode and step, including unequal and incomplete recordings', () => {
    const left = run([frame(0, 1), frame(0, 2), frame(1, 1)]);
    const right = run([frame(0, 1), frame(1, 1), frame(1, 2)]);
    expect(buildTimeline([left, right])).toEqual([
      { e: 0, s: 1 },
      { e: 0, s: 2 },
      { e: 1, s: 1 },
      { e: 1, s: 2 },
    ]);
    expect(frameAt(right, { e: 0, s: 2 })).toBeNull();
    expect(frameAt(left, { e: 1, s: 1 })).toEqual(left.frames[2]);
  });
  it('does not carry the trail across an episode reset or into the future', () => {
    const recording = run([frame(0, 1, 8), ...Array.from({ length: 25 }, (_, i) => frame(1, i, i))]);
    const trail = trailAt(recording, { e: 1, s: 22 });
    expect(trail).toHaveLength(20);
    expect(trail[0]).toEqual({ x: 3, y: 1 });
    expect(trail[19]).toEqual({ x: 22, y: 1 });
    expect(trailAt(recording, { e: 2, s: 1 })).toEqual([]);
  });
});

describe('recording loading and charts', () => {
  it('reads simple and metadata indexes without accepting unrelated entries', () => {
    expect(indexPaths(['hf-1.json', 'llm-1.json'])).toEqual(['hf-1.json', 'llm-1.json']);
    expect(indexPaths([{ file: 'hf-1.json', mind: 'hf', seed: 1 }])).toEqual(['hf-1.json']);
    expect(indexPaths({ recordings: [{ file: 'hf-1.json', mind: 'hf' }, { path: 'llm-1.json' }] })).toEqual([
      'hf-1.json',
      'llm-1.json',
    ]);
    expect(() => indexPaths({ recordings: [{ mind: 'hf' }] })).toThrow();
    expect(() => indexPaths(['https://example.com/run.json'])).toThrow();
    expect(() => indexPaths(['%2e%2e/private.json'])).toThrow();
    expect(() => indexPaths(['nested/%2E%2e/%2e%2e/private.json'])).toThrow();
  });
  it('keeps chart gaps for absent readings and clamps readings to the chart', () => {
    expect(sparklinePoints([0, 0.5, undefined, 2], 100, 20)).toEqual(['0,20 33.33,10', '100,0']);
    expect(sparklinePoints([], 100, 20)).toEqual([]);
    expect(sparklinePoints([0.5], 100, 20)).toEqual(['0,10']);
  });
});
