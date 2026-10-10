import { describe, expect, it } from 'vitest';
import { getView, transition } from '../src/game/engine';
import { earnedHandoff } from './support/earned-handoff';

describe('first independent repair ceremony', () => {
  it('appears for a genuinely earned collected whole job and ends on the next choice', () => {
    const state = earnedHandoff();
    const job = state.objects.find((item) => item.id === state.apprentice?.completedJobIds[0]);
    expect(job?.completedBy).toBe('sam');
    expect(job?.independent).toBe(true);
    expect(job?.awaitingCollection).toBe(false);
    expect(getView(state).milestone?.sourcekey).toBe('independent-handoff:independent-light');
    expect(getView(state).milestone?.title).toBe('Sam finished the whole repair');
    const next = transition(state, { type: 'action', id: 'service-begin' });
    expect(next).not.toBe(state);
    expect(getView(next).milestone).toBeUndefined();
  });
  it('does not mistake supervised or assisted work for independent completion', () => {
    const state = earnedHandoff();
    const supervised = state.objects.find((item) => item.id === 'supervised-light');
    expect(state.apprentice?.supervisedCompleted).toBe(true);
    expect(supervised?.independent).not.toBe(true);
    const withoutIndependent = structuredClone(state);
    if (!withoutIndependent.apprentice) throw Error('Missing apprentice');
    withoutIndependent.apprentice.completedJobIds = [];
    expect(getView(withoutIndependent).milestone).toBeUndefined();
    const assisted = structuredClone(state);
    const job = assisted.objects.find((item) => item.id === 'independent-light');
    if (!job) throw Error('Missing independent object');
    job.independent = false;
    expect(getView(assisted).milestone).toBeUndefined();
  });
});
