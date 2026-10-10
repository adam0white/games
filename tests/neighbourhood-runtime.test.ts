import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as six from '../src/game/engine6';
import type { GameInput, GameState } from '../src/game/types';
import regular from './fixtures/published-six-regular-route.json';
import { earnedHandoff } from './support/earned-handoff';
import { beginPrivateWeek } from './support/public-attendance';
import { choose } from './support/school-route';

const has = (s: GameState, id: string) => getView(s).actions.some((a) => a.id === id);
function privateWeek() {
  return beginPrivateWeek(earnedHandoff());
}
function agree(s: GameState, id: string) {
  const original = s.inputs.length;
  for (let n = 0; n < 100; n++) {
    if (has(s, id)) {
      const before = s.now;
      s = choose(s, id);
      if (s.now > before) return s;
    }
    s = choose(s, has(s, 'wait-person') ? 'wait-person' : 'rest');
  }
  throw Error(`No received consent for ${id} after ${s.inputs.length - original} actual inputs`);
}
it('real Nora and player consent creates an optional case, measured replacement fails, compatible owned repair is checked once', () => {
  let s = privateWeek();
  const cash = s.workshop?.cash,
    batteries = s.parts.batteries,
    credits = s.apprentice?.independentCompleted;
  s = agree(s, 'neighbourhood-remember');
  expect(s.journal?.some((l) => l.text.includes('childhood drawing pages remain put away'))).toBe(
    false,
  );
  s = agree(s, 'neighbourhood-hear-case');
  s = agree(s, 'neighbourhood-accept-case');
  const item = s.objects.find((o) => o.id === 'nora-sample-case');
  expect(item?.caseFittings?.original).toBe('attached-worn');
  s = agree(s, 'measure-case');
  s = agree(s, 'try-case-replacement');
  expect(s.objects.find((o) => o.id === item?.id)?.repaired).toBe(false);
  s = agree(s, 'neighbourhood-compare-source');
  s = agree(s, 'neighbourhood-source');
  s = agree(s, 'fit-case-catch');
  s = agree(s, 'check-case-carry');
  let labelled = agree(structuredClone(s), 'leave-ready-nora-sample-case');
  const beforeHandover = labelled.nextLineId ?? 0;
  labelled = agree(labelled, 'neighbourhood-return-repaired');
  expect(labelled.objects.find((o) => o.id === item?.id)?.location).toBe('returned');
  expect(labelled.neighbourhood?.caseStage).toBe('returned');
  expect(
    labelled.journal
      ?.filter((line) => line.id >= beforeHandover)
      .some((line) => line.text.includes('The time together stopped before you finished')),
  ).toBe(false);
  const count = s.repairs;
  s = agree(s, 'neighbourhood-return-repaired');
  expect(s.repairs).toBe(count + 1);
  expect(s.objects.find((o) => o.id === item?.id)?.caseFittings?.compatible?.status).toBe('fitted');
  expect(s.objects.find((o) => o.id === item?.id)?.location).toBe('returned');
  expect(has(s, 'neighbourhood-return-repaired')).toBe(false);
  expect(s.workshop?.cash).toBe(cash);
  expect(s.parts.batteries).toBe(batteries);
  expect(s.apprentice?.independentCompleted).toBe(credits);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('a real stationary-use agreement has a separate checked outcome without original repair credit or a second repair mode', () => {
  let s = privateWeek();
  s = agree(s, 'neighbourhood-remember');
  s = agree(s, 'neighbourhood-hear-case');
  s = agree(s, 'neighbourhood-accept-case');
  s = agree(s, 'measure-case');
  s = agree(s, 'neighbourhood-tray-consent');
  const count = s.repairs;
  expect(has(s, 'fit-case-catch')).toBe(false);
  s = agree(s, 'check-case-tray');
  s = agree(s, 'neighbourhood-return-tray');
  expect(s.neighbourhood?.outcome).toBe('adapted-checked');
  expect(s.objects.find((o) => o.id === 'nora-sample-case')?.verified).toBe(false);
  expect(s.repairs).toBe(count);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('actual conversation refusal preserves the invitation and actor clock; absence cannot speak or accept', () => {
  let s = privateWeek();
  for (let n = 0; n < 40 && !has(s, 'neighbourhood-remember'); n++) s = choose(s, 'wait-person');
  expect(has(s, 'neighbourhood-remember')).toBe(true);
  const same = structuredClone(s);
  if (!same.people.nora) throw Error('Missing Nora');
  // Matched body interference, not a policy flag: the same offer is rejected by the public actor API.
  same.people.nora.body.downed = { since: s.now, reason: 'An acute injury' };
  expect(has(same, 'neighbourhood-remember')).toBe(false);
  expect(() => transition(same, { type: 'action', id: 'neighbourhood-remember' })).toThrow(
    'not available',
  );
  expect(same.neighbourhood).toBeUndefined();
  const at = s.now;
  s = choose(s, 'neighbourhood-remember');
  expect(
    s.people.nora?.trace.some(
      (t) => t.at === at && t.considered.some((c) => c.affordanceId === 'neighbourhood-remember'),
    ),
  ).toBe(true);
  if (s.now === at) expect(s.neighbourhood).toBeUndefined();
  else expect(s.now).toBe(at + 3);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('the open first week has no later episode and case shelving preserves actual physical work and traces', () => {
  let s = earnedHandoff();
  s = choose(s, 'service-begin');
  expect(s.serviceWeek?.conclusion).toBe('open');
  expect(getView(s).actions.some((a) => a.id.startsWith('neighbourhood-'))).toBe(false);
  s = beginPrivateWeek(s);
  s = agree(s, 'neighbourhood-remember');
  s = agree(s, 'neighbourhood-hear-case');
  s = agree(s, 'neighbourhood-accept-case');
  const at = s.now;
  s = agree(s, 'measure-case');
  expect(
    s.people.player?.trace.some((t) => t.at >= at && t.chosenAffordanceId === 'measure-case'),
  ).toBe(true);
  s = choose(s, 'shelve');
  expect(s.focusId).toBeNull();
  expect(s.objects.find((o) => o.id === 'nora-sample-case')?.location).toBe('shelf');
  expect(getView(s).shelf.some((o) => o.id === 'nora-sample-case')).toBe(true);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('an actual completed regular story separately accepts a priced light, agrees Sam’s new rate and settles once without watching', () => {
  let prior = six.createGame(regular.seed);
  for (const input of regular.inputs) prior = six.transition(prior, input as GameInput);
  const raw = six.serializeGame(prior);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(regular.sha256);
  let s = restoreGame(raw);
  const cash = s.workshop?.cash ?? 0;
  s = agree(s, 'neighbourhood-remember');
  s = agree(s, 'neighbourhood-hear-case');
  s = agree(s, 'neighbourhood-accept-case');
  s = agree(s, 'neighbourhood-return-unchanged');
  s = agree(s, 'neighbourhood-hear-light');
  expect(getView(s).actions.find((a) => a.id === 'neighbourhood-accept-light')?.label).toContain(
    '£5',
  );
  s = agree(s, 'neighbourhood-accept-light');
  const id = 'workshop-neighbourhood-nora-light';
  expect(s.workshop?.jobs.find((j) => j.id === id)?.fee).toBe(500);
  expect(s.workshop?.jobs.find((j) => j.id === id)?.samFee).toBe(0);
  expect(has(s, 'delegate-repair')).toBe(false);
  for (let n = 0; n < 100 && !s.workshop?.paidHelp; n++)
    s = choose(
      s,
      has(s, 'workshop-sam-agreement')
        ? 'workshop-sam-agreement'
        : has(s, 'wait-appointment')
          ? 'wait-appointment'
          : has(s, 'wait-person')
            ? 'wait-person'
            : 'rest',
    );
  expect(s.workshop?.paidHelp).toBe(true);
  expect(s.workshop?.jobs.find((j) => j.id === id)?.samFee).toBe(300);
  for (let n = 0; n < 100 && !has(s, 'delegate-repair'); n++)
    s = choose(
      s,
      has(s, 'arrange-learning')
        ? 'arrange-learning'
        : has(s, 'wait-appointment')
          ? 'wait-appointment'
          : has(s, 'wait-person')
            ? 'wait-person'
            : 'rest',
    );
  s = choose(s, 'delegate-repair');
  const mark = s.inputs.length;
  for (let n = 0; n < 100 && s.apprentice?.jobId; n++)
    s = choose(
      s,
      has(s, 'arrange-learning')
        ? 'arrange-learning'
        : has(s, 'wait-appointment')
          ? 'wait-appointment'
          : has(s, 'wait-person')
            ? 'wait-person'
            : 'rest',
    );
  expect(s.objects.find((o) => o.id === id)?.independent).toBe(true);
  expect(s.workshop?.jobs.find((j) => j.id === id)?.stage).toBe('complete');
  expect((s.workshop?.cash ?? 0) - cash).toBe(200);
  expect(s.workshop?.ledger.filter((e) => e.jobId === id && e.kind === 'sam-pay')).toHaveLength(1);
  expect(s.inputs.slice(mark).some((i) => i.input.id === 'watch-sam')).toBe(false);
  s = choose(s, 'rest');
  expect((s.workshop?.cash ?? 0) - cash).toBe(200);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('an accompanied comparison records a completed thirty-minute shared activity, with all clocks aligned and no free repair', () => {
  let s = privateWeek();
  s = agree(s, 'neighbourhood-remember');
  const count = s.repairs,
    objects = s.objects.length;
  s = agree(s, 'neighbourhood-frontage');
  expect(s.neighbourhood?.frontage).toBe('visited');
  const action = s.inputs.findLast((i) => i.input.id === 'neighbourhood-frontage');
  expect(action).toBeTruthy();
  expect(s.now - (action?.at ?? s.now)).toBe(30);
  expect(Object.values(s.people).every((p) => p.now === s.now)).toBe(true);
  expect(s.people.nora?.activity?.affordanceId).not.toBe('neighbourhood-frontage');
  expect(s.neighbourhood?.frontageObservations).toHaveLength(2);
  expect(s.repairs).toBe(count);
  expect(s.objects.length).toBe(objects);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('private household light terms remain an explicitly accepted no-fee favour with conserved provided battery', () => {
  let s = privateWeek();
  s = agree(s, 'neighbourhood-remember');
  s = agree(s, 'neighbourhood-hear-case');
  s = agree(s, 'neighbourhood-accept-case');
  s = agree(s, 'neighbourhood-return-unchanged');
  s = agree(s, 'neighbourhood-hear-light');
  const count = s.parts.batteries;
  expect(getView(s).actions.find((a) => a.id === 'neighbourhood-accept-light')?.label).toContain(
    'as a favour',
  );
  s = agree(s, 'neighbourhood-accept-light');
  const job = s.workshop?.jobs.find((j) => j.id === 'workshop-neighbourhood-nora-light');
  expect(job?.fee).toBe(0);
  expect(job?.samFee).toBe(0);
  expect(s.parts.batteries).toBe(count + 1);
  expect(
    s.people.player?.agenda.commitments.some(
      (c) => c.status === 'pending' && c.until === job?.collectionAt,
    ),
  ).toBe(true);
  expect(restoreGame(serializeGame(s))).toEqual(s);
  s = choose(s, 'next-day');
  const legacy = structuredClone(s);
  const presence = legacy.world?.presence.nora;
  if (!presence) throw Error('Missing arranged Nora collection');
  presence.activity = 'Coming back for collection tomorrow';
  const beforeView = JSON.stringify(legacy);
  const note = getView(legacy).knownAppointments?.find((event) => event.personId === 'nora');
  expect(note?.detail).toContain('arranged collection');
  expect(note?.detail).not.toContain('collection tomorrow');
  expect(JSON.stringify(legacy)).toBe(beforeView);
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
