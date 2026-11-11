import { readRunHistory, replay as replayNative } from '@adam0white/human-framework';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LessonControl } from '../src/components/LessonControl';
import { PersonalReply } from '../src/components/PersonalReply';
import { RecentConversation } from '../src/components/RecentConversation';
import { discoveredAccounts } from '../src/game/cast-content';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { activityEndMs, snapshotRuntime } from '../src/game/hf';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';
import { reAuthor } from './hf-fixture';

function act(s: GameState, c: Command) {
  const r = dispatch(s, c);
  expect(r.ok, r.message).toBe(true);
  return r.state;
}
function lesson(s: GameState) {
  return renderToStaticMarkup(
    createElement(LessonControl, { state: s, act: () => {}, onBench: () => {} }),
  );
}
describe('visible route to an actual shared observation', () => {
  it('offers request, actual agreement, bench test and retained witness rather than teaching by a label', () => {
    let s = createGame(42);
    expect(lesson(s)).toContain('Share an observation with Sam');
    expect(lesson(s)).toContain('Request lesson');
    expect(lesson(s)).toContain('Go to the held object');
    const unwatched = act(s, { type: 'verify', jobId: s.selectedJobId, condition: 'movement' });
    expect(unwatched.jobs[0]?.evidence.at(-1)?.witnessedBy ?? []).not.toContain('sam');
    expect(dispatch(unwatched, { type: 'ask-about-work', personId: 'sam' }).ok).toBe(false);
    const before = saveGame(s);
    lesson(s);
    expect(saveGame(s)).toBe(before);
    s = act(s, { type: 'request-lesson' });
    expect(s.watching).toBe(false);
    expect(lesson(s)).toContain('Start lesson');
    s = act(s, { type: 'start-lesson' });
    expect(s.watching).toBe(true);
    s = act(s, { type: 'verify', jobId: s.selectedJobId, condition: 'movement' });
    expect(s.jobs[0]?.evidence.at(-1)?.witnessedBy).toContain('sam');
    expect(lesson(s)).toContain('Witnessed test');
    expect(dispatch(s, { type: 'ask-about-work', personId: 'sam' }).ok).toBe(true);
    s = act(s, { type: 'watch', enabled: false });
    s = act(s, { type: 'verify', jobId: s.selectedJobId, condition: 'movement' });
    expect(s.jobs[0]?.evidence.at(-1)?.witnessedBy ?? []).not.toContain('sam');
  });
  it('does not start or credit a lesson when the opening invitation is rendered', () => {
    const s = createGame(42);
    const before = saveGame(s);
    const html = lesson(s);
    expect(html).toContain('Request lesson');
    expect(s.pendingRequest).toBeUndefined();
    expect(s.watching).toBe(false);
    expect(s.jobs[0]?.evidence ?? []).toHaveLength(0);
    expect(saveGame(s)).toBe(before);
  });
  it('keeps Halil’s exact quoted words and moves narrator limits outside the speech', () => {
    const original = discoveredAccounts.halil;
    const markup = renderToStaticMarkup(
      createElement(RecentConversation, {
        lines: [{ id: 1, at: 540, speaker: 'Halil', text: original, tone: 'ordinary' }],
        canAskSam: false,
        onAskSam: () => {},
      }),
    );
    expect(markup).toContain('Nuran asked why I would not name a price.');
    expect(markup).toContain('<summary>Narrator limits</summary>');
    expect(markup.indexOf('hypertension')).toBeGreaterThan(
      markup.indexOf('<summary>Narrator limits</summary>'),
    );
    expect(discoveredAccounts.halil).toBe(original);
  });
  it('retains the disclosed account when ordinary history retention has removed the statement', () => {
    let s = createGame(42);
    s = act(s, { type: 'watch', enabled: true });
    s = act(s, { type: 'verify', jobId: s.selectedJobId, condition: 'movement' });
    s = act(s, { type: 'ask-about-work', personId: 'sam' });
    // Existing 160-line log retention is exercised through legal inputs, without changing saved history.
    for (let n = 0; n < 160; n++) s = act(s, { type: 'watch', enabled: false });
    expect(s.log.some((e) => e.text === discoveredAccounts.sam)).toBe(false);
    const markup = renderToStaticMarkup(
      createElement(PersonalReply, { state: s, personId: 'sam', act: () => {} }),
    );
    expect(markup).toContain('I once copied another player');
    expect(markup).toContain('That conversation has ended.');
    expect(markup).toContain('disabled');
  });
});

