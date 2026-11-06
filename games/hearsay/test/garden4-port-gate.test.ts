import type { LifeBatchPreparation } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { eligibleGardenBatch } from '../src/sim/garden4-continuity.ts';

it('preserves an explicitly blocked preparation head while other garden roles open', async () => {
  const { freshGarden } = await import('../src/sim/garden4.ts');
  const { admitGardenBatch } = await import('../src/sim/garden4-continuity.ts');
  const castId = 'hf.cast.riza.voice';
  const revision = 'a'.repeat(64);
  const batch = {
    expectedHeads: { [castId]: revision, 'hf.cast.osman.voice': null },
    inputs: [],
    blocked: [{ castId, reason: 'The saved head is unavailable.' }],
  } satisfies LifeBatchPreparation;
  const before = JSON.stringify(batch);
  const eligible = eligibleGardenBatch(batch);
  expect(eligible.inputs).toEqual([]);
  expect(eligible.blocked).toEqual([]);
  expect(eligible.expectedHeads).toEqual(batch.expectedHeads);
  expect(eligible.expectedHeads[castId]).toBe(revision);
  expect(eligible.skipped).toEqual([
    {
      castId,
      revision,
      reason:
        'Their saved history is unavailable here. This garden uses a local person. The saved history stays unchanged.',
    },
  ]);
  const authors = admitGardenBatch(eligible);
  expect(authors.find((person) => person.id === 'riza')?.portable).toBeUndefined();
  const garden = freshGarden(17, authors, {
    version: 'hearsay-hf4-batch/1',
    claims: [],
    skipped: eligible.skipped,
  });
  expect(garden.people.osman).toBeDefined();
  const { requireGardenWrite } = await import('../src/sim/garden4-continuity.ts');
  expect(() => requireGardenWrite(garden, castId)).toThrow('skipped');
  expect(() => requireGardenWrite(garden, 'hf.cast.osman.voice')).not.toThrow();
  expect(JSON.stringify(batch)).toBe(before);
});

it('retains only refusal metadata through useful play and replay and prevents source capture', async () => {
  const { freshGarden, chooseGarden, advanceGarden } = await import('../src/sim/garden4.ts');
  const { exportGarden, importGarden } = await import('../src/sim/garden4-export.ts');
  const { captureGardenSource, requireGardenWrite } = await import('../src/sim/garden4-continuity.ts');
  const castId = 'hf.cast.hatice.hearsay';
  const garden = freshGarden(17, undefined, {
    version: 'hearsay-hf4-batch/1',
    claims: [],
    skipped: [{ castId, reason: 'Their saved history cannot continue here.', revision: 'a'.repeat(64) }],
  });
  expect(chooseGarden(garden, { type: 'silence' })).toBe(true);
  advanceGarden(garden, 365);
  const restored = importGarden(JSON.stringify(exportGarden(garden)));
  expect(exportGarden(restored)).toEqual(exportGarden(garden));
  expect(restored.chapter?.skipped).toEqual(garden.chapter?.skipped);
  expect(restored.chapter?.claims).toEqual([]);
  expect(() => requireGardenWrite(restored, castId)).toThrow('skipped');
  expect(() => captureGardenSource(restored, 'hatice')).toThrow('skipped');
  restored.people.hatice.body.alive = false;
  expect(() => requireGardenWrite(restored, castId)).toThrow('skipped');
  expect(() => requireGardenWrite(restored, 'hf.cast.riza.voice')).not.toThrow();
});
