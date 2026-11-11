import { createHash } from 'node:crypto';
import { canonicalPersona, preparePersonaLife, validatePersona } from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import { admitWorkshop } from '../src/game/cast';
import { createGame } from '../src/game/engine';
import currentReceipt from './fixtures/commonstead-nora-hf221-native.json';
import hf3Receipt from './fixtures/commonstead-nora-hf223-native.json';
import receipt from './fixtures/commonstead-nora-native.json';

// Actual historical source receipts remain unchanged. The current HF4 producer is qualified separately; these old formats remain refused.
// The owner waived old3 compatibility; refused history is never replaced by a fresh person.
describe('historical Commonstead source boundary at HF4', () => {
  it.each([
    ['historical native', receipt],
    ['HF2.21 native', currentReceipt],
    ['HF3 native', hf3Receipt],
  ] as const)('retains the exact %s source hash and refuses admission', async (_label, source) => {
    const parent = await validatePersona(source.envelope);
    expect(source.raw.engine).toBe(parent.source.engine);
    expect(createHash('sha256').update(canonicalPersona(source.raw)).digest('hex')).toBe(
      source.envelope.transfer.checkpoint.sha256,
    );
    const target = createGame(42);
    const before = canonicalPersona(target.people);
    const input = preparePersonaLife(
      parent,
      source.envelope.transfer.life.clock.watermark * 3_600_000,
    );
    expect(() => admitWorkshop(input, target.people.nora!)).toThrow(/start fresh/i);
    expect(canonicalPersona(target.people)).toBe(before);
  });
  it('retains the original pinned receipt identity', async () => {
    const parent = await validatePersona(receipt.envelope);
    expect(parent.revision).toBe(
      '957c44e876d2019d0410b7580dbffd3ae8dd55a94d243af46beef25108d555d1',
    );
  });
});
