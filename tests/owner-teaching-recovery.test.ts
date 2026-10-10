import { begin, createPerson, decide, finish, promise, tick } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import {
  advanceApprentice,
  arrangeLearning,
  explainLesson,
  freshApprentice,
  pendingCorrectiveDemonstration,
  prepareCorrectiveDemonstration,
  recordLesson,
  startApprenticeJob,
} from '../src/game/apprentice';
import { createGame, getView, restoreGame, transition } from '../src/game/engine';
import * as thirteen from '../src/game/engine13';
import { inspectRepair, performActiveBellCheck, readLongCheck } from '../src/game/repairs';
import type { GameInput, RepairObject } from '../src/game/types';
import fixture from './fixtures/owner-thirteen-school-apprentice-route.json';
import { positiveAction } from './support/public-attendance';

function actualOwner() {
  let s = thirteen.createGame(fixture.seed);
  for (const input of fixture.inputs) s = thirteen.transition(s, input as GameInput);
  return restoreGame(thirteen.serializeGame(s));
}
it('recovers the actual stopped owner repair through physical attended teaching, with a withheld watching control', () => {
  let s = actualOwner();
  expect(getView(s).actions.some((x) => x.id === 'show-corrective-step')).toBe(true);
  s = transition(s, { type: 'action', id: 'show-corrective-step' });
  const prepared = structuredClone(s);
  expect(getView(s).actions.some((x) => x.id === 'supervised-repair')).toBe(false);
  expect(() => transition(s, { type: 'action', id: 'supervised-repair' })).toThrow('not available');
  expect(s.objects.find((x) => x.id === s.focusId)?.repaired).toBe(false);
  expect(s).toEqual(prepared);
  expect(s.unlocked).toContain(`corrective-demonstration:${s.focusId}`);
  let withheld = structuredClone(s);
  const absent = withheld.people.sam;
  if (!absent?.activity) throw Error('Missing actual watching activity');
  finish(absent, {
    affordanceId: absent.activity.affordanceId,
    action: absent.activity.action,
    at: absent.now,
    status: 'interrupted',
    summary: 'Matched control stops watching before the physical contact work',
  });
  withheld = transition(withheld, { type: 'action', id: 'clean-contact' });
  expect(withheld.objects.find((item) => item.id === withheld.focusId)?.repaired).toBe(true);
  expect(withheld.apprentice?.lastLesson?.step).not.toBe('clean-contact');
  expect(withheld.people.sam?.methods?.rules.some((rule) => rule.action === 'clean-contact')).toBe(
    false,
  );
  s = transition(s, { type: 'action', id: 'clean-contact' });
  expect(s.unlocked).not.toContain(`corrective-demonstration:${s.focusId}`);

  const shown = s.objects.find((x) => x.id === s.focusId);
  if (!shown) throw Error('Missing corrected owner light');
  expect(shown.repaired).toBe(true);
  expect(shown.playerAssisted).toBe(true);
  expect(shown.independent).toBe(false);
  expect(s.apprentice?.lastLesson?.step).toBe('clean-contact');
  expect(s.apprentice?.lastLesson?.success).toBe(true);
  expect(s.apprentice?.lastLesson?.learnedAutomatically).toBe(true);
  const watchedMethods = structuredClone(s.people.sam?.methods);
  s = transition(s, { type: 'action', id: 'explain-step' });
  expect(s.people.sam?.methods).toEqual(watchedMethods);
  expect(s.unlocked).not.toContain(`corrective-demonstration:${s.focusId}`);
  for (const [state, expected] of [
    [s, true],
    [withheld, false],
  ] as const) {
    const item: RepairObject = {
      ...structuredClone(shown),
      id: 'transfer-contact',
      repaired: false,
      verified: false,
      attempted: 0,
      assignedTo: undefined,
      location: 'bench',
      evidence: ['still-flickers'],
      checkStarted: undefined,
    };
    state.objects.push(item);
    startApprenticeJob(state, item, true, () => {});
    advanceApprentice(
      state,
      (state.people.sam?.now ?? state.now) + 16,
      () => {},
      () => true,
    );
    expect(item.repaired).toBe(expected);
    if (!expected) expect(state.apprentice?.needsHelp).toBeTruthy();
  }
}, 30_000);
it('describes the actually failed replacement without asserting successful contact teaching', () => {
  const s = actualOwner();
  const lesson = s.apprentice?.lastLesson;
  if (!lesson) throw Error('Missing actual failed lesson');
  lesson.explained = false;
  const words: string[] = [];
  explainLesson(s, (_speaker, text) => words.push(text), true);
  expect(words.join(' ')).toContain(
    'replacing the old battery did not establish a successful result',
  );
  expect(words.join(' ')).not.toContain('Restore the contact instead');
}, 30_000);
it('requires active five-minute ringing rather than idle elapsed time', () => {
  const bell = {
    form: 'bell',
    fault: 'striker',
    repaired: true,
    verified: false,
    checkStarted: 10,
    evidence: [],
  } as unknown as RepairObject;
  expect(() => readLongCheck(bell, 1000)).toThrow('attended');
  expect(() => performActiveBellCheck(bell, 1000, 1004)).toThrow('incomplete');
  expect(bell.verified).toBe(false);
  expect(performActiveBellCheck(bell, 1000, 1005)).toContain('ring the bell repeatedly');
  expect(bell.verified).toBe(true);
});

