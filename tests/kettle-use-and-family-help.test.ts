import { begin, decide } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import { performKettleLampUseCheck, readLongCheck } from '../src/game/repairs';

function kettle() {
  const s = transition(createGame(1701), { type: 'action', id: 'talk-family' });
  const o = s.objects[0];
  if (!o) throw Error('Missing object');
  o.id = 'friend-0';
  o.owner = 'Nora';
  o.title = 'Nora’s kettle lamp';
  o.repaired = true;
  o.checkStarted = s.now;
  s.focusId = o.id;
  return { s, o };
}
it('requires the longer electrical run and six minutes of actual kettle placement testing', () => {
  const { s, o } = kettle();
  expect(() => readLongCheck(o, s.now + 100)).toThrow('actual shade');
  expect(() => performKettleLampUseCheck(o, s.now + 19, s.now + 25)).toThrow();
  expect(() => performKettleLampUseCheck(o, s.now + 20, s.now + 25)).toThrow();
  expect(o.verified).toBe(false);
  s.now += 20;
  expect(getView(s).actions.find((a) => a.id === 'check-result')?.label).toContain('stair doorway');
  const next = transition(s, { type: 'action', id: 'check-result' });
  expect(next.now - s.now).toBe(6);
  expect(next.objects[0]?.verified).toBe(true);
  expect(next.objects[0]?.observations.join(' ')).toContain('shade keeps the light off the stairs');
});
it('a returned unchecked object offers neither parent as a hidden bench verification route', () => {
  const { s, o } = kettle();
  o.location = 'returned';
  s.chapter = 'garage';
  s.now += 25;
  expect(getView(s).actions.some((a) => ['ask-dad', 'ask-mum'].includes(a.id))).toBe(false);
});
it('Dad refusing during an actual meal does not consume the later invitation or verify the light', () => {
  const { s, o } = kettle();
  s.chapter = 'garage';
  s.now += 20;
  const dad = s.people.dad;
  if (!dad) throw Error('Missing Dad');
  dad.activity = null;
  dad.now = s.now;
  const meal = {
    id: 'meal-control',
    action: 'eat',
    label: 'Having something to eat and drink',
    duration: 30,
    effort: 0,
    advertises: { food: 0.2, water: 0.2 },
  };
  begin(dad, meal, decide(dad, [meal]));
  const next = transition(s, { type: 'action', id: 'ask-dad' });
  expect(next.objects[0]?.verified).toBe(false);
  expect(next.unlocked).not.toContain(`dad-help:${o.id}`);
  expect(getView(next).actions.some((a) => a.id === 'ask-dad')).toBe(true);
});
