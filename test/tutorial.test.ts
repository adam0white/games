import { describe, expect, it } from 'vitest';
import { tutorialPrompt } from '../src/ui/tutorial.ts';

describe('first order tutorial', () => {
  const task = { id: 1, carried: false, by: 500, done: undefined };
  it('follows the real order through selection, travel, pickup and delivery', () => {
    expect(
      tutorialPrompt({ task, minute: 420, ordersOpen: false, selected: false, walking: false }).target,
    ).toBe('orders');
    expect(
      tutorialPrompt({ task, minute: 420, ordersOpen: true, selected: false, walking: false }).target,
    ).toBe('order');
    expect(
      tutorialPrompt({ task, minute: 420, ordersOpen: true, selected: true, walking: false }).target,
    ).toBe('go');
    expect(
      tutorialPrompt({ task, minute: 421, ordersOpen: true, selected: false, walking: true }).target,
    ).toBe('travel');
    expect(
      tutorialPrompt({
        task: { ...task, carried: true },
        minute: 430,
        ordersOpen: true,
        selected: false,
        walking: false,
      }).target,
    ).toBe('order');
    expect(
      tutorialPrompt({
        task: { ...task, done: 490 },
        minute: 490,
        ordersOpen: true,
        selected: false,
        walking: false,
      }).outcome,
    ).toBe('on-time');
    expect(
      tutorialPrompt({
        task: { ...task, done: 510 },
        minute: 510,
        ordersOpen: true,
        selected: false,
        walking: false,
      }).outcome,
    ).toBe('late');
  });
  it('does not call a day-end closure a delivery', () => {
    expect(
      tutorialPrompt({
        task: { ...task, done: 1260 },
        minute: 1260,
        ordersOpen: false,
        selected: false,
        walking: false,
      }).outcome,
    ).toBe('closed');
  });
});
