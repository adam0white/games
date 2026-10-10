import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import { choose, nextSchoolAction } from './support/school-route';

it('unchecked opening handbacks remain honest and the self-owned lamp can earn a real check before school progress', () => {
  let s = createGame(1701);
  for (const id of ['talk-family', 'inspect', 'test-battery', 'clean-contact', 'early-return'])
    s = choose(s, id);
  const handback = s.conversation.map((line) => line.text);
  expect(
    handback.filter((text) => text.includes('Thank you') || text.includes('Thanks for')),
  ).toHaveLength(1);
  const honesty = handback.findIndex((text) => text.includes('have not given it the longer check'));
  const response = handback.findIndex(
    (text) => text.includes('Thank you') || text.includes('Thanks for'),
  );
  expect(honesty).toBeLessThan(response);
  expect(handback.join(' ')).toContain('Your old bedside lamp is still upstairs');
  for (const id of ['inspect', 'shelve', 'talk-garage', 'search-donor']) s = choose(s, id);
  s = transition(s, { type: 'select', id: 'personal' });
  s = choose(s, 'fit-holder');
  s = choose(s, 'early-return');
  expect(getView(s).actions.find((a) => a.id === 'bring-back-bedside')?.kind).toBe('primary');
  expect(s.repairs).toBe(0);
  expect(s.objects.find((o) => o.id === 'personal')?.callbackAt).toBeUndefined();
  const before = s.now,
    parts = structuredClone(s.parts),
    repairs = s.repairs,
    skill = structuredClone(s.people.player?.skills);
  s = choose(s, 'bring-back-bedside');
  expect(s.now - before).toBe(3);
  expect(s.repairs).toBe(repairs);
  expect(s.parts).toEqual(parts);
  expect(s.people.player?.skills).toEqual(skill);
  expect(s.objects.find((o) => o.id === 'personal')?.verified).toBe(false);
  expect(s.objects.find((o) => o.id === 'personal')?.repaired).toBe(true);
  s = choose(s, 'verify');
  while (getView(s).actions.some((a) => a.id === 'wait-check')) s = choose(s, 'wait-check');
  s = choose(s, 'check-result');
  s = choose(s, 'return');
  expect(s.repairs).toBe(repairs + 1);
  expect(getView(s).actions.some((a) => a.id === 'bring-back-bedside')).toBe(false);
  if (!getView(s).actions.some((a) => a.id === 'talk-friends')) s = choose(s, 'wait-person');
  s = choose(s, 'talk-friends');
  for (let n = 0; n < 100 && s.campaign?.holiday === 0; n++) s = choose(s, nextSchoolAction(s));
  expect(s.campaign?.holiday).toBe(1);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
