import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as thirteen from '../src/game/engine13';
import * as fourteen from '../src/game/engine14';
import type { GameInput, GameState } from '../src/game/types';
import longRoute from './fixtures/fourteen-long-workshop-route.json';
import ownerRoute from './fixtures/fourteen-owner-return-route.json';
import ownerSource from './fixtures/owner-thirteen-school-apprentice-route.json';

const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');
function checkActual(raw: string, prior: GameState, fixture: typeof longRoute) {
  expect(hash(raw)).toBe(fixture.sha256);
  expect(prior.inputs).toHaveLength(fixture.inputCount);
  expect(prior.journal).toHaveLength(fixture.journalCount);
  expect(fourteen.serializeGame(fourteen.restoreGame(raw))).toBe(raw);
  const current = restoreGame(raw);
  const { engine3Save, engine3InputCount, ...preserved } = current;
  const { engine3Save: _olderSave, engine3InputCount: _olderCount, ...actualHistorical } = prior;
  expect(preserved).toEqual(actualHistorical);
  expect(engine3Save).toBe(raw);
  expect(engine3InputCount).toBe(fixture.inputCount);
  expect(getView(current).actions.length).toBeGreaterThan(0);
  const continued = transition(current, { type: 'action', id: 'rest' });
  expect(restoreGame(serializeGame(continued))).toEqual(continued);
}
it('preserves the exact source-unread engine-14 long-workshop export from candidate52a9', () => {
  let prior = fourteen.createGame(longRoute.seed);
  for (const input of longRoute.inputs) prior = fourteen.transition(prior, input as GameInput);
  checkActual(fourteen.serializeGame(prior), prior, longRoute);
}, 30_000);
it('preserves the exact engine-14 owner-return export including its actual nested engine-13 provenance', () => {
  let source = thirteen.createGame(ownerSource.seed);
  for (const input of ownerSource.inputs) source = thirteen.transition(source, input as GameInput);
  const original = thirteen.serializeGame(source);
  expect(hash(original)).toBe(ownerRoute.sourceSha256);
  expect(hash(original)).toBe(ownerSource.sha256);
  let prior = fourteen.restoreGame(original);
  for (const input of ownerRoute.inputs) prior = fourteen.transition(prior, input as GameInput);
  expect(prior.engine3Save).toBe(original);
  expect(prior.engine3InputCount).toBe(ownerRoute.sourceInputCount);
  checkActual(fourteen.serializeGame(prior), prior, ownerRoute);
}, 30_000);
