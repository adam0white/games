import { type Affordance, begin, decide, finish, promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import { freshOperations } from '../src/game/operations';
import { freshServiceWeek } from '../src/game/service-week';
import type { GameState } from '../src/game/types';
import { freshWorkshop } from '../src/game/workshop';

const act = (s: GameState, id: string) => {
  if (!getView(s).actions.some((a) => a.id === id))
    throw Error(
      id +
        ' unavailable: ' +
        getView(s)
          .actions.map((a) => a.id)
          .join(','),
    );
  return transition(s, { type: 'action', id });
};
function fixture() {
  const s = createGame(17);
  s.chapter = 'garage';
  if (s.campaign) s.campaign.graduated = true;
  s.unlocked.push('story:observer-invite');
  return s;
}
const steps = [
  'inspect',
  'test-mechanical-empty',
  'test-mechanical-loaded',
  'open-access',
  'clear-obstruction',
  'reassemble',
  'check-result',
  'return',
];
it('the finite stand uses actual comparison, retained access and a complete circuit', () => {
  let s = act(fixture(), 'mechanical-intake-stand');
  for (const id of steps) {
    expect(
      getView(s).actions.some((a) => a.id === id),
      id,
    ).toBe(true);
    s = act(s, id);
  }
  expect(s.objects.find((x) => x.id === 'mechanical-stand')).toMatchObject({
    verified: true,
    location: 'returned',
    mechanicalDisplay: { cleared: true, checked: true },
  });
});
it('watched explanations teach distinct mechanical choices', () => {
  let s = act(fixture(), 'mechanical-intake-stand');
  for (let n = 0; n < 12 && !s.apprentice?.arranged; n++) {
    s = act(s, 'arrange-learning');
    if (!s.apprentice?.arranged) s = act(s, 'rest');
  }
  expect(s.apprentice?.arranged).toBe(true);
  for (const id of steps) {
    s = act(s, id);
    expect(
      getView(s).actions.some((a) => a.id === 'explain-step'),
      id,
    ).toBe(true);
    s = act(s, 'explain-step');
  }
  expect(
    s.people.sam?.methods?.rules.filter((r) =>
      r.conditions.some((c) => String(c.value).startsWith('mechanical-')),
    ).length,
  ).toBe(8);
});
it('transfers the actually taught method to Evan’s different untouched carousel', () => {
  let s = act(fixture(), 'mechanical-intake-stand');
  s = act(s, 'arrange-learning');
  for (const id of steps) {
    s = act(s, id);
    s = act(s, 'explain-step');
  }
  s = act(s, 'mechanical-invite-evan');
  s = act(s, 'rest');
  s = act(s, 'mechanical-intake-carousel');
  expect(s.objects.find((x) => x.id === 'mechanical-carousel')).toBeDefined();
  const before = s.journal?.length ?? 0;
  const priorMethods = structuredClone(s.people.sam?.methods?.rules);
  s = act(s, 'delegate-repair');
  for (let i = 0; i < 12 && s.apprentice?.jobId && !s.apprentice.needsHelp; i++)
    s = act(s, 'watch-sam');
  expect(s.objects.find((x) => x.id === 'mechanical-carousel')).toMatchObject({
    verified: true,
    location: 'returned',
    completedBy: 'sam',
    independent: true,
  });
  const work = s.objects.find((x) => x.id === 'mechanical-carousel')?.mechanicalDisplay?.events;
  const samLines = (s.journal ?? []).slice(before).filter((line) => line.speaker === 'Sam');
  expect(samLines.some((line) => line.text.startsWith('You '))).toBe(false);
  for (const [action, opening] of [
    ['test-mechanical-empty', 'I set Evan’s four parts cards'],
    ['clear-obstruction', 'I remove the observed folded card scrap'],
  ]) {
    const event = work?.find((entry) => entry.action === action && entry.actor === 'sam');
    expect(event, action).toBeDefined();
    expect(samLines.some((line) => line.text.startsWith(opening ?? ''))).toBe(true);
  }
  expect(s.people.sam?.methods?.rules).toEqual(priorMethods);
});
function taughtTransfer() {
  let s = act(fixture(), 'mechanical-intake-stand');
  s = act(s, 'arrange-learning');
  for (const id of steps) {
    s = act(s, id);
    s = act(s, 'explain-step');
  }
  s = act(s, 'mechanical-invite-evan');
  s = act(s, 'rest');
  return act(s, 'mechanical-intake-carousel');
}
it('withheld mechanical teaching and skill alone do not select the repair sequence', () => {
  for (const skilled of [false, true]) {
    let s = taughtTransfer();
    const sam = s.people.sam;
    if (!sam?.methods) throw Error('Missing learned actor');
    sam.methods.rules = sam.methods.rules.filter(
      (r) => !r.conditions.some((c) => String(c.value).startsWith('mechanical-')),
    );
    if (skilled && sam.skills.repair) sam.skills.repair.level = 1;
    s = act(s, 'delegate-repair');
    s = act(s, 'watch-sam');
    expect(s.apprentice?.needsHelp).toBeTruthy();
    expect(s.objects.find((x) => x.id === 'mechanical-carousel')).toMatchObject({
      verified: false,
    });
  }
});
it('the related missing drive stops at observed exception without guessed parts or useless circuit', () => {
  let s = taughtTransfer();
  const variant = s.objects.find((x) => x.id === 'mechanical-carousel');
  if (!variant) throw Error('Missing held-out object');
  variant.fault = 'gear';
  s = act(s, 'delegate-repair');
  for (let i = 0; i < 12 && s.apprentice?.jobId && !s.apprentice.needsHelp; i++)
    s = act(s, 'watch-sam');
  const o = s.objects.find((x) => x.id === 'mechanical-carousel');
  expect(s.apprentice?.needsHelp).toBeTruthy();
  expect(o?.mechanicalDisplay?.observed).toBe('missing-drive-part');
  expect(o?.mechanicalDisplay?.events.some((e) => e.action === 'check-result')).toBe(false);
  expect(o?.verified).toBe(false);
});
it('an existing paid arrangement is conserved by the separately agreed learning favour', () => {
  let s = taughtTransfer();
  s.operations = {
    ...freshOperations(s.now),
    samPaidHelp: true,
    jobs: [{ id: 'existing-paid-work', stage: 'accepted', fee: 500, samWageReserved: 200 }],
  };
  s.workshop = { ...freshWorkshop(), cash: 800 };
  const paid = structuredClone(s.operations);
  const cash = s.workshop?.cash;
  s = act(s, 'delegate-repair');
  expect(s.operations).toEqual(paid);
  expect(s.workshop?.cash).toBe(cash);
  expect(s.conversation.map((x) => x.text).join(' ')).toContain('It’s my practice afternoon');
  for (let i = 0; i < 12 && s.apprentice?.jobId && !s.apprentice.needsHelp; i++)
    s = act(s, 'watch-sam');
  expect(s.objects.find((o) => o.id === 'mechanical-carousel')?.completedBy).toBe('sam');
  expect(s.operations).toEqual(paid);
  expect(s.workshop?.cash).toBe(800);
});

it('mechanical observations require actual attention and preserve state when interrupted', () => {
  const base = act(act(fixture(), 'mechanical-intake-stand'), 'inspect');
  for (const late of [false, true]) {
    const s = structuredClone(base),
      p = s.people.player;
    if (!p) throw Error('Missing player');
    const c = promise(p, {
      kind: late ? 'appointment' : 'promise',
      toId: 'mum',
      actions: ['check-in'],
      from: s.now + (late ? 2 : 0),
      until: s.now + (late ? 3 : 60),
      importance: 1,
      label: 'Promised check-in',
    });
    if (!late) {
      const offer: Affordance = {
        id: 'prior-check-in',
        action: 'check-in',
        label: 'Keep promised check-in',
        duration: 60,
        effort: 0,
        fulfills: [c.id],
        advertises: { belonging: 0.3 },
      };
      begin(p, offer, decide(p, [offer]));
    }
    const after = act(s, 'test-mechanical-empty');
    expect(after.objects).toEqual(s.objects);
    expect(after.parts).toEqual(s.parts);
    expect(after.now - s.now).toBe(late ? 2 : 0);
    if (!late) expect(after.people.player?.activity).toEqual(p.activity);
  }
  const yes = act(base, 'test-mechanical-empty');
  expect(yes.now - base.now).toBe(4);
  expect(
    yes.objects.find((o) => o.id === 'mechanical-stand')?.mechanicalDisplay?.emptyObserved,
  ).toBe(true);
});

it('a failed attended circuit is not successful teaching or a checked result', () => {
  let s = act(fixture(), 'mechanical-intake-stand');
  s = act(s, 'arrange-learning');
  for (const id of ['inspect', 'test-mechanical-empty', 'test-mechanical-loaded']) {
    s = act(s, id);
    s = act(s, 'explain-step');
  }
  s = act(s, 'check-result');
  expect(s.apprentice?.lastLesson?.success).toBe(false);
  expect(s.objects.find((o) => o.id === 'mechanical-stand')?.verified).toBe(false);
  s = act(s, 'explain-step');
  expect(
    s.people.sam?.methods?.rules.some(
      (r) => r.action === 'check-result' && r.evidence.some((e) => e.outcome === 'success'),
    ),
  ).toBe(false);
});
it('Sam cannot complete custody transfer through an owner’s stronger activity', () => {
  let s = taughtTransfer();
  s = act(s, 'delegate-repair');
  const evan = s.people.evan;
  if (!evan) throw Error('Missing owner');
  const c = promise(evan, {
    kind: 'promise',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now,
    until: s.now + 180,
    importance: 1,
    label: 'Promised check-in',
  });
  const offer: Affordance = {
    id: 'owner-check-in',
    action: 'check-in',
    label: 'Keep my earlier check-in',
    duration: 180,
    effort: 0,
    fulfills: [c.id],
    advertises: { belonging: 0.3 },
  };
  begin(evan, offer, decide(evan, [offer]));
  const prior = structuredClone(evan.activity);
  for (let i = 0; i < 12 && s.apprentice?.jobId && !s.apprentice.needsHelp; i++)
    s = act(s, 'watch-sam');
  const item = s.objects.find((x) => x.id === 'mechanical-carousel');
  expect(item?.verified).toBe(true);
  expect(item?.collectedAt).toBeUndefined();
  expect(item?.completedBy).toBeUndefined();
  expect(item?.location).toBe('bench');
  expect(s.people.evan?.activity?.affordanceId).toBe(prior?.affordanceId);
  expect(s.apprentice?.needsHelp).toContain('owner');
});
it('Sam’s mechanical choices progress while the player makes a retained personal insert', () => {
  let s = taughtTransfer();
  s.operations = { ...freshOperations(s.now), route: 'private' };
  s.serviceWeek = { ...freshServiceWeek(), conclusion: 'small' };
  s = act(s, 'find-paper-street');
  s = act(s, 'operations-personal-open');
  s = act(s, 'operations-personal-measure');
  s = transition(s, { type: 'select', id: 'mechanical-carousel' });
  for (let i = 0; i < 60 && !s.apprentice?.jobId; i++) {
    if (getView(s).actions.some((a) => a.id === 'delegate-repair')) s = act(s, 'delegate-repair');
    if (s.apprentice?.jobId) break;
    const wait = getView(s).actions.find((a) => /Sam’s usual free time/.test(a.label));
    s = act(
      s,
      wait?.id ?? (getView(s).actions.some((a) => a.id === 'wait-person') ? 'wait-person' : 'rest'),
    );
    if (getView(s).actions.some((a) => a.id === 'arrange-learning')) s = act(s, 'arrange-learning');
  }
  expect(
    s.apprentice?.jobId,
    JSON.stringify({
      a: s.apprentice,
      focus: s.focusId,
      offers: getView(s).actions.map((a) => a.id),
      lines: s.conversation.slice(-3),
    }),
  ).toBe('mechanical-carousel');
  const before = s.now;
  s = act(s, 'operations-personal-make-insert');
  expect(s.now - before).toBe(25);
  expect(s.operations?.personalProject?.insert).toBe('retained');
  const item = s.objects.find((o) => o.id === 'mechanical-carousel');
  expect(item?.mechanicalDisplay?.events.length).toBeGreaterThan(0);
  expect(item?.playerAssisted).toBeFalsy();
  for (let i = 0; i < 60 && s.apprentice?.jobId && !s.apprentice.needsHelp; i++) {
    const offers = getView(s).actions;
    if (offers.some((a) => a.id === 'arrange-learning')) s = act(s, 'arrange-learning');
    const current = getView(s).actions;
    s = act(
      s,
      current.some((a) => a.id === 'watch-sam')
        ? 'watch-sam'
        : current.some((a) => a.id === 'wait-person')
          ? 'wait-person'
          : 'rest',
    );
  }
  expect(s.objects.find((o) => o.id === 'mechanical-carousel')).toMatchObject({
    verified: true,
    completedBy: 'sam',
    independent: true,
  });
});
it('the finite third public request reveals its missing part and allows honest retained return', () => {
  let s = taughtTransfer();
  s = act(s, 'delegate-repair');
  for (let i = 0; i < 12 && s.apprentice?.jobId && !s.apprentice.needsHelp; i++)
    s = act(s, 'watch-sam');
  for (let i = 0; i < 40 && !s.objects.some((o) => o.id === 'mechanical-missing'); i++) {
    const offers = getView(s).actions;
    if (offers.some((a) => a.id === 'mechanical-intake-missing')) {
      s = act(s, 'mechanical-intake-missing');
      continue;
    }
    if (offers.some((a) => a.id === 'mechanical-invite-evan')) s = act(s, 'mechanical-invite-evan');
    s = act(s, 'wait-person');
  }
  expect(s.objects.some((o) => o.id === 'mechanical-missing')).toBe(true);
  for (const id of [
    'inspect',
    'test-mechanical-empty',
    'test-mechanical-loaded',
    'open-access',
    'reassemble',
  ])
    s = act(s, id);
  const before = s.objects.find((o) => o.id === 'mechanical-missing');
  expect(before?.mechanicalDisplay?.observed).toBe('missing-drive-part');
  expect(before?.mechanicalDisplay?.events.some((e) => e.action === 'check-result')).toBe(false);
  s = act(s, 'mechanical-return-unchanged');
  expect(s.objects.find((o) => o.id === 'mechanical-missing')).toMatchObject({
    location: 'returned',
    verified: false,
    independent: false,
  });
});
it.each(['evan', 'sam'] as const)(
  'a newly due %s appointment interrupts the shared handover without custody completion',
  (personId) => {
    const base = act(taughtTransfer(), 'delegate-repair');
    let yes = structuredClone(base);
    for (let i = 0; i < 12 && yes.apprentice?.jobId && !yes.apprentice.needsHelp; i++)
      yes = act(yes, 'watch-sam');
    const collected = yes.objects.find((o) => o.id === 'mechanical-carousel')?.collectedAt;
    if (collected === undefined) throw Error('Matched handover failed');
    let no = structuredClone(base);
    const owner = no.people[personId];
    if (!owner) throw Error('Missing owner');
    promise(owner, {
      kind: 'appointment',
      toId: 'mum',
      actions: ['check-in'],
      from: collected - 2,
      until: collected + 2,
      importance: 1,
      label: 'Previously arranged check-in',
    });
    for (let i = 0; i < 12 && no.apprentice?.jobId && !no.apprentice.needsHelp; i++)
      no = act(no, 'watch-sam');
    expect(no.objects.find((o) => o.id === 'mechanical-carousel')).toMatchObject({
      verified: true,
      location: 'bench',
    });
    expect(no.objects.find((o) => o.id === 'mechanical-carousel')?.collectedAt).toBeUndefined();
    expect(no.apprentice?.needsHelp).toContain('handover');
  },
);

it('Sam keeps a newly due appointment without recording interrupted mechanical work', () => {
  let s = act(taughtTransfer(), 'delegate-repair');
  const sam = s.people.sam;
  if (!sam) throw Error('Missing Sam');
  promise(sam, {
    kind: 'appointment',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now + 2,
    until: s.now + 5,
    importance: 1,
    label: 'Sam’s agreed check-in',
  });
  const before = structuredClone(s.objects.find((o) => o.id === 'mechanical-carousel'));
  s = act(s, 'watch-sam');
  const after = s.objects.find((o) => o.id === 'mechanical-carousel');
  expect(after?.mechanicalDisplay).toEqual(before?.mechanicalDisplay);
  expect(after?.observations).toEqual(before?.observations);
  expect(after?.verified).toBe(false);
  expect(s.apprentice?.needsHelp).toBeTruthy();
  expect(
    s.people.sam?.agenda.commitments.some(
      (c) => c.label === 'Sam’s agreed check-in' && c.status === 'kept',
    ),
  ).toBe(true);
});

it.each(['away', 'present-unwatched'] as const)(
  'a retained earlier lesson cannot make Sam comment on a new circuit while %s',
  (presence) => {
    let s = act(fixture(), 'mechanical-intake-stand');
    for (let n = 0; n < 12 && !s.apprentice?.arranged; n++) {
      s = act(s, 'arrange-learning');
      if (!s.apprentice?.arranged) s = act(s, 'rest');
    }
    for (const id of steps.slice(0, 3)) s = act(s, id);
    expect(s.apprentice?.lastLesson?.learnedAutomatically).toBe(true);
    const lesson = structuredClone(s.apprentice?.lastLesson);
    const sam = s.people.sam;
    if (!sam) throw Error('Missing Sam');
    if (sam.activity)
      finish(sam, {
        affordanceId: sam.activity.affordanceId,
        action: sam.activity.action,
        at: sam.now,
        status: 'interrupted',
        summary: 'The observed stretch has ended.',
      });
    if (presence === 'away' && s.world)
      s.world.presence.sam = { awayUntil: s.now + 90, activity: 'Walking the dog' };
    for (const id of ['open-access', 'clear-obstruction', 'reassemble']) s = act(s, id);
    const before = (s.journal ?? []).length;
    s = act(s, 'check-result');
    expect(s.objects.find((o) => o.id === 'mechanical-stand')?.verified).toBe(true);
    expect(s.apprentice?.lastLesson).toEqual(lesson);
    expect((s.journal ?? []).slice(before).filter((line) => line.speaker === 'Sam')).toEqual([]);
  },
);

it('declining while actually eating reveals that received activity and a same-day opportunity, without changing consent', () => {
  const initial = fixture();
  const sam = initial.people.sam;
  if (!sam) throw Error('Missing Sam');
  const meal: Affordance = {
    id: 'ordinary-meal',
    action: 'eat',
    label: 'Finish my meal',
    duration: 30,
    effort: 0,
    advertises: { food: 1 },
  };
  expect(begin(sam, meal, decide(sam, [meal]))).toBeTruthy();
  const before = (initial.journal ?? []).length;
  const s = act(initial, 'arrange-learning');
  expect(s.people.sam?.activity?.affordanceId).toBe('ordinary-meal');
  expect(s.apprentice?.arranged).not.toBe(true);
  expect(s.conversationPause).toMatchObject({
    participantId: 'sam',
    actionId: 'arrange-learning',
    activityId: 'ordinary-meal',
    until: initial.now + 30,
  });
  expect((s.journal ?? []).slice(before).some((l) => /meal|eating/.test(l.text))).toBe(true);
  expect(
    (s.journal ?? []).slice(before).some((l) => /morning shift|another day/.test(l.text)),
  ).toBe(false);
  expect(getView(s).actions.some((a) => a.id === 'wait-conversation-activity')).toBe(true);
});

it('an optional explanation names its actual observed object and does not follow the player onto another project', () => {
  let s = act(fixture(), 'mechanical-intake-stand');
  for (let n = 0; n < 12 && !s.apprentice?.arranged; n++) {
    s = act(s, 'arrange-learning');
    if (!s.apprentice?.arranged) s = act(s, 'rest');
  }
  s = act(s, 'inspect');
  const observed = s.objects.find((o) => o.id === 'mechanical-stand');
  expect(getView(s).actions.find((a) => a.id === 'explain-step')?.label).toContain(observed?.title);
  if (!observed) throw Error('Missing observed stand');
  s.objects.push({
    ...structuredClone(observed),
    id: 'other-project',
    title: 'Another retained project',
  });
  s = transition(s, { type: 'select', id: 'other-project' });
  expect(getView(s).actions.some((a) => a.id === 'explain-step')).toBe(false);
  expect(s.apprentice?.lastLesson?.objectId).toBe('mechanical-stand');
});
