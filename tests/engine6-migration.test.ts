import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as six from '../src/game/engine6';
import { earnedHandoff } from './support/earned-handoff';

it('a generated real published-six public route validates unchanged before seven continuation', () => {
  const current = earnedHandoff();
  let old = six.createGame(current.seed);
  for (const entry of current.inputs) old = six.transition(old, entry.input);
  const raw = six.serializeGame(old);
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
  expect(getView(migrated).actions.some((a) => a.id === 'service-begin')).toBe(true);
  migrated = transition(migrated, { type: 'action', id: 'service-begin' });
  expect(restoreGame(serializeGame(migrated))).toEqual(migrated);
});
