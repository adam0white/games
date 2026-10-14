import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { loadGame, saveGame } from '../src/game/persistence';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';

// Exact first 63 inputs from the 2026-10-14 12:14:29–12:21:48 source-unread
// player export (seed 42). The historical export is unchanged. The final recall
// and player delivery are excluded because the corrected Sam returns it first.
// These inputs preserve the player's choices; they do not establish new live play.
const playerInputs: Command[] = [
  { type: 'request-lesson' },
  { type: 'start-lesson' },
  { type: 'verify', jobId: 'object-2', condition: 'movement' },
  { type: 'inspect', jobId: 'object-2', componentId: 'contact' },
  {
    type: 'measure',
    jobId: 'object-2',
    request: { mode: 'voltage', a: 'C', b: 'D', condition: 'movement' },
  },
  { type: 'inspect', jobId: 'object-2', componentId: 'switch' },
  {
    type: 'measure',
    jobId: 'object-2',
    request: { mode: 'voltage', a: 'B', b: 'C', condition: 'movement' },
  },
  {
    type: 'measure',
    jobId: 'object-2',
    request: { mode: 'voltage', a: 'B', b: 'C', condition: 'bench' },
  },
  { type: 'work', jobId: 'object-2', componentId: 'switch', intervention: 'adjust' },
  { type: 'verify', jobId: 'object-2', condition: 'movement' },
  { type: 'request-lesson' },
  { type: 'wait', minutes: 15 },
  { type: 'start-lesson' },
  { type: 'work', jobId: 'object-2', componentId: 'switch', intervention: 'replace' },
  { type: 'verify', jobId: 'object-2', condition: 'movement' },
  { type: 'deliver', jobId: 'object-2' },
  { type: 'assign', jobId: 'object-3', personId: 'sam' },
  { type: 'accept', jobId: 'object-27' },
  { type: 'wait', minutes: 30 },
  { type: 'verify', jobId: 'object-27', condition: 'load' },
  { type: 'inspect', jobId: 'object-27', componentId: 'contact' },
  {
    type: 'measure',
    jobId: 'object-27',
    request: { mode: 'voltage', a: 'C', b: 'D', condition: 'load' },
  },
  { type: 'request-lesson' },
  { type: 'wait', minutes: 16 },
  { type: 'start-lesson' },
  {
    type: 'measure',
    jobId: 'object-27',
    request: { mode: 'voltage', a: 'C', b: 'D', condition: 'load' },
  },
  { type: 'work', jobId: 'object-27', componentId: 'contact', intervention: 'clean' },
  { type: 'verify', jobId: 'object-27', condition: 'load' },
  { type: 'deliver', jobId: 'object-27' },
  { type: 'select', jobId: 'object-3' },
  { type: 'recall', jobId: 'object-3' },
  { type: 'select', jobId: 'object-3' },
  { type: 'verify', jobId: 'object-3', condition: 'load' },
  { type: 'inspect', jobId: 'object-3', componentId: 'governor' },
  { type: 'watch', enabled: false },
  { type: 'request-lesson' },
  { type: 'start-lesson' },
  { type: 'calibrate', jobId: 'object-3', componentId: 'governor', setting: 1 },
  { type: 'verify', jobId: 'object-3', condition: 'load' },
  { type: 'accept', jobId: 'object-29' },
  { type: 'assign', jobId: 'object-29', personId: 'sam' },
  { type: 'wait', minutes: 30 },
  { type: 'next-day' },
  { type: 'assign', jobId: 'object-29', personId: 'sam' },
  { type: 'wait', minutes: 30 },
  { type: 'recall', jobId: 'object-29' },
  { type: 'request-lesson' },
  { type: 'select', jobId: 'object-29' },
  { type: 'wait', minutes: 6 },
  { type: 'start-lesson' },
  { type: 'verify', jobId: 'object-29', condition: 'load' },
  { type: 'inspect', jobId: 'object-29', componentId: 'gear' },
  {
    type: 'measure',
    jobId: 'object-29',
    request: { mode: 'motion', a: 'A', b: 'B', condition: 'load' },
  },
  {
    type: 'measure',
    jobId: 'object-29',
    request: { mode: 'motion', a: 'A', b: 'B', condition: 'bench' },
  },
  { type: 'work', jobId: 'object-29', componentId: 'gear', intervention: 'adjust' },
  { type: 'verify', jobId: 'object-29', condition: 'load' },
  { type: 'watch', enabled: false },
  { type: 'request-lesson' },
  { type: 'start-lesson' },
  { type: 'work', jobId: 'object-29', componentId: 'gear', intervention: 'replace' },
  { type: 'verify', jobId: 'object-29', condition: 'load' },
  { type: 'assign', jobId: 'object-29', personId: 'sam' },
  { type: 'wait', minutes: 30 },
];
function apply(state: GameState, inputs: Command[]): GameState {
  for (const input of inputs) {
    const result = dispatch(state, input);
    expect(result.ok, `${JSON.stringify(input)}: ${result.message}`).toBe(true);
    state = result.state;
  }
  return state;
}
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing regression fixture value');
  return value;
}
const beforeReassignment = () => apply(createGame(42), playerInputs.slice(0, 61));
const deliveryPromises = (state: GameState) =>
  required(state.people.sam).agenda.commitments.filter(
    (c) => c.targetId === 'object-29' && c.actions.includes('deliver'),
  );

