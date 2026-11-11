import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { replayExport, validateReplayFile } from '../src/sim/continuation.ts';
import {
  boardDefaults,
  cloneState,
  type Export,
  exportRun,
  newGame,
  queueInput,
  step,
} from '../src/sim/kitchen.ts';

it('keeps the historical full notebook unchanged and refuses it', async () => {
  const file = JSON.parse(
    readFileSync(new URL('./fixtures/followup-pass@13-before.json', import.meta.url), 'utf8'),
  );
  const original = structuredClone(file);
  await expect(validateReplayFile(file)).rejects.toThrow('Keep this file and start a new game');
  expect(file).toEqual(original);
});

function currentRun() {
  const state = newGame(42, 'pass@20');
  queueInput(state, { kind: 'board', rows: boardDefaults(state) });
  queueInput(state, { kind: 'open' });
  step(state);
  return state;
}

it('rejects null and altered current full states', async () => {
  const full = JSON.parse(JSON.stringify(exportRun(currentRun(), '4.17.0'))) as Export;
  await expect(validateReplayFile({ ...full, state: null } as never)).rejects.toThrow();
  const altered = structuredClone(full);
  altered.state.price += 1;
  await expect(validateReplayFile(altered)).rejects.toThrow();
});

it('keeps current full and compact notebooks on the same complete continuation', async () => {
  const original = currentRun();
  const full = JSON.parse(JSON.stringify(exportRun(original, '4.17.0'))) as Export;
  const { state: _state, ...header } = full;
  const compact = { ...header, minute: original.minute, hf4Host: { schema: 'pass-hf4/2' } };
  const loadedFull = await validateReplayFile(full);
  const loadedCompact = await validateReplayFile(compact);
  expect(cloneState(loadedFull)).toEqual(full.state);
  expect(cloneState(loadedCompact)).toEqual(full.state);
  step(original);
  step(loadedFull);
  step(loadedCompact);
  expect(cloneState(loadedFull)).toEqual(cloneState(original));
  expect(cloneState(loadedCompact)).toEqual(cloneState(original));
  expect(() => replayExport({ ...compact, game: 'pass@13' })).toThrow('Keep this file and start a new game');
});
