import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import type { GameInput } from '../src/game/types';
import actual from './fixtures/twenty-table-before-school.json';

it('puts the actual family-table arrangement away before school passage without inventing repair or extra player choices', () => {
  let s = createGame(actual.seed);
  for (const entry of actual.inputs) {
    expect(s.now).toBe(entry.at);
    s = transition(s, entry.input as GameInput);
  }
  expect(s.eveningTable?.stage).toBe('table');
  expect(s.objects.filter((o) => o.location === 'home-table').map((o) => o.id)).toEqual([
    'personal',
    'paper-street',
  ]);
  const model = structuredClone(s.objects.find((o) => o.id === 'paper-street'));
  const repairs = s.repairs;
  const parts = structuredClone(s.parts);
  const holiday = s.campaign?.holiday;
  s = transition(s, { type: 'action', id: 'back-to-school' });
  expect(s.campaign?.holiday).toBe((holiday ?? 0) + 1);
  expect(s.eveningTable?.stage).toBe('finished');
  expect(s.objects.some((o) => o.location === 'home-table')).toBe(false);
  expect(s.objects.find((o) => o.id === 'personal')?.location).toBe('returned');
  expect(s.objects.find((o) => o.id === 'paper-street')).toEqual({ ...model, location: 'shelf' });
  expect(s.repairs).toBe(repairs);
  expect(s.parts).toEqual(parts);
  expect(s.inputs).toHaveLength(actual.inputs.length + 1);
  expect(s.inputs.at(-1)?.input).toEqual({ type: 'action', id: 'back-to-school' });
  expect(getView(s).eveningTable?.stage).not.toBe('table');
  expect(serializeGame(restoreGame(serializeGame(s)))).toBe(serializeGame(s));
});
