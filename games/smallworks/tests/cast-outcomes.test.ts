import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { readRunHistory, replay as replayNative } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { activityEndMs, snapshotRuntime } from '../src/game/hf';
import {
  OUTCOME_TERMS,
  type OutcomeAction,
  outcomeBoundary,
  outcomeDone,
  requestOutcome,
} from '../src/game/outcomes';
import { chooseActivity, startActivity } from '../src/game/people';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';
import { reAuthor } from './hf-fixture';

function act(s: GameState, c: Command) {
  const r = dispatch(s, c);
  expect(r.ok, r.message).toBe(true);
  return r.state;
}
describe('optional cast outcomes', () => {
  it('refuses the historical HF3 baseline without rewriting its retained evidence', () => {
    const b = JSON.parse(
      readFileSync(new URL('./fixtures/cast-outcomes-baseline.json', import.meta.url), 'utf8'),
    );
    expect(() => loadGame(b.initial)).toThrow();
    expect(() => loadGame(b.continued)).toThrow();
  });
  it('records an explicit isolated edition and refuses undisclosed outcomes', () => {
    const base = createGame(416);
    const s = act(base, { type: 'start-cast-outcomes' });
    expect(s.provenance?.scenario).toBe('cast-outcomes@1');
    expect(replayRecordedRun({ seed: s.seed, inputs: [], provenance: s.provenance }).ok).toBe(
      false,
    );
    expect(replayRecordedRun({ ...s, inputs: s.inputs, provenance: base.provenance }).ok).toBe(
      false,
    );
    expect(dispatch(s, { type: 'cast-outcome', action: 'sam-correction' }).ok).toBe(false);
    expect(saveGame(loadGame(saveGame(s)))).toBe(saveGame(s));
    const crossed = JSON.parse(saveGame(s));
    crossed.provenance.scenario = 'canonical-workshop@2';
    expect(() => loadGame(JSON.stringify(crossed))).toThrow();
    const unsupported = JSON.parse(saveGame(s));
    unsupported.provenance.scenario = 'cast-outcomes@9';
    expect(() => loadGame(JSON.stringify(unsupported))).toThrow();
    const replay = replayRecordedRun({ ...s, inputs: s.inputs }, saveGame(s));
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.save).toBe(saveGame(s));
  });
});

