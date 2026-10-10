import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as eight from '../src/game/engine8';
import type { GameInput } from '../src/game/types';
import fixture from './fixtures/published-eight-space-block-route.json';

it('waits only after a real refusal to the actual activity endpoint without granting space', () => {
  let old = eight.createGame(fixture.seed);
  for (const input of fixture.inputs) old = eight.transition(old, input as GameInput);
  let s = restoreGame(eight.serializeGame(old));
  expect(getView(s).actions.some((a) => a.id === 'wait-dad-activity')).toBe(false);
  s = transition(s, { type: 'action', id: 'workshop-intake-space' });
  expect(s.workshop?.intakeSpace).toBe(false);
  const end = s.people.dad?.activity?.endsAt;
  expect(end).toBeGreaterThan(s.now);
  const action = getView(s).actions.find((a) => a.id === 'wait-dad-activity');
  expect(action?.kind).toBe('primary');
  expect(action?.detail).toContain('own plans');
  const before = s.now;
  s = transition(s, { type: 'action', id: 'wait-dad-activity' });
  expect(s.now).toBe(end);
  expect(s.now - before).toBeGreaterThan(0);
  expect(s.workshop?.intakeSpace).toBe(false);
  expect(s.people.dad?.activity).toBeNull();
  for (const p of Object.values(s.people)) expect(p.now).toBe(s.now);
  expect(getView(s).actions.some((a) => a.id === 'wait-dad-activity')).toBe(false);
  expect(restoreGame(serializeGame(s))).toEqual(s);
  for (let n = 0; n < 20 && !s.workshop?.intakeSpace; n++) {
    if (getView(s).actions.some((a) => a.id === 'workshop-intake-space'))
      s = transition(s, { type: 'action', id: 'workshop-intake-space' });
    if (!s.workshop?.intakeSpace)
      s = transition(s, {
        type: 'action',
        id:
          getView(s).actions.find((a) =>
            ['wait-dad-activity', 'wait-player-activity'].includes(a.id),
          )?.id ?? 'rest',
      });
  }
  expect(s.workshop?.intakeSpace).toBe(true);
  expect(getView(s).actions.some((a) => a.id === 'wait-dad-activity')).toBe(false);
  expect(restoreGame(serializeGame(s))).toEqual(s);
  let competing = restoreGame(eight.serializeGame(old));
  competing = transition(competing, { type: 'action', id: 'workshop-intake-space' });
  competing = transition(competing, { type: 'action', id: 'rest' });
  expect(getView(competing).actions.some((a) => a.id === 'wait-dad-activity')).toBe(false);
  expect(competing.workshop?.intakeSpace).toBe(false);
});
