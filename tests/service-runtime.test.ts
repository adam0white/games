import { expect, it } from 'vitest';
import { arrangeLearning } from '../src/game/apprentice';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import { checkingSpaceAvailable } from '../src/game/repairs';
import type { GameState } from '../src/game/types';
import { earnedHandoff } from './support/earned-handoff';
import { choose } from './support/school-route';

const has = (s: GameState, id: string) => getView(s).actions.some((a) => a.id === id);
function reach(s: GameState, id: string) {
  for (let n = 0; n < 120 && !has(s, id); n++) {
    const next = has(s, 'wait-appointment')
      ? 'wait-appointment'
      : has(s, 'wait-person')
        ? 'wait-person'
        : 'rest';
    s = choose(s, next);
  }
  expect(has(s, id), `Reach ${id}`).toBe(true);
  return s;
}
it('a genuine earned private week discovers its own model and closes without fictitious customers or money', () => {
  let s = earnedHandoff();
  const count = s.objects.length;
  s = choose(s, 'service-begin');
  expect(s.world?.presence.leila).toBeUndefined();
  s = choose(s, 'service-private');
  expect(s.serviceWeek?.jobs).toEqual([]);
  expect(has(s, 'service-hear-leila')).toBe(false);
  s = choose(s, 'service-find-model');
  expect(s.objects.length).toBe(count + 1);
  expect(s.objects.find((o) => o.id === 'paper-street')?.repaired).toBe(false);
  expect(has(s, 'service-find-model')).toBe(false);
  s = choose(s, 'service-protect-session');
  s = choose(s, 'service-invite-donor');
  s = choose(reach(s, 'service-personal-session'), 'service-personal-session');
  expect(s.serviceWeek?.personalSession).toBe('spent');
  s = choose(reach(s, 'service-hear-donor'), 'service-hear-donor');
  s = choose(s, 'service-measure-donor');
  s = choose(s, 'service-recover-donor');
  expect(s.parts.gears).toBe(1);
  s = transition(s, { type: 'select', id: 'paper-street' });
  for (const id of ['inspect', 'fit-gear', 'verify', 'wait-check', 'check-result', 'return'])
    s = choose(s, id);
  expect(s.objects.find((o) => o.id === 'paper-street')?.verified).toBe(true);
  while (!has(s, 'service-close-small')) s = choose(s, 'service-next-day');
  s = choose(s, 'service-close-small');
  expect(s.serviceWeek?.conclusion).toBe('small');
  const ending = s.conversation.map((line) => line.text).join(' ');
  expect(ending).toContain('0 checked service-week jobs returned');
  expect(ending).toContain('household and personal items are also checked');
  expect(ending).toContain('installed in the model, whose movement has been checked');
  expect(ending).not.toContain('gear is kept with its source label');
  expect(s.workshop?.cash ?? 0).toBe(0);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('a bought second checking place changes physical capacity, without changing repair outcomes', () => {
  const s = earnedHandoff();
  const items = s.objects
    .filter((o) => o.verified)
    .slice(0, 2)
    .map((o) => ({ ...o, location: 'bench' as const, verified: false, checkStarted: s.now }));
  const first = items[0],
    second = items[1];
  if (!first || !second) throw Error('Need two actual repaired objects');
  expect(checkingSpaceAvailable({ objects: items, checkingPlaces: 1 }, second.id)).toBe(false);
  expect(checkingSpaceAvailable({ objects: items, checkingPlaces: 2 }, second.id)).toBe(true);
});
it('regular service jobs use real Sam work, honest dates, and the agreed fee ledger while you do other things', () => {
  let s = earnedHandoff();
  s = choose(s, 'service-begin');
  s = choose(s, 'service-regular');
  s = choose(reach(s, 'service-paid-help'), 'service-paid-help');
  expect(s.serviceWeek?.paidHelp).toBe(true);
  s = choose(s, 'service-find-model');
  s = choose(s, 'service-protect-session');
  s = choose(s, 'service-invite-donor');
  s = choose(reach(s, 'service-hear-leila'), 'service-hear-leila');
  s = choose(s, 'service-accept-leila');
  if (!has(s, 'delegate-repair')) s = choose(reach(s, 'arrange-learning'), 'arrange-learning');
  s = choose(s, 'delegate-repair');
  const samStepsBefore =
    s.objects.find((o) => o.id === 'service-leila')?.stepDecisions?.length ?? 0;
  s = choose(s, 'rest');
  expect(
    s.objects.find((o) => o.id === 'service-leila')?.stepDecisions?.length ?? 0,
  ).toBeGreaterThan(samStepsBefore);
  for (let n = 0; n < 160 && s.apprentice?.jobId; n++) {
    const item = s.objects.find((o) => o.id === s.apprentice?.jobId);
    s = choose(
      s,
      item?.awaitingCollection && has(s, 'wait-appointment')
        ? 'wait-appointment'
        : has(s, 'arrange-learning')
          ? 'arrange-learning'
          : has(s, 'watch-sam')
            ? 'watch-sam'
            : has(s, 'wait-person')
              ? 'wait-person'
              : 'rest',
    );
  }
  expect(s.objects.find((o) => o.id === 'service-leila')?.location).toBe('returned');
  expect(s.objects.find((o) => o.id === 'service-leila')?.independent).toBe(true);
  s = choose(reach(s, 'service-hear-nora'), 'service-hear-nora');
  s = choose(s, 'service-accept-nora');

  // Sam can refuse a new 150-minute agreement immediately before his counter shift.
  expect(has(s, 'delegate-repair')).toBe(false);
  expect(s.objects.find((o) => o.id === 'service-nora')?.verified).toBe(false);
  s = choose(reach(s, 'service-delay-nora'), 'service-delay-nora');
  s = choose(reach(s, 'service-personal-session'), 'service-personal-session');
  expect(s.serviceWeek?.personalSession).toBe('spent');
  for (let n = 0; n < 80 && !has(s, 'delegate-repair'); n++)
    s = choose(
      s,
      has(s, 'arrange-learning')
        ? 'arrange-learning'
        : has(s, 'wait-appointment')
          ? 'wait-appointment'
          : 'rest',
    );
  s = choose(s, 'delegate-repair');
  for (let n = 0; n < 80 && s.apprentice?.jobId; n++) {
    const item = s.objects.find((o) => o.id === s.apprentice?.jobId);
    s = choose(
      s,
      item?.awaitingCollection && has(s, 'wait-appointment')
        ? 'wait-appointment'
        : has(s, 'arrange-learning')
          ? 'arrange-learning'
          : has(s, 'watch-sam')
            ? 'watch-sam'
            : has(s, 'wait-person')
              ? 'wait-person'
              : 'rest',
    );
  }
  const nora = s.objects.find((o) => o.id === 'service-nora');
  expect(nora?.verified).toBe(true);
  expect(nora?.independent).toBe(true);
  expect(s.serviceWeek?.jobs.every((j) => j.stage === 'returned')).toBe(true);
  expect(s.workshop?.cash).toBe(600);
  const promises = s.people.player?.agenda.commitments ?? [];
  expect(promises.find((c) => c.label === 'Checked collection: service-leila')?.status).toBe(
    'kept',
  );
  // Sam's own competing plans delay the second job beyond the renegotiated date.
  // This route deliberately does not overwrite a genuinely late promise as kept.
  const latestNora = promises.filter((c) => c.label === 'Checked collection: service-nora').at(-1);
  expect(nora?.collectedAt).toBeGreaterThan(latestNora?.until ?? Infinity);
  expect(latestNora?.status).toBe('broken');
  s = choose(reach(s, 'service-checking-place'), 'service-checking-place');
  expect(s.checkingPlaces).toBe(2);
  expect(s.workshop?.cash).toBe(0);
  while (!has(s, 'service-close-regular')) s = choose(s, 'service-next-day');
  s = choose(s, 'service-close-regular');
  expect(s.serviceWeek?.conclusion).toBe('regular');
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('changing only Nora’s agreed date changes the actual promise consequence under the same repair sequence', () => {
  let base = earnedHandoff();
  for (const id of [
    'service-begin',
    'service-regular',
    'service-find-model',
    'service-protect-session',
  ])
    base = choose(base, id);
  base = choose(reach(base, 'service-paid-help'), 'service-paid-help');
  base = choose(reach(base, 'service-hear-nora'), 'service-hear-nora');
  let early = choose(base, 'service-accept-nora');
  let later = choose(base, 'service-later-nora');
  expect(early.now).toBe(later.now);
  for (let n = 0; n < 100 && !has(early, 'delegate-repair'); n++) {
    const action = has(early, 'arrange-learning') ? 'arrange-learning' : 'rest';
    expect(has(later, action)).toBe(true);
    early = choose(early, action);
    later = choose(later, action);
  }
  early = choose(early, 'delegate-repair');
  later = choose(later, 'delegate-repair');
  for (let n = 0; n < 100 && early.apprentice?.jobId; n++) {
    const action = has(early, 'arrange-learning')
      ? 'arrange-learning'
      : has(early, 'watch-sam')
        ? 'watch-sam'
        : 'rest';
    expect(has(later, action)).toBe(true);
    early = choose(early, action);
    later = choose(later, action);
  }
  const first = early.objects.find((o) => o.id === 'service-nora');
  const second = later.objects.find((o) => o.id === 'service-nora');
  expect(first?.verified).toBe(true);
  expect(second?.verified).toBe(true);
  expect(first?.stepDecisions).toEqual(second?.stepDecisions);
  expect(first?.awaitingCollection).toBe(false);
  expect(second?.awaitingCollection).toBe(true);
  later = choose(later, 'wait-appointment');
  for (let n = 0; n < 10 && later.apprentice?.jobId; n++)
    later = choose(later, has(later, 'watch-sam') ? 'watch-sam' : 'rest');
  const promiseFor = (s: GameState) =>
    s.people.player?.agenda.commitments.find((c) => c.label === 'Checked collection: service-nora');
  expect(promiseFor(early)?.status).toBe('broken');
  expect(promiseFor(later)?.status).toBe('kept');
  expect(later.objects.find((o) => o.id === 'service-nora')?.awaitingCollection).toBe(false);
});

it('a two-day known donor wait keeps real routines but announces each quiet departure at most once', () => {
  let s = earnedHandoff();
  for (const id of ['service-begin', 'service-private', 'service-find-model']) s = choose(s, id);
  expect(s.conversation.at(-1)?.text).toContain('Evan — display stands and clockwork bases');
  s = choose(s, 'service-invite-donor');
  const before = s.now;
  const until = s.serviceWeek?.donorAt;
  if (!until) throw Error('Missing actual donor appointment');
  s = choose(s, 'wait-appointment');
  expect(s.now).toBe(until);
  expect(s.now - before).toBeGreaterThan(1440);
  const lines = s.conversation.filter((line) => line.id >= (s.eventStartId ?? 0));
  expect(
    lines.filter((line) => line.speaker === 'Mum' && line.text.includes('pray quietly')).length,
  ).toBeLessThanOrEqual(1);
  expect(
    lines.filter((line) => line.speaker === 'Sam' && line.text.includes('dog out now')).length,
  ).toBeLessThanOrEqual(1);
  expect(
    s.people.mum?.agenda.commitments.filter((c) => c.kind === 'worship' && c.status === 'kept')
      .length,
  ).toBeGreaterThan(1);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('priced whole-job delegation waits for an actual separate rate agreement, then pays once', () => {
  let s = earnedHandoff();
  for (const id of ['service-begin', 'service-regular']) s = choose(s, id);
  s = choose(reach(s, 'service-hear-leila'), 'service-hear-leila');
  s = choose(s, 'service-accept-leila');
  s = choose(reach(s, 'arrange-learning'), 'arrange-learning');
  expect(has(s, 'delegate-repair')).toBe(false);
  expect(getView(s).actions.find((a) => a.id === 'service-paid-help')?.kind).toBe('primary');
  expect(s.objects.find((o) => o.id === 'service-leila')?.assignedTo).toBeUndefined();
  for (let n = 0; n < 40 && !s.serviceWeek?.paidHelp; n++) {
    s = choose(reach(s, 'service-paid-help'), 'service-paid-help');
    if (!s.serviceWeek?.paidHelp) s = choose(s, 'rest');
  }
  expect(s.serviceWeek?.paidHelp).toBe(true);
  if (!has(s, 'delegate-repair')) s = choose(reach(s, 'arrange-learning'), 'arrange-learning');
  s = choose(s, 'delegate-repair');
  for (let n = 0; n < 160 && s.apprentice?.jobId; n++)
    s = choose(
      s,
      has(s, 'wait-appointment')
        ? 'wait-appointment'
        : has(s, 'arrange-learning')
          ? 'arrange-learning'
          : has(s, 'watch-sam')
            ? 'watch-sam'
            : 'rest',
    );
  expect(s.objects.find((o) => o.id === 'service-leila')?.independent).toBe(true);
  expect(s.workshop?.ledger.filter((entry) => entry.kind === 'sam-pay')).toHaveLength(1);
  expect(s.workshop?.cash).toBe(300);
  s = choose(s, 'rest');
  expect(s.workshop?.ledger.filter((entry) => entry.kind === 'sam-pay')).toHaveLength(1);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('a future agreed Nora visit keeps its known purpose through her intervening ordinary morning', () => {
  let s = earnedHandoff();
  for (const id of ['service-begin', 'service-regular', 'service-next-day']) s = choose(s, id);
  const before = getView(s).knownAppointments?.find((a) => a.personId === 'nora');
  expect(before?.at).toBeGreaterThan(s.now);
  expect(before?.detail).toContain('cutting-table');
  s = choose(s, 'rest');
  const after = getView(s).knownAppointments?.find((a) => a.personId === 'nora');
  expect(after?.at).toBe(before?.at);
  expect(after?.detail).toContain('cutting-table');
  expect(after?.detail).not.toContain('Busy at home');
  expect(after?.detail).not.toContain('in 1 days');
  expect(restoreGame(serializeGame(s))).toEqual(s);
});

it('renewing Sam’s whole-job work preserves responsibility without granting extra learning', () => {
  let s = earnedHandoff();
  for (const id of ['service-begin', 'service-regular']) s = choose(s, id);
  s = choose(reach(s, 'service-paid-help'), 'service-paid-help');
  s = choose(reach(s, 'service-hear-leila'), 'service-hear-leila');
  s = choose(s, 'service-accept-leila');
  if (!has(s, 'delegate-repair')) s = choose(reach(s, 'arrange-learning'), 'arrange-learning');
  s = choose(s, 'delegate-repair');
  // A matched state immediately at the end of this agreement: actual saved
  // repair and learned rules remain unchanged; the next agreement is voluntary.
  if (!s.apprentice) throw Error('Missing actual Sam assignment');
  s.apprentice.visitUntil = s.now;
  const methods = structuredClone(s.people.sam?.methods),
    skill = structuredClone(s.people.sam?.skills);
  const agreementOnly = structuredClone(s);
  arrangeLearning(agreementOnly, () => {});
  expect(agreementOnly.people.sam?.skills).toEqual(skill);
  for (let n = 0; n < 30 && s.apprentice?.visitUntil === s.now; n++) {
    const before = s.now;
    s = choose(s, 'arrange-learning');
    if ((s.apprentice?.visitUntil ?? 0) > before) break;
    s = choose(s, 'rest');
  }
  expect(s.apprentice?.jobId).toBe('service-leila');
  expect(s.apprentice?.role).toBe('repairer');
  expect(s.people.sam?.methods?.rules).toEqual(methods?.rules);
  expect(s.people.sam?.methods?.recentDemonstrations).toEqual(methods?.recentDemonstrations);
  // The public action also gives the real repair four elapsed minutes. Its
  // ordinary HF practice is permitted; the agreement itself grants none.
  expect(
    (s.people.sam?.skills.repair?.practice ?? 0) - (skill?.repair?.practice ?? 0),
  ).toBeLessThanOrEqual(4);
  expect(s.conversation.map((line) => line.text).join(' ')).toContain(
    'continue from the labelled observations',
  );
});

it('a new bench agreement also preserves an established independent repairer without an active job', () => {
  let s = earnedHandoff();
  const completed = structuredClone(s.apprentice?.completedJobIds);
  for (let n = 0; n < 30; n++) {
    s = choose(reach(s, 'arrange-learning'), 'arrange-learning');
    if ((s.apprentice?.visitUntil ?? 0) > s.now) break;
    s = choose(s, 'rest');
  }
  expect(s.apprentice?.jobId).toBeUndefined();
  expect(s.apprentice?.role).toBe('repairer');
  expect(s.apprentice?.completedJobIds).toEqual(completed);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
