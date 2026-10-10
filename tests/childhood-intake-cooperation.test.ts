import { expect, it } from 'vitest';
import { createGame, transition } from '../src/game/engine';
import { freshWorkshop } from '../src/game/workshop';

it('reusing the actual work card finishes both shared actors within the shorter agreed setup', () => {
  let s = createGame(1);
  s.chapter = 'garage';
  if (!s.campaign) throw Error('Missing campaign');
  s.campaign.graduated = true;
  s.workshop = freshWorkshop();
  s.workshop.referral = 'permitted';
  s.workshop.childhoodProject = { measured: true, frontage: 'preserved', label: 'ready' };
  const start = s.now;
  s = transition(s, { type: 'action', id: 'workshop-intake-space' });
  expect(s.now - start).toBe(5);
  expect(s.workshop?.intakeSpace).toBe(true);
  expect(s.workshop?.childhoodProject?.label).toBe('in-use');
  expect(s.people.player?.activity?.affordanceId).not.toBe('cabinet-space');
  expect(s.people.dad?.activity?.affordanceId).not.toBe('cabinet-space');
  for (const person of [s.people.player, s.people.dad]) {
    expect(person?.now).toBe(s.now);
  }
});
