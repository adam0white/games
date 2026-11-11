import { expect, it } from 'vitest';
import { replayExport, validateReplayFile } from '../src/sim/continuation.ts';

it('refuses an old notebook without changing its source data', async () => {
  const file = { game: 'pass@12', seed: 7, inputs: [] };
  const original = structuredClone(file);
  expect(() => replayExport(file)).toThrow('Keep this file and start a new game');
  await expect(validateReplayFile(file)).rejects.toThrow('Keep this file and start a new game');
  expect(file).toEqual(original);
});