function start(seed = 42) {
  return act(createGame(seed), { type: 'start-cast-outcomes' });
}
function samDisclosure() {
  let s = start();
  s = act(s, { type: 'watch', enabled: true });
  s = act(s, { type: 'inspect', jobId: s.selectedJobId, componentId: 'switch' });
  s = act(s, { type: 'ask-about-work', personId: 'sam' });
  return act(s, { type: 'watch', enabled: false });
}
function otherDisclosure(id: 'nora' | 'rafi' | 'halil', initialState = start()) {
  let s = initialState;
  if (s.day < 2) s = act(s, { type: 'next-day' });
  if (id === 'halil' && s.day < 3) s = act(s, { type: 'next-day' });
  const j = s.jobs.find((j) => j.ownerId === id);
  if (!j) throw new Error('No visitor object');
  s = act(s, { type: 'accept', jobId: j.id });
  s = act(s, { type: 'inspect', jobId: j.id, componentId: 'contact' });
  return act(s, { type: 'ask-about-work', personId: id });
}
function complete(s: GameState, action: OutcomeAction) {
  // Re-ask only after the actor's actual alternative activity. No seed or world edits.
  for (let n = 0; n < 12 && !outcomeDone(s, action); n++) {
    const r = dispatch(s, { type: 'cast-outcome', action });
    expect(r.ok, r.message).toBe(true);
    s = r.state;
    s = act(s, {
      type: 'wait',
      minutes: s.castOutcomes?.pending ? OUTCOME_TERMS[action].minutes : 30,
    });
  }
  expect(outcomeDone(s, action), action).toBe(true);
  return s;
}
function exact(s: GameState, name: string) {
  const raw = saveGame(s);
  expect(saveGame(loadGame(raw))).toBe(raw);
  const full = JSON.parse(gunzipSync(gzipSync(raw)).toString());
  const compact = JSON.parse(
    gunzipSync(
      gzipSync(
        JSON.stringify({
          seed: s.seed,
          inputs: s.inputs,
          provenance: s.provenance,
          ...(s.openingPeople ? { openingPeople: s.openingPeople } : {}),
          ...(s.castChapter ? { castChapter: s.castChapter } : {}),
        }),
      ),
    ).toString(),
  );
  const derived = replayRecordedRun(compact, raw);
  expect(derived.ok).toBe(true);
  if (derived.ok) expect(derived.save).toBe(raw);
  const replay = replayRecordedRun({ ...full, inputs: full.inputs }, raw);
  expect(replay.ok, JSON.stringify(replay)).toBe(true);
  if (replay.ok) {
    expect(replay.save).toBe(raw);
    let loaded = loadGame(raw),
      replayed = replay.state;
    const remaining = s.castOutcomes?.pending ? s.castOutcomes.pending.endsAt - s.now : 0;
    for (const c of [
      { type: 'wait', minutes: Math.max(7, remaining) },
      { type: 'next-day' },
    ] as Command[]) {
      loaded = act(loaded, c);
      replayed = act(replayed, c);
    }
    expect(saveGame(replayed)).toBe(saveGame(loaded));
    if (process.env.OUTCOME_EVIDENCE)
      writeFileSync(
        `${process.env.OUTCOME_EVIDENCE}/${name}.json`,
        JSON.stringify({ save: raw, continued: saveGame(loaded) }),
      );
  }
}
describe('attended outcome mechanisms', () => {
  it('retains Sam’s copied report, records a real correction, and pays only a fulfilled separate shift', () => {
    let s = samDisclosure();
    const original = structuredClone(s.castOutcomes?.originalReport);
    s = complete(s, 'sam-correction');
    expect(s.castOutcomes?.originalReport).toEqual(original);
    s = complete(s, 'sam-terms');
    expect(s.castOutcomes?.samCash).toBe(0);
    let begun = act(s, { type: 'cast-outcome', action: 'sam-shift' });
    if (!begun.castOutcomes?.pending) {
      begun = act(begun, { type: 'wait', minutes: 30 });
      begun = act(begun, { type: 'cast-outcome', action: 'sam-shift' });
    }
    expect(begun.castOutcomes?.pending?.action).toBe('sam-shift');
    expect(begun.castOutcomes?.decisions.at(-1)?.says).toBe('Sam agrees to this work.');
    begun = act(begun, { type: 'pause-chapter' });
    expect(dispatch(begun, { type: 'wait', minutes: 5 }).ok).toBe(false);
    const pendingSave = saveGame(begun);
    expect(saveGame(loadGame(pendingSave))).toBe(pendingSave);
    const pendingReplay = replayRecordedRun({ ...begun, inputs: begun.inputs }, pendingSave);
    expect(pendingReplay.ok).toBe(true);
    if (pendingReplay.ok) expect(pendingReplay.save).toBe(pendingSave);
    begun = act(begun, { type: 'resume-chapter' });
    const reserved = begun.cash;
    begun = act(begun, { type: 'wait', minutes: 5 });
    begun = act(begun, { type: 'stop-cast-outcome' });
    expect(begun.castOutcomes?.samCash).toBe(0);
    expect(begun.cash).toBe(reserved + 6);
    expect(outcomeDone(begun, 'sam-shift')).toBe(false);
    s = complete(begun, 'sam-shift');
    expect(s.castOutcomes?.samCash).toBe(6);
    expect(s.castOutcomes?.labelledEvidence?.length).toBeGreaterThan(0);
    exact(s, 'sam');
  });
  it('uses actual Nora activity, consumes a real collar and stores both physical trials and credit', () => {
    let s = otherDisclosure('nora');
    s = complete(s, 'nora-trial');
    expect(s.castOutcomes?.handle.trials[0]?.held).toBe(false);
    const stock = s.stock.gear ?? 0;
    s = complete(s, 'nora-revision');
    expect(s.stock.gear).toBe(stock - 1);
    expect(s.castOutcomes?.handle.credit).toContain('brother');
    s = complete(s, 'nora-retrial');
    expect(s.castOutcomes?.handle.trials[1]?.held).toBe(true);
    exact(s, 'nora');
  });
  it('returns conserved deposit and separate jar money, and repairs the separate appliance through normal bench inputs', () => {
    let s = otherDisclosure('rafi');
    s = complete(s, 'rafi-return');
    expect(s.castOutcomes?.rafi.customerReceived).toBe(4);
    expect(s.castOutcomes?.rafi.heldDeposit).toBe(0);
    s = complete(s, 'rafi-deposit-loan');
    s = complete(s, 'rafi-jar-loan');
    expect(s.castOutcomes?.rafi.workshopDebt).toBe(11);
    s = complete(s, 'rafi-appliance');
    const id = s.castOutcomes?.applianceId;
    if (!id) throw new Error('Missing appliance');
    s = act(s, { type: 'inspect', jobId: id, componentId: 'contact' });
    s = act(s, {
      type: 'measure',
      jobId: id,
      request: { mode: 'voltage', a: 'B', b: 'C', condition: 'load' },
    });
    s = act(s, { type: 'work', jobId: id, componentId: 'contact', intervention: 'clean' });
    s = act(s, { type: 'verify', jobId: id, condition: 'load' });
    s = act(s, { type: 'deliver', jobId: id });
    expect(s.jobs.find((j) => j.id === id)?.returnedUnfinished).not.toBe(true);
    expect(s.castOutcomes?.rafi.workshopDebt).toBe(11);
    exact(s, 'rafi');
  });
  it('separates Halil’s agreed price from work, and only pays an inspected physical service', () => {
    let s = otherDisclosure('rafi');
    s = complete(s, 'rafi-appliance');
    s = otherDisclosure('halil', s);
    s = complete(s, 'halil-terms');
    expect(s.castOutcomes?.halilCash).toBe(0);
    expect(dispatch(s, { type: 'cast-outcome', action: 'halil-service' }).ok).toBe(false);
    const id = s.castOutcomes?.serviceId;
    if (!id) throw new Error('Missing service object');
    s = act(s, { type: 'inspect', jobId: id, componentId: 'contact' });
    s = complete(s, 'halil-service');
    expect(s.castOutcomes?.halilCash).toBe(6);
    expect(s.jobs.find((j) => j.id === id)?.verified).toContain('load');
    expect(s.people.halil?.body.illnesses.some((c) => c.kind === 'hypertension')).toBe(true);
    exact(s, 'halil');
  });
});

