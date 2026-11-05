import { replay as replayNative } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
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

it('keeps the complete owner-seed cast, actual call and native history through a replaying six-hour ending', () => {
  const begun = performance.now();
  const g = newGame(406153184);
  expect(g.valley.people.length + 1).toBe(58);
  expect(g.valley.minute).toBe(420);
  expect(act(g, { verb: 'call', job: 'reap-agha', houses: ['coban'] })).toBe(true);
  step(g, EPISODE_END);
  expect(g.valley.minute).toBe(780);
  expect(g.valley.flags.ended).toBe('episode');
  expect(g.valley.flags.gathering).toBeUndefined();
  expect(g.inputs).toHaveLength(1);
  expect(g.valley.asks).toHaveLength(1);
  expect(Object.keys(required(g.valley.asks[0]).replies).length).toBeGreaterThan(0);
  const full = save(g);
  const archive = full.state.community?.archive;
  if (!archive) throw new Error('Missing complete native archive');
  expect(archive.initial.people).toHaveLength(58);
  expect(archive.initial.spec.definitions.calendar.days).toHaveLength(2);
  const native = replayNative(archive);
  if (!native.ok) throw new Error(native.error.message);
  expect(native.value.verified).toBe(true);
  expect(native.value.fullHash).toBe(archive.hashes.full);
  const compact = compactRun(full);
  for (const copy of [
    load(JSON.parse(JSON.stringify(full))),
    load(JSON.parse(JSON.stringify(compact))),
    replay(full.seed, full.inputs, full.minute),
  ]) {
    expect(stateJson(copy.valley)).toEqual(full.state);
    expect(copy.inputs).toEqual(full.inputs);
  }
  const corrupted = structuredClone(full);
  const badArchive = required(required(corrupted.state.community).archive);
  corrupted.state.community = {
    ...required(corrupted.state.community),
    archive: { ...badArchive, hashes: { ...badArchive.hashes, full: '0'.repeat(64) } },
  };
  expect(() => load(corrupted)).toThrow();
  expect(act(g, { verb: 'give', house: 'coban', kile: 1 })).toBe(false);
  const ended = JSON.stringify(stateJson(g.valley));
  step(g, 17550);
  expect(JSON.stringify(stateJson(g.valley))).toBe(ended);
  console.info(
    JSON.stringify({
      episodeMs: performance.now() - begun,
      fullBytes: JSON.stringify(full).length,
      compactBytes: JSON.stringify(compact).length,
      nativePeople: archive.initial.people.length,
      minute: g.valley.minute,
      replies: required(g.valley.asks[0]).replies,
    }),
  );
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