it('keeps Sam on a stronger actual promise when he declines watching the correction', () => {
  const s = actualOwner();
  const sam = s.people.sam;
  if (!sam) throw Error('Missing Sam');
  if (sam.activity)
    finish(sam, {
      affordanceId: sam.activity.affordanceId,
      action: sam.activity.action,
      at: sam.now,
      status: 'interrupted',
      summary: 'Control begins a promised check-in',
    });
  const duty = promise(sam, {
    kind: 'promise',
    toId: 'mum',
    actions: ['check-in'],
    from: sam.now,
    until: sam.now + 30,
    importance: 1,
  });
  const own = {
    id: 'promised-check-in',
    action: 'check-in',
    label: 'Keeping the promised check-in',
    duration: 30,
    effort: 0,
    fulfills: [duty.id],
    with: ['mum'],
    advertises: { belonging: 0.1 },
  };
  begin(sam, own, decide(sam, [own]));
  const prior = structuredClone(sam.activity);
  const job = s.apprentice?.jobId;
  const lines: string[] = [];
  prepareCorrectiveDemonstration(s, (_who, text) => lines.push(text));
  expect(sam.activity).toEqual(prior);
  expect(s.apprentice?.jobId).toBe(job);
  expect(s.apprentice?.needsHelp).toBeTruthy();
  expect(lines.join(' ')).toContain('until');
  expect(s.conversationPause?.activityId).toBe(own.id);
}, 30_000);

it('spends five active player minutes on a fresh bell after preparation and preserves finished historical bells', () => {
  let s = createGame(76);
  s.chapter = 'garage';
  const bell: RepairObject = {
    id: 'fresh-bell',
    title: 'A small bell',
    owner: 'You',
    story: 'A shifted striker',
    form: 'bell',
    fault: 'striker',
    location: 'bench',
    observations: [],
    inspected: true,
    tested: false,
    attempted: 1,
    repaired: true,
    verified: false,
    discovered: true,
    evidence: ['light-steady'],
  };
  s.objects.push(bell);
  s.focusId = bell.id;
  s = transition(s, { type: 'action', id: 'verify' });
  if (getView(s).actions.some((x) => x.id === 'wait-check'))
    s = transition(s, { type: 'action', id: 'wait-check' });
  const at = s.now;
  s = transition(s, { type: 'action', id: 'check-result' });
  expect(s.now - at).toBe(5);
  expect(s.objects.find((x) => x.id === bell.id)?.verified).toBe(true);
  expect(s.journal?.at(-1)?.text).toContain('ring the bell repeatedly');
  expect(
    actualOwner().objects.filter((x) => x.form === 'bell' && x.verified).length,
  ).toBeGreaterThan(0);
}, 30_000);