it('respects the actual HF decision after missed lessons instead of forcing refusal', () => {
  let s = samDisclosure();
  for (let n = 0; n < 5; n++) {
    s = act(s, { type: 'request-lesson' });
    s = act(s, { type: 'wait', minutes: 60 });
    if (s.pendingRequest) s = act(s, { type: 'cancel-request' });
  }
  s = act(s, { type: 'cast-outcome', action: 'sam-correction' });
  const choice = s.castOutcomes?.decisions.at(-1);
  expect(choice).toBeDefined();
  expect(s.castOutcomes?.pending?.action).toBe(
    choice?.chosen === 'sam-correction' ? 'sam-correction' : undefined,
  );
  expect(outcomeDone(s, 'sam-correction')).toBe(false);
  expect(s.castOutcomes?.samCash).toBe(0);
  exact(s, 'sam-refusal');
});

it('saves immediately when a cast request interrupts background work and is declined', () => {
  const s = start(1);
  const p = s.people.sam;
  if (!p) throw new Error('Missing Sam');
  reAuthor(p, {
    needs: {
      safety: 1,
      belonging: 1,
      esteem: 1,
      autonomy: 1,
      competence: 1,
      leisure: 0,
      meaning: 1,
    },
  });
  const option = {
    id: 'background-test',
    action: 'clean:contact',
    label: 'background work',
    duration: 60,
    effort: 0.9,
  };
  chooseActivity(p, 'workshop', {}, [option], s.now);
  expect(startActivity(p, option, s.now)).toBe(true);
  const stock = s.stock.switch ?? 0;
  s.stock.switch = stock - 1;
  s.npcWork.push({
    personId: p.id,
    option,
    startedAt: s.now,
    endsAt: s.now + option.duration,
    reservedPart: 'switch',
  });
  requestOutcome(s, 'sam-correction');
  expect(s.stock.switch).toBe(stock);
  expect(s.castOutcomes?.decisions.at(-1)?.chosen).toBe('personal');
  expect(s.castOutcomes?.decisions.at(-1)?.says).toBe('Sam chooses “keep my own plans” instead.');
  expect(s.people.sam?.activity?.affordance.id).toBe('personal');
  expect(s.npcWork.filter((w) => w.personId === 'sam')).toHaveLength(1);
  expect(s.npcWork.find((w) => w.personId === 'sam')?.option.id).toBe('personal');
  const raw = saveGame(s);
  expect(saveGame(loadGame(raw))).toBe(raw);
  const advanced = act(loadGame(raw), { type: 'wait', minutes: 1 });
  expect(advanced.stock.switch).toBe(stock);
});