describe('actual player checked-object cooperation regression', () => {
  it('renews a released promise on fresh acceptance and returns shared work without independence credit', () => {
    const before = beforeReassignment();
    expect(deliveryPromises(before).map((c) => c.status)).toEqual(['released']);
    const result = apply(before, playerInputs.slice(61));
    expect(result.jobs.find((j) => j.id === 'object-29')).toMatchObject({
      status: 'delivered',
      completedBy: 'sam',
      returnedUnfinished: false,
    });
    expect(result.independentRepairs).toBe(0);
    expect(deliveryPromises(result).map((c) => c.status)).toEqual(['released', 'kept']);
    expect(
      result.log.some((row) => row.text.includes('Sam returned the object after shared work.')),
    ).toBe(true);
  });

  it('reproduces the same cooperative return after save/resume and replay', () => {
    const before = beforeReassignment();
    const direct = apply(before, playerInputs.slice(61));
    const resumed = apply(loadGame(saveGame(before)), playerInputs.slice(61));
    expect(saveGame(resumed)).toBe(saveGame(direct));
    expect(replayRecordedRun({ seed: 42, inputs: playerInputs }, saveGame(direct)).ok).toBe(true);
  });

  // Policy controls below deliberately alter promise/deadline state. They are
  // not additional uncontrolled player observations.
  it.each(['pending', 'broken', 'kept'] as const)(
    'fresh acceptance does not duplicate or replace a %s delivery promise',
    (status) => {
      const before = beforeReassignment();
      required(deliveryPromises(before)[0]).status = status;
      const result = apply(before, [required(playerInputs[61])]);
      expect(result.jobs.find((j) => j.id === 'object-29')?.assignedTo).toBe('sam');
      expect(deliveryPromises(result)).toHaveLength(1);
      expect(deliveryPromises(result)[0]?.status).toBe(status);
    },
  );

  it.each([0, -1])('does not renew a released promise at deadline offset %s', (offset) => {
    const before = beforeReassignment();
    required(before.jobs.find((j) => j.id === 'object-29')).due = before.now + offset;
    const result = apply(before, [required(playerInputs[61])]);
    expect(result.jobs.find((j) => j.id === 'object-29')?.assignedTo).toBe('sam');
    expect(deliveryPromises(result).map((c) => c.status)).toEqual(['released']);
  });

  it.each(['pending', 'released', 'broken'] as const)(
    'retrying ongoing responsibility leaves its %s promise unchanged',
    (status) => {
      let before = apply(createGame(42), playerInputs.slice(0, 45));
      // A learned initial diagnostic can now run across requested paces. Wait
      // for an actual help boundary before isolating promise renewal policy.
      for (let step = 0; step < 12; step++) {
        if (before.jobs.find((j) => j.id === 'object-29')?.blocked) break;
        const activity = before.npcWork.find((work) => work.personId === 'sam');
        if (!activity) break;
        before = apply(before, [{ type: 'wait', minutes: activity.endsAt - before.now }]);
      }
      const job = required(before.jobs.find((j) => j.id === 'object-29'));
      expect(job.assignedTo).toBe('sam');
      expect(job.blocked?.kind).toBe('help');
      expect(
        job.contributions.some(
          (entry) => entry.actorId === 'sam' && entry.action === 'verify:load',
        ),
      ).toBe(true);
      expect(before.independentRepairs).toBe(0);
      required(deliveryPromises(before)[0]).status = status;
      const result = apply(before, [
        { type: 'retry-sam', jobId: job.id },
        { type: 'wait', minutes: 30 },
      ]);
      expect(deliveryPromises(result)).toHaveLength(1);
      expect(deliveryPromises(result)[0]?.status).toBe(status);
    },
  );
});
