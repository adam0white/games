import { describe, expect, it } from 'vitest';
import { exactPermutation, median } from '../src/compare.ts';

describe('exact two-sided permutation of mean difference', () => {
  it('includes observed allocation, opposite allocation and ties', () => {
    expect(exactPermutation([1, 2], [3, 4])).toBeCloseTo(2 / 6);
    expect(exactPermutation([0, 0], [0, 0])).toBe(1);
    expect(exactPermutation(Array(10).fill(0), Array(10).fill(1))).toBeCloseTo(2 / 184756);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
