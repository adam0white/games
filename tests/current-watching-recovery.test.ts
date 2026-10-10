import { begin, decide, finish, promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame, transition } from '../src/game/engine';
import * as fourteen from '../src/game/engine14';
import * as fifteen from '../src/game/engine15';
import type { GameInput } from '../src/game/types';
import continued from './fixtures/fifteen-long-workshop-route.json';
import base from './fixtures/fourteen-long-workshop-route.json';
import { positiveAction } from './support/public-attendance';

function actual(count = continued.inputs.length) {
  let old = fourteen.createGame(base.seed);
  for (const input of base.inputs) old = fourteen.transition(old, input as GameInput);
  let prior = fifteen.restoreGame(fourteen.serializeGame(old));
  for (const input of continued.inputs.slice(0, count))
    prior = fifteen.transition(prior, input as GameInput);
  return restoreGame(fifteen.serializeGame(prior));
}
it('recovers the actual engine15 stopped story through the disclosed meal endpoint and a real watched physical correction', () => {
  let s = actual();
  const until = s.people.sam?.activity?.endsAt;
  s = transition(s, { type: 'action', id: 'show-corrective-step' });
  expect(s.apprentice?.needsHelp).toBeTruthy();
  expect(s.conversationPause?.until).toBe(until);
  const activity = getView(s).whereabouts?.find((x) => x.name === 'Sam')?.activity;
  expect(activity).toContain('Finishing');
  expect(activity).toContain('14:32');
  expect(activity).not.toContain('At the bench');
  expect(s.journal?.at(-1)?.text).toContain('until');
  s = transition(s, { type: 'action', id: 'wait-conversation-activity' });
  expect(s.now).toBe(until);
  s = transition(s, { type: 'action', id: 'show-corrective-step' });
  expect(s.apprentice?.needsHelp).toBeUndefined();
  const withheld = structuredClone(s);
  s = positiveAction(s, 'clean-contact');
  s = transition(s, { type: 'action', id: 'explain-step' });
  expect(s.apprentice?.lastLesson?.step).toBe('clean-contact');
  expect(s.apprentice?.lastLesson?.explained).toBe(true);
  expect(withheld.apprentice?.lastLesson?.step).not.toBe('clean-contact');
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 30_000);
it('reuses a genuinely chosen existing complete watching activity and preserves a stronger actual promise', () => {
  const s = actual();
  const sam = s.people.sam;
  if (!sam) throw Error('Missing Sam');
  if (sam.activity)
    finish(sam, {
      affordanceId: sam.activity.affordanceId,
      action: sam.activity.action,
      at: sam.now,
      status: 'completed',
      summary: 'Control finishes the meal before watching',
    });
  const watch = {
    id: 'learning-afternoon',
    action: 'learn',
    label: 'Watching the actual repair steps',
    duration: 90,
    effort: 0.02,
    advertises: { competence: 0.5, belonging: 0.3 },
  };
  begin(sam, watch, decide(sam, [watch]));
  const prior = structuredClone(sam.activity);
  const kept = transition(s, { type: 'action', id: 'show-corrective-step' });
  expect(kept.apprentice?.needsHelp).toBeUndefined();
  expect(kept.people.sam?.activity?.startedAt).toBe(prior?.startedAt);
  expect(kept.people.sam?.activity?.endsAt).toBe(prior?.endsAt);
  const refusing = actual();
  const other = refusing.people.sam;
  if (!other) throw Error('Missing Sam');
  if (other.activity)
    finish(other, {
      affordanceId: other.activity.affordanceId,
      action: other.activity.action,
      at: other.now,
      status: 'completed',
      summary: 'Control begins an actual promise',
    });
  const duty = promise(other, {
    kind: 'promise',
    toId: 'mum',
    actions: ['check-in'],
    from: other.now,
    until: other.now + 30,
    importance: 1,
  });
  const own = {
    id: 'promised-check-in',
    action: 'check-in',
    label: 'Keeping a promised check-in',
    duration: 30,
    effort: 0,
    fulfills: [duty.id],
    with: ['mum'],
    advertises: { belonging: 0.1 },
  };
  begin(other, own, decide(other, [own]));
  const before = structuredClone(other.activity);
  const declined = transition(refusing, { type: 'action', id: 'show-corrective-step' });
  expect(declined.people.sam?.activity).toEqual(before);
  expect(declined.apprentice?.needsHelp).toBeTruthy();
  expect(declined.conversationPause?.until).toBe(before?.endsAt);
  expect(getView(declined).actions.some((x) => x.id === 'wait-conversation-activity')).toBe(true);
}, 30_000);

it('presents the actual expired-job renewal as a current invitation and suppresses the obsolete observer invitation', () => {
  const s = actual(continued.inputs.length - 2);
  const view = getView(s);
  expect(s.samPlans?.invitation).toBe('pending');
  expect(view.actions.some((x) => x.id === 'arrange-learning')).toBe(true);
  expect(view.actions.some((x) => x.id === 'resume-observer-invite')).toBe(false);
  const renewal = view.dayPlan?.entries.find((x) => x.id === 'sam-work');
  expect(renewal?.status).toBe('invitation');
  expect(renewal?.actionIds).toContain('arrange-learning');
  expect(view.dayPlan?.entries.some((x) => x.id === 'sam-invitation')).toBe(false);
}, 30_000);

it('does not alias an existing short watching decision into fresh consent, while a distinct new watching choice can renew it', () => {
  const basis = actual();
  const sam = basis.people.sam;
  if (!sam) throw Error('Missing Sam');
  if (sam.activity)
    finish(sam, {
      affordanceId: sam.activity.affordanceId,
      action: sam.activity.action,
      at: sam.now,
      status: 'completed',
      summary: 'Control finishes meal before short watching',
    });
  const short = {
    id: 'watch-corrective-repair',
    action: 'learn',
    label: 'Five minutes of actual watching',
    duration: 5,
    effort: 0.02,
    advertises: { competence: 0.5, belonging: 0.3 },
  };
  const declined = structuredClone(basis);
  const keeper = declined.people.sam;
  if (!keeper) throw Error('Missing Sam');
  begin(keeper, short, decide(keeper, [short]));
  const before = structuredClone(keeper.activity);
  const kept = transition(declined, { type: 'action', id: 'show-corrective-step' });
  expect(kept.people.sam?.trace.at(-1)?.chosenAffordanceId).toBe(short.id);
  expect(kept.people.sam?.activity).toMatchObject({
    affordanceId: before?.affordanceId,
    action: before?.action,
    startedAt: before?.startedAt,
    endsAt: before?.endsAt,
  });
  expect(kept.apprentice?.needsHelp).toBeTruthy();
  expect(kept.apprentice?.jobId).toBe(basis.apprentice?.jobId);
  expect(kept.conversationPause?.until).toBe(before?.endsAt);
  const accepted = structuredClone(basis);
  const watcher = accepted.people.sam;
  if (!watcher) throw Error('Missing Sam');
  const little = {
    ...short,
    effort: 0.8,
    focus: 0.8,
    advertises: { competence: 0.001, belonging: 0.001 },
  };
  begin(watcher, little, decide(watcher, [little]));
  const renewed = transition(accepted, { type: 'action', id: 'show-corrective-step' });
  expect(renewed.people.sam?.trace.at(-1)?.chosenAffordanceId).toBe('watch-corrective-renewal');
  expect(renewed.people.sam?.activity?.affordanceId).toBe('watch-corrective-renewal');
  expect(renewed.people.sam?.activity?.endsAt).toBe(accepted.now + 30);
  expect(renewed.apprentice?.needsHelp).toBeUndefined();
  expect(renewed.apprentice?.lastLesson).toEqual(basis.apprentice?.lastLesson);
}, 30_000);
