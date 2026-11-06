import { expect, test } from 'vitest';
import { advance, apply, newGame, replay, view } from '../src/sim/index.ts';
import type { State } from '../src/sim/types.ts';
import { exportRun, verifyImport } from '../src/ui/export.ts';
import { createFileSession } from '../src/ui/file-session.ts';
import historicalState from './fixtures/historical-refusal-state.json' with { type: 'json' };

test('historical export is refused without replacing the held file', async () => {
  // Existing authored two-input historical envelope, also checked by export.test.ts.
  const old = {
    game: 'goodhands',
    version: 1,
    seed: 37,
    minute: 519,
    inputs: [
      { at: 510, input: { type: 'interview', candidate: 'sevda' } },
      { at: 510, input: { type: 'choose', scene: 'scene-1', choice: 'q-patient' } },
    ],
    fingerprint: 'ef02eb7b',
  };
  const oldFile = new File([JSON.stringify(old)], 'old.json');
  const current = new File([JSON.stringify(exportRun(newGame(24), []))], 'current.json');
  const session = createFileSession();
  await session.select(current);
  const before = session.snapshot();
  const original = session.original();
  await expect(session.select(oldFile)).rejects.toThrow(/keep.*start a new game/i);
  expect(session.snapshot()).toEqual(before);
  expect(session.original()).toEqual(original);
  expect(() => verifyImport(JSON.stringify(old))).toThrow(/keep.*start a new game/i);
  expect(() => newGame(37, 2)).toThrow(/start a new game/i);
  expect(() => replay(37, [], old.minute, 1)).toThrow(/start a new game/i);
  const state = historicalState as unknown as State;
  expect(() => view(state)).toThrow(/start a new game/i);
  expect(() => apply(state, { type: 'speed', speed: 2 })).toThrow(/start a new game/i);
  expect(() => advance(state, 1)).toThrow(/start a new game/i);
});

test('an old guest continuity book leaves the selected current file and native storage untouched', async () => {
  const { validateContinuity } = await import('../src/ui/export.ts');
  const { emptyContinuity } = await import('../src/ui/continuity.ts');
  const current = exportRun(newGame(24), []);
  const session = createFileSession();
  await session.select(new File([JSON.stringify(current)], 'current.json'));
  const held = session.snapshot();
  const bytes = session.original();
  // Deliberately untrusted arrival: refusal precedes historic preparation or any state restoration.
  const oldBook = { ...emptyContinuity(), arrivals: [{ initial: { version: historicalState.version } }] };
  const old = { ...current, continuity: oldBook, oneCast: [] };
  let writes = 0;
  const native = globalThis.indexedDB;
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open() {
        writes++;
        throw new Error('Unexpected native write');
      },
    },
  });
  try {
    await expect(session.select(new File([JSON.stringify(old)], 'old-arrivals.json'))).rejects.toThrow(
      /keep.*start a new game/i,
    );
    await expect(validateContinuity(oldBook as never)).rejects.toThrow(/keep.*start a new game/i);
    expect(session.snapshot()).toEqual(held);
    expect(session.original()).toEqual(bytes);
    expect(writes).toBe(0);
  } finally {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: native });
  }
});