it.each(['npc-first', 'scene-first'] as const)(
  'settles scene and NPC finishes in native order within one displayed minute (%s)',
  (order) => {
    let state = complete(samDisclosure(), 'sam-correction');
    state = act(state, { type: 'wait', minutes: 15 });
    let otherPerson: string | undefined;
    for (let attempts = 0; attempts < 8; attempts++) {
      state = act(state, { type: 'cast-outcome', action: 'sam-terms' });
      const scene = state.castOutcomes?.pending;
      expect(scene?.action).toBe('sam-terms');
      if (!scene || !state.people.sam) throw new Error('Missing accepted terms agreement');
      const sceneEnd = activityEndMs(state.people.sam);
      otherPerson = state.npcWork.find((work) => {
        const person = state.people[work.personId];
        return (
          person &&
          work.endsAt === scene.endsAt &&
          (order === 'npc-first'
            ? activityEndMs(person) < sceneEnd
            : activityEndMs(person) > sceneEnd) &&
          Math.floor(activityEndMs(person) / 60_000) === Math.floor(sceneEnd / 60_000)
        );
      })?.personId;
      if (otherPerson) break;
      state = act(state, { type: 'stop-cast-outcome' });
    }
    expect(otherPerson).toBeDefined();
    const scene = state.castOutcomes?.pending;
    if (!scene || !otherPerson) throw new Error('Missing aligned native finishes');
    const before = snapshotRuntime(state.people);
    const npcActivity = before.active[otherPerson]?.id;
    const sceneActivity = before.active.sam?.id;
    expect(npcActivity).toBeDefined();
    expect(sceneActivity).toBeDefined();
    const cash = state.cash;
    const stock = structuredClone(state.stock);
    const waiting = dispatch(state, { type: 'wait', minutes: scene.endsAt - state.now });
    expect(waiting.ok, waiting.message).toBe(true);
    state = waiting.state;
    expect(outcomeDone(state, 'sam-terms')).toBe(true);
    expect(state.castOutcomes?.pending).toBeUndefined();
    expect(state.cash).toBe(cash);
    expect(state.stock).toEqual(stock);
    const raw = saveGame(state);
    expect(saveGame(loadGame(raw))).toBe(raw);
    const archive = snapshotRuntime(state.people).archive;
    const completions = readRunHistory(archive)
      .flatMap((tx) => tx.inputs)
      .filter(
        (input) =>
          input.kind === 'action.resolved' &&
          input.payload.stage === 'finish' &&
          input.payload.disposition === 'completed' &&
          [npcActivity, sceneActivity].includes(input.payload.activityId),
      );
    expect(completions).toHaveLength(2);
    const first = completions[0];
    const second = completions[1];
    if (!first || !second || first.kind !== 'action.resolved')
      throw new Error('Missing finish receipts');
    expect(first.payload.activityId).toBe(order === 'npc-first' ? npcActivity : sceneActivity);
    expect(first.at).toBeLessThan(second.at);
    const native = replayNative(archive);
    expect(native.ok && native.value.verified).toBe(true);
    const replayed = replayRecordedRun(JSON.parse(raw), raw);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.save).toBe(raw);
  },
);

it.each([
  { name: 'tired', exertion: 0.9 },
  { name: 'rested', exertion: 0 },
])('lets HF reconsider attended work when $name', ({ exertion }) => {
  let s = start(1);
  const p = s.people.sam;
  if (!p || !s.castOutcomes) throw new Error('Missing Sam or outcomes');
  reAuthor(p, {
    needs: {
      safety: 1,
      belonging: 1,
      esteem: 1,
      autonomy: 1,
      competence: 0,
      leisure: 1,
      meaning: 1,
    },
    body: { exertion } as Parameters<typeof reAuthor>[1]['body'],
  });
  const option = {
    id: 'sam-shift',
    action: 'sam-shift',
    label: 'help with the shift',
    duration: 60,
    effort: 0.25,
  };
  chooseActivity(p, 'cast-outcomes', {}, [option], s.now);
  expect(startActivity(p, option, s.now)).toBe(true);
  s.castOutcomes.pending = {
    action: 'sam-shift',
    option,
    startedAt: s.now,
    endsAt: s.now + 60,
    reservedCash: 6,
  };
  const cash = s.cash;
  const boundary = outcomeBoundary(s);
  expect(boundary).toBeLessThan(s.castOutcomes.pending.endsAt);
  s = act(s, { type: 'wait', minutes: boundary - s.now });
  if (exertion > 0) {
    expect(s.castOutcomes?.pending).toBeUndefined();
    expect(s.cash).toBe(cash + 6);
    expect(s.castOutcomes?.samCash).toBe(0);
    expect(outcomeDone(s, 'sam-shift')).toBe(false);
    expect(s.npcWork.find((w) => w.personId === p.id)?.option.id).toBe('rest');
  } else {
    expect(s.castOutcomes?.pending?.action).toBe('sam-shift');
    expect(s.people.sam?.activity?.affordance.id).toBe('sam-shift');
    const endsAt = s.castOutcomes?.pending?.endsAt;
    if (endsAt === undefined) throw new Error('Missing continued work');
    s = act(s, { type: 'wait', minutes: endsAt - s.now });
    expect(outcomeDone(s, 'sam-shift')).toBe(true);
    expect(s.castOutcomes?.samCash).toBe(6);
  }
});
