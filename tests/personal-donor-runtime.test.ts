import { begin, decide, finish, promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as six from '../src/game/engine6';
import type { GameInput } from '../src/game/types';
import regular from './fixtures/published-six-regular-route.json';

function measuredDonor() {
  let s = createGame(1701);
  for (const id of [
    'talk-family',
    'inspect',
    'clean-contact',
    'reassemble',
    'early-return',
    'shelve',
    'talk-garage',
    'find-paper-street',
    'service-invite-donor',
  ])
    s = transition(s, { type: 'action', id });
  for (let n = 0; n < 5 && !getView(s).actions.some((a) => a.id === 'service-hear-donor'); n++)
    s = transition(s, { type: 'action', id: 'wait-appointment' });
  s = transition(s, { type: 'action', id: 'service-hear-donor' });
  s = transition(s, { type: 'action', id: 'service-measure-donor' });
  return s;
}
it('an early personal donor transfers one gear only after forty minutes of actual shared HF work', () => {
  let s = measuredDonor();
  expect(s.objects.find((o) => o.id === 'paper-street')?.observations.at(-1)).toContain(
    'tooth count',
  );
  const start = s.now;
  s = transition(s, { type: 'action', id: 'service-recover-donor' });
  expect(s.serviceWeek?.part).toBe('recovered');
  expect(s.now - start).toBe(40);
  expect(s.parts.gears).toBe(1);
  for (const id of ['player', 'evan']) {
    expect(s.people[id]?.trace.some((t) => t.chosenAffordanceId === 'service-recover-donor')).toBe(
      true,
    );
    expect(s.people[id]?.chronicleDay?.actions.some((a) => a.action === 'sort-donor-parts')).toBe(
      true,
    );
  }
  expect(
    s.people.evan?.agenda?.goals.find((g) => g.id === s.serviceWeek?.donorPurposeId)?.status,
  ).toBe('achieved');
  expect(s.serviceWeek?.startedAt).toBeUndefined();
  expect(s.serviceWeek?.jobs).toEqual([]);
  expect(s.objects.find((o) => o.id === 'paper-street')?.observations.at(-1)).toContain(
    'compatible gear',
  );
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('Evan can retain a stronger promised activity, with no shared completion or donated part', () => {
  const s = measuredDonor();
  const evan = s.people.evan;
  if (!evan) throw Error('Missing donor');
  if (evan.activity)
    finish(evan, {
      affordanceId: evan.activity.affordanceId,
      action: evan.activity.action,
      at: evan.now,
      status: 'interrupted',
      summary: 'Control begins promised delivery',
    });
  const duty = promise(evan, {
    kind: 'promise',
    toId: 'nora',
    label: 'Deliver the promised parcel',
    actions: ['parcel'],
    from: s.now,
    until: s.now + 60,
    importance: 1,
  });
  const own = {
    id: 'promised-parcel',
    action: 'parcel',
    label: 'Keeping the promised parcel delivery',
    duration: 60,
    effort: 0,
    fulfills: [duty.id],
    advertises: { autonomy: 0.1 },
  };
  begin(evan, own, decide(evan, [own]));
  const prior = structuredClone(evan.activity);
  const agenda = structuredClone(evan.agenda);
  const after = transition(s, { type: 'action', id: 'service-recover-donor' });
  expect(after.serviceWeek?.part).toBe('measured');
  expect(after.parts.gears ?? 0).toBe(0);
  expect(after.people.evan?.activity).toEqual(prior);
  expect(after.people.evan?.agenda).toEqual(agenda);
  expect(after.now).toBe(s.now);
});
it('closing the played school holiday cancels the actual future donor visit and requires a fresh invitation', () => {
  let s = createGame(1701);
  for (const id of [
    'talk-family',
    'inspect',
    'clean-contact',
    'reassemble',
    'early-return',
    'shelve',
    'talk-garage',
    'find-paper-street',
    'service-invite-donor',
  ])
    s = transition(s, { type: 'action', id });
  const oldAt = s.serviceWeek?.donorAt;
  s = transition(s, { type: 'action', id: 'leave-school-holiday' });
  expect(s.serviceWeek?.donorInvited).toBe(false);
  expect(s.serviceWeek?.donorAt).toBeUndefined();
  expect(s.world?.presence.evan?.awayUntil).not.toBe(oldAt);
  expect(s.journal?.some((l) => l.text.includes('cancel the unfinished donor visit'))).toBe(true);
  expect(getView(s).actions.some((a) => a.id === 'service-invite-donor')).toBe(true);
  expect(s.parts.gears ?? 0).toBe(0);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('declining the measured exchange abandons its actual purpose without transferring a part', () => {
  const s = measuredDonor();
  const purpose = s.serviceWeek?.donorPurposeId;
  const after = transition(s, { type: 'action', id: 'service-decline-donor' });
  expect(after.people.evan?.agenda?.goals.find((g) => g.id === purpose)?.status).toBe('abandoned');
  expect(after.parts.gears ?? 0).toBe(0);
});
it('a retained measured gear needs a new invitation and actual renewed purpose after school', () => {
  let s = measuredDonor();
  const oldPurpose = s.serviceWeek?.donorPurposeId;
  s = transition(s, { type: 'action', id: 'leave-school-holiday' });
  expect(s.serviceWeek?.part).toBe('measured');
  expect(s.people.evan?.agenda?.goals.find((g) => g.id === oldPurpose)?.status).toBe('abandoned');
  s = transition(s, { type: 'action', id: 'service-invite-donor' });
  expect(s.serviceWeek?.donorPurposeId).not.toBe(oldPurpose);
  expect(
    s.people.evan?.agenda?.goals.find((g) => g.id === s.serviceWeek?.donorPurposeId)?.status,
  ).toBe('active');
  expect(s.parts.gears ?? 0).toBe(0);
});

it('a real published-six measured donor resumes its heard purpose only on selected current work', () => {
  let old = six.createGame(regular.seed);
  for (const input of regular.inputs) {
    old = six.transition(old, input as GameInput);
    if (input.type === 'action' && input.id === 'service-measure-donor') break;
  }
  expect(old.inputs).toHaveLength(199);
  const raw = six.serializeGame(old);
  let s = restoreGame(raw);
  expect(s.engine3Save).toBe(raw);
  expect(s.people).toEqual(old.people);
  expect(s.serviceWeek?.donorPurposeId).toBeUndefined();
  s = transition(s, { type: 'action', id: 'service-recover-donor' });
  expect(s.serviceWeek?.donorPurposeId).toBeTruthy();
  if (s.serviceWeek?.part !== 'recovered') {
    s = transition(s, { type: 'action', id: 'wait-conversation-activity' });
    s = transition(s, { type: 'action', id: 'service-recover-donor' });
  }
  expect(s.serviceWeek?.part).toBe('recovered');
  expect(
    s.people.evan?.agenda?.goals.find((g) => g.id === s.serviceWeek?.donorPurposeId)?.status,
  ).toBe('achieved');
  expect(s.engine3Save).toBe(raw);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
