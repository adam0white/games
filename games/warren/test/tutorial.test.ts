import { describe, expect, it } from 'vitest';
import { advanceGuide } from '../src/ui/tutorial.ts';

describe('first chalk guide', () => {
  it('waits for the actual tool and an accepted new mark', () => {
    expect(advanceGuide('tool', 'mark')).toBe('tool');
    expect(advanceGuide('tool', 'chalk')).toBe('mark');
    expect(advanceGuide('mark', 'refused')).toBe('mark');
    expect(advanceGuide('mark', 'mark')).toBe('result');
  });
});