it('drains later NPC finishes before returning a watched replacement', () => {
  let state = createGame(42);
  state = act(state, { type: 'watch', enabled: true });
  state = act(state, { type: 'inspect', jobId: state.selectedJobId, componentId: 'switch' });
  state = act(state, { type: 'wait', minutes: 5 });
  const work = state.npcWork.find((work) => work.endsAt === state.now + 30);
  expect(work).toBeDefined();
  if (!work) throw new Error('Missing later background work');
  const other = state.people[work.personId];
  if (!other) throw new Error('Missing background actor');
  const otherEnd = activityEndMs(other);
  const otherActivity = snapshotRuntime(state.people).active[work.personId]?.id;
  expect(otherActivity).toBeDefined();
  state = act(state, {
    type: 'work',
    jobId: state.selectedJobId,
    componentId: 'cell',
    intervention: 'replace',
  });
  const archive = snapshotRuntime(state.people).archive;
  const finishes = readRunHistory(archive)
    .flatMap((tx) => tx.inputs)
    .filter(
      (input) =>
        input.kind === 'action.resolved' &&
        input.payload.stage === 'finish' &&
        input.payload.disposition === 'completed',
    );
  const observation = finishes.findLast(
    (input) =>
      input.kind === 'action.resolved' &&
      input.payload.person === 'sam' &&
      input.payload.outcome?.actionId === 'observe',
  );
  expect(observation).toBeDefined();
  if (!observation) throw new Error('Missing completed observation');
  expect(Math.floor(observation.at / 60_000)).toBe(Math.floor(otherEnd / 60_000));
  expect(observation.at).toBeLessThan(otherEnd);
  const raw = saveGame(state);
  expect(saveGame(loadGame(raw))).toBe(raw);
  expect(state.npcWork.some((work) => work.endsAt <= state.now)).toBe(false);
  const otherFinish = finishes.filter(
    (input) => input.kind === 'action.resolved' && input.payload.activityId === otherActivity,
  );
  expect(otherFinish).toHaveLength(1);
  expect(otherFinish[0]?.at).toBe(otherEnd);
  const native = replayNative(archive);
  expect(native.ok && native.value.verified).toBe(true);
  const replayed = replayRecordedRun(JSON.parse(raw), raw);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.save).toBe(raw);
});

it('withholds final witness and teaching credit when HF interrupts an observation', () => {
  let state = createGame(1);
  const sam = state.people.sam;
  if (!sam) throw new Error('Missing observer');
  // Controlled public authoring makes dozing likely. HF still chooses and interrupts.
  reAuthor(sam, {
    body: {
      sleepPressure: 1,
      sleepDebtHours: 24,
      doze: {
        context: { posture: 'reclined', stimulation: 0 },
        basis: { kind: 'authored', author: 'repair', at: state.now * 60000 },
      },
    } as Parameters<typeof reAuthor>[1]['body'],
  });
  state = act(state, { type: 'watch', enabled: true });
  state = act(state, {
    type: 'work',
    jobId: state.selectedJobId,
    componentId: 'cell',
    intervention: 'replace',
  });
  const archive = snapshotRuntime(state.people).archive;
  const inputs = readRunHistory(archive).flatMap((tx) => tx.inputs);
  const interruption = inputs.find(
    (input) =>
      input.kind === 'action.resolved' &&
      input.payload.person === 'sam' &&
      input.payload.stage === 'interrupt' &&
      input.payload.outcome?.actionId === 'observe',
  );
  expect(interruption).toBeDefined();
  expect(
    inputs.some(
      (input) =>
        input.kind === 'action.resolved' &&
        input.payload.person === 'sam' &&
        input.payload.stage === 'start' &&
        input.payload.disposition === 'accepted',
    ),
  ).toBe(true);
  const evidence = state.jobs[0]?.evidence.at(-1);
  expect(evidence).toBeDefined();
  expect(evidence?.witnessedBy ?? []).not.toContain('sam');
  expect(inputs.filter((input) => input.kind === 'method.demonstrated')).toHaveLength(0);
  expect(state.jobs[0]?.pendingLessons).toHaveLength(0);
  const raw = saveGame(state);
  expect(saveGame(loadGame(raw))).toBe(raw);
  const native = replayNative(archive);
  expect(native.ok && native.value.verified).toBe(true);
});
