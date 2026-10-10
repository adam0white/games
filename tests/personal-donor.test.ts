import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import {
  applyServiceWeekAction,
  cancelPersonalDonorForSchool,
  type ServiceWeekContext,
  type ServiceWeekGame,
  serviceWeekActions,
} from '../src/game/service-week';

const personal: ServiceWeekContext = {
  independentHandoff: false,
  graduated: false,
  samHere: false,
  dadHere: true,
  ownerHere: () => true,
  paperStreetPresent: true,
  paperStreetWaiting: true,
};
it('a discovered personal model can contact its donor without starting business or granting a part', () => {
  const s: ServiceWeekGame = { now: 15 * 60 };
  expect(
    serviceWeekActions(s, { ...personal, paperStreetPresent: false, paperStreetWaiting: false }),
  ).toEqual([]);
  expect(serviceWeekActions(s, personal).map((a) => a.id)).toEqual(['service-invite-donor']);
  const call = applyServiceWeekAction(s, 'service-invite-donor', personal);
  expect(call?.visits?.[0]?.at).toBe(1440 + 15 * 60);
  expect(s.serviceWeek?.startedAt).toBeUndefined();
  expect(s.serviceWeek?.jobs).toEqual([]);
  expect(s.serviceWeek?.route).toBe('undecided');
  expect(s.workshop).toBeUndefined();
  expect(call?.recoveredPart).toBeUndefined();
  expect(serviceWeekActions(s, personal).some((a) => a.id === 'service-hear-donor')).toBe(false);
  s.now = 1440 + 15 * 60;
  expect(
    serviceWeekActions(s, { ...personal, ownerHere: () => false }).some(
      (a) => a.id === 'service-hear-donor',
    ),
  ).toBe(false);
  expect(applyServiceWeekAction(s, 'service-hear-donor', personal)).not.toBeNull();
  expect(applyServiceWeekAction(s, 'service-recover-donor', personal)).toBeNull();
  expect(applyServiceWeekAction(s, 'service-measure-donor', personal)?.minutes).toBe(20);
  expect(
    applyServiceWeekAction(s, 'service-recover-donor', { ...personal, ownerHere: () => false }),
  ).toBeNull();
  expect(applyServiceWeekAction(s, 'service-recover-donor', personal)?.recoveredPart?.count).toBe(
    1,
  );
  expect(applyServiceWeekAction(s, 'service-recover-donor', personal)).toBeNull();
  expect(s.serviceWeek?.startedAt).toBeUndefined();
  expect(s.serviceWeek?.jobs).toEqual([]);
});
it('a later business week preserves recovered personal history and creates no duplicate gear', () => {
  const s: ServiceWeekGame = { now: 900 };
  applyServiceWeekAction(s, 'service-invite-donor', personal);
  s.now = s.serviceWeek?.donorAt ?? 0;
  for (const id of ['service-hear-donor', 'service-measure-donor', 'service-recover-donor'])
    applyServiceWeekAction(s, id, personal);
  const donorAt = s.serviceWeek?.donorAt;
  const begin = applyServiceWeekAction(s, 'service-begin', {
    ...personal,
    graduated: true,
    independentHandoff: true,
  });
  expect(begin).not.toBeNull();
  expect(s.serviceWeek?.part).toBe('recovered');
  expect(s.serviceWeek?.donorAt).toBe(donorAt);
  expect(s.serviceWeek?.startedAt).toBe(s.now);
  expect(s.serviceWeek?.jobs).toEqual([]);
  expect(serviceWeekActions(s, personal).some((a) => a.id === 'service-recover-donor')).toBe(false);
});
it('ending a school holiday cancels the outstanding visit while retaining measured knowledge for a real new invitation', () => {
  const s: ServiceWeekGame = { now: 900 };
  applyServiceWeekAction(s, 'service-invite-donor', personal);
  expect(
    cancelPersonalDonorForSchool(s)
      .map((l) => l.text)
      .join(' '),
  ).toContain('cancel');
  expect(s.serviceWeek?.donorAt).toBeUndefined();
  expect(s.serviceWeek?.donorInvited).toBe(false);
  applyServiceWeekAction(s, 'service-invite-donor', personal);
  s.now = s.serviceWeek?.donorAt ?? 0;
  applyServiceWeekAction(s, 'service-hear-donor', personal);
  applyServiceWeekAction(s, 'service-measure-donor', personal);
  cancelPersonalDonorForSchool(s);
  expect(s.serviceWeek?.part).toBe('measured');
  expect(serviceWeekActions(s, personal).map((a) => a.id)).toEqual(['service-invite-donor']);
  expect(applyServiceWeekAction(s, 'service-recover-donor', personal)).toBeNull();
  applyServiceWeekAction(s, 'service-invite-donor', personal);
  expect(applyServiceWeekAction(s, 'service-recover-donor', personal)).toBeNull();
  s.now = s.serviceWeek?.donorAt ?? 0;
  expect(applyServiceWeekAction(s, 'service-recover-donor', personal)?.recoveredPart?.count).toBe(
    1,
  );
});

it('making a work card keeps its text on the actual model when the model is shelved', () => {
  let s = createGame(1701);
  for (const id of [
    'talk-family',
    'inspect',
    'clean-contact',
    'early-return',
    'shelve',
    'talk-garage',
    'find-paper-street',
    'childhood-measure-model',
    'childhood-preserve-frontage',
    'childhood-make-label',
    'shelve',
  ])
    s = transition(s, { type: 'action', id });
  const model = s.objects.find((o) => o.id === 'paper-street');
  expect(model?.observations.at(-1)).toContain('reusable work card');
  expect(getView(s).shelf.find((o) => o.id === 'paper-street')?.note).toContain(
    'reusable work card',
  );
  expect(s.serviceWeek).toBeUndefined();
  expect(getView(s).actions.some((a) => a.id === 'service-invite-donor')).toBe(true);
});
