import { createHash } from 'node:crypto';
import { snapshot } from '@adam0white/human-framework';
import {
  canonicalPersona,
  createPersona,
  preparePersonaLife,
  validatePersona,
} from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import { admitWorkshop } from '../src/game/cast';
import { createGame, dispatch } from '../src/game/engine';
import { loadGame, saveGame } from '../src/game/persistence';
import { replayRecordedRun } from '../src/game/replay';
import currentReceipt from './fixtures/commonstead-nora-hf221-native.json';
import receipt from './fixtures/commonstead-nora-native.json';

// Actual ordinary Commonstead pause/Save Nora receipt. No fabricated live shelf state.
describe('finite Commonstead native Nora receiver', () => {
  it('admits an actual current-engine native projection and replays the admitted workshop', async () => {
    const parent = await validatePersona(currentReceipt.envelope);
    const portable = currentReceipt.envelope.transfer.person.person;
    expect(currentReceipt.raw.engine).toBe('2.21.0');
    expect(portable.source.engine).toBe('2.21.0');
    expect(createHash('sha256').update(canonicalPersona(currentReceipt.raw)).digest('hex')).toBe(
      currentReceipt.envelope.transfer.checkpoint.sha256,
    );
    const input = preparePersonaLife(parent, 0);
    const people = createGame(42).people;
    people.nora = admitWorkshop(input, people.nora!);
    const admitted = snapshot(people.nora);
    expect(admitted.rng).toEqual(portable.rng);
    expect(admitted.traits).toEqual(portable.traits);
    expect(admitted.values).toEqual(portable.values);
    expect(admitted.now - admitted.life.bornAt).toBe(portable.source.now - portable.life.bornAt);
    expect(admitted.lexicon?.plainEnglish).toBe(true);
    const { revision, ...body } = parent;
    const claim = await createPersona({
      ...body,
      parentRevision: revision,
      source: { game: 'repair', build: 'test', engine: '2.23.0', rules: 'canonical-workshop-2' },
      transfer: { ...parent.transfer, life: input.life },
    });
    const state = createGame(42, 'current', people, {
      version: 'workshop-cast/1',
      inputs: [input],
      claims: [claim],
    });
    const played = dispatch(state, {
      type: 'verify',
      jobId: state.selectedJobId!,
      condition: 'movement',
    }).state;
    const saved = saveGame(played);
    expect(saveGame(loadGame(saved))).toBe(saved);
    expect(replayRecordedRun(JSON.parse(saved), saved).ok).toBe(true);
  });

  it('preserves actual native RNG, fitness, age and profile in pinned current replay', async () => {
    const parent = await validatePersona(receipt.envelope);
    expect(parent.revision).toBe(
      '957c44e876d2019d0410b7580dbffd3ae8dd55a94d243af46beef25108d555d1',
    );
    expect(createHash('sha256').update(canonicalPersona(receipt.raw)).digest('hex')).toBe(
      receipt.envelope.transfer.checkpoint.sha256,
    );
    const input = preparePersonaLife(
      parent,
      receipt.envelope.transfer.life.clock.watermark * 3600000,
    );
    const people = createGame(42).people;
    people.nora = admitWorkshop(input, people.nora!);
    const admitted = snapshot(people.nora);
    const portable = receipt.envelope.transfer.person.person;
    expect(admitted.rng).toEqual(portable.rng);
    expect(admitted.body.fitness).toBe(portable.health.fitness);
    expect(admitted.traits).toEqual(portable.traits);
    expect(admitted.values).toEqual(portable.values);
    expect(admitted.now - admitted.life.bornAt).toBe(portable.source.now - portable.life.bornAt);
    expect(admitted.skills).toEqual({});
    // Synthetic target claim for the recorded-source mechanism control, never a live shelf receipt.
    const { revision, ...body } = parent;
    const claim = await createPersona({
      ...body,
      parentRevision: revision,
      source: { game: 'repair', build: 'test', engine: '2.23.0', rules: 'canonical-workshop-2' },
      transfer: { ...parent.transfer, life: input.life },
    });
    let state = createGame(42, 'current', people, {
      version: 'workshop-cast/1',
      inputs: [input],
      claims: [claim],
    });
    state = dispatch(state, {
      type: 'verify',
      jobId: state.selectedJobId!,
      condition: 'movement',
    }).state;
    const saved = saveGame(state);
    expect(saveGame(loadGame(saved))).toBe(saved);
    expect(replayRecordedRun(JSON.parse(saved), saved).ok).toBe(true);
  });
  it('refuses incompatible native metadata, calendar, body and qualification semantics', async () => {
    const parent = await validatePersona(receipt.envelope);
    const original = preparePersonaLife(
      parent,
      receipt.envelope.transfer.life.clock.watermark * 3600000,
    );
    for (const mutate of [
      (p: typeof receipt.envelope) => {
        p.source.rules = 'commonstead-unknown';
      },
      (p: typeof receipt.envelope) => {
        p.source.engine = '2.16.0';
      },
      (p: typeof receipt.envelope) => {
        p.transfer.sourceRole = 'nora';
      },
      (p: typeof receipt.envelope) => {
        p.transfer.person.person.source.id = 'nora';
      },
      (p: typeof receipt.envelope) => {
        p.transfer.person.calendar.offset = 1;
      },
      (p: typeof receipt.envelope) => {
        p.transfer.person.person.family = {} as never;
      },
      (p: typeof receipt.envelope) => {
        p.transfer.person.person.health.health = 0.5;
      },
      (p: typeof receipt.envelope) => {
        p.transfer.person.calendar.norms.pop();
      },
      (p: typeof receipt.envelope) => {
        p.transfer.checkpoint.sourceMinute++;
      },
    ]) {
      const input = structuredClone(original);
      mutate(input.parent as unknown as typeof receipt.envelope);
      expect(() => admitWorkshop(input, createGame(42).people.nora!)).toThrow();
    }
  });

  it('refuses unsupported or mismatched current Commonstead engine stamps', async () => {
    const original = await validatePersona(currentReceipt.envelope);
    for (const [envelopeEngine, portableEngine] of [
      ['2.20.0', '2.21.0'],
      ['2.21.0', '2.20.0'],
      ['2.17.0', '2.21.0'],
    ] as const) {
      const parent = structuredClone(original);
      parent.source.engine = envelopeEngine;
      (
        parent.transfer.person as typeof currentReceipt.envelope.transfer.person
      ).person.source.engine = portableEngine;
      const input = preparePersonaLife(parent, 0);
      expect(() => admitWorkshop(input, createGame(42).people.nora!)).toThrow();
    }
  });
});
