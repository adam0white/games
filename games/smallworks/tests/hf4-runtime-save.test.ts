import { replay } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { attachWorkshop, createPeopleRuntime, createPerson, snapshotRuntime } from '../src/game/hf';
import { loadGame, saveGame } from '../src/game/persistence';

function savedOpening() {
  const people = createPeopleRuntime(17, 540, ['rest']);
  createPerson(people, { id: 'sam', name: 'Sam', age: 20, sex: 'male', now: 540 });
  return JSON.parse(JSON.stringify({ people, hf: snapshotRuntime(people) }));
}

describe('HF4 game save envelope', () => {
  it('refuses an unknown outer field without changing the original workshop', () => {
    const state = createGame(17);
    const before = saveGame(state);
    const changed = JSON.parse(before);
    changed.unrecognized = true;
    expect(() => loadGame(JSON.stringify(changed))).toThrow();
    expect(saveGame(state)).toBe(before);
  });

  it('refuses a cached bodily change absent from the HF archive', () => {
    const saved = JSON.parse(saveGame(createGame(17)));
    saved.people.nora.body.satiety = 0.01;
    expect(() => loadGame(JSON.stringify(saved))).toThrow();
  });
});

describe('HF4 runtime save boundary', () => {
  it('restores the JSON archive and the same inspection cache', () => {
    const state = savedOpening();
    const before = structuredClone(state);
    attachWorkshop(state);
    expect(state.people).toEqual(before.people);
    expect(snapshotRuntime(state.people)).toEqual(before.hf);
  });

  it('refuses an unknown runtime field', () => {
    const state = savedOpening();
    state.hf.unrecognized = true;
    expect(() => attachWorkshop(state)).toThrow();
  });

  it('refuses an invalid next input sequence', () => {
    const state = savedOpening();
    state.hf.nextInput = 0;
    expect(() => attachWorkshop(state)).toThrow();
  });

  it('refuses host work absent from the accepted HF activity', () => {
    const state = savedOpening();
    state.hf.active.sam = {
      id: 'invented-activity',
      person: 'sam',
      offer: { id: 'rest', action: 'rest', label: 'Rest', duration: 5, effort: 0 },
      native: {},
      start: 540 * 60_000,
      end: 545 * 60_000,
    };
    expect(() => attachWorkshop(state)).toThrow();
  });
});

it('keeps unsaved sibling histories isolated across public checkpoints', () => {
  const opening = createGame(42);
  const initial = saveGame(opening);
  const jobId = opening.selectedJobId;
  const shared = dispatch(opening, { type: 'verify', jobId, condition: 'movement' }).state;
  const work = {
    type: 'work' as const,
    jobId,
    componentId: 'switch',
    intervention: 'replace' as const,
  };
  const left = dispatch(shared, work).state;
  // The shared branch has no cold save yet. Taking its other path must replay
  // its public call prefix without changing either the source or the first path.
  const right = dispatch(shared, { type: 'wait', minutes: 1 }).state;
  const sharedSave = saveGame(shared);
  const leftSave = saveGame(left);
  expect(saveGame(dispatch(loadGame(sharedSave), work).state) === leftSave).toBe(true);
  expect(
    saveGame(dispatch(loadGame(sharedSave), { type: 'wait', minutes: 1 }).state) ===
      saveGame(right),
  ).toBe(true);
  expect(saveGame(opening) === initial).toBe(true);
  const archive = JSON.parse(leftSave).hf.archive;
  const exact = replay(archive);
  expect(exact.ok && exact.value.verified && exact.value.fullHash === archive.hashes.full).toBe(
    true,
  );
});
