import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createGame, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as seven from '../src/game/engine7';
import * as eight from '../src/game/engine8';
import type { GameInput } from '../src/game/types';
import drawings from './fixtures/published-eight-drawings-route.json';
import fixture from './fixtures/published-eight-route.json';

it('preserves the actual 259-input published eight export before nine continuation', () => {
  let prior = seven.createGame(fixture.seed);
  for (const input of fixture.inputs.slice(0, fixture.baseCount))
    prior = seven.transition(prior, input as GameInput);
  let old = eight.restoreGame(seven.serializeGame(prior));
  for (const input of fixture.inputs.slice(fixture.baseCount))
    old = eight.transition(old, input as GameInput);
  const raw = eight.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(fixture.sha256);
  let current = restoreGame(raw);
  const { engine3Save, engine3InputCount, ...preserved } = current;
  const { engine3Save: priorRaw, engine3InputCount: priorCount, ...oldState } = old;
  expect(priorRaw).toBeTruthy();
  expect(priorCount).toBe(206);
  expect(preserved).toEqual(oldState);
  expect(engine3Save).toBe(raw);
  expect(engine3InputCount).toBe(259);
  current = transition(current, { type: 'action', id: 'rest' });
  expect(restoreGame(serializeGame(current))).toEqual(current);
}, 20_000);
it('reports completed quiet routines at their actual start and retrieves drawings without absent Dad speech', () => {
  let s = createGame(drawings.seed);
  let retrievalStart = 0;
  for (const input of drawings.inputs) {
    if (input.type === 'action' && input.id === 'workshop-drawings') retrievalStart = s.now;
    s = transition(s, input as GameInput);
  }
  const routines = s.journal?.filter((l) => l.text.includes('prayed quietly earlier')) ?? [];
  expect(routines.some((l) => l.text.includes('12:40') && l.at === 2385)).toBe(true);
  expect(routines.every((l) => l.speaker === 'You')).toBe(true);
  expect(
    s.journal?.some(
      (l) => l.at === 844 && l.text.includes('is praying quietly') && l.text.includes('14:00'),
    ),
  ).toBe(true);
  expect(
    s.journal?.some(
      (l) => l.speaker === 'Mum' && l.at === 2385 && l.text.includes('going to pray'),
    ),
  ).toBe(false);
  expect(retrievalStart).toBe(2450);
  expect(s.workshop?.drawingFound).toBe(true);
  expect(s.workshop?.drawingChoice).toBe('displayed');
  expect(s.journal?.filter((l) => l.at === 2460).some((l) => l.speaker === 'Dad')).toBe(false);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
