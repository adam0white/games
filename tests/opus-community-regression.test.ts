import { describe, expect, it } from 'vitest';
import { createCommunityEvent } from '../src/game/community';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { createPeople, prepareMorning } from '../src/game/people';

// Controlled event timing inside a genuinely selected lesson-start window; no body, clock or activity reset.
function acceptedWindow() {
  let state = createGame(416);
  state = dispatch(state, { type: 'request-lesson' }).state;
  expect(state.pendingRequest?.status).toBe('ready');
  state.community = {
    ...createCommunityEvent(),
    announcedAt: 540,
    opensAt: 540,
    deadline: 550,
    finishesAt: 580,
  };
  return state;
}
describe('gathering honours agreed lesson availability', () => {
  it('keeps real accepted start availability, with no replacement activity, and round-trips the crossing save', () => {
    const before = acceptedWindow();
    const state = dispatch(before, { type: 'wait', minutes: 10 }).state;
    expect(state.pendingRequest?.status).toBe('ready');
    expect(state.people.sam?.activity).toBeNull();
    expect(
      state.community?.decisions.find((decision) => decision.personId === 'sam')?.activityId,
    ).toBeUndefined();
    expect(
      state.community?.decisions.find((decision) => decision.personId === 'sam')?.activityLabel,
    ).toContain('agreed lesson');
    const resumed = loadGame(saveGame(state));
    expect(resumed).not.toBeNull();
    if (!resumed) throw new Error('Crossing save rejected');
    expect(saveGame(resumed)).toBe(saveGame(state));
    const start = dispatch(resumed, { type: 'start-lesson' });
    expect(start.ok).toBe(true);
    expect(start.state.watching).toBe(true);
    expect(start.state.pendingRequest).toBeUndefined();
  });
  it('keeps an already started voluntary lesson separate from gathering choices and expiry', () => {
    const before = acceptedWindow();
    const started = dispatch(before, { type: 'start-lesson' }).state;
    expect(started.watching).toBe(true);
    const crossed = dispatch(started, { type: 'wait', minutes: 10 }).state;
    expect(crossed.people.sam?.activity).toBeNull();
    expect(crossed.watching).toBe(true);
    expect(
      crossed.community?.decisions.find((decision) => decision.personId === 'sam')?.activityLabel,
    ).toBe('The agreed repair lesson');
    expect(loadGame(saveGame(crossed))).not.toBeNull();
  });
  it('expires availability normally without retaining a ready request or inventing attendance', () => {
    const before = acceptedWindow();
    const expired = dispatch(before, { type: 'wait', minutes: 20 }).state;
    expect(expired.pendingRequest).toBeUndefined();
    expect(expired.log.some((entry) => entry.text.includes('time I set aside'))).toBe(true);
    expect(
      expired.community?.decisions.find((decision) => decision.personId === 'sam')?.completed,
    ).toBe(false);
    expect(loadGame(saveGame(expired))).not.toBeNull();
  });
  it('leaves an unaccepted requested lesson queued behind actual Day 4 activity', () => {
    let state = createGame(416);
    for (let day = 0; day < 3; day++) state = dispatch(state, { type: 'next-day' }).state;
    state = dispatch(state, { type: 'wait', minutes: 350 }).state;
    state = dispatch(state, { type: 'request-lesson' }).state;
    expect(state.now).toBe(5210);
    expect(state.pendingRequest?.status).toBe('requested');
    expect(dispatch(state, { type: 'start-lesson' }).ok).toBe(false);
    const crossed = dispatch(state, { type: 'wait', minutes: 10 }).state;
    expect(crossed.now).toBe(5220);
    expect(crossed.pendingRequest?.status).toBe('requested');
    expect(crossed.people.sam?.activity).not.toBeNull();
    expect(loadGame(saveGame(crossed))).not.toBeNull();
  });
  it('preserves an actual HF-agreed 14:50–15:10 window in a controlled Day 4 initial world', () => {
    // Controlled afternoon initialization without Sam’s football promise; retail Day 4 normally queues or declines this request.
    let state = createGame(416);
    state.now = 5210;
    state.day = 4;
    state.people = createPeople(416, 5210);
    for (const person of Object.values(state.people))
      if (person.id !== 'sam') prepareMorning(person, 4320);
    state.community = createCommunityEvent();
    state = dispatch(state, { type: 'request-lesson' }).state;
    expect(state.pendingRequest?.status).toBe('ready');
    expect(state.pendingRequest?.readyUntil).toBe(5230);
    state = dispatch(state, { type: 'wait', minutes: 10 }).state;
    expect(state.now).toBe(5220);
    expect(state.people.sam?.activity).toBeNull();
    const resumed = loadGame(saveGame(state));
    expect(resumed).not.toBeNull();
    if (!resumed) throw new Error('Day 4 crossing save rejected');
    expect(saveGame(resumed)).toBe(saveGame(state));
    const start = dispatch(resumed, { type: 'start-lesson' });
    expect(start.ok).toBe(true);
    expect(start.message).not.toContain('still occupied');
    expect(start.state.pendingRequest).toBeUndefined();
    // A fresh start decision may honour the afternoon promise instead. That refusal is actual HF choice.
    if (!start.state.watching) expect(start.message).toMatch(/promised|own plans|food|tired/);
  });
});
