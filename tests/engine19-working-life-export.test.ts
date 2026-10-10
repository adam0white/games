import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createBrowserReplay } from '../src/game/browser-replay';
import * as current from '../src/game/engine';
import * as eighteen from '../src/game/engine18';
import * as nineteen from '../src/game/engine19';
import { restoreHistorical } from '../src/game/historical-runtime';
import type { GameInput } from '../src/game/types';
import owner from './fixtures/eighteen-owner-exhausted.json';
import player from './fixtures/nineteen-working-life-wildcard.json';

it('preserves the actual immutable working-life player before continuing in the new engine', {
  timeout: 30000,
}, async () => {
  let original = eighteen.createGame(owner.seed);
  for (const entry of owner.inputs) {
    expect(original.now).toBe(entry.at);
    original = eighteen.transition(original, entry.input as GameInput);
  }
  const prefix = eighteen.serializeGame(original);
  expect(createHash('sha256').update(prefix).digest('hex')).toBe(owner.sha256);
  let played = nineteen.restoreGame(prefix);
  for (const entry of player.inputs) {
    expect(played.now).toBe(entry.at);
    played = nineteen.transition(played, entry.input as GameInput);
  }
  const raw = nineteen.serializeGame(played);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(player.sha256);
  expect(played.inputs).toHaveLength(player.inputCount);
  expect(played.journal).toHaveLength(player.journalCount);
  expect(nineteen.serializeGame(nineteen.restoreGame(raw))).toBe(raw);
  const migrated = current.restoreGame(raw);
  expect(migrated.inputs).toEqual(played.inputs);
  expect(migrated.journal).toEqual(played.journal);
  const replay = createBrowserReplay(async () => ({ restoreHistorical }));
  expect(current.serializeGame(await replay(raw))).toBe(current.serializeGame(migrated));
  const continued = current.transition(migrated, { type: 'action', id: 'rest' });
  expect(current.restoreGame(current.serializeGame(continued))).toEqual(continued);
  expect(continued.inputs.slice(0, player.inputCount)).toEqual(played.inputs);
});
