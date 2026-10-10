import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as thirteen from '../src/game/engine13';
import type { GameInput } from '../src/game/types';
import fixture from './fixtures/owner-thirteen-school-apprentice-route.json';

it('preserves the actual owner school/apprentice export before current continuation', () => {
  let prior = thirteen.createGame(fixture.seed);
  for (const input of fixture.inputs) prior = thirteen.transition(prior, input as GameInput);
  const raw = thirteen.serializeGame(prior);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(fixture.sha256);
  expect(prior.inputs).toHaveLength(fixture.inputCount);
  expect(prior.journal).toHaveLength(fixture.journalCount);
  expect(thirteen.serializeGame(thirteen.restoreGame(raw))).toBe(raw);
  const current = restoreGame(raw);
  const { engine3Save, engine3InputCount, ...preserved } = current;
  expect(preserved).toEqual(prior);
  expect(engine3Save).toBe(raw);
  expect(engine3InputCount).toBe(fixture.inputCount);
  expect(getView(current).actions.length).toBeGreaterThan(0);
  const continued = transition(current, { type: 'action', id: 'rest' });
  expect(restoreGame(serializeGame(continued))).toEqual(continued);
}, 20_000);
