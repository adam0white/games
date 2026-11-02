/** Scope: physical guidance and actual food work through existing HF choices.
 * This adds no cognitive faculty, private competence read, synthetic skill witness
 * or felt/voice outcome. Compliance after ordinary insist is not voluntary assent.
 */
import { beforeAll, expect, it } from 'vitest';
import { replayExport, validateReplayFile } from '../src/sim/continuation.ts';
import { communityRun, interrupt, verifyCommunity } from '../src/sim/hf4-person.ts';
import {
  boardDefaults,
  cloneState,
  exportRun,
  inKitchen,
  newGame,
  personOf,
  queueInput,
  replay,
  restoreState,
  stationOf,
  step,
} from '../src/sim/kitchen.ts';
import { attentionAvailable, grillLessonAvailable } from '../src/sim/kitchen-edition.ts';
import historicalExport from './fixtures/grill-lesson-historical-public-export.json';
import historicalMeta from './fixtures/grill-lesson-historical-public-export.meta.json';
import native from './fixtures/grill-lesson-native-modified.json';
import prefix from './fixtures/grill-lesson-prefix.json';

const raw = (s: ReturnType<typeof newGame>) => JSON.parse(JSON.stringify(cloneState(s)));
let checkpoint: ReturnType<typeof cloneState>;
beforeAll(() => {
  // Original ordinary-input night-two prefix, followed by an actual private invite.
  // No Person, task demand, body, skill, clock, actor or horizon is edited.
  const s = replay(prefix.seed, prefix.inputs as Parameters<typeof replay>[1], prefix.minute, 'pass@20');
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'invite' });
  for (let i = 0; i < 5; i++) step(s);
  expect(s.privateAccounts?.selim).toBeDefined();
  checkpoint = raw(s);
}, 120000);

it('offers no lesson before actual disclosure or without a waiting grill order', () => {
  const s = newGame(42, 'pass@20');
  expect(grillLessonAvailable(s, 'dilek')).toBe(false);
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'listen' });
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  expect(grillLessonAvailable(s, 'dilek')).toBe(false);
  expect(grillLessonAvailable(s, 'selim')).toBe(false);
});

it('records real guidance and later food work, preserving full replay and cold continuation', () => {
  const s = restoreState(checkpoint);
  expect(grillLessonAvailable(s, 'rafi')).toBe(true);
  queueInput(s, { kind: 'grill-lesson', learner: 'rafi' });
  expect(s.grillLessons?.[0]?.teacherVerdict).toBe('assented');
  expect(raw(replayExport(exportRun(s, '4.12.0')))).toEqual(raw(s));
  expect(stationOf(s, 'selim')).toBeNull();
  const teacherWork = personOf(s, 'selim').activity;
  expect(teacherWork?.affordanceId).toBe('conversation');
  expect((teacherWork?.endsAt ?? 0) - (teacherWork?.startedAt ?? 0)).toBe(3);
  expect(stationOf(s, 'rafi')).toBe('dish');
  // Exactly one existing insist request. Current HF assents; no compliance cost is inferred.
  // Preregistered: seven steps to 2622, one minute beyond the preserved six-step tape.
  queueInput(s, { kind: 'ask', cook: 'rafi', verb: 'grill', insist: true });
  for (let i = 0; i < 7; i++) step(s);
  expect(s.minute).toBe(2622);
  const lesson = s.grillLessons?.[0];
  expect(lesson?.state).toBe('practised');
  expect(lesson?.learnerVerdict).toBe('assented');
  expect(lesson?.learnerInsisted).toBe(true);
  expect(lesson?.guidedWork).toBeGreaterThan(0);
  expect(lesson?.learnerWork).toBeGreaterThan(0);
  expect(lesson?.food).toBeDefined();
  expect(lesson?.food?.at).toBeGreaterThan(lesson?.teacherCompleted ?? 0);
  const food = s.tickets.find((ticket) => ticket.id === lesson?.food?.ticket);
  expect(food).toBeDefined();
  expect(food?.doneGrill).toBeGreaterThan(0);
  expect(lesson?.teacherCompleted).toBeGreaterThan(lesson?.at ?? 0);
  expect(s.inputs[lesson?.id ?? -1]?.kind).toBe('grill-lesson');
  const file = exportRun(s, '4.12.0');
  const replayed = replayExport(file),
    cold = restoreState(raw(s));
  expect(raw(replayed)).toEqual(raw(s));
  expect(raw(cold)).toEqual(raw(s));
  for (let i = 0; i < 30; i++) {
    step(s);
    step(replayed);
    step(cold);
  }
  expect(raw(replayed)).toEqual(raw(s));
  expect(raw(cold)).toEqual(raw(s));
  expect(verifyCommunity(s.chef).verified).toBe(true);
}, 120000);

