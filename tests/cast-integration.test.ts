import { replay } from '@adam0white/human-framework';
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
import { createPeopleRuntime, createPerson, snapshotRuntime } from '../src/game/hf';
import { loadGame, saveGame } from '../src/game/persistence';
import { replayRecordedRun } from '../src/game/replay';

const stamps = { game: 'repair', build: 'test', engine: '4.5.2', rules: 'canonical-workshop-2' };
// Explicit public authoring makes a distinct source. No cache edit changes an HF actor.
async function source(id: 'nora' | 'rafi') {
  const castId = CAST_IDS[id]!;
  const cast = canonicalCast(castId);
  const people = createPeopleRuntime(17, 540, ['rest']);
  const person = createPerson(people, {
    id,
    name: cast.name,
    age: cast.age,
    sex: id === 'nora' ? 'female' : 'male',
    now: 540,
    traits: { honesty: 0.91 },
    body: { fitness: 0.37 },
  });
  const { transfer, limitations } = await workshopTransfer(person);
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
    await expect(workshopTransfer(state.people.sam!)).rejects.toThrow();
    await expect(workshopTransfer(state.people.halil!)).rejects.toThrow();
    const parent = await source('nora');
    const terminal = await closePersonaBranch(parent, stamps, 600);
    const closed = acceptPersona(acceptPersona({ heads: {}, revisions: [] }, parent), terminal);
    const { revision, terminal: _terminal, ...body } = terminal;
    const child = await createPersona({ ...body, parentRevision: revision, source: stamps });
    expect(() => acceptPersona(closed, child)).toThrow();
  });
});
