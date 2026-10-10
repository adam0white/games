import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  advanceApprentice,
  apprenticeActions,
  explainLesson,
  recordLesson,
} from '../src/game/apprentice';
import { getView, restoreGame, serializeGame } from '../src/game/engine';
import * as seven from '../src/game/engine7';
import type { GameInput, GameState } from '../src/game/types';
import fixture from './fixtures/published-seven-rescued-route.json';
import { choose } from './support/school-route';

function recovered(): GameState {
  let old = seven.createGame(fixture.seed);
  for (const input of fixture.inputs) old = seven.transition(old, input as GameInput);
  const raw = seven.serializeGame(old);
  expect(createHash('sha256').update(raw).digest('hex')).toBe(fixture.sha256);
  return restoreGame(raw);
}
const has = (s: GameState, id: string) => getView(s).actions.some((a) => a.id === id);
function reach(s: GameState, id: string) {
  for (let n = 0; n < 100 && !has(s, id); n++)
    s = choose(
      s,
      has(s, 'arrange-learning')
        ? 'arrange-learning'
        : has(s, 'wait-person')
          ? 'wait-person'
          : 'rest',
    );
  expect(has(s, id), `Actual reachable ${id}`).toBe(true);
  return s;
}
it('the actual public rescued route gets one distinct supervised request and then an unassisted Nora handoff', () => {
  let s = recovered();
  const prior = s.objects
    .filter((o) => ['lesson-battery', 'lesson-contact', 'supervised-light'].includes(o.id))
    .map((o) => structuredClone(o));
  s = reach(s, 'supervised-retry-intake');
  expect(getView(s).actions.find((a) => a.id === 'supervised-retry-intake')?.kind).toBe('primary');
  const parts = s.parts.batteries;
  s = choose(s, 'supervised-retry-intake');
  expect(s.parts.batteries).toBe(parts + 1);
  for (let n = 0; n < 100 && !s.apprentice?.supervisedCompleted; n++)
    s = choose(
      s,
      has(s, 'reconsider-sam')
        ? 'reconsider-sam'
        : has(s, 'arrange-learning')
          ? 'arrange-learning'
          : has(s, 'watch-sam')
            ? 'watch-sam'
            : has(s, 'wait-person')
              ? 'wait-person'
              : 'rest',
    );
  expect(s.apprentice?.supervisedCompleted).toBe(true);
  expect(s.apprentice?.completedJobIds).toEqual([]);
  expect(s.objects.filter((o) => prior.some((p) => p.id === o.id))).toEqual(prior);
  expect(s.objects.filter((o) => o.id === 'supervised-retry-light')).toHaveLength(1);
  expect(has(s, 'supervised-retry-intake')).toBe(false);
  s = choose(reach(s, 'independent-intake'), 'independent-intake');
  for (let n = 0; n < 100 && s.apprentice?.jobId; n++) {
    expect(has(s, 'reconsider-sam'), 'Unassisted Nora never requires explicit help').toBe(false);
    s = choose(
      s,
      has(s, 'arrange-learning')
        ? 'arrange-learning'
        : has(s, 'watch-sam')
          ? 'watch-sam'
          : has(s, 'wait-person')
            ? 'wait-person'
            : 'rest',
    );
  }
  expect(s.apprentice?.completedJobIds).toEqual(['independent-light']);
  expect(s.objects.find((o) => o.id === 'independent-light')?.playerAssisted).toBe(false);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
it('postponing and rescuing the additional request cannot fabricate supervision or independent credit', () => {
  let s = reach(recovered(), 'postpone-supervised-retry');
  const before = s.parts.batteries;
  s = choose(s, 'postpone-supervised-retry');
  expect(s.parts.batteries).toBe(before);
  expect(s.apprentice?.supervisedCompleted).toBe(false);
  expect(has(s, 'rest')).toBe(true);
  expect(has(s, 'supervised-retry-intake')).toBe(true);
  s = choose(s, 'supervised-retry-intake');
  // Withhold acquired methods in a matched opportunity; HF must ask instead of host-solving.
  if (!s.people.sam?.methods) throw Error('Missing Sam methods');
  s.people.sam.methods.rules = [];
  s = choose(s, 'watch-sam');
  expect(s.apprentice?.needsHelp).toBeTruthy();
  s = choose(s, 'reconsider-sam');
  expect(s.apprentice?.needsHelp).toBeTruthy();
  const job = s.objects.find((o) => o.id === 'supervised-retry-light');
  expect(job?.independent).toBe(false);
  s = choose(s, 'take-over-repair');
  expect(s.apprentice?.supervisedCompleted).toBe(false);
  expect(s.apprentice?.completedJobIds).toEqual([]);
  expect(has(s, 'inspect') || has(s, 'test-battery') || has(s, 'verify')).toBe(true);
  expect(has(s, 'rest')).toBe(true);
});
it('absent demonstration and absent explanation do not grant receipt, skill or methods; explaining into an active job is sticky assistance', () => {
  let s = recovered();
  const sam = s.people.sam;
  if (!sam || !s.apprentice) throw Error('Missing learner');
  const item = s.objects.find((o) => o.id === 'supervised-light');
  if (!item) throw Error('Missing actual rescued item');
  const before = structuredClone(sam);
  const last = structuredClone(s.apprentice.lastLesson);
  recordLesson(s, item, 'verify', 'light-steady', true, 2, false);
  expect(s.people.sam).toEqual(before);
  expect(s.apprentice.lastLesson).toEqual(last);
  if (!s.apprentice.lastLesson) throw Error('Missing demonstration');
  s.apprentice.lastLesson.explained = false;
  expect(apprenticeActions(s, undefined, false).some((a) => a.id === 'explain-step')).toBe(false);
  explainLesson(s, () => {}, false);
  expect(s.people.sam).toEqual(before);
  expect(s.apprentice.lastLesson.explained).toBe(false);
  s = reach(s, 'supervised-retry-intake');
  s = choose(s, 'supervised-retry-intake');
  const active = s.objects.find((o) => o.id === s.apprentice?.jobId);
  if (!active || !s.apprentice) throw Error('Missing fresh job');
  active.playerAssisted = false;
  active.independent = true;
  s.apprentice.supervised = false;
  // Reconsider is explicit player support even on a previously unassisted assignment.
  s.apprentice.needsHelp = 'Need the missing explanation';
  s = choose(s, 'reconsider-sam');
  expect(s.objects.find((o) => o.id === active.id)?.playerAssisted).toBe(true);
  expect(s.objects.find((o) => o.id === active.id)?.independent).toBe(false);
  expect(s.apprentice?.supervised).toBe(true);
  expect(s.apprentice?.completedJobIds).toEqual([]);
});

it('an actually started test needs elapsed time but no taught wait action; withholding result-reading still stops at the result', () => {
  let s = choose(reach(recovered(), 'supervised-retry-intake'), 'supervised-retry-intake');
  for (
    let n = 0;
    n < 30 && s.objects.find((o) => o.id === 'supervised-retry-light')?.checkStarted === undefined;
    n++
  ) {
    s = choose(
      s,
      has(s, 'reconsider-sam')
        ? 'reconsider-sam'
        : has(s, 'arrange-learning')
          ? 'arrange-learning'
          : 'watch-sam',
    );
  }
  const item = s.objects.find((o) => o.id === 'supervised-retry-light');
  const sam = s.people.sam;
  if (item?.checkStarted === undefined || !sam?.methods)
    throw Error('No actual timed test started');
  expect(sam.methods.rules.some((r) => r.action === 'wait-check')).toBe(false);
  expect(sam.methods.rules.some((r) => r.action === 'verify')).toBe(true);
  const end = item.checkStarted + 20;
  expect(sam.now).toBeLessThan(end);
  const withheld = structuredClone(s);
  if (!withheld.people.sam?.methods) throw Error('Missing withheld actor');
  withheld.people.sam.methods.rules = withheld.people.sam.methods.rules.filter(
    (r) => r.action !== 'check-result',
  );
  const decisions = item.stepDecisions?.length;
  advanceApprentice(
    s,
    end - 1,
    () => {},
    () => true,
    () => true,
  );
  expect(item.verified).toBe(false);
  expect(item.stepDecisions?.length).toBe(decisions);
  advanceApprentice(
    s,
    end,
    () => {},
    () => true,
    () => true,
  );
  expect(item.verified).toBe(false);
  expect(item.stepDecisions?.length).toBe(decisions);
  advanceApprentice(
    s,
    end + 4,
    () => {},
    () => true,
    () => true,
  );
  expect(item.verified).toBe(true);
  advanceApprentice(
    withheld,
    end + 4,
    () => {},
    () => true,
    () => true,
  );
  expect(withheld.objects.find((o) => o.id === item.id)?.verified).toBe(false);
  expect(withheld.apprentice?.needsHelp).toBeTruthy();
  expect(withheld.apprentice?.completedJobIds).toEqual([]);
});
