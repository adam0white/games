import { expect, it } from 'vitest';
import { travelWords } from '../../src/ui/clarity.ts';

it('keeps fractional native timestamps out of the visit countdown', () => {
  expect(travelWords({ arrive: 570, leave: 625.00015, back: 645.00015 }, 600)).toBe(
    '25 game minutes left here; 45 until home.',
  );
  expect(travelWords({ arrive: 620.00015, leave: 650, back: 670.00015 }, 600)).toBe(
    '20 game minutes until arrival; 70 until home.',
  );
  expect(travelWords({ arrive: 570, leave: 625, back: 645 }, 650)).toBe('0 game minutes until home.');
});
