import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createBrowserReplay } from '../src/game/browser-replay';
import { createGame, restoreGame, serializeGame, transition } from '../src/game/engine';
import type { GameInput } from '../src/game/types';
import player from './fixtures/twenty-impatient-player.json';

it('replays the actual fresh private player without manufacturing skipped work', async () => {
  let state = createGame(player.seed);
  for (const entry of player.inputs) {
    expect(state.now).toBe(entry.at);
    state = transition(state, entry.input as GameInput);
  }
  const raw = serializeGame(state);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(player.sha256);
  expect(state.inputs).toHaveLength(player.inputCount);
  expect(state.journal).toHaveLength(player.journalCount);
  expect(state.objects.find((object) => object.id === 'family')?.verified).toBe(false);
  expect(state.objects.find((object) => object.id === 'personal')?.verified).toBe(false);
  expect(state.objects.some((object) => object.id === 'paper-street')).toBe(false);
  expect(restoreGame(raw)).toEqual(state);
  const replay = createBrowserReplay(async () => {
    throw Error('A fresh current story must not need historical code');
  });
  expect(serializeGame(await replay(raw))).toBe(raw);
});