it('records a physical demonstration only during complete actual watching, not nearby rest or a partial session', () => {
  const s = createGame(42);
  s.people.sam = createPerson({
    id: 'sam',
    name: 'Sam',
    seed: 42,
    now: s.now,
    sex: 'male',
    bornAt: s.now - 18 * 365 * 1440,
  });
  s.apprentice = { ...freshApprentice(), arranged: true, visitUntil: s.now + 150 };
  const item: RepairObject = {
    id: 'observed-light',
    title: 'A light',
    owner: 'You',
    story: 'Contact work',
    form: 'lamp',
    fault: 'contact',
    location: 'bench',
    observations: ['It stays steady after the contact repair'],
    inspected: true,
    tested: true,
    attempted: 1,
    repaired: true,
    verified: false,
    discovered: true,
  };
  s.objects.push(item);
  const sam = s.people.sam;
  if (!item || !sam) throw Error('Missing teaching controls');
  const rest = {
    id: 'ordinary-rest',
    action: 'rest',
    label: 'Resting',
    duration: 30,
    effort: 0,
    advertises: { rest: 0.1 },
  };
  begin(sam, rest, decide(sam, [rest]));
  recordLesson(s, item, 'clean-contact', 'still-flickers', true, 12, true);
  expect(s.apprentice.lastLesson).toBeUndefined();
  finish(sam, {
    affordanceId: rest.id,
    action: rest.action,
    at: sam.now,
    status: 'completed',
    summary: 'Finished resting',
  });
  const watching = {
    id: 'watch-repair',
    action: 'learn',
    label: 'Watching actual contact work',
    duration: 30,
    effort: 0,
    advertises: { competence: 0.03 },
  };
  const shortWatch = { ...watching, duration: 2 };
  begin(sam, shortWatch, decide(sam, [shortWatch]));
  s.unlocked.push(`corrective-demonstration:${item.id}`);
  s.now += 12;
  tick(sam, s.now);
  recordLesson(s, item, 'clean-contact', 'still-flickers', true, 12, true);
  expect(s.apprentice.lastLesson).toBeUndefined();
  expect(pendingCorrectiveDemonstration(s)).toBeUndefined();
  expect(sam.methods?.rules.length ?? 0).toBe(0);
  finish(sam, {
    affordanceId: watching.id,
    action: watching.action,
    at: sam.now,
    status: 'completed',
    summary: 'The short watching session ended before the repair result.',
  });
  begin(sam, watching, decide(sam, [watching]));
  s.now += 4;
  tick(sam, s.now);
  recordLesson(s, item, 'clean-contact', 'still-flickers', true, 12, true);
  expect(s.apprentice.lastLesson).toBeUndefined();
  s.now += 8;
  tick(sam, s.now);
  recordLesson(s, item, 'clean-contact', 'still-flickers', true, 12, true);
  expect(s.apprentice.lastLesson?.step).toBe('clean-contact');
  expect(s.apprentice.lastLesson?.explained).toBe(false);
  expect(s.apprentice.lastLesson?.learnedAutomatically).toBe(true);
  expect(sam.methods?.rules.some((rule) => rule.action === 'clean-contact')).toBe(true);
  const kept = structuredClone(s.apprentice.lastLesson);
  const another: RepairObject = {
    ...structuredClone(item),
    id: 'another-observed-light',
    inspected: false,
    repaired: false,
    observations: [],
  };
  s.objects.push(another);
  another.observations.push(inspectRepair(another));
  s.now += 4;
  tick(sam, s.now);
  recordLesson(s, another, 'inspect', 'intake', true, 4, true);
  expect(another.inspected).toBe(true);
  expect(s.apprentice.lastLesson?.step).toBe('inspect');
  expect(s.apprentice.lastLesson?.eventId).not.toBe(kept?.eventId);
  expect(sam.methods?.rules.some((rule) => rule.action === 'inspect')).toBe(true);
  expect(sam.methods?.rules.some((rule) => rule.action === 'clean-contact')).toBe(true);
});

