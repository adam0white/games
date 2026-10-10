import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as six from '../src/game/engine6';
import type { GameInput } from '../src/game/types';
import fixture from './fixtures/published-six-route.json';

it('a pinned actual published-six public route validates unchanged before seven continuation', () => {
  let old = six.createGame(fixture.seed);
  for (const input of fixture.inputs) old = six.transition(old, input as GameInput);
  const raw = six.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(fixture.sha256);
  expect(six.restoreGame(raw)).toEqual(old);
  let migrated = restoreGame(raw);
  const { engine3Save, engine3InputCount, ...unchanged } = migrated;
  expect(engine3Save).toBe(raw);
  expect(engine3InputCount).toBe(old.inputs.length);
  expect(unchanged).toEqual(old);
  expect(migrated.people).toEqual(old.people);
  expect(migrated.unlocked.filter((f) => f === 'profiles:6')).toEqual(
    old.unlocked.filter((f) => f === 'profiles:6'),
  );
  expect(getView(migrated).actions.some((a) => a.id === 'rest')).toBe(true);
  migrated = transition(migrated, { type: 'action', id: 'rest' });
  expect(restoreGame(serializeGame(migrated))).toEqual(migrated);
}, 20_000);