it('does not credit food work when the learner modifies the ordinary request to dish work', () => {
  const s = restoreState(checkpoint);
  queueInput(s, { kind: 'grill-lesson', learner: 'rafi' });
  expect(s.grillLessons?.[0]?.teacherVerdict).toBe('assented');
  queueInput(s, { kind: 'ask', cook: 'rafi', verb: 'grill', insist: false });
  for (let i = 0; i < 6; i++) step(s);
  expect(s.cooks.find((cook) => cook.id === 'rafi')?.night.events.at(-1)).toMatchObject({
    verb: 'grill',
    verdict: 'modified',
    insisted: false,
  });
  expect(stationOf(s, 'rafi')).toBe('dish');
  expect(personOf(s, 'rafi').activity?.affordanceId).toBe('dish');
  expect(s.grillLessons?.[0]?.teacherCompleted).toBeGreaterThan(s.grillLessons?.[0]?.at ?? 0);
  expect(s.grillLessons?.[0]?.learnerActivity).toBeUndefined();
  expect(s.grillLessons?.[0]?.guidedWork).toBe(0);
  expect(s.grillLessons?.[0]?.learnerWork).toBe(0);
  expect(s.grillLessons?.[0]?.learnerVerdict).toBe('not-asked');
  expect(s.grillLessons?.[0]?.learnerInsisted).toBeUndefined();
  expect(s.grillLessons?.[0]?.learnerCompleted).toBeUndefined();
  expect(s.grillLessons?.[0]?.lastLearnerWorkAt).toBeUndefined();
  expect(s.grillLessons?.[0]?.food).toBeUndefined();
  expect(s.grillLessons?.[0]?.state).toBe('no-food-work');
  expect(s.said.some((line) => line.who === 'rafi' && line.kind === 'answer')).toBe(true);
  const replayed = replayExport(exportRun(s, '4.12.0')),
    cold = restoreState(raw(s));
  expect(raw(replayed)).toEqual(raw(s));
  expect(raw(cold)).toEqual(raw(s));
  expect(verifyCommunity(s.chef).verified).toBe(true);
  const next = { kind: 'ask', cook: 'dilek', verb: 'cold' } as const;
  for (const state of [s, replayed, cold]) queueInput(state, next);
  for (let i = 0; i < 8; i++) {
    step(s);
    step(replayed);
    step(cold);
  }
  expect(raw(replayed)).toEqual(raw(s));
  expect(raw(cold)).toEqual(raw(s));
  expect(verifyCommunity(s.chef).verified).toBe(true);
}, 120000);

/** The original historical native unit body is byte-exact and inert in
 * archive/evidence/2026-11-02-pass-ci-corrections/grill-lesson-historical-native-unit.ts.txt.
 * Its provenance is retained there and in native.meta; it is not executed current coverage.
 * The unaltered /1 fixture must refuse under current guest rules, preserving the original.
 */
it('refuses the unaltered historical native archive and tells the player to keep it and start fresh', () => {
  const original = JSON.stringify(native);
  expect(native.meta.archiveVerified).toBe(true);
  expect(native.checkpoint.hf4.schema).toBe('pass-hf4/1');
  expect(() =>
    restoreState(structuredClone(native.checkpoint) as unknown as ReturnType<typeof cloneState>),
  ).toThrow('Keep this file. This kitchen needs a new game.');
  expect(JSON.stringify(native)).toBe(original);
}, 120000);

/** The file is a genuine R3 public export serialized before any mutation (generator and source hashes in the .meta sidecar), and the
 * generator proved it VALID under R3's own strict replay. Its three input counts agree, so a refusal here is not an artefact of a
 * malformed file. The refusal shows only that current strict replay does not accept an R3 export; it does not show R3 validity.
 */
