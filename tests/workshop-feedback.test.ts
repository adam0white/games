import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { componentWorkReading, ownerPromiseAccount } from '../src/ui/workshop-feedback';

function present<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture value');
  return value;
}

describe('observed workshop feedback', () => {
  it('shows only performed work and does not claim a cleaned contact fixes a worn switch', () => {
    let state = createGame(42);
    const id = present(state.jobs[0]).id;
    expect(componentWorkReading(present(state.jobs[0]), 'contact')).toBeUndefined();
    state = dispatch(state, {
      type: 'work',
      jobId: id,
      componentId: 'contact',
      intervention: 'clean',
    }).state;
    expect(componentWorkReading(present(state.jobs[0]), 'contact')?.kind).toBe('clean');
    expect(componentWorkReading(present(state.jobs[0]), 'contact')?.text).toContain('cleaned');
    state = dispatch(state, { type: 'verify', jobId: id, condition: 'movement' }).state;
    expect(present(state.jobs[0]).verified).not.toContain('movement');
    expect(componentWorkReading(present(state.jobs[0]), 'switch')).toBeUndefined();
    state = dispatch(state, {
      type: 'work',
      jobId: id,
      componentId: 'switch',
      intervention: 'replace',
    }).state;
    expect(componentWorkReading(present(state.jobs[0]), 'switch')?.kind).toBe('replace');
    expect(componentWorkReading(present(state.jobs[0]), 'switch')?.text).toContain(
      'replacement switch',
    );
    expect(present(state.jobs[0]).verified).toEqual([]);
    expect(componentWorkReading(present(loadGame(saveGame(state)).jobs[0]), 'switch')).toEqual(
      componentWorkReading(present(state.jobs[0]), 'switch'),
    );
  });

  it('distinguishes an honest late return from an outstanding overdue object without erasing missed time', () => {
    let state = createGame(416);
    const job = present(state.jobs[0]);
    state = dispatch(state, { type: 'next-day' }).state;
    state = dispatch(state, { type: 'next-day' }).state;
    const neglected = ownerPromiseAccount(present(state.people[job.ownerId]), state.jobs);
    expect(neglected).toContain('still waiting');
    const late = dispatch(state, { type: 'deliver', jobId: job.id, unfinished: true });
    expect(late.ok).toBe(true);
    const account = ownerPromiseAccount(present(late.state.people[job.ownerId]), late.state.jobs);
    expect(account).toContain('honestly unfinished');
    expect(account).toContain('after the promised time');
    expect(account).not.toBe(neglected);
    expect(account).not.toContain('still waiting');
    expect(
      ownerPromiseAccount(
        present(loadGame(saveGame(late.state)).people[job.ownerId]),
        late.state.jobs,
      ),
    ).toBe(account);
  });
});