it('learns consecutive witnessed steps without explanation and closes the corrective episode before collection', () => {
  let s = actualOwner();
  s = transition(s, { type: 'action', id: 'show-corrective-step' });
  s = transition(s, { type: 'action', id: 'clean-contact' });
  const witnessed = structuredClone(s.apprentice?.lastLesson);
  expect(witnessed?.learnedAutomatically).toBe(true);
  expect(witnessed?.explained).toBe(false);
  s = transition(s, { type: 'action', id: 'verify' });
  expect(s.apprentice?.lastLesson).toMatchObject({
    step: 'verify',
    learnedAutomatically: true,
    explained: false,
  });
  expect(s.people.sam?.methods?.rules.some((rule) => rule.action === 'clean-contact')).toBe(true);
  expect(s.people.sam?.methods?.rules.some((rule) => rule.action === 'verify')).toBe(true);
  expect(pendingCorrectiveDemonstration(s)).toBeUndefined();
  expect(s.unlocked).not.toContain(`corrective-demonstration:${witnessed?.objectId}`);
  for (let n = 0; n < 20 && getView(s).actions.some((x) => x.id === 'wait-check'); n++)
    s = positiveAction(s, 'wait-check');
  s = transition(s, { type: 'action', id: 'check-result' });
  s = transition(s, { type: 'action', id: 'return' });
  expect(pendingCorrectiveDemonstration(s)).toBeUndefined();
  expect(s.objects.find((item) => item.id === witnessed?.objectId)).toMatchObject({
    location: 'returned',
    verified: true,
    independent: false,
  });
  expect(s.people.sam?.methods?.rules.some((rule) => rule.action === 'clean-contact')).toBe(true);
}, 30_000);

it('closes a pending watching invitation only after a genuinely accepted renewed stretch', () => {
  const s = actualOwner();
  s.samPlans = { invitation: 'pending', heardAt: s.now };
  const prior = s.apprentice?.visitUntil ?? 0;
  arrangeLearning(s, () => {});
  expect(s.apprentice?.visitUntil).toBeGreaterThan(prior);
  expect(s.samPlans.invitation).toBe('accepted');
  const sam = s.people.sam;
  if (!sam) throw Error('Missing Sam');
  if (sam.activity)
    finish(sam, {
      affordanceId: sam.activity.affordanceId,
      action: sam.activity.action,
      at: sam.now,
      status: 'interrupted',
      summary: 'Control starts an actual promise',
    });
  const duty = promise(sam, {
    kind: 'promise',
    toId: 'mum',
    actions: ['check-in'],
    from: sam.now,
    until: sam.now + 30,
    importance: 1,
  });
  const own = {
    id: 'promised-check-in',
    action: 'check-in',
    label: 'Keeping the promised check-in',
    duration: 30,
    effort: 0,
    fulfills: [duty.id],
    with: ['mum'],
    advertises: { belonging: 0.1 },
  };
  begin(sam, own, decide(sam, [own]));
  const deadline = s.apprentice?.visitUntil;
  s.samPlans.invitation = 'pending';
  arrangeLearning(s, () => {});
  expect(s.samPlans.invitation).toBe('pending');
  expect(s.apprentice?.visitUntil).toBe(deadline);
  expect(sam.activity?.affordanceId).toBe(own.id);
}, 30_000);
it('explains the actual start-of-run demonstration in past tense when the repair check has since finished', () => {
  let s = actualOwner();
  for (const id of ['show-corrective-step', 'clean-contact', 'explain-step', 'verify'])
    s = transition(s, { type: 'action', id });
  const start = s.apprentice?.lastLesson;
  expect(start?.step).toBe('verify');
  for (let n = 0; n < 20 && getView(s).actions.some((x) => x.id === 'wait-check'); n++)
    s = positiveAction(s, 'wait-check');
  s = transition(s, { type: 'action', id: 'check-result' });
  expect(s.objects.find((x) => x.id === s.focusId)?.verified).toBe(true);
  s = transition(s, { type: 'action', id: 'explain-step' });
  expect(s.apprentice?.lastLesson?.eventId).toBe(start?.eventId);
  const words =
    s.journal
      ?.slice(-2)
      .map((x) => x.text)
      .join(' ') ?? '';
  expect(words).toContain('At that step');
  expect(words).toContain('You started its longer run');
  expect(words).not.toContain('not yet a long check');
}, 30_000);

