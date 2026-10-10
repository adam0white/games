import { understandNorm } from '@repair/hf-engine5';
import { expect, it } from 'vitest';
import { restoreGame, serializeGame } from '../src/game/engine';
import * as phase1 from '../src/game/engine5';
import { initializeMissingProfile } from '../src/game/practices';

it('published phase-one saves gain only missing present-day profiles and replay their migration', () => {
  const old = phase1.createGame(42);
  const mum = old.people.mum;
  if (!mum) throw Error('Missing Mum');
  understandNorm(mum, 'lying', 'forbidden', 0.71);
  // A saved person remains validated by the frozen original engine. Its profile
  // is customized through HF, so use the direct migration helper for preservation.
  const held = JSON.stringify(mum.conscience.norms);
  initializeMissingProfile(mum, 'mum');
  expect(mum.conscience.norms.find((n) => n.normId === 'lying')?.conviction).toBe(0.71);
  expect(JSON.stringify(mum.conscience.norms)).toBe(held);
  const original = phase1.createGame(42);
  const packet = phase1.serializeGame(original);
  const migrated = restoreGame(packet);
  for (const id of ['mum', 'player', 'dad', 'sam', 'nora']) {
    const before = original.people[id],
      after = migrated.people[id];
    if (!before || !after) throw Error(`Missing ${id}`);
    expect(after.body).toEqual(before.body);
    expect(after.now).toBe(before.now);
    expect(after.life).toEqual(before.life);
    expect(after.skills).toEqual(before.skills);
    expect(after.conscience.norms.length).toBeGreaterThan(0);
  }
  expect(migrated.people.mum?.agenda.commitments.filter((c) => c.kind === 'worship')).toHaveLength(
    5,
  );
  expect(migrated.people.mum?.conscience.breaches).toEqual([]);
  expect(migrated.unlocked).toContain('profiles:6');
  expect(migrated.engine3Save).toBe(packet);
  expect(restoreGame(serializeGame(migrated))).toEqual(migrated);
});

it('adult legacy arrivals have a present-day clock through direct and phase-five migration', async () => {
  const old = await import('../src/game/engine3');
  const { getView } = await import('../src/game/engine');
  const { gameTimeLabel } = await import('../src/game/clock');
  const packet = old.serializeGame(old.createGame(42));
  const viaFive = phase1.serializeGame(phase1.restoreGame(packet));
  for (const text of [packet, viaFive]) {
    const original = JSON.parse(text);
    const migrated = restoreGame(text);
    expect(getView(migrated).timeLabel).toBe('After school · Summer day 1 · 00:00');
    expect(migrated.journal).toEqual(original.state.journal);
    expect(migrated.conversation).toEqual(original.state.conversation);
    expect(migrated.engine3Save).toBe(text);
    expect(gameTimeLabel({ ...migrated, now: migrated.now + 20 })).toBe(
      'After school · Summer day 1 · 00:20',
    );
    expect(restoreGame(serializeGame(migrated))).toEqual(migrated);
  }
});
