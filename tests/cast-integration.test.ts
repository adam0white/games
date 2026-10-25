import { snapshot } from '@adam0white/human-framework';
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
import { loadGame, saveGame } from '../src/game/persistence';
import { replayRecordedRun } from '../src/game/replay';

const stamps = { game: 'repair', build: 'test', engine: '2.23.0', rules: 'canonical-workshop-2' };
async function source(id: string) {
  const person = createGame(42).people[id]!;
  person.traits.honesty = 0.91;
  person.body.fitness = 0.37;
  const { transfer, limitations } = await workshopTransfer(person);
  const castId = CAST_IDS[id]!;
  const branchId = `test-${id}`;
  return createPersona({
    format: 'hf-persona/1',
    castId,
    castRevision: canonicalCast(castId).revision,
    branchId,
    parentRevision: null,
    source: stamps,
    transfer: { ...transfer, life: initialPersonaLife(castId, branchId, 0) },
    limitations,
  });
}
describe('released whole-cast workshop adapter', () => {
  it('admits two changed actual people atomically, pins their life and replays without the shelf', async () => {
    const parents = await Promise.all(['nora', 'rafi'].map(source));
    let shelf: PersonaShelfState = { heads: {}, revisions: [] };
    for (const p of parents) shelf = acceptPersona(shelf, p);
    const initialShelf = structuredClone(shelf);
    const inputs = parents.map((p) => preparePersonaLife(p, 24 * 3600000));
    const result = await claimCastChapterBatch(
      {
        async request<T>(request: PersonaRequest) {
          if (request.action === 'prepareBatch')
            return {
              expectedHeads: Object.fromEntries(
                CAST.map((c) => [c.castId, shelf.heads[c.castId] ?? null]),
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
      CAST.map((c) => c.castId),
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
    expect(shelf.revisions.length).toBe(initialShelf.revisions.length + 2);
    const chapter: CastChapter = {
      version: 'workshop-cast/1',
      inputs: result!.inputs,
      claims: result!.claims,
    };
    let state = createGame(42, 'current', result!.initial, chapter);
    expect(state.people.nora!.traits.honesty).toBe(0.91);
    for (const person of Object.values(state.people))
      expect(person.lexicon?.plainEnglish).toBe(true);
    expect(state.people.rafi!.body.fitness).toBe(0.37);
    expect(state.castChapter!.inputs[0]!.life).toEqual(inputs[0]!.life);
    state = dispatch(state, { type: 'wait', minutes: 15 }).state;
    expect(state.npcWork.find((w) => w.personId === 'nora')?.option.label).toBe('repair design');
    expect(state.npcWork.find((w) => w.personId === 'rafi')).toBeUndefined();
    state = dispatch(state, { type: 'wait', minutes: 60 }).state;
    expect(state.npcWork.find((w) => w.personId === 'rafi')?.option.label).toBe(
      'supervised repair preparation',
    );
    const saved = saveGame(state);
    expect(saveGame(loadGame(saved))).toBe(saved);
    expect(replayRecordedRun({ ...state, inputs: state.inputs }, saved).ok).toBe(true);
    const changed = structuredClone(state.openingPeople!);
    changed.nora!.body.fitness = 0.99;
    expect(() => createGame(42, 'current', changed, chapter)).toThrow('do not match');
    const tampered = JSON.parse(saved);
    tampered.openingPeople = changed;
    expect(() => loadGame(JSON.stringify(tampered))).toThrow('do not match');
    expect(snapshot(state.people.nora!)).not.toEqual(snapshot(createGame(42).people.nora!));
  });
  it('refuses an unsupported person before any claim and refuses stale whole-batch writes', async () => {
    const parent = await source('nora');
    const input = preparePersonaLife(parent, 3600000);
    const bad = structuredClone(input);
    bad.parent.source.game = 'unregistered';
    expect(() => admitWorkshop(bad, createGame(42).people.nora!)).toThrow('cannot load people');
    let shelf = acceptPersona({ heads: {}, revisions: [] }, parent);
    const { revision, ...body } = parent;
    const first = await createPersona({ ...body, parentRevision: revision, source: stamps });
    shelf = acceptPersona(shelf, first);
    expect(() =>
      acceptPersonaBatch(shelf, [first], { [parent.castId]: parent.revision }),
    ).toThrow();
  });
  it('keeps source illness and active projects as actual refusals and closes owned death authority', async () => {
    const sam = createGame(42).people.sam!;
    await expect(workshopTransfer(sam)).rejects.toThrow('project');
    await expect(workshopTransfer(createGame(42).people.halil!)).rejects.toThrow('health');
    const parent = await source('nora');
    const terminal = await closePersonaBranch(parent, stamps, 600);
    const closed = acceptPersona(acceptPersona({ heads: {}, revisions: [] }, parent), terminal);
    const { revision, terminal: _terminal, ...body } = terminal;
    const child = await createPersona({
      ...body,

      parentRevision: revision,
      source: stamps,
    });
    expect(() => acceptPersona(closed, child)).toThrow();
  });
});
