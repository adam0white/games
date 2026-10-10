import { createPerson } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as frozen from '../src/game/engine3';

const action = (s: ReturnType<typeof createGame>, id: string) =>
  transition(s, { type: 'action', id });
const ready = () =>
  [
    'talk-family',
    'inspect',
    'clean-contact',
    'verify',
    'rest',
    'check-result',
    'return',
    'inspect',
    'shelve',
    'talk-garage',
    'talk-friends',
    'accept-request',
    'inspect',
    'test-battery',
  ].reduce(action, createGame(42));
function finishItem(s: ReturnType<typeof createGame>) {
  const item = s.objects.find((x) => x.id === s.focusId);
  s = action(
    s,
    item?.fault === 'battery'
      ? 'replace-battery'
      : item?.fault === 'cap'
        ? 'twist-cap'
        : 'clean-contact',
  );
  return ['verify', 'rest', 'check-result', 'return'].reduce(action, s);
}
it('all named people are seeded HF actors sharing every elapsed action and remembered dialogue', () => {
  let s = ready();
  expect(Object.keys(s.people).sort()).toEqual(['dad', 'mum', 'nora', 'player', 'sam']);
  for (const person of Object.values(s.people)) expect(person.now).toBe(s.now);
  expect(s.people.dad?.trace.length).toBeGreaterThan(0);
  expect(s.people.nora?.memory.episodes.length).toBeGreaterThan(0);
  s = action(s, 'next-day');
  for (const person of Object.values(s.people)) expect(person.now).toBe(s.now);
  expect(getView(s).timeLabel).toBe('Summer day 2 · 09:00');
  expect(s.world?.presence.sam?.activity).toContain('morning shift');
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('Sam can leave for his dog walk without a contradictory immediate handback or a blocked bench', () => {
  let s = finishItem(ready());
  s = action(s, 'accept-request');
  s = action(s, 'inspect');
  s = action(s, 'test-battery');
  const item = s.objects.find((x) => x.id === s.focusId);
  s = action(
    s,
    item?.fault === 'battery'
      ? 'replace-battery'
      : item?.fault === 'cap'
        ? 'twist-cap'
        : 'clean-contact',
  );
  s = action(s, 'verify');
  s = action(s, 'rest');
  s = action(s, 'observer-invite');
  const departure = s.now;
  expect(s.world?.presence.sam?.awayUntil).toBe(departure + 50);
  expect(getView(s).actions.some((a) => a.id === 'ask-sam-string')).toBe(false);
  s = action(s, 'early-return');
  expect(s.objects.find((x) => x.id === item?.id)?.awaitingCollection).toBe(true);
  expect(s.objects.find((x) => x.id === item?.id)?.callbackAt).toBeUndefined();
  expect(getView(s).currentDialogue?.every((x) => x.speaker !== 'Sam')).toBe(true);
  expect(restoreGame(serializeGame(s))).toEqual(s);
  s = action(s, 'wait-person');
  s = action(s, 'wait-person');
  expect(s.objects.find((x) => x.id === item?.id)?.awaitingCollection).toBe(false);
  expect(getView(s).currentDialogue?.some((x) => x.speaker === 'Sam')).toBe(true);
});
it('frozen engine3 exports validate before additive migration and reject tampering', () => {
  let old = frozen.createGame(99);
  for (const id of [
    'talk-family',
    'inspect',
    'clean-contact',
    'verify',
    'rest',
    'check-result',
    'return',
  ])
    old = frozen.transition(old, { type: 'action', id });
  const text = frozen.serializeGame(old);
  expect(frozen.serializeGame(frozen.restoreGame(text))).toBe(text);
  const migrated = restoreGame(text);
  for (const id of ['player', 'mum'])
    expect({ ...migrated.people[id], engine: old.people[id]?.engine }).toEqual(old.people[id]);
  expect(migrated.objects).toEqual(old.objects);
  expect(restoreGame(serializeGame(action(migrated, 'rest')))).toEqual(action(migrated, 'rest'));
  const invalid = JSON.parse(text);
  invalid.state.repairs++;
  expect(() => restoreGame(JSON.stringify(invalid))).toThrow('Save does not match');
});

it('nighttime and bodily unavailability suppress conversations without reading private remote routines', () => {
  const s = ready();
  s.now = 3 * 60;
  for (const person of Object.values(s.people)) person.now = s.now;
  expect(getView(s).actions.some((a) => a.id === 'ask-dad-bench')).toBe(false);
  expect(getView(s).actions.find((a) => a.id === 'rest')?.label).toBe('Take a quiet break');
  s.now = 14 * 60;
  const dad = s.people.dad;
  if (!dad) throw Error('Missing Dad');
  dad.body.asleep = true;
  expect(getView(s).actions.some((a) => a.id === 'ask-dad-bench')).toBe(false);
  expect(getView(s).whereabouts?.find((person) => person.id === 'nora')?.activity).toBe(
    'At home; you can arrange a visit',
  );
});

it('Dad’s voluntary help completes the final shared check, while refusal leaves the same solo route', () => {
  let s = ready();
  const item = s.objects.find((x) => x.id === s.focusId);
  s = action(s, item?.fault === 'battery' ? 'replace-battery' : 'clean-contact');
  s = action(s, 'verify');
  s = action(s, 'rest');
  const fixture = (belonging: number, leisure: number) => {
    const state = structuredClone(s);
    state.people.dad = createPerson({
      id: 'dad',
      name: 'Dad',
      seed: 42,
      now: state.now,
      bornAt: -55 * 365 * 1440,
      sex: 'male',
      needs: { belonging, leisure },
      relationships: [{ otherId: 'player', roles: ['child'] }],
    });
    return state;
  };
  const helped = action(fixture(0.1, 0.95), 'ask-dad');
  const declined = action(fixture(0.95, 0.1), 'ask-dad');
  expect(helped.objects.find((x) => x.id === item?.id)?.verified).toBe(true);
  expect(declined.objects.find((x) => x.id === item?.id)?.verified).toBe(false);
  expect(getView(declined).actions.some((a) => a.id === 'check-result')).toBe(true);
  expect(helped.now).toBe(declined.now);
});
