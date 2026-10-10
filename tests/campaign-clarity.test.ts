import { expect, it } from 'vitest';
import { createGame, getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as thirteen from '../src/game/engine13';
import { nextWakingMorning } from '../src/game/school-calendar';
import type { GameInput } from '../src/game/types';
import { applyWorkshopAction, freshWorkshop, workshopActions } from '../src/game/workshop';
import freshRoute from './fixtures/fresh-fourteen-school-route.json';
import fixture from './fixtures/owner-thirteen-school-apprentice-route.json';
import { choose } from './support/school-route';

// This route was played in an unreleased development preview. Rebuild its
// choices with the revised attended torch check; it is not a frozen raw replay.
function rebuildFreshDevelopmentRoute() {
  let s = createGame(freshRoute.seed);
  for (const raw of freshRoute.inputs) {
    const input = raw as GameInput;
    const item = s.objects.find((object) => object.id === s.focusId);
    if (
      input.type === 'action' &&
      item?.id === 'friend-1' &&
      ['wait-check', 'check-result'].includes(input.id)
    ) {
      if (!item.verified) s = transition(s, { type: 'action', id: 'check-result' });
      continue;
    }
    s = input.type === 'action' ? choose(s, input.id) : transition(s, input);
  }
  return s;
}

it('the next waking morning after midnight is today, never tomorrow', () => {
  expect(nextWakingMorning(1440 + 92)).toBe(1440 + 540);
  expect(nextWakingMorning(540)).toBe(1440 + 540);
});
it('school can resume without completing a repair quota, but not with a customer promise unresolved', () => {
  const s = transition(createGame(1701), { type: 'action', id: 'talk-family' });
  s.chapter = 'garage';
  s.focusId = null;
  expect(getView(s).actions.some((a) => a.id === 'leave-school-holiday')).toBe(true);
  const lamp = s.objects[0];
  if (!lamp) throw Error('Missing initial lamp');
  lamp.awaitingCollection = true;
  expect(getView(s).actions.some((a) => a.id === 'leave-school-holiday')).toBe(false);
  expect(getView(s).lifeChapter?.detail).toContain('collection');
});
it('each eligible household request can be learned from an actual note and then a known-time jump', () => {
  const s = createGame(1701);
  s.chapter = 'garage';
  s.focusId = null;
  s.requests = 5;
  if (!s.campaign) throw Error('Missing campaign');
  s.campaign.holiday = 2;
  s.unlocked.push('friends');
  s.now = 2 * 1440 + 9 * 60;
  const read = transition(s, { type: 'action', id: 'read-household-note' });
  expect(read.unlocked).toContain('known-request:5');
  expect(read.journal?.at(-1)?.text).toContain('Sam');
  expect(getView(read).actions.some((a) => a.id === 'wait-appointment')).toBe(true);
});
it('Mum must be available before a conversation can unlock her referral', () => {
  const s = createGame(1701);
  s.chapter = 'garage';
  s.repairs = 2;
  s.unlocked.push('garage');
  s.now = 23 * 60;
  expect(getView(s).actions.some((a) => a.id === 'talk-friends')).toBe(false);
  expect(() => transition(s, { type: 'action', id: 'talk-friends' })).toThrow('not available');
  expect(s.unlocked).not.toContain('friends');
});
it('a finished cabinet cannot reopen as an unfinished pair of doors', () => {
  const s = createGame(1701);
  s.chapter = 'garage';
  s.workshop = freshWorkshop();
  s.workshop.cabinet = 'finished';
  const ctx = {
    graduated: false,
    independentRepair: false,
    paidHelpEligible: false,
    dadHere: false,
    noraHere: false,
    samHere: false,
    leilaHere: false,
  };
  const action = workshopActions(s, ctx).find((a) => a.id === 'workshop-cabinet-open');
  expect(action?.label).toContain('finished');
  const result = applyWorkshopAction(s, 'workshop-cabinet-open', ctx);
  expect(result?.lines.map((l) => l.text).join(' ')).toContain('kitchen');
});
it('childhood work changes the actual saved model and keeps mutually exclusive frontage choices', () => {
  let s = createGame(1701);
  s.chapter = 'garage';
  s.focusId = null;
  s = transition(s, { type: 'action', id: 'find-paper-street' });
  s = transition(s, { type: 'action', id: 'childhood-measure-model' });
  s = transition(s, { type: 'action', id: 'childhood-preserve-frontage' });
  const model = s.objects.find((o) => o.id === 'paper-street');
  if (!model) throw Error('Missing model');
  expect(model.observations.some((o) => o.includes('original frontage'))).toBe(true);
  expect(getView(s).actions.some((a) => a.id === 'childhood-rebuild-frontage')).toBe(false);
  s = transition(s, { type: 'action', id: 'childhood-make-label' });
  expect(s.workshop?.childhoodProject?.label).toBe('ready');
  expect(model.repaired).toBe(false);
});
it('graduating without optional repairs grants no expertise and gives a visible family milestone', () => {
  let s = createGame(1701);
  for (const id of [
    'talk-family',
    'inspect',
    'clean-contact',
    'early-return',
    'inspect',
    'shelve',
    'talk-garage',
  ])
    s = choose(s, id);
  for (let year = 0; year < 4; year++)
    s = transition(s, { type: 'action', id: 'leave-school-holiday' });
  expect(s.repairs).toBe(0);
  expect(s.campaign?.graduated).toBe(true);
  expect(getView(s).milestone?.title).toContain('School');
  expect(getView(s).actions.some((a) => a.id === 'after-school-work')).toBe(true);
  expect(s.apprentice).toBeUndefined();
  expect(s.objects.find((item) => item.id === 'personal')?.repaired).toBe(false);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('the childhood work card is physically reused when the first intake corner is agreed', () => {
  const s = createGame(1701);
  s.chapter = 'garage';
  s.workshop = freshWorkshop();
  s.workshop.referral = 'permitted';
  s.workshop.childhoodProject = { measured: true, frontage: 'preserved', label: 'ready' };
  const result = applyWorkshopAction(s, 'workshop-intake-space', {
    graduated: true,
    independentRepair: false,
    paidHelpEligible: false,
    dadHere: true,
    noraHere: false,
    samHere: false,
    leilaHere: false,
    dadWillWork: () => true,
  });
  expect(result?.minutes).toBe(5);
  expect(s.workshop.childhoodProject.label).toBe('in-use');
  expect(result?.lines.some((line) => line.text.includes('turn over the work card'))).toBe(true);
  expect(s.workshop.cash).toBe(0);
});
it('first money is shown only after an actual repair fee, never a materials advance', () => {
  const s = createGame(1701);
  s.chapter = 'garage';
  s.workshop = freshWorkshop();
  s.inputs.push({ at: s.now, input: { type: 'action', id: 'rest' } });
  s.workshop.ledger.push({
    id: 'advance',
    at: s.now,
    amount: 200,
    kind: 'materials-advance',
    jobId: 'one',
  });
  expect(getView(s).milestone).toBeUndefined();
  s.workshop.ledger.push({ id: 'fee', at: s.now, amount: 800, kind: 'repair-fee', jobId: 'one' });
  expect(getView(s).milestone?.title).toContain('£8.00');
  s.inputs.push({ at: s.now + 1, input: { type: 'action', id: 'rest' } });
  expect(getView(s).milestone).toBeUndefined();
});

it('the exact owner prefix receives Mum’s referral before her later prayer activity', () => {
  let old = thirteen.createGame(fixture.seed);
  for (const input of fixture.inputs.slice(0, 19))
    old = thirteen.transition(old, input as GameInput);
  let s = restoreGame(thirteen.serializeGame(old));
  expect(s.now).toBe(970);
  expect(getView(s).actions.some((a) => a.id === 'talk-friends')).toBe(false);
  expect(s.unlocked).not.toContain('friends');
  for (let n = 0; n < 4 && !getView(s).actions.some((a) => a.id === 'talk-friends'); n++)
    s = transition(s, { type: 'action', id: 'wait-person' });
  const after = transition(s, { type: 'action', id: 'talk-friends' });
  expect(after.unlocked).toContain('friends');
  expect(
    after.journal
      ?.slice(s.journal?.length ?? 0)
      .some((line) => line.speaker === 'Mum' && line.text.includes('Nora')),
  ).toBe(true);
});
it('putting the unexamined childhood lamp aside leaves a visible route to the garage, with truthful chapter guidance', () => {
  let s = createGame(1701);
  expect(getView(s).lifeChapter?.detail).not.toContain('close this holiday');
  for (const id of ['talk-family', 'inspect', 'clean-contact', 'early-return', 'shelve'])
    s = choose(s, id);
  expect(s.chapter).toBe('later');
  expect(getView(s).lifeChapter?.detail).not.toContain('close this holiday');
  expect(getView(s).actions.some((a) => a.id === 'talk-garage')).toBe(true);
  s = transition(s, { type: 'action', id: 'talk-garage' });
  expect(getView(s).actions.some((a) => a.id === 'leave-school-holiday')).toBe(true);
  expect(s.objects.find((o) => o.id === 'personal')?.inspected).toBe(false);
});

it('the actual fresh player graduation can learn Sam’s usual time without inventing his agreement', () => {
  let s = rebuildFreshDevelopmentRoute();
  expect(s.now % 1440).toBe(9 * 60 + 12);
  expect(s.samPlans).toBeUndefined();
  expect(getView(s).actions.some((a) => a.id === 'read-sam-afternoon-note')).toBe(true);
  s = transition(s, { type: 'action', id: 'read-sam-afternoon-note' });
  expect(s.samPlans).toBeUndefined();
  expect(s.apprentice).toBeUndefined();
  expect(
    getView(s).knownAppointments?.some((a) => a.personId === 'sam' && a.at % 1440 === 13 * 60),
  ).toBe(true);
  for (let n = 0; n < 3 && s.now % 1440 < 13 * 60; n++)
    s = transition(s, { type: 'action', id: 'wait-appointment' });
  expect(getView(s).actions.some((a) => a.id === 'observer-invite')).toBe(true);
  expect(s.samPlans).toBeUndefined();
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('received Nora and Sam routine knowledge survives later requests; withheld notes do not reveal their hours', () => {
  const s = rebuildFreshDevelopmentRoute();
  const known = getView(s).knownAppointments ?? [];
  expect(known.some((a) => a.personId === 'nora' && a.at % 1440 === 10 * 60)).toBe(true);
  expect(known.some((a) => a.personId === 'sam' && a.at % 1440 === 13 * 60)).toBe(true);
  const unheard = structuredClone(s);
  unheard.unlocked = unheard.unlocked.filter((flag) => !flag.startsWith('known-request:'));
  expect(
    getView(unheard).knownAppointments?.some((a) => ['nora', 'sam'].includes(a.personId)),
  ).toBe(false);
});

it('a received household routine is never described as an arranged collection', () => {
  const s = rebuildFreshDevelopmentRoute();
  const torch = s.objects.find((item) => item.id === 'friend-1');
  if (!torch) throw Error('Missing previously collected torch');
  // A delayed collection control changes only the host's collection status.
  torch.awaitingCollection = true;
  torch.collectedAt = undefined;
  const before = JSON.stringify(s);
  const detail = getView(s).collectionPlans?.find((plan) => plan.objectId === torch.id)?.detail;
  expect(detail).toContain('usual availability');
  expect(detail).toContain('not an arranged collection');
  expect(detail).not.toContain('next arranged visit');
  expect(JSON.stringify(s)).toBe(before);
});
