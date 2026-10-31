/** MR1-1/2: real public calls, ordinary inputs, complete states and exact differences. No latency claim. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as hf from '@adam0white/human-framework';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as game from '../src/sim/game.ts';
import type { GameState } from '../src/sim/types.ts';
import { validateCanonicalRun } from '../src/ui/cast-chapter.ts';
import { momentRecords } from '../src/ui/journal.ts';
import { compactNotebook, expandNotebook } from '../src/ui/notebook.ts';
import { replyWords } from '../src/ui/reply.ts';
import { ordinaryHeldMonday, ordinaryLateTuesday, ordinaryReach, ordinarySay } from './retest1-ordinary.ts';

// Call-through spies count actual public archive work, retaining real implementations and outcomes.
vi.mock('@adam0white/human-framework', { spy: true });
const output = process.env.MURMUR_CORRECTION_EVIDENCE;
const source9e = process.env.MURMUR_CORRECTION_SOURCE9E;
const counts: unknown[] = [];
const sha = (s: Uint8Array | string) => createHash('sha256').update(s).digest('hex');
function save(suffix: string, data: unknown) {
  if (output) writeFileSync(`${output}-${suffix}.json`, JSON.stringify(data));
}
function resetCounts() {
  vi.mocked(hf.exportRun).mockClear();
  vi.mocked(hf.readRunHistory).mockClear();
}
function count(label: string) {
  const result = {
    label,
    exports: vi.mocked(hf.exportRun).mock.calls.length,
    decodes: vi.mocked(hf.readRunHistory).mock.calls.length,
  };
  counts.push(result);
  save('counts', counts);
  return result;
}
let truth: GameState;
let lie: GameState;
beforeAll(() => {
  truth = ordinaryLateTuesday(game, 'truth');
  lie = ordinaryLateTuesday(game, 'lie');
}, 60_000);
afterEach(() => vi.clearAllMocks());

it('does no complete export or history decode on repeated ordinary context/options/preview reads', () => {
  resetCounts();
  for (const s of [truth, lie]) {
    for (let n = 0; n < 3; n++) {
      game.ctxOf(s);
      const m = game.openMoment(s);
      if (!m) throw Error('Missing real late card');
      game.optionsOf(s, m);
      game.cardView(s);
    }
  }
  expect(count('repeated live reads')).toEqual({ label: 'repeated live reads', exports: 0, decodes: 0 });
});

it('reconstructs stored questions on cold clone, native mutation and actual rewind branches', () => {
  for (const s of [truth, lie]) {
    const snapshot = game.cloneState(s);
    const cold = game.restoreState(snapshot);
    const rebuilt = game.replay(s.seed, s.inputs, s.minute, s.version, s.castChapter, s.plainEnglish);
    expect(game.cardView(cold)?.scene).toBe(game.cardView(s)?.scene);
    expect(game.cardView(rebuilt)?.scene).toBe(game.cardView(s)?.scene);
    expect(game.cloneState(cold)).toEqual(snapshot);
    expect(game.cloneState(rebuilt)).toEqual(snapshot);
    resetCounts();
    game.ctxOf(cold);
    game.cardView(cold);
    game.cardView(rebuilt);
    expect(count('cold repeated reads')).toEqual({ label: 'cold repeated reads', exports: 0, decodes: 0 });
    const handle = cold.hf.run;
    ordinarySay(game, cold, 'truth');
    expect(cold.hf.run).toBe(handle); // Actual native mutation retains handle identity.
    expect(game.ctxOf(cold).completedMondayTruth).toBeUndefined();
  }
  const atTruth = truth.inputs.findIndex((i) => i.kind === 'say' && i.option === 'truth');
  const input = truth.inputs[atTruth];
  if (!input) throw Error('Missing actual truth input');
  const rewind = game.replay(truth.seed, truth.inputs.slice(0, atTruth), input.at, truth.version);
  expect(rewind.card?.moment).toBe('late-1');
  ordinarySay(game, rewind, 'lie', true);
  ordinaryReach(game, rewind, 'alarm-2');
  ordinarySay(game, rewind, 'snooze');
  ordinaryReach(game, rewind, 'late-2');
  expect(game.cardView(rewind)?.scene).toContain('Was it the ring road again?');
  expect(game.cardView(truth)?.scene).toContain('Late again, Dilan.');
}, 30_000);

it('bounds complete archive work to one late opening in each actual journal reconstruction', () => {
  resetCounts();
  momentRecords(truth);
  expect(count('one journal reconstruction')).toEqual({
    label: 'one journal reconstruction',
    exports: 1,
    decodes: 1,
  });
  resetCounts();
  momentRecords(lie);
  expect(count('independent lie journal')).toEqual({
    label: 'independent lie journal',
    exports: 1,
    decodes: 1,
  });
});

function leafDifferences(a: unknown, b: unknown, path = ''): unknown[] {
  if (Object.is(a, b)) return [];
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const left = Object.keys(a),
      right = Object.keys(b);
    expect(right).toEqual(left);
    return left.flatMap((key) =>
      leafDifferences(
        Reflect.get(a, key),
        Reflect.get(b, key),
        Array.isArray(a) ? `${path}[${key}]` : path ? `${path}.${key}` : key,
      ),
    );
  }
  return [{ path, before: a, after: b }];
}

it.skipIf(!source9e)(
  'regenerates source9e and candidate ordinary prefixes, full archives and exact next inputs',
  async () => {
    if (!source9e) throw Error('Missing explicit offline source9e mirror');
    const baseline: typeof game = await import(/* @vite-ignore */ join(source9e, 'src/sim/game.ts'));
    const baseStates: Record<string, unknown> = {},
      candidateStates: Record<string, unknown> = {};
    const proofs: unknown[] = [];
    let oldNotebook: Uint8Array | undefined;
    for (const name of ['held', 'truth', 'lie'] as const) {
      const a = name === 'held' ? ordinaryHeldMonday(baseline) : ordinaryLateTuesday(baseline, name);
      const b = name === 'held' ? ordinaryHeldMonday(game) : ordinaryLateTuesday(game, name);
      if (name === 'held') {
        const answers = momentRecords(b).filter((r) => ['lunch-1', 'slump-1'].includes(r.moment));
        expect(answers.map((r) => [r.answer.chosen, r.answer.verdict, r.answer.says])).toEqual([
          ['outside', 'complied', undefined],
          ['walk', 'complied', undefined],
        ]);
        const [outside, walk] = answers;
        if (!outside || !walk) throw Error('Missing actual complied answers');
        expect(replyWords(b, outside.answer)).toContain('eating outside because you pushed me');
        expect(replyWords(b, walk.answer)).toContain('water and going outside because you pushed me');
        expect(b.inputs.some((i) => i.kind === 'say' && i.option === 'map')).toBe(false);
        expect(b.inputs.find((i) => i.at === 576641)).toEqual({ kind: 'quiet', at: 576641 });
      }
      const beforeA = baseline.cloneState(a),
        beforeB = game.cloneState(b);
      baseStates[name] = beforeA;
      candidateStates[name] = beforeB;
      expect(beforeB.hf).toEqual(beforeA.hf);
      expect(beforeB.inputs).toEqual(beforeA.inputs);
      const expected =
        name === 'truth'
          ? [
              {
                path: 'log[28].text',
                before: 'It is 08:25. Murat looks at the clock, then at her. “Did traffic hold you up?”',
                after:
                  'It is 08:25. Murat looks at the clock. “Late again, Dilan. What happened this morning?”',
              },
            ]
          : [];
      const difference = leafDifferences(beforeA, beforeB);
      expect(difference).toEqual(expected); // Exact paths and values, no string normalization.
      const notebook = { game: 'murmur', version: b.version, seed: b.seed, inputs: b.inputs, state: beforeB };
      const expanded = await expandNotebook(await compactNotebook(notebook));
      expect(expanded.state).toEqual(beforeB);
      const cold = await validateCanonicalRun(expanded.state);
      expect(game.cloneState(cold)).toEqual(beforeB);
      const archive = hf.exportRun(b.hf.run),
        replay = hf.replay(archive);
      expect(replay.ok && replay.value.verified && replay.value.fullHash).toBe(archive.hashes.full);
      if (name === 'truth')
        oldNotebook = Buffer.from(JSON.stringify({ ...notebook, inputs: a.inputs, state: beforeA }));
      baseline.runToCard(a);
      game.runToCard(b);
      game.runToCard(cold);
      expect(a.card?.moment).toBe(b.card?.moment);
      const at = b.minute;
      if (name === 'held') {
        expect(game.cardView(b)?.id).toBe(b.card?.moment);
        baseline.queueInput(a, { kind: 'quiet' });
        game.queueInput(b, { kind: 'quiet' });
        game.queueInput(cold, { kind: 'quiet' });
      } else {
        ordinarySay(baseline, a, 'truth');
        ordinarySay(game, b, 'truth');
        ordinarySay(game, cold, 'truth');
      }
      const nextA = baseline.cloneState(a),
        nextB = game.cloneState(b);
      expect(game.cloneState(cold)).toEqual(nextB);
      expect(nextB.hf).toEqual(nextA.hf);
      expect(nextB.inputs).toEqual(nextA.inputs);
      expect(leafDifferences(nextA, nextB)).toEqual(expected);
      baseStates[`${name}-next`] = nextA;
      candidateStates[`${name}-next`] = nextB;
      const nextArchive = hf.exportRun(b.hf.run),
        nextReplay = hf.replay(nextArchive);
      expect(nextReplay.ok && nextReplay.value.verified && nextReplay.value.fullHash).toBe(
        nextArchive.hashes.full,
      );
      proofs.push({
        name,
        difference,
        fullHash: archive.hashes.full,
        nextFullHash: nextArchive.hashes.full,
        beforeSourceSha256: sha(JSON.stringify(beforeA)),
        beforeCandidateSha256: sha(JSON.stringify(beforeB)),
        nextSourceSha256: sha(JSON.stringify(nextA)),
        nextCandidateSha256: sha(JSON.stringify(nextB)),
        nextInput: {
          ...(name === 'held' ? { kind: 'quiet' } : { kind: 'say', option: 'truth', insist: false }),
          at,
        },
        verified: true,
        entireHfEqual: true,
        completeColdStateEqual: true,
      });
    }
    save('source9e-states', baseStates);
    save('candidate-states', candidateStates);
    save('proofs', proofs);
    if (!oldNotebook) throw Error('Missing source9e old-file control');
    const originalHash = sha(oldNotebook);
    if (output) writeFileSync(`${output}-old-notebook.json`, oldNotebook);
    await expect(validateCanonicalRun(JSON.parse(Buffer.from(oldNotebook).toString()).state)).rejects.toThrow(
      'The pinned cast notebook does not replay exactly.',
    );
    expect(sha(oldNotebook)).toBe(originalHash);
    if (output) expect(sha(readFileSync(`${output}-old-notebook.json`))).toBe(originalHash);
    save('old-file-refusal', {
      originalHash,
      afterHash: sha(oldNotebook),
      refused: true,
      originalBytesPreserved: true,
      scope:
        'Fresh offline source9e notebook with old stored question; actual current validator, not browser import.',
    });
  },
  120_000,
);
