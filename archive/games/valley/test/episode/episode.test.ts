import { replay as replayNative } from '@adam0white/human-framework';
import { beforeAll, expect, it } from 'vitest';
import { PUBLIC_EDITION } from '../../src/sim/edition.ts';
import {
  act,
  compactRun,
  EPISODE_END,
  load,
  newGame,
  replay,
  save,
  stateJson,
  step,
} from '../../src/sim/game.ts';
import { validLocalLog } from '../../src/ui/local-log.ts';
import { required } from '../required.ts';

it('identifies the opening episode separately from the continuous term', () => {
  expect(PUBLIC_EDITION).toBe('valley-opening-2026-11');
});

let ownerGame: ReturnType<typeof newGame>;
let ownerSave: ReturnType<typeof save>;
beforeAll(() => {
  ownerGame = newGame(406153184);
  expect(ownerGame.valley.people.length + 1).toBe(58);
  expect(ownerGame.valley.minute).toBe(420);
  expect(act(ownerGame, { verb: 'call', job: 'reap-agha', houses: ['coban'] })).toBe(true);
  step(ownerGame, EPISODE_END);
  ownerSave = save(ownerGame);
}, 120000);

it('keeps the complete owner-seed cast, actual call and native history through the six-hour ending', () => {
  const g = ownerGame;
  expect(g.valley.minute).toBe(780);
  expect(g.valley.flags.ended).toBe('episode');
  expect(g.valley.flags.gathering).toBeUndefined();
  expect(g.inputs).toHaveLength(1);
  expect(g.valley.asks).toHaveLength(1);
  expect(Object.keys(required(g.valley.asks[0]).replies).length).toBeGreaterThan(0);
  const archive = ownerSave.state.community?.archive;
  if (!archive) throw new Error('Missing complete native archive');
  expect(archive.initial.people).toHaveLength(58);
  expect(archive.initial.spec.definitions.calendar.days).toHaveLength(2);
  const native = replayNative(archive);
  if (!native.ok) throw new Error(native.error.message);
  expect(native.value.verified).toBe(true);
  expect(native.value.fullHash).toBe(archive.hashes.full);
  expect(act(g, { verb: 'give', house: 'coban', kile: 1 })).toBe(false);
  const ended = JSON.stringify(stateJson(g.valley));
  step(g, 17550);
  expect(JSON.stringify(stateJson(g.valley))).toBe(ended);
});

// Each complete restore is its own correctness control under the same 120s cap.
// The former combined case did four complete replays in one 120s case and
// reached 128s on CI. No product latency budget or assertion is changed here.
for (const mode of ['full', 'compact', 'replay'] as const) {
  it(`reconstructs every native and host field from the owner ending: ${mode}`, () => {
    const full = ownerSave;
    const copy =
      mode === 'replay'
        ? replay(full.seed, full.inputs, full.minute)
        : load(JSON.parse(JSON.stringify(mode === 'full' ? full : compactRun(full))));
    expect(stateJson(copy.valley)).toEqual(full.state);
    expect(copy.inputs).toEqual(full.inputs);
  });
}

it('refuses a corrupted complete native ending archive', () => {
  const corrupted = structuredClone(ownerSave);
  const badArchive = required(required(corrupted.state.community).archive);
  corrupted.state.community = {
    ...required(corrupted.state.community),
    archive: { ...badArchive, hashes: { ...badArchive.hashes, full: '0'.repeat(64) } },
  };
  expect(() => load(corrupted)).toThrow();
});

it('cold-restores before ending, continues identically, and refuses forged time, inputs and old editions', () => {
  const g = newGame(7);
  step(g, 540);
  expect(act(g, { verb: 'visit', house: 'coban' })).toBe(true);
  step(g, 600);
  const full = save(g);
  const cold = load(JSON.parse(JSON.stringify(full)));
  step(g, 630);
  step(cold, 630);
  expect(stateJson(cold.valley)).toEqual(stateJson(g.valley));
  const compact = compactRun(full);
  for (const minute of [419, 421, 781, 810, NaN, Infinity]) {
    expect(() => load({ ...compact, minute })).toThrow(/horizon/);
    expect(() => replay(full.seed, full.inputs, minute)).toThrow(/horizon/);
    expect(validLocalLog({ ...compact, minute, volume: 1 })).toBe(false);
  }
  expect(() => load({ ...full, minute: 630 })).toThrow(/horizon/);
  expect(() =>
    load({ ...compact, inputs: [...compact.inputs, { at: 780, verb: 'give', house: 'coban', kile: 1 }] }),
  ).toThrow();
  expect(() => load({ ...compact, rules: 'valley-public-2026-10' } as never)).toThrow(/start fresh/);
  expect(() => load({ ...compact, fingerprint: '00000000' })).toThrow();
});
