import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChoiceGate } from '../src/ui/choiceGate';

afterEach(() => vi.useRealTimers());

describe('response reveal input protection', () => {
  it('blocks repeated choices briefly, then allows the next action', () => {
    vi.useFakeTimers();
    const ready = vi.fn();
    const gate = createChoiceGate(ready);
    gate.pause(false);
    expect(gate.locked).toBe(true);
    vi.advanceTimersByTime(419);
    expect(gate.locked).toBe(true);
    vi.advanceTimersByTime(1);
    expect(gate.locked).toBe(false);
    expect(ready).toHaveBeenCalledOnce();
  });

  it('cancels an old reveal when importing, resetting or leaving the screen', () => {
    vi.useFakeTimers();
    const ready = vi.fn();
    const gate = createChoiceGate(ready);
    gate.pause(false);
    vi.advanceTimersByTime(200);
    gate.cancel();
    gate.pause(false);
    vi.advanceTimersByTime(220);
    expect(gate.locked).toBe(true);
    expect(ready).not.toHaveBeenCalled();
    gate.cancel();
    vi.runAllTimers();
    expect(gate.locked).toBe(false);
    expect(ready).not.toHaveBeenCalled();
  });

  it('does not delay choices for reduced-motion players', () => {
    vi.useFakeTimers();
    const ready = vi.fn();
    const gate = createChoiceGate(ready);
    gate.pause(true);
    expect(gate.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
