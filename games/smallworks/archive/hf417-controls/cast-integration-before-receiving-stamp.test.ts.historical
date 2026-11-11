import { readRunHistory, replay, validatePortablePerson } from '@adam0white/human-framework';
import {
  acceptPersona,
  acceptPersonaBatch,
  canonicalCast,
  claimCastChapterBatch,
  closePersonaBranch,
  createPersona,
  initialPersonaLife,
  type PersonaRequest,
  type PersonaShelfState,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import {
  admitWorkshop,
  CAST,
  CAST_IDS,
  type CastChapter,
  workshopTransfer,
} from '../src/game/cast';
import { createGame, dispatch } from '../src/game/engine';
import { createPeopleRuntime, createPerson, promise, snapshotRuntime } from '../src/game/hf';
import { loadGame, saveGame } from '../src/game/persistence';
import { replayRecordedRun } from '../src/game/replay';
import { historicalPerson } from './historical-hf411';

const stamps = { game: 'repair', build: 'test', engine: '4.11.0', rules: 'canonical-workshop-3' };
// Explicit public authoring makes a distinct source. No cache edit changes an HF actor.
async function source(id: 'nora' | 'rafi', prayer = false, prayerFrom = 540) {
  const castId = CAST_IDS[id]!;
  const cast = canonicalCast(castId);
  const people = createPeopleRuntime(17, 540, prayer ? ['rest', 'pray'] : ['rest']);
  const person = createPerson(people, {
    id,
    name: cast.name,
    age: cast.age,
    sex: id === 'nora' ? 'female' : 'male',
    now: 540,
    traits: { honesty: 0.91 },
    body: { fitness: 0.37 },
  });
  if (prayer)
    promise(person, {
      kind: 'worship',
      actions: ['pray'],
      from: prayerFrom,
      until: prayerFrom + 60,
      importance: 1,
      label: 'A retained prayer duty',
    });
  const transfer = {
    castPassport: 'workshop-hf4/1',
    sourceRole: id,
    person: historicalPerson(snapshotRuntime(people).archive, id, castId, cast.revision),
  };
  const limitations: string[] = [];
  const native = replay(snapshotRuntime(people).archive);
  expect(native.ok).toBe(true);
  if (native.ok) expect(native.value.verified).toBe(true);
  const branchId = `test-${id}`;
  return createPersona({
    format: 'hf-persona/1',
    castId,
    castRevision: cast.revision,
    branchId,
    parentRevision: null,
    source: stamps,
    transfer: { ...transfer, life: initialPersonaLife(castId, branchId, 0) },
    limitations,
  });
}

describe('released HF4 whole-cast workshop adapter', () => {
  it('admits a Commonstead retained v2 envelope with its canonical source identity', async () => {
    const original = await source('nora');
    const portable = structuredClone(validatePortablePerson(original.transfer.person));
    portable.source.game = 'commonstead';
    portable.source.personId = original.castId;
    const { revision: _revision, ...body } = original;
    const parent = await createPersona({
      ...body,
      source: { ...stamps, game: 'commonstead', rules: 'commonstead-4' },
      transfer: {
        castPassport: 'commonstead-retained/4',
        sourceRole: original.castId,
        portable,
        life: original.transfer.life,
      },
    });
    const input = preparePersonaLife(parent, 0);
    const opening = createGame(42).people.nora!;
    const admitted = admitWorkshop(input, opening);
    expect(admitted.traits.honesty).toBeCloseTo(0.91, 9);
    expect(admitted.body.fitness).toBeCloseTo(0.37, 9);
    const bad = structuredClone(input);
    bad.parent.transfer.sourceRole = 'nora';
    expect(() => admitWorkshop(bad, opening)).toThrow();
    const wrongRules = structuredClone(input);
    wrongRules.parent.source.rules = 'unknown';
    expect(() => admitWorkshop(wrongRules, opening)).toThrow();
  });
  it('admits two authored source people atomically and replays without the shelf', async () => {
    const parents = await Promise.all([source('nora'), source('rafi')]);
    let shelf: PersonaShelfState = { heads: {}, revisions: [] };
    for (const parent of parents) shelf = acceptPersona(shelf, parent);
    const initialCount = shelf.revisions.length;
    const inputs = parents.map((parent) => preparePersonaLife(parent, 24 * 3_600_000));
    const result = await claimCastChapterBatch(
      {
        async request<T>(request: PersonaRequest) {
          if (request.action === 'prepareBatch')
            return {
              expectedHeads: Object.fromEntries(
                CAST.map((cast) => [cast.castId, shelf.heads[cast.castId] ?? null]),
              ),
              inputs,
              blocked: [],
            } as T;
          if (request.action === 'putBatch') {
            shelf = acceptPersonaBatch(shelf, request.envelopes!, request.expectedHeads);
            return null as T;
          }
          throw new Error('Unexpected request');
        },
      },
      CAST.map((cast) => cast.castId),
      stamps,
      async (prepared) => {
        const people = createGame(42).people;
        for (const input of prepared) {
          const role = Object.keys(CAST_IDS).find((id) => CAST_IDS[id] === input.parent.castId)!;
          people[role] = admitWorkshop(input, people[role]!);
        }
        return people;
      },
    );
    expect(result?.claims).toHaveLength(2);
    expect(shelf.revisions.length).toBe(initialCount + 2);
    const chapter: CastChapter = {
      version: 'workshop-cast/1',
      inputs: result!.inputs,
      claims: result!.claims,
    };
    let state = createGame(42, 'current', result!.initial, chapter);
    // Public ingress advances a few milliseconds before the opening inspection.
    expect(state.people.nora!.traits.honesty).toBeCloseTo(0.91, 9);
    expect(state.people.rafi!.body.fitness).toBeCloseTo(0.37, 9);
    expect(state.castChapter!.inputs[0]!.life).toEqual(inputs[0]!.life);
    state = dispatch(state, { type: 'wait', minutes: 5 }).state;
    const saved = saveGame(state);
    expect(saveGame(loadGame(saved))).toBe(saved);
    const native = replay(JSON.parse(saved).hf.archive);
    expect(native.ok).toBe(true);
    if (native.ok) {
      expect(native.value.verified).toBe(true);
      expect(native.value.fullHash).toBe(JSON.parse(saved).hf.archive.hashes.full);
    }
    expect(replayRecordedRun({ ...state, inputs: state.inputs }, saved).ok).toBe(true);
    const changed = structuredClone(state.openingPeople!);
    changed.nora!.body.fitness = 0.99;
    expect(() => createGame(42, 'current', changed, chapter)).toThrow('do not match');
    const tampered = JSON.parse(saved);
    tampered.openingPeople = changed;
    expect(() => loadGame(JSON.stringify(tampered))).toThrow();
  });
  it('refuses unsupported sources and stale whole-batch writes', async () => {
    const parent = await source('nora');
    const input = preparePersonaLife(parent, 3_600_000);
    const bad = structuredClone(input);
    bad.parent.source.game = 'unregistered';
    expect(() => admitWorkshop(bad, createGame(42).people.nora!)).toThrow();
    let shelf = acceptPersona({ heads: {}, revisions: [] }, parent);
    const { revision, ...body } = parent;
    const first = await createPersona({ ...body, parentRevision: revision, source: stamps });
    shelf = acceptPersona(shelf, first);
    expect(() =>
      acceptPersonaBatch(shelf, [first], { [parent.castId]: parent.revision }),
    ).toThrow();
  });
  it('refuses ongoing goals and clinical state and preserves closed branch authority', async () => {
    const state = createGame(42);
    await expect(workshopTransfer(state.people.sam!, state)).rejects.toThrow();
    await expect(workshopTransfer(state.people.halil!, state)).rejects.toThrow();
    const parent = await source('nora');
    const terminal = await closePersonaBranch(parent, stamps, 600);
    const closed = acceptPersona(acceptPersona({ heads: {}, revisions: [] }, parent), terminal);
    const { revision, terminal: _terminal, ...body } = terminal;
    const child = await createPersona({ ...body, parentRevision: revision, source: stamps });
    expect(() => acceptPersona(closed, child)).toThrow();
  });
});

it('keeps historical worship actions on workshop re-entry', async () => {
  const parent = await source('nora', true);
  const input = preparePersonaLife(parent, 0);
  const base = createGame(42);
  admitWorkshop(input, base.people.nora!);
  const archive = snapshotRuntime(base.people).archive;
  expect(archive.initial.spec.definitions.actions.some((action) => action.id === 'pray')).toBe(
    true,
  );
  expect(archive.initial.people.find((person) => person.id === 'nora')?.portable?.person).toEqual(
    parent.transfer.person,
  );
  expect(
    base.people.nora?.agenda.commitments.some(
      (duty) => duty.actions.includes('pray') && duty.status === 'pending',
    ),
  ).toBe(true);
  const exact = replay(archive);
  expect(exact.ok && exact.value.verified).toBe(true);
});

it('restores a carried person during jobless prayer and finishes it exactly once', async () => {
  const parent = await source('nora', true, 600);
  const input = preparePersonaLife(parent, 0);
  let shelf = acceptPersona({ heads: {}, revisions: [] }, parent);
  const result = await claimCastChapterBatch(
    {
      async request<T>(request: PersonaRequest) {
        if (request.action === 'prepareBatch')
          return {
            expectedHeads: Object.fromEntries(
              CAST.map((cast) => [cast.castId, shelf.heads[cast.castId] ?? null]),
            ),
            inputs: [input],
            blocked: [],
          } as T;
        if (request.action === 'putBatch') {
          shelf = acceptPersonaBatch(shelf, request.envelopes!, request.expectedHeads);
          return null as T;
        }
        throw new Error('Unexpected request');
      },
    },
    CAST.map((cast) => cast.castId),
    stamps,
    async (inputs) => {
      const people = createGame(42).people;
      const input = inputs[0];
      if (!input || !people.nora) throw new Error('Missing carried prayer opening');
      people.nora = admitWorkshop(input, people.nora);
      return people;
    },
  );
  if (!result) throw new Error('Missing carried prayer claim');
  const chapter: CastChapter = {
    version: 'workshop-cast/1',
    inputs: result.inputs,
    claims: result.claims,
  };
  let state = createGame(42, 'current', result.initial, chapter);
  for (const minutes of [60, 1]) {
    const waiting = dispatch(state, { type: 'wait', minutes });
    expect(waiting.ok, waiting.message).toBe(true);
    state = waiting.state;
  }
  const prayer = state.npcWork.find((work) => work.personId === 'nora');
  expect(prayer?.option.action).toBe('pray');
  if (!prayer) throw new Error('Missing active prayer');
  expect(prayer?.jobId).toBeUndefined();
  expect(prayer.endsAt).toBeGreaterThan(state.now);
  const saved = saveGame(state);
  const restored = loadGame(saved);
  expect(saveGame(restored)).toBe(saved);
  const native = replay(JSON.parse(saved).hf.archive);
  expect(native.ok && native.value.verified).toBe(true);
  const game = replayRecordedRun(JSON.parse(saved), saved);
  expect(game.ok).toBe(true);
  if (game.ok) expect(game.save).toBe(saved);
  const finished = dispatch(restored, { type: 'wait', minutes: 15 });
  expect(finished.ok, finished.message).toBe(true);
  const nora = finished.state.people.nora;
  if (!nora) throw new Error('Missing restored Nora');
  const kept = nora.agenda.commitments.filter(
    (duty) => duty.actions.includes('pray') && duty.status === 'kept',
  );
  expect(kept).toHaveLength(1);
  const completions = readRunHistory(snapshotRuntime(finished.state.people).archive)
    .flatMap((tx) => tx.inputs)
    .filter(
      (input) =>
        input.kind === 'action.resolved' &&
        input.payload.person === 'nora' &&
        input.payload.stage === 'finish' &&
        input.payload.disposition === 'completed' &&
        input.payload.outcome?.actionId === 'pray',
    );
  expect(completions).toHaveLength(1);
  const continued = saveGame(finished.state);
  expect(saveGame(loadGame(continued))).toBe(continued);
  const continuedNative = replay(JSON.parse(continued).hf.archive);
  expect(continuedNative.ok && continuedNative.value.verified).toBe(true);
  const continuedGame = replayRecordedRun(JSON.parse(continued), continued);
  expect(continuedGame.ok).toBe(true);
  if (continuedGame.ok) expect(continuedGame.save).toBe(continued);
});
