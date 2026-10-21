import { describe, expect, it } from 'vitest';
import { WorkshopTally } from '../src/components/WorkshopTally';
import { createGame, saveGame } from '../src/game/engine';

describe('optional workshop tally', () => {
  it('stays absent when off, during play, and after continuing', () => {
    const state = createGame(42);
    expect(WorkshopTally({ state, enabled: true })).toBeNull();
    state.ended = true;
    expect(WorkshopTally({ state, enabled: false })).toBeNull();
    expect(WorkshopTally({ state, enabled: true })).not.toBeNull();
    state.ended = false;
    expect(WorkshopTally({ state, enabled: true })).toBeNull();
  });

  it('shows the explicit job formula without changing the saved run', () => {
    const state = createGame(42);
    state.ended = true;
    const template = state.jobs[0];
    if (!template) throw new Error('Missing opening object');
    state.jobs = [
      { ...template, id: 'checked', status: 'delivered', returnedUnfinished: false },
      { ...template, id: 'unfinished', status: 'delivered', returnedUnfinished: true },
      { ...template, id: 'open', status: 'active', isDonor: false, isPersonal: false },
      { ...template, id: 'donor', status: 'active', isDonor: true },
      { ...template, id: 'personal', status: 'active', isPersonal: true },
    ];
    const before = saveGame(state);
    const result = WorkshopTally({ state, enabled: true });
    const text = JSON.stringify(result);
    expect(text).toContain('Workshop tally');
    expect(text).toContain('checked returns (');
    expect(text).toContain('unfinished returns (');
    expect(text).toContain('open promises (');
    expect(result?.props.children[0].props.children).toEqual(['Workshop tally · ', 2]);
    expect(saveGame(state)).toBe(before);
  });
});
