import { promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import { freshServiceWeek } from '../src/game/service-week';
import type { GameState } from '../src/game/types';
import { freshWorkshop } from '../src/game/workshop';

const act = (s: GameState, id: string) => transition(s, { type: 'action', id });
function route() {
  let s = createGame(17);
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.serviceWeek = { ...freshServiceWeek(), conclusion: 'regular' };
  s.workshop = { ...freshWorkshop(), cash: 800 };
  for (const id of [
    'operations-begin',
    'operations-route-regular',
    'operations-hear-operations-trolley-first',
    'rest',
    'operations-request-operations-trolley-first',
    'operations-accept-operations-trolley-first',
    'inspect',
    'test-trolley-unloaded',
    'test-trolley-loaded',
    'align-trolley-wheel',
    'check-trolley-route',
    'operations-plan-display',
    'operations-arrange-crates',
    'rest',
    'operations-agree-crate-loan',
    'operations-fetch-crates',
    'operations-pack-crate',
  ])
    s = act(s, id);
  for (let n = 0; !s.operations?.delivery && n < 20; n++) {
    if (getView(s).actions.some((a) => a.id === 'operations-round-leila'))
      s = act(s, 'operations-round-leila');
    if (!s.operations?.delivery) s = act(s, 'rest');
  }
  expect(s.operations?.delivery?.status).toBe('working');
  return s;
}
it.each([0, 2])(
  'a delivery competes with a short duty starting in %i minutes and cannot earn pay after interruption',
  (offset) => {
    const s = route(),
      p = s.people.leila;
    if (!p) throw Error('Missing Leila');
    const yes = act(structuredClone(s), 'rest');
    expect(yes.operations?.delivery?.status).toBe('complete');
    expect(yes.workshop?.cash).toBe(1100);
    promise(p, {
      kind: 'appointment',
      toId: 'mum',
      actions: ['check-in'],
      from: s.now + offset,
      until: s.now + offset + 3,
      importance: 1,
      label: 'Received check-in',
    });
    const no = act(s, 'rest');
    expect(no.operations?.delivery?.status).toBe('interrupted');
    expect(no.workshop?.cash).toBe(800);
    expect(no.operations?.crates.location).toBe('route-stop');
    expect(no.objects.find((o) => o.id === 'operations-trolley-first')?.location).not.toBe(
      'returned',
    );
  },
);
