import { expect } from 'vitest';
import { dispatch } from '../src/game/engine';
import type { GameState } from '../src/game/types';

/** Offer again only after the person's actual selected activity finishes. Never clear their body or agenda. */
export function acceptRepairOffer(state: GameState, jobId: string): GameState {
  for (let attempt = 0; attempt < 12; attempt++) {
    if (state.jobs.find((job) => job.id === jobId)?.assignedTo === 'sam') {
      const consent = state.npcWork.find(
        (work) => work.personId === 'sam' && work.option.action === 'accept-repair',
      );
      if (consent)
        state = dispatch(state, { type: 'wait', minutes: consent.endsAt - state.now }).state;
      return state;
    }
    if (!state.pendingRequest)
      state = dispatch(state, { type: 'assign', jobId, personId: 'sam' }).state;
    if (state.jobs.find((job) => job.id === jobId)?.assignedTo === 'sam') continue;
    const activity = state.npcWork.find((work) => work.personId === 'sam');
    if (!activity || activity.endsAt % 1440 > 1020) break;
    const result = dispatch(state, { type: 'wait', minutes: activity.endsAt - state.now });
    if (!result.ok) break;
    state = result.state;
  }
  expect(
    state.jobs.find((job) => job.id === jobId)?.assignedTo,
    'The person must actually accept the offer',
  ).toBe('sam');
  return state;
}
