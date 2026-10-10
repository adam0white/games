import { expect, it } from 'vitest';
import { resolveTouchTarget, withinTouchBounds } from '../src/ui/inspection/touchTargets';

const bounds = { left: 100, right: 110, top: 100, bottom: 150 };
it('gives visible selected surfaces a bounded 22 CSS pixel margin', () => {
  expect(withinTouchBounds(79, 110, bounds)).toBe(true);
  expect(withinTouchBounds(77, 110, bounds)).toBe(false);
  expect(withinTouchBounds(120, 180, bounds)).toBe(false);
  expect(resolveTouchTarget(null, 'operation', 79, 110, bounds)).toBe('operation');
  expect(resolveTouchTarget(null, 'battery', 79, 110, bounds)).toBe('battery');
});
it('never changes actual hits or activates an unselected unknown area', () => {
  expect(resolveTouchTarget('contact', 'battery', 105, 110, bounds)).toBe('contact');
  expect(resolveTouchTarget('shell', 'battery', 105, 110, bounds)).toBe('shell');
  expect(resolveTouchTarget(null, null, 105, 110, bounds)).toBeNull();
  expect(resolveTouchTarget(null, 'battery', 105, 110, null)).toBeNull();
  expect(resolveTouchTarget(null, 'battery', 5, 5, bounds)).toBeNull();
  expect(withinTouchBounds(100, 100, { ...bounds, left: Number.NaN })).toBe(false);
});
