import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { loadGame, saveGame } from '../src/game/persistence';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';
import { acceptRepairOffer } from './repair-offer';

// Exact first 63 inputs from the 2026-10-14 12:14:29–12:21:48 source-unread
// player export (seed 42). The historical export is unchanged. The final recall
// and player delivery are excluded because the corrected Sam returns it first.
// These inputs preserve the player's choices; they do not establish new live play.
// They were recorded under engine-4 rules and are historical evidence, not an HF4 replay.
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
function deliveryPromises(state: GameState, jobId: string) {
  return state.people.sam!.agenda.commitments.filter(
    (commitment) => commitment.targetId === jobId && commitment.actions.includes('deliver'),
  );
}

describe('checked-object cooperation regression at HF4', () => {
  it('refuses the historical recording rather than replaying it as HF4', () => {
    const old = JSON.parse(saveGame(createGame(42)));
    old.provenance.framework = '3.0.0';
    old.inputs = playerInputs;
    expect(() => loadGame(JSON.stringify(old))).toThrow('Start fresh');
    expect(replayRecordedRun(old)).toMatchObject({ ok: false, reason: 'unsupported-version' });
  });

  it('renews a released delivery promise after a fresh acceptance', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    state = acceptRepairOffer(state, jobId);
    expect(deliveryPromises(state, jobId).map((c) => c.status)).toEqual(['pending']);
    const recall = dispatch(state, { type: 'recall', jobId });
    expect(recall.ok, recall.message).toBe(true);
    state = recall.state;
    expect(deliveryPromises(state, jobId).map((c) => c.status)).toEqual(['released']);
    state = acceptRepairOffer(state, jobId);
    expect(deliveryPromises(state, jobId).map((c) => c.status)).toEqual(['released', 'pending']);
    expect(state.jobs.find((job) => job.id === jobId)?.assignedTo).toBe('sam');
    expect(state.independentRepairs).toBe(0);
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });

  it('keeps one responsibility and one delivery promise when retrying blocked work', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    state = acceptRepairOffer(state, jobId);
    state = dispatch(state, { type: 'wait', minutes: 10 }).state;
    const job = state.jobs.find((candidate) => candidate.id === jobId)!;
    expect(job.blocked?.kind).toBe('help');
    const responsibility = structuredClone(job.responsibility);
    const promises = deliveryPromises(state, jobId).map((c) => ({ id: c.id, status: c.status }));
    expect(promises).toHaveLength(1);
    const retry = dispatch(state, { type: 'retry-sam', jobId });
    expect(retry.ok, retry.message).toBe(true);
    state = retry.state;
    expect(state.jobs.find((candidate) => candidate.id === jobId)?.responsibility).toEqual(
      responsibility,
    );
    expect(deliveryPromises(state, jobId).map((c) => ({ id: c.id, status: c.status }))).toEqual(
      promises,
    );
    expect(state.independentRepairs).toBe(0);
  });
});
