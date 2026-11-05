/** Current-native bounded retest: actual outcomes, complete archive replay and exact next input. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { exportRun, replay as nativeReplay, readRunHistory } from '@adam0white/human-framework';
import { beforeAll, expect, it } from 'vitest';
import { playedFirstWeek } from '../src/sim/firstweek.ts';
import * as game from '../src/sim/game.ts';
import {
  cardView,
  cloneState,
  ctxOf,
  newGame,
  queueInput,
  restoreState,
  runToCard,
  step,
} from '../src/sim/game.ts';
import { momentsOf } from '../src/sim/moments.ts';
import type { GameState } from '../src/sim/types.ts';
import { validateCanonicalRun } from '../src/ui/cast-chapter.ts';
import { journalLines, momentRecords } from '../src/ui/journal.ts';
import { compactNotebook, expandNotebook } from '../src/ui/notebook.ts';
import { replyWords } from '../src/ui/reply.ts';
import { ordinaryHeldMonday } from './retest1-ordinary.ts';

const evidence = process.env.MURMUR_RETEST_EVIDENCE;
const phase = process.env.MURMUR_RETEST_PHASE ?? 'green';
const snapshots: Record<string, ReturnType<typeof cloneState>> = {};
const nativeProofs: unknown[] = [];
const branchProofs: unknown[] = [];
const digest = (s: unknown) => createHash('sha256').update(JSON.stringify(s)).digest('hex');
function requiredSnapshot(name: string) {
  const value = snapshots[name];
  if (!value) throw Error(`Missing completed fixture ${name}`);
  return value;
}
function save() {
  if (evidence)
    writeFileSync(`${evidence}-${phase}.json`, JSON.stringify({ snapshots, nativeProofs, branchProofs }));
}
function reach(s: GameState, id: string) {
  for (let n = 0; n < 120; n++) {
    if (s.card?.moment === id) return;
    if (s.phase === 'evening' || s.phase === 'end') queueInput(s, { kind: 'next' });
    else {
      runToCard(s);
      if (s.card?.moment === id) return;
      if (s.card) queueInput(s, { kind: 'quiet' });
      else step(s);
    }
  }
  throw Error(`Did not reach ${id}: ${s.day}/${s.phase}`);
}
let held: GameState;
let letter: GameState;
let truth: GameState;
let lie: GameState;
beforeAll(() => {
  held = ordinaryHeldMonday(game);
  snapshots.held = cloneState(held);
  letter = playedFirstWeek(17);
  queueInput(letter, { kind: 'next' });
  reach(letter, 'letter-8');
  snapshots.beforeRead = cloneState(letter);
  queueInput(letter, { kind: 'say', option: 'read', insist: true });
  snapshots.afterRead = cloneState(letter);
  reach(letter, 'letter-decision-8');
  snapshots.beforeDecision = cloneState(letter);
  for (const choice of ['truth', 'lie'] as const) {
    const s = newGame(17);
    reach(s, 'alarm-1');
    queueInput(s, { kind: 'say', option: 'snooze' });
    reach(s, 'late-1');
    queueInput(s, { kind: 'say', option: choice, insist: true });
    snapshots[`monday-${choice}`] = cloneState(s);
    reach(s, 'alarm-2');
    queueInput(s, { kind: 'say', option: 'snooze' });
    reach(s, 'late-2');
    if (choice === 'truth') truth = s;
    else lie = s;
    snapshots[`tuesday-${choice}`] = cloneState(s);
  }
  save();
}, 120_000);

it('discloses only the new bounded renewal facts after real reading and at the unsigned choice', () => {
  expect(letter.flags.w2?.letterRead).toBe(true);
  const before = requiredSnapshot('beforeRead');
  expect(before.flags.w2?.letterRead).not.toBe(true);
  expect(JSON.stringify(before.log)).not.toMatch(/one year|Friday at 17:00/);
  const outcome = requiredSnapshot('afterRead').log.find(
    (l) => l.who === 'narrator' && /read the tenancy/.test(l.text),
  );
  expect(outcome?.text).toMatch(/one year/);
  expect(outcome?.text).toContain('Friday at 17:00');
  expect(outcome?.text).toContain('Other terms are not shown here. The consequences are unknown.');
  expect(cardView(letter)?.scene).toContain('Friday at 17:00');
  expect(cardView(letter)?.scene).toContain('one year');
  expect(journalLines(letter).some((l) => l.who === 'narrator' && l.text.includes('Friday at 17:00'))).toBe(
    true,
  );
  expect(cardView(letter)?.options.map((o) => o.id)).toEqual(['sign', 'bowl']);
  for (const version of ['0.10.0', '0.10.1', '0.10.2']) {
    const m = momentsOf(8, version).find((m) => m.id === 'letter-8');
    if (!m) throw Error(`Missing current letter in ${version}`);
    const opts = typeof m.options === 'function' ? m.options(ctxOf(letter)) : m.options;
    expect(opts.map((o) => [o.id, o.duration])).toEqual([
      ['read', 10],
      ['sign', 5],
      ['unopened', 2],
      ['bowl', 2],
    ]);
  }
});

it('gives authentic complied outside and water choices distinct protests in the current journal', () => {
  const before = cloneState(held);
  const records = momentRecords(held).filter((r) => ['lunch-1', 'slump-1'].includes(r.moment));
  expect(records.map((r) => [r.answer.chosen, r.answer.verdict, r.answer.insisted, r.answer.says])).toEqual([
    ['outside', 'complied', true, undefined],
    ['walk', 'complied', true, undefined],
  ]);
  const words = records.map((r) => replyWords(held, r.answer));
  expect(words[0]).toMatch(/eating outside.*because you pushed me/);
  expect(words[1]).toMatch(/water.*because you pushed me/);
  expect(new Set(words).size).toBe(2);
  for (const r of records) expect(replyWords(held, r.answer)).toContain('I don’t like being pushed.');
  expect(cloneState(held)).toEqual(before);
});

it('remembers completed Monday truth and preserves the distinct prior-lie question', () => {
  const native = readRunHistory(exportRun(truth.hf.run)).flatMap((t) => t.inputs);
  expect(
    native.some(
      (i) =>
        i.kind === 'action.resolved' &&
        i.payload.disposition === 'completed' &&
        i.payload.outcome?.actionId === 'own-up' &&
        i.payload.outcome.offerId === 'truth',
    ),
  ).toBe(true);
  expect(cardView(truth)?.scene).toContain('Late again, Dilan. What happened this morning?');
  expect(cardView(lie)?.scene).toContain('Was it the ring road again?');
});

// Three complete cold validations, journal reconstructions and next-input replays run serially.
it('cold validates complete archives and follows the exact next input without presentation mutation', async () => {
  for (const [name, s, input] of [
    ['held', held, { kind: 'quiet' as const }],
    ['letter', letter, { kind: 'say' as const, option: 'bowl' }],
    ['truth', truth, { kind: 'say' as const, option: 'truth' }],
  ] as const) {
    const before = cloneState(s);
    const packed = await compactNotebook({
      game: 'murmur',
      version: s.version,
      seed: s.seed,
      inputs: s.inputs,
      state: before,
    });
    const expanded = await expandNotebook(packed);
    expect(expanded.state).toEqual(before);
    const cold = await validateCanonicalRun(expanded.state);
    expect(cloneState(cold)).toEqual(before);
    const archive = exportRun(cold.hf.run);
    for (const r of momentRecords(s)) replyWords(s, r.answer);
    expect(cloneState(s)).toEqual(before);
    runToCard(s);
    runToCard(cold);
    expect(cardView(cold)).toEqual(cardView(s));
    const at = s.minute;
    queueInput(s, input);
    queueInput(cold, input);
    expect(cloneState(cold)).toEqual(cloneState(s));
    const nextArchive = exportRun(cold.hf.run);
    const nextVerified = nativeReplay(nextArchive);
    expect(nextVerified.ok && nextVerified.value.verified && nextVerified.value.fullHash).toBe(
      nextArchive.hashes.full,
    );
    snapshots[`${name}-next`] = cloneState(s);
    nativeProofs.push({
      name,
      beforeSha256: digest(before),
      fullHash: archive.hashes.full,
      nextInput: { ...input, at },
      nextFullHash: nextArchive.hashes.full,
      nextSha256: digest(cloneState(s)),
      completeStateEqual: true,
      verified: true,
    });
  }
  save();
  // A supplied corrected baseline can establish whole-state equality for display-only controls.
  // Correction1 records exact leaf differences separately; never normalize arbitrary matching prose.
  if (process.env.MURMUR_RETEST_BASELINE) {
    const baseline = JSON.parse(readFileSync(process.env.MURMUR_RETEST_BASELINE, 'utf8')) as {
      snapshots: typeof snapshots;
    };
    expect(snapshots.held).toEqual(baseline.snapshots.held);
    expect(snapshots['held-next']).toEqual(baseline.snapshots['held-next']);
  }
}, 180_000);

it('does not rewrite a stored question when synthetic host-only selection metadata is changed', () => {
  // Negative consumer fixture only: actual retained HF history still contains the completed lie.
  // This is not offered as a valid replayed game or as an authentic truth outcome.
  const selectedOnly = restoreState(requiredSnapshot('tuesday-lie'));
  selectedOnly.chosen['late-1'] = 'truth';
  delete selectedOnly.flags.lied;
  expect(ctxOf(selectedOnly).completedMondayTruth).toBeUndefined();
  expect(cardView(selectedOnly)?.scene).toContain('Was it the ring road again?');
});

// Each case restores a complete archive, reaches the next card and hashes the resulting run.
// Hosted runs measured about 29–30 seconds per case; retain headroom for runner variation.
it.each(['sign', 'unopened', 'bowl'])(
  'keeps actual %s branch unread and does not disclose the new facts',
  (option) => {
    const s = restoreState(requiredSnapshot('beforeRead'));
    queueInput(s, { kind: 'say', option, insist: true });
    expect(s.chosen['letter-8']).toBe(option);
    expect(s.flags.w2?.letterRead).not.toBe(true);
    expect(s.log.some((l) => /one year|Friday at 17:00/.test(l.text))).toBe(false);
    runToCard(s);
    expect(s.card?.moment).not.toBe('letter-decision-8');
    branchProofs.push({
      option,
      chosen: s.chosen['letter-8'],
      read: false,
      summaryAbsent: true,
      nextCard: s.card?.moment,
      nextFullHash: exportRun(s.hf.run).hashes.full,
    });
    save();
  },
  45_000,
);