it('keeps real stopped work prominent instead of repeating an already agreed invitation', () => {
  const s = actualOwner();
  s.samPlans = { invitation: 'pending', heardAt: s.now - 60 };
  const view = getView(s);
  expect(view.actions.some((a) => a.id === 'show-corrective-step')).toBe(true);
  expect(view.actions.some((a) => a.id === 'resume-observer-invite')).toBe(false);
  expect(view.dayPlan?.entries.some((e) => e.id === 'sam-invitation')).toBe(false);
  expect(view.dayPlan?.entries[0]?.id).toBe('sam-work');
  expect(view.dayPlan?.entries[0]?.actionIds).toContain('show-corrective-step');
}, 30_000);

it('the observed tired battery offers a real demonstration, consumes one cell only on work, and learns only while watched', () => {
  let s = createGame(17);
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.unlocked.push('story:observer-invite');
  const item: RepairObject = {
    id: 'battery-teaching-control',
    title: 'A stopped porch light',
    owner: 'Nora',
    story: 'A retained stopped repair',
    form: 'lamp',
    fault: 'battery',
    location: 'bench',
    observations: ['The known-good cell shines steadily.'],
    evidence: ['battery-steady'],
    inspected: true,
    tested: true,
    attempted: 0,
    repaired: false,
    verified: false,
    discovered: true,
    assignedTo: 'sam',
    access: {
      kind: 'lamp',
      state: 'open',
      revision: 1,
      retainedPieceIds: ['battery-teaching-control:cover'],
      workMarkers: [],
      events: [],
    },
  };
  s.objects.push(item);
  s.focusId = item.id;
  s.apprentice = {
    ...freshApprentice(),
    arranged: true,
    visitUntil: s.now + 150,
    jobId: item.id,
    needsHelp: 'I do not know a method for this observation.',
  };
  const before = s.parts.batteries;
  expect(getView(s).actions.some((a) => a.id === 'show-corrective-step')).toBe(true);
  expect(getView(s).actions.some((a) => a.id === 'reconsider-sam')).toBe(false);
  s = transition(s, { type: 'action', id: 'show-corrective-step' });
  expect(s.apprentice?.jobId).toBeUndefined();
  expect(s.parts.batteries).toBe(before);
  expect(s.objects.find((o) => o.id === item.id)?.repaired).toBe(false);
  const withheld = structuredClone(s),
    sam = withheld.people.sam;
  if (!sam?.activity) throw Error('Missing real watch');
  finish(sam, {
    affordanceId: sam.activity.affordanceId,
    action: sam.activity.action,
    at: sam.now,
    status: 'interrupted',
    summary: 'Watching withheld before physical change',
  });
  const unwatched = transition(withheld, { type: 'action', id: 'replace-battery' });
  s = transition(s, { type: 'action', id: 'replace-battery' });
  expect(s.parts.batteries).toBe(before - 1);
  expect(s.objects.find((o) => o.id === item.id)).toMatchObject({
    repaired: true,
    verified: false,
    playerAssisted: true,
    independent: false,
  });
  expect(s.apprentice?.lastLesson).toMatchObject({
    step: 'replace-battery',
    learnedAutomatically: true,
  });
  expect(unwatched.apprentice?.lastLesson?.step).not.toBe('replace-battery');
});
