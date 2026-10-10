import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as eight from '../src/game/engine8';
import type { GameInput } from '../src/game/types';
import fixture from './fixtures/published-eight-missing-model-route.json';

it('keeps a saved personal model reachable when another intake takes the player bench', () => {
  let old = eight.createGame(fixture.seed);
  let checked = false;
  for (const input of fixture.inputs) {
    if (input.type === 'action' && input.id === 'service-later-nora') {
      let current = restoreGame(eight.serializeGame(old));
      expect(current.focusId).toBe('paper-street');
      current = transition(current, input as GameInput);
      expect(current.objects.find((o) => o.id === 'paper-street')?.location).toBe('shelf');
      expect(getView(current).shelf.some((o) => o.id === 'paper-street')).toBe(true);
      expect(restoreGame(serializeGame(current))).toEqual(current);
      checked = true;
    }
    old = eight.transition(old, input as GameInput);
  }
  expect(checked).toBe(true);
  const raw = eight.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(fixture.sha256);
  let current = restoreGame(raw);
  const unchanged = serializeGame(current);
  expect(old.objects.find((o) => o.id === 'paper-street')?.location).toBe('bench');
  expect(getView(current).shelf.some((o) => o.id === 'paper-street')).toBe(true);
  expect(getView(current).shelf.some((o) => o.id === 'service-nora')).toBe(false);
  expect(serializeGame(current)).toBe(unchanged);
  expect(current.parts.gears).toBe(1);
  current = transition(current, { type: 'select', id: 'paper-street' });
  for (const id of ['fit-gear', 'verify', 'wait-check', 'check-result', 'return'])
    current = transition(current, { type: 'action', id });
  expect(current.objects.find((o) => o.id === 'paper-street')?.repaired).toBe(true);
  expect(current.parts.gears).toBe(0);
  expect(current.objects.find((o) => o.id === 'paper-street')?.verified).toBe(true);
  expect(current.objects.find((o) => o.id === 'service-nora')?.assignedTo).toBe('sam');
  expect(restoreGame(serializeGame(current))).toEqual(current);
}, 20_000);
