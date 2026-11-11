import { describe, expect, it } from 'vitest';
import { beginPreparation, createCommunityEvent, eventOptions } from '../src/game/community';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { createModel } from '../src/game/model';
import { createPeople } from '../src/game/people';
import type { GameState, Job } from '../src/game/types';
import { nativeOf } from './hf-fixture';

function fixture(now = 5040): GameState {
  const state = createGame(416);
  state.now = now;
  state.day = 4;
  state.people = createPeople(416, now);
  state.community = createCommunityEvent();
  const template = state.jobs[0];
  if (!template) throw new Error('Missing job');
  const fan = (id: string, reward: number, importance: string): Job => ({
    ...structuredClone(template),
    id,
    title: id === 'favour-fan' ? 'The community room fan' : 'The meeting-room fan',
    kind: 'fan',
    model: createModel('fan', 1, []),
    status: 'ready',
    ownerId: 'mum',
    due: 5220,
    reward,
    importance,
    acceptedAt: 4000,
    verified: ['load'],
  });
  // Paid job precedes the favour, reproducing the fresh playtest's selection error.
  state.jobs.push(
    fan('paid-fan', 30, 'Neighbourhood work'),
    fan('favour-fan', 0, 'Neighbourhood gathering'),
  );
  return state;
}
function job(state: GameState, id: string): Job {
  const found = state.jobs.find((candidate) => candidate.id === id);
  if (!found) throw new Error('Missing job');
  return found;
}
describe('community installation is an actual unpaid return', () => {
  it('prefers the intended checked favour and exposes the selected object title', () => {
    const state = fixture();
    const event = state.community;
    if (!event) throw new Error('Missing event');
    const reading = eventOptions(state, event).find((option) => option.format === 'reading');
    expect(reading?.jobId).toBe('favour-fan');
    expect(reading?.jobTitle).toBe('The community room fan');
    job(state, 'favour-fan').verified = [];
    expect(eventOptions(state, event).find((option) => option.format === 'reading')?.jobId).toBe(
      'paid-fan',
    );
  });
  it('returns the installed favour only after the actual 90-minute preparation without cash or another delivery cost', () => {
    const state = fixture();
    const event = state.community;
    if (!event) throw new Error('Missing event');
    expect(beginPreparation(state, event, 'reading', state.now).ok).toBe(true);
    expect(job(state, 'favour-fan').status).toBe('ready');
    const almost = dispatch(state, { type: 'wait', minutes: 89 }).state;
    expect(almost.now).toBe(5129);
    expect(job(almost, 'favour-fan').status).toBe('ready');
    const finished = dispatch(almost, { type: 'wait', minutes: 1 }).state;
    expect(finished.now).toBe(5130);
    expect(job(finished, 'favour-fan').status).toBe('delivered');
    expect(job(finished, 'favour-fan').deliveredAt).toBe(5130);
    expect(job(finished, 'favour-fan').returnedUnfinished).toBe(false);
    expect(finished.cash).toBe(state.cash);
    expect(job(finished, 'paid-fan').status).toBe('ready');
    expect(
      job(finished, 'favour-fan').contributions.filter((c) => c.action === 'install:reading'),
    ).toHaveLength(1);
    expect(finished.community?.reservedJobIds).toContain('favour-fan');
    expect(
      nativeOf(finished.people.mum)?.memory.episodes.some(
        (episode) => episode.targetId === 'favour-fan' && episode.summary.includes('returned'),
      ),
    ).toBe(true);
  });
  it('returns exactly at 15:00 before participant choices and retains the physical loan until 15:30', () => {
    const state = fixture(5130);
    const model = structuredClone(job(state, 'favour-fan').model);
    const prepared = dispatch(state, { type: 'prepare-event', format: 'reading' });
    expect(prepared.ok).toBe(true);
    expect(prepared.state.now).toBe(5220);
    expect(job(prepared.state, 'favour-fan').deliveredAt).toBe(5220);
    expect(prepared.state.community?.resolvedAt).toBe(5220);
    expect(prepared.state.community?.reservedJobIds).toContain('favour-fan');
    expect(dispatch(prepared.state, { type: 'deliver', jobId: 'favour-fan' }).ok).toBe(false);
    const ended = dispatch(prepared.state, { type: 'wait', minutes: 30 }).state;
    expect(ended.community?.reservedJobIds).toEqual([]);
    expect(job(ended, 'favour-fan').model).toEqual(model);
    expect(job(ended, 'paid-fan').status).toBe('ready');
    expect(dispatch(ended, { type: 'deliver', jobId: 'favour-fan' }).ok).toBe(false);
    expect(ended.cash).toBe(state.cash);
  });
  it('never settles a paid temporary loan or another unselected favour promise', () => {
    const state = fixture();
    const favour = job(state, 'favour-fan');
    favour.model = createModel('fan', 1, [{ componentId: 'motor', condition: 'misaligned' }]);
    const prepared = dispatch(state, { type: 'prepare-event', format: 'reading' });
    expect(prepared.ok).toBe(true);
    expect(prepared.state.community?.reservedJobIds).toContain('paid-fan');
    expect(job(prepared.state, 'paid-fan').status).toBe('ready');
    expect(job(prepared.state, 'favour-fan').status).toBe('ready');
    expect(prepared.state.cash).toBe(state.cash);
    const ended = dispatch(prepared.state, { type: 'wait', minutes: 120 }).state;
    expect(job(ended, 'paid-fan').status).toBe('ready');
    expect(ended.cash).toBe(state.cash);
    const paid = dispatch(ended, { type: 'deliver', jobId: 'paid-fan' }).state;
    expect(paid.now).toBe(ended.now + 10);
    expect(paid.cash).toBe(state.cash + 21);
    expect(job(paid, 'favour-fan').deliveredAt).toBeUndefined();
    expect(dispatch(paid, { type: 'deliver', jobId: 'paid-fan' }).ok).toBe(false);
  });
  it('replays a saved pending installation once with identical receipt, clock and cash', () => {
    const state = fixture();
    const event = state.community;
    if (!event) throw new Error('Missing event');
    beginPreparation(state, event, 'reading', state.now);
    const pending = dispatch(state, { type: 'wait', minutes: 89 }).state;
    const resumed = loadGame(saveGame(pending));
    if (!resumed) throw new Error('Save refused');
    const originalEnd = dispatch(pending, { type: 'wait', minutes: 1 }).state;
    const resumedEnd = dispatch(resumed, { type: 'wait', minutes: 1 }).state;
    expect(saveGame(resumedEnd)).toBe(saveGame(originalEnd));
    const later = dispatch(resumedEnd, { type: 'wait', minutes: 150 }).state;
    expect(
      job(later, 'favour-fan').contributions.filter((c) => c.action === 'install:reading'),
    ).toHaveLength(1);
    expect(later.cash).toBe(state.cash);
  });
  it('does not offer reserved owned equipment as ordinary background leisure', () => {
    const state = fixture();
    const event = state.community;
    if (!event) throw new Error('Missing event');
    job(state, 'favour-fan').status = 'delivered';
    beginPreparation(state, event, 'reading', state.now);
    const result = dispatch(state, { type: 'wait', minutes: 1 }).state;
    expect(
      result.people.mum?.trace
        .at(-1)
        ?.considered.some((offer) => offer.affordanceId === 'use:favour-fan'),
    ).toBe(false);
  });
});
