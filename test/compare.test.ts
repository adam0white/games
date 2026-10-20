import { describe, expect, it } from 'vitest';
import { compare, exactPermutation, holmAdjust, median } from '../src/compare.ts';

describe('exact two-sided permutation of mean difference', () => {
  it('includes observed allocation, opposite allocation and ties', () => {
    expect(exactPermutation([1, 2], [3, 4])).toBeCloseTo(2 / 6);
    expect(exactPermutation([0, 0], [0, 0])).toBe(1);
    expect(exactPermutation(Array(10).fill(0), Array(10).fill(1))).toBeCloseTo(2 / 184756);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('Holm adjustment', () => {
  it('adjusts a known vector and restores input order', () => {
    const input = [0.03, 0.001, 0.02, 0.2];
    expect(holmAdjust(input)).toEqual([0.06, 0.004, 0.06, 0.2]);
    expect(input).toEqual([0.03, 0.001, 0.02, 0.2]);
  });

  it('caps at one and keeps adjusted values monotone in sorted raw p', () => {
    expect(holmAdjust([0.9, 0.8, 0.7])).toEqual([1, 1, 1]);
    expect(holmAdjust([0.01, 0.011, 0.012, 0.2])).toEqual([0.04, 0.04, 0.04, 0.2]);
    expect(holmAdjust([0, 0.02, 0.02, 1])).toEqual([0, 0.06, 0.06, 1]);
    expect(holmAdjust([])).toEqual([]);
    expect(holmAdjust([0.4])).toEqual([0.4]);
  });

  it('rejects invalid p values', () => {
    for (const value of [-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => holmAdjust([value])).toThrow('Finite p values');
  });
});

describe('comparison report', () => {
  it('covers all requested blocks and adjusts each random comparison as one eight-test family', async () => {
    const report = await compare();
    const rows = report
      .split('\n')
      .filter((line) => line.startsWith('| ') && !line.startsWith('| Comparison'))
      .map((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
    const freeLabels = [
      'Cells visited',
      'Kind entropy',
      'Manipulation share',
      'Idle share',
      'Spire objects',
      'Tallest stack',
      'Repeated pursuit',
    ];
    for (const arm of ['hf', 'hf2', 'hf2-no-memory', 'hf2-no-boredom']) {
      const block = rows.filter(([comparison]) => comparison === `${arm} vs random`);
      expect(block.map((row) => row[1])).toEqual([...freeLabels, 'Task score']);
      const expected = holmAdjust(block.map((row) => Number(row[4])));
      block.forEach((row, index) => {
        // Printed raw p values have six decimals; adjustment can multiply rounding by eight.
        expect(Number(row[5])).toBeCloseTo(expected[index] as number, 4);
      });
    }
    for (const arm of ['hf2', 'hf2-no-memory', 'hf2-no-boredom']) {
      const block = rows.filter(([comparison]) => comparison === `${arm} vs hf`);
      expect(block).toHaveLength(1);
      expect(block[0]?.[1]).toBe('Task score');
      expect(block[0]?.[5]).toBe(block[0]?.[4]);
    }
    for (const arm of ['hf2-no-boredom', 'hf2-no-memory', 'hf2-no-goals']) {
      const block = rows.filter(([comparison]) => comparison === `hf2 vs ${arm}`);
      expect(block.map((row) => row[1])).toEqual(['Task score', 'Remembered-target moves (all)']);
      const expected = holmAdjust(block.map((row) => Number(row[4])));
      block.forEach((row, index) => {
        expect(Number(row[5])).toBeCloseTo(expected[index] as number, 4);
      });
    }
    expect(rows).toHaveLength(41);
    expect(report).toContain('one eight-test family per arm vs random');
    expect(report).toContain('one singleton family per task-score comparison vs hf');
    expect(report).toContain('one two-test family per hf2 ablation comparison');
    expect(report).toContain('| Exact p | Holm p |');
  });
});
