import { describe, expect, it } from 'vitest';
import { measureRecording } from '../src/measures.ts';
import type { Frame, Recording } from '../src/types.ts';

function frame(action: string, overrides: Partial<Frame> = {}): Frame {
  return { e: 0, s: 0, me: { x: 1, y: 1 }, carrying: null, objects: [], action, events: [], ...overrides };
}

function recording(frames: Frame[], freeEpisodes = 2): Recording {
  return {
    format: 'island-recording@1',
    mind: 'fixture',
    seed: 7,
    hf: '2.9.0',
    world: { size: 5, height: [], spire: { x: 3, y: 3 } },
    config: { freeEpisodes, stepsPerEpisode: 10, taskSteps: 10, task: 'Build on the Spire.' },
    frames,
    notes: [],
    selfReports: [],
    measures: {},
    cost: { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 },
  };
}

describe('measureRecording', () => {
  it('returns finite zero metrics for an empty recording', () => {
    expect(measureRecording(recording([]))).toEqual({
      cellsVisited: 0,
      distinctActs: 0,
      kindEntropy: 0,
      repeatWithVariation: 0,
      maxStack: 0,
      ringGlows: 0,
      rockCubes: 0,
      idleShare: 0,
      freeSpireObjects: 0,
      taskScore: 0,
    });
  });

  it('counts free action ids and cells, maps jump to climb, and keeps rest and look separate', () => {
    const measures = measureRecording(
      recording([
        frame('jump N'),
        frame('jump N', { me: { x: 2, y: 1 } }),
        frame('rest', { e: 1 }),
        frame('look', { e: 1 }),
        frame('throw E hard', { e: 2, me: { x: 4, y: 4 } }),
      ]),
    );
    expect(measures.cellsVisited).toBe(2);
    expect(measures.distinctActs).toBe(3);
    expect(measures.kindEntropy).toBe(1.5);
    expect(measures.idleShare).toBe(0.5);
  });

  it('counts occurrences of repeated four-kind windows only when exact arguments vary', () => {
    const measures = measureRecording(
      recording([
        frame('move N'),
        frame('pick cube-1'),
        frame('place here'),
        frame('throw E hard'),
        frame('move S'),
        frame('pick cube-2'),
        frame('place here'),
        frame('throw W soft'),
      ]),
    );
    // Five windows; the first and fifth share kinds but differ in arguments.
    expect(measures.repeatWithVariation).toBe(2 / 5);
  });

  it('does not treat exact repetition as variation or join windows across episodes', () => {
    expect(
      measureRecording(
        recording([frame('move N'), frame('move N'), frame('move N'), frame('move N'), frame('move N')]),
      ).repeatWithVariation,
    ).toBe(0);
    expect(
      measureRecording(
        recording([
          frame('move N'),
          frame('move S'),
          frame('move E'),
          frame('move W', { e: 1 }),
          frame('move N', { e: 1 }),
          frame('move S', { e: 1 }),
        ]),
      ).repeatWithVariation,
    ).toBe(0);
  });

  it('uses all frames for stacks, free frames for peak Spire count, and final task state for score', () => {
    const atSpire = { id: 'cube-1', x: 3, y: 3, level: 0 };
    const measures = measureRecording(
      recording([
        frame('place here', { objects: [atSpire, { ...atSpire, id: 'cube-2', level: 1 }] }),
        frame('pick cube-2', { e: 1, objects: [atSpire] }),
        frame('place here', { e: 2, s: 0, objects: [atSpire, { ...atSpire, id: 'cube-2', level: 4 }] }),
        frame('pick cube-2', { e: 2, s: 1, objects: [atSpire] }),
      ]),
    );
    expect(measures.maxStack).toBe(5);
    expect(measures.freeSpireObjects).toBe(2);
    expect(measures.taskScore).toBe(1);
  });

  it('averages available boredom readings per free episode and omits missing episodes', () => {
    const measures = measureRecording(
      recording([
        frame('rest', { inner: { boredom: 0.2 } }),
        frame('look'),
        frame('rest', { inner: { boredom: 0.6 } }),
        frame('rest', { e: 1, inner: { other: 0.9 } }),
        frame('rest', { e: 2, inner: { boredom: 1 } }),
      ]),
    );
    expect(measures.boredomMean0).toBeCloseTo(0.4);
    expect(measures).not.toHaveProperty('boredomMean1');
    expect(measures).not.toHaveProperty('boredomMean2');
  });

  it('counts canonical hidden-rule events in free and task frames', () => {
    const measures = measureRecording(
      recording([
        frame('look', { events: ['The ring glows.', 'The ring glows.'] }),
        frame('throw E hard', {
          e: 2,
          events: ['The rock cracks, and a small cube breaks off.', 'You see a ring.'],
        }),
      ]),
    );
    expect(measures.ringGlows).toBe(2);
    expect(measures.rockCubes).toBe(1);
  });

  it('scores only cubes in the task while free Spire count includes rocks and rings', () => {
    const objects = [
      { id: 'cube-1', x: 3, y: 3, level: 0 },
      { id: 'rock', x: 3, y: 3, level: 1 },
      { id: 'ring', x: 3, y: 3, level: 2 },
      { id: 'cube-2', x: 2, y: 3, level: 0 },
    ];
    const measures = measureRecording(
      recording([frame('look', { objects }), frame('look', { e: 2, objects })]),
    );
    expect(measures.freeSpireObjects).toBe(3);
    expect(measures.taskScore).toBe(1);
  });
});
