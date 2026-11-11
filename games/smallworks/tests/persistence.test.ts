import { describe, expect, it } from 'vitest';
import { createCommunityEvent, resolveCommunityEvent } from '../src/game/community';
import { createGame, dispatch } from '../src/game/engine';
import { createModel } from '../src/game/model';
import { createPeople, tickPeople } from '../src/game/people';
import { loadGame, saveGame } from '../src/game/persistence';
import type { GameState } from '../src/game/types';

function dayThree(): GameState {
  let state = createGame(416);
  state = dispatch(state, { type: 'next-day' }).state;
  return dispatch(state, { type: 'next-day' }).state;
}
function roundtrip(state: GameState): GameState {
  const text = saveGame(state);
  const restored = loadGame(text);
  expect(saveGame(restored)).toBe(text);
  return restored;
}
function eventFixture(now: number): GameState {
  const state = dayThree();
  state.now = now;
  state.day = Math.floor(now / 1440) + 1;
  state.people = createPeople(state.seed, now);
  state.npcWork = [];
  return state;
}

describe('save boundary', () => {
  it('refuses the previous text edition instead of mixing narration during replay', () => {
    const previous = JSON.parse(saveGame(createGame(42)));
    previous.provenance.game = '4.0.0+plain-english';
    expect(() => loadGame(JSON.stringify(previous))).toThrow(
      /earlier workshop edition.*Start fresh/,
    );
  });
  it('preserves real dispatched daytime activities and resumes the same event proposal', () => {
    let state = createGame(416);
    state = dispatch(state, { type: 'wait', minutes: 10 }).state;
    expect(state.npcWork.length).toBeGreaterThan(0);
    const restored = roundtrip(state);
    expect(saveGame(dispatch(restored, { type: 'wait', minutes: 20 }).state)).toBe(
      saveGame(dispatch(state, { type: 'wait', minutes: 20 }).state),
    );
    const proposed = dayThree();
    expect(proposed.community?.phase).toBe('announced');
    const resumed = roundtrip(proposed);
    expect(saveGame(dispatch(resumed, { type: 'next-day' }).state)).toBe(
      saveGame(dispatch(proposed, { type: 'next-day' }).state),
    );
  });
  it('retains an in-progress preparation without changing reserved equipment or stock', () => {
    const state = eventFixture(5085);
    const event = createCommunityEvent();
    const job = state.jobs[0];
    if (!job) throw new Error('Missing fixture object');
    event.phase = 'setting-up';
    event.reservedJobIds = [job.id];
    event.preparations = [{ format: 'garden', jobId: job.id, startedAt: 5040 }];
    state.community = event;
    const resumed = roundtrip(state);
    expect(resumed.stock).toEqual(state.stock);
    expect(saveGame(dispatch(resumed, { type: 'wait', minutes: 45 }).state)).toBe(
      saveGame(dispatch(state, { type: 'wait', minutes: 45 }).state),
    );
  });
  it('preserves running event decisions and HF activities with no invented NPC work', () => {
    const state = eventFixture(5220);
    const event = createCommunityEvent();
    state.community = event;
    const lantern = state.jobs.find((job) => job.ownerId === 'mum');
    if (!lantern) throw new Error('Missing fixture lantern');
    lantern.model = createModel('lantern', 1, []);
    lantern.status = 'delivered';
    lantern.verified = ['movement'];
    event.phase = 'setting-up';
    event.preparedFormats = ['garden'];
    event.reservedJobIds = [lantern.id];
    event.preparations = [
      { format: 'garden', jobId: lantern.id, startedAt: 5040, completedAt: 5130 },
    ];
    state.people = createPeople(state.seed, 5040);
    tickPeople(state.people, state.now);
    resolveCommunityEvent(state, event, state.now);
    expect(event.decisions.some((decision) => decision.format === 'garden')).toBe(true);
    expect(event.decisions.some((decision) => decision.activityId)).toBe(true);
    expect(state.npcWork).toEqual([]);
    const resumed = roundtrip(state);
    expect(saveGame(dispatch(resumed, { type: 'wait', minutes: 30 }).state)).toBe(
      saveGame(dispatch(state, { type: 'wait', minutes: 30 }).state),
    );
  });
  it.each([false, -1, 5, 0.5])('rejects unsupported collar setting %s', (setting) => {
    const value = JSON.parse(saveGame(createGame(416)));
    const job = value.jobs.find((candidate: { kind: string }) => candidate.kind === 'music-box');
    job.model.components.find(
      (component: { kind: string }) => component.kind === 'governor',
    ).setting = setting;
    expect(() => loadGame(JSON.stringify(value))).toThrow();
  });
  it.each([[], ['bench', 'bench'], ['unknown'], false])(
    'rejects malformed required checks %s',
    (checks) => {
      const value = JSON.parse(saveGame(createGame(416)));
      value.jobs[0].requiredConditions = checks;
      expect(() => loadGame(JSON.stringify(value))).toThrow();
    },
  );
  it.each(['desiredRPM', 'tolerance', 'ratedDrive', 'gearRatio'])(
    'rejects invalid model specification %s',
    (field) => {
      const value = JSON.parse(saveGame(createGame(416)));
      value.jobs[0].model[field] = 0;
      expect(() => loadGame(JSON.stringify(value))).toThrow();
    },
  );
  it('rejects unrecognizable community data and unknown reservations', () => {
    const value = JSON.parse(saveGame(dayThree()));
    value.community = { phase: 'unrecognizable' };
    expect(() => loadGame(JSON.stringify(value))).toThrow();
    value.community = createCommunityEvent();
    value.community.reservedJobIds = ['missing'];
    expect(() => loadGame(JSON.stringify(value))).toThrow();
  });
  it('rejects invalid event clocks, decision people, and missing required arrays', () => {
    for (const mutate of [
      (event: Record<string, unknown>) => {
        event.opensAt = -1;
      },
      (event: Record<string, unknown>) => {
        event.deadline = 1;
      },
      (event: Record<string, unknown>) => {
        event.resolvedAt = 999999;
      },
      (event: Record<string, unknown>) => {
        event.invitedPersonIds = ['stranger'];
      },
      (event: Record<string, unknown>) => {
        delete event.preparations;
      },
    ]) {
      const value = JSON.parse(saveGame(dayThree()));
      mutate(value.community);
      expect(() => loadGame(JSON.stringify(value))).toThrow();
    }
  });
  it('rejects a reserved replacement without a known assigned object', () => {
    const state = dispatch(createGame(416), { type: 'wait', minutes: 1 }).state;
    const value = JSON.parse(saveGame(state));
    value.npcWork[0].option.action = 'replace:cell';
    value.npcWork[0].reservedPart = 'cell';
    value.npcWork[0].jobId = 'missing';
    expect(() => loadGame(JSON.stringify(value))).toThrow();
  });
});
