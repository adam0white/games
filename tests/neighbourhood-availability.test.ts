import { createHash } from 'node:crypto';
import { begin, decide, finish, promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import {
  caseConversationPurpose,
  getView,
  receivedCasePurposes,
  restoreGame,
  serializeGame,
  transition,
} from '../src/game/engine';
import * as eight from '../src/game/engine8';
import * as twelve from '../src/game/engine12';
import { beginSharedConversation, type ConversationRefusal } from '../src/game/humans';
import type { GameInput } from '../src/game/types';
import fixture from './fixtures/candidate-twelve-nora-block-route.json';

function candidate() {
  let base = eight.createGame(fixture.seed);
  for (const input of fixture.inputs.slice(0, fixture.baseCount))
    base = eight.transition(base, input as GameInput);
  let s = twelve.restoreGame(eight.serializeGame(base));
  for (const input of fixture.inputs.slice(fixture.baseCount))
    s = twelve.transition(s, input as GameInput);
  return s;
}
it('pins the immutable private candidate and reproduces Nora continuing her meal', () => {
  const old = candidate();
  const raw = twelve.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(fixture.sha256);
  expect(old.people.nora?.activity?.affordanceId).toBe('ordinary-meal');
  expect(old.people.nora?.activity?.endsAt).toBe(2120404);
  expect(old.people.nora?.trace.at(-1)?.chosenAffordanceId).toBe('ordinary-meal');
  expect(old.journal?.at(-1)?.text).toContain('You have not agreed time');
  const s = restoreGame(raw);
  expect(s.people).toEqual(old.people);
  expect(s.journal).toEqual(old.journal);
  expect(s.engine3Save).toBe(raw);
}, 20_000);
for (const final of [false, true])
  it(`resolves the actual ${final ? 'final' : 'first'} saved comparison in five minutes through received purposes`, () => {
    let old = candidate();
    if (final)
      for (const id of [
        'neighbourhood-tray-consent',
        'wait-person',
        'neighbourhood-compare-source',
      ])
        old = twelve.transition(old, { type: 'action', id });
    let s = restoreGame(twelve.serializeGame(old));
    expect(s.neighbourhood?.noraPurposeId).toBeUndefined();
    const before = s.now,
      journal = structuredClone(s.journal);
    s = transition(s, { type: 'action', id: 'neighbourhood-compare-source' });
    expect(s.now - before).toBe(5);
    expect(s.neighbourhood?.sourceCompared).toBe(true);
    for (const person of Object.values(s.people)) expect(person.now).toBe(s.now);
    expect(
      s.people.nora?.agenda.goals.find((g) => g.id === s.neighbourhood?.noraPurposeId)?.progress,
    ).toBe(0.1);
    expect(s.journal?.slice(0, journal?.length)).toEqual(journal);
    expect(restoreGame(serializeGame(s))).toEqual(s);
  }, 20_000);
it('changes only purpose linkage in matched comparison offers, preserving the real busy refusal', () => {
  const received = restoreGame(twelve.serializeGame(candidate()));
  receivedCasePurposes(received);
  const linked = structuredClone(received),
    withheld = structuredClone(received);
  const purpose = caseConversationPurpose(received, 'neighbourhood-compare-source');
  if (
    !purpose ||
    !linked.people.player ||
    !linked.people.nora ||
    !withheld.people.player ||
    !withheld.people.nora
  )
    throw Error('Missing people');
  expect(linked).toEqual(withheld);
  const refusal: ConversationRefusal[] = [];
  expect(
    beginSharedConversation(
      withheld.people.player,
      withheld.people.nora,
      'neighbourhood-compare-source',
      'Ask Nora to compare her retained counter catch',
      5,
      (r) => refusal.push(r),
      { ...purpose, partnerGoals: [], playerGoals: [] },
    ),
  ).toBe(false);
  expect(refusal[0]?.activity?.id).toBe('ordinary-meal');
  expect(
    beginSharedConversation(
      linked.people.player,
      linked.people.nora,
      'neighbourhood-compare-source',
      'Ask Nora to compare her retained counter catch',
      5,
      undefined,
      purpose,
    ),
  ).toBe(true);
  expect(
    linked.people.nora.trace
      .at(-1)
      ?.considered.find((c) => c.affordanceId === 'neighbourhood-compare-source')
      ?.terms.some((t) => t.source.startsWith('goal:')),
  ).toBe(true);
  for (const s of [linked, withheld]) {
    expect(s.now).toBe(received.now);
    expect(s.people.nora?.agenda.goals.every((g) => g.progress === 0)).toBe(true);
  }
}, 20_000);
it('gives a real retained-spare alternative its own received purpose and no progress on refusal', () => {
  let s = restoreGame(twelve.serializeGame(candidate()));
  s = transition(s, { type: 'action', id: 'neighbourhood-compare-source' });
  const linked = structuredClone(s),
    withheld = structuredClone(s);
  const purpose = caseConversationPurpose(s, 'neighbourhood-source');
  if (
    !purpose ||
    !linked.people.player ||
    !linked.people.nora ||
    !withheld.people.player ||
    !withheld.people.nora
  )
    throw Error('Missing people');
  expect(purpose.alternative?.advances).toEqual([s.neighbourhood?.conservationPurposeId]);
  const refusal: ConversationRefusal[] = [];
  expect(
    beginSharedConversation(
      withheld.people.player,
      withheld.people.nora,
      'neighbourhood-source',
      'Ask to use Nora’s retained old-counter catch',
      5,
      (r) => refusal.push(r),
      { ...purpose, partnerGoals: [] },
    ),
  ).toBe(false);
  expect(refusal[0]?.alternativeId).toBe('retain-case-fitting');
  expect(
    withheld.people.nora.agenda.goals.find((g) => g.id === s.neighbourhood?.conservationPurposeId)
      ?.progress,
  ).toBe(0);
  expect(
    beginSharedConversation(
      linked.people.player,
      linked.people.nora,
      'neighbourhood-source',
      'Ask to use Nora’s retained old-counter catch',
      5,
      undefined,
      purpose,
    ),
  ).toBe(true);
  expect(
    s.objects.find((o) => o.id === 'nora-sample-case')?.caseFittings?.compatible,
  ).toBeUndefined();
  s = transition(s, { type: 'action', id: 'neighbourhood-source' });
  expect(
    s.objects.find((o) => o.id === 'nora-sample-case')?.caseFittings?.compatible?.permission,
  ).toBe(true);
  const restored = restoreGame(serializeGame(s));
  expect(restored).toEqual(s);
  expect(transition(restored, { type: 'action', id: 'fit-case-catch' })).toEqual(
    transition(s, { type: 'action', id: 'fit-case-catch' }),
  );
}, 20_000);
it('does not advance an honest resolution through repeated known-incompatible fitting attempts', () => {
  let s = restoreGame(twelve.serializeGame(candidate()));
  s = transition(s, { type: 'action', id: 'neighbourhood-compare-source' });
  const goal = () =>
    s.people.player?.agenda.goals.find((g) => g.id === s.neighbourhood?.playerPurposeId);
  const before = goal()?.progress;
  for (let n = 0; n < 3; n++) s = transition(s, { type: 'action', id: 'try-case-replacement' });
  expect(goal()?.progress).toBe(before);
  expect(goal()?.status).toBe('active');
  expect(s.objects.find((o) => o.id === 'nora-sample-case')?.repaired).toBe(false);
  s = transition(s, { type: 'action', id: 'neighbourhood-return-unchanged' });
  expect(
    s.people.nora?.agenda.goals.find((g) => g.id === s.neighbourhood?.noraPurposeId)?.status,
  ).toBe('active');
  expect(restoreGame(serializeGame(s))).toEqual(s);
}, 20_000);
it('a received case purpose can still lose to an actual ongoing promised duty', () => {
  let s = restoreGame(twelve.serializeGame(candidate()));
  receivedCasePurposes(s);
  const nora = s.people.nora;
  if (!nora) throw Error('Missing Nora');
  if (nora.activity)
    finish(nora, {
      affordanceId: nora.activity.affordanceId,
      action: nora.activity.action,
      at: s.now,
      status: 'interrupted',
      summary: 'A promised check-in starts.',
    });
  const duty = promise(nora, {
    kind: 'promise',
    toId: 'mum',
    actions: ['check-in'],
    from: s.now,
    until: s.now + 30,
    importance: 0.8,
  });
  const checking = {
    id: 'promised-check-in',
    action: 'check-in',
    label: 'Finishing a promised check-in',
    duration: 30,
    effort: 0.02,
    fulfills: [duty.id],
    with: ['mum'],
    advertises: { belonging: 0.07 },
  };
  expect(begin(nora, checking, decide(nora, [checking]))).toBeTruthy();
  const progress = nora.agenda.goals.find((g) => g.id === s.neighbourhood?.noraPurposeId)?.progress;
  const at = s.now;
  s = transition(s, { type: 'action', id: 'neighbourhood-compare-source' });
  expect(s.now).toBe(at);
  expect(s.neighbourhood?.sourceCompared).toBe(false);
  expect(s.people.nora?.trace.at(-1)?.chosenAffordanceId).toBe('promised-check-in');
  expect(s.conversationPause?.until).toBe(at + 30);
  expect(s.journal?.at(-1)?.text).toContain('Nora is still finishing a promised check-in');
  expect(
    s.people.nora?.agenda.goals.find((g) => g.id === s.neighbourhood?.noraPurposeId)?.progress,
  ).toBe(progress);
  const beforeView = JSON.stringify(s);
  getView(s);
  expect(JSON.stringify(s)).toBe(beforeView);
  s = transition(s, { type: 'action', id: 'wait-conversation-activity' });
  expect(s.now).toBe(at + 30);
  expect(s.neighbourhood?.sourceCompared).toBe(false);
  for (const person of Object.values(s.people)) expect(person.now).toBe(s.now);
}, 20_000);
