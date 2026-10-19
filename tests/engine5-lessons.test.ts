import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { playerWordReading } from '../src/game/people';
import type { GameState } from '../src/game/types';

const lines = (s: GameState, start: string) => s.log.filter((e) => e.text.includes(start));

describe('engine 5: surfaced promises', () => {
  it('an owner says once that an object is past the promised time, then takes the next one elsewhere once', () => {
    let state = createGame(416);
    const job = state.jobs.find(
      (j) => !j.isDonor && !j.isPersonal && ['offer', 'active'].includes(j.status),
    );
    if (!job) throw new Error('No opening object');
    if (job.status === 'offer') state = dispatch(state, { type: 'accept', jobId: job.id }).state;
    state = dispatch(state, { type: 'next-day' }).state;
    state = dispatch(state, { type: 'next-day' }).state;
    const waiting = lines(state, 'I’m still waiting');
    expect(waiting).toHaveLength(1);
    expect(waiting[0]?.tone).toBe('warning');
    const owner = state.people[job.ownerId];
    if (!owner) throw new Error('Missing owner');
    expect(playerWordReading(owner)).toBeDefined();
    state = dispatch(state, { type: 'next-day' }).state;
    expect(lines(state, 'a day past what you said')).toHaveLength(1);
    state = dispatch(state, { type: 'deliver', jobId: job.id, unfinished: true }).state;
    for (let d = 0; d < 6; d++) state = dispatch(state, { type: 'next-day' }).state;
    expect(lines(state, 'I’m still waiting')).toHaveLength(1);
    expect(lines(state, 'a day past what you said')).toHaveLength(1);
    expect(lines(state, 'came back after the time you gave me').length).toBeLessThanOrEqual(1);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });

  it('engine-4 worlds never hear these lines', () => {
    let state = createGame(416, 'legacy');
    const job = state.jobs.find(
      (j) => !j.isDonor && !j.isPersonal && ['offer', 'active'].includes(j.status),
    );
    if (!job) throw new Error('No opening object');
    if (job.status === 'offer') state = dispatch(state, { type: 'accept', jobId: job.id }).state;
    for (let d = 0; d < 4; d++) state = dispatch(state, { type: 'next-day' }).state;
    expect(lines(state, 'I’m still waiting')).toHaveLength(0);
    expect(lines(state, 'shop in town')).toHaveLength(0);
    expect(lines(state, 'a day past what you said')).toHaveLength(0);
  });

  it('a donor part that looks present costs the attempt before it is known to be unusable', () => {
    for (const rules of ['current', 'legacy'] as const) {
      let state = createGame(416, rules);
      const donor = state.jobs.find((j) => j.isDonor);
      const open = donor?.model.components.find((c) => c.condition === 'open');
      if (!donor || !open) throw new Error('Missing donor part');
      const before = state.now;
      const first = dispatch(state, { type: 'salvage', jobId: donor.id, componentId: open.id });
      expect(first.ok).toBe(rules === 'current');
      if (rules === 'legacy') continue;
      state = first.state;
      expect(state.now).toBeGreaterThan(before);
      expect(lines(state, 'is not usable')).toHaveLength(1);
      const again = dispatch(state, { type: 'salvage', jobId: donor.id, componentId: open.id });
      expect(again.ok).toBe(false);
    }
  });
});