it('refuses the internally consistent historical R3 public export under current strict replay', async () => {
  const ex = historicalExport as unknown as Parameters<typeof validateReplayFile>[0] & {
    inputs: unknown[];
    state: { inputs: unknown[]; applied: number; minute: number };
  };
  expect(ex.inputs).toHaveLength(historicalMeta.prefix.inputs);
  expect(ex.state.inputs).toHaveLength(ex.inputs.length);
  expect(ex.state.applied).toBe(ex.inputs.length);
  expect(ex.state.minute).toBe(historicalMeta.prefix.minute);
  expect(ex.state.inputs).toEqual(ex.inputs);
  expect(historicalMeta.listsAgree).toBe(true);
  expect(historicalMeta.validUnderR3Replay).toBe(true);
  await expect(validateReplayFile(ex)).rejects.toThrow(
    'Keep this file and start a new game. This kitchen uses different guest request rules.',
  );
}, 120000);

it('does not offer a second lesson to a learner already working at the grill', () => {
  const s = restoreState(checkpoint);
  queueInput(s, { kind: 'grill-lesson', learner: 'rafi' });
  queueInput(s, { kind: 'ask', cook: 'rafi', verb: 'grill', insist: true });
  // Fixed station-guard control: six steps, ending 2621. Practice is not this guard's premise.
  // The failed post-practice 2622 point remains immutable in
  // pass-three-gaps-trace1102/run-root-01: T11 then lacks cold, not grill.
  // The separate seven-step practice/food/replay/cold30 positive is unchanged.
  for (let i = 0; i < 6; i++) step(s);
  expect(s.minute).toBe(2621);
  expect(s.version).toBe('pass@20');
  expect(s.phase).toBe('service');
  expect(s.privateAccounts?.selim).toBeDefined();
  const lesson = s.grillLessons?.[0];
  expect(lesson?.state).toBe('demonstrated');
  expect(lesson?.teacherCompleted).toBeGreaterThan(lesson?.at ?? 0);
  const learnerWork = communityRun(s.chef).active.find((a) => a.person === 'rafi');
  expect(learnerWork).toBeDefined();
  expect(learnerWork?.offer.id).toBe('grill');
  expect(lesson?.learnerActivity).toBeDefined();
  expect(learnerWork?.id).toBe(lesson?.learnerActivity);
  expect(personOf(s, 'rafi').activity?.affordanceId).toBe('grill');
  expect(stationOf(s, 'rafi')).toBe('grill');
  expect(s.crew.some((m) => m.id === 'rafi' && !m.left)).toBe(true);
  for (const who of ['rafi', 'selim']) {
    expect(s.cooks.some((c) => c.id === who && c.here && !c.gone)).toBe(true);
    expect(inKitchen(s, who)).toBe(true);
    expect(['no-replies', 'resign', 'conversation', 'explain-wait', 'clear-table']).not.toContain(
      personOf(s, who).activity?.affordanceId,
    );
    expect(attentionAvailable(s, who)).toBe(true);
  }
  expect(s.grillLessons?.some((x) => ['waiting', 'watching'].includes(x.state))).toBe(false);
  expect(s.tickets.find((t) => t.id === 11)).toMatchObject({ status: 'open', doneGrill: 0, grill: 1 });
  expect(s.tickets.some((t) => t.status === 'open' && t.doneGrill < t.grill)).toBe(true);
  expect(grillLessonAvailable(s, 'rafi')).toBe(false);
  queueInput(s, { kind: 'grill-lesson', learner: 'rafi' });
  expect(s.grillLessons).toHaveLength(1);
}, 120000);

it('never completes interrupted guidance from a later ordinary activity', () => {
  const s = restoreState(checkpoint);
  queueInput(s, { kind: 'grill-lesson', learner: 'rafi' });
  const activity = s.grillLessons?.[0]?.teacherActivity;
  expect(activity).toBeDefined();
  interrupt(personOf(s, 'selim'), s.minute, 'control:guidance-interrupted');
  queueInput(s, { kind: 'ask', cook: 'rafi', verb: 'grill', insist: true });
  for (let i = 0; i < 10; i++) step(s);
  expect(s.grillLessons?.[0]?.state).toBe('interrupted');
  expect(s.grillLessons?.[0]?.food).toBeUndefined();
  expect(s.grillLessons?.[0]?.teacherCompleted).toBeUndefined();
  expect(verifyCommunity(s.chef).verified).toBe(true);
}, 120000);
