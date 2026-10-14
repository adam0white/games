import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { helpFeedback } from '../src/game/help-feedback';
import { teachObserved } from '../src/game/people';
import type { Command, GameState } from '../src/game/types';

function act(state: GameState, command: Command): GameState {
  const result = dispatch(state, command);
  expect(result.ok, result.message).toBe(true);
  return result.state;
}

describe('received evidence and legal checks', () => {
  it('lets a learner perform a known check even when someone else already checked the object', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    state = act(state, { type: 'work', jobId, componentId: 'switch', intervention: 'replace' });
    state = act(state, { type: 'verify', jobId, condition: 'movement' });
    const sam = state.people.sam;
    if (!sam) throw new Error('Missing learner');
    // Isolate the legal test offer with a public demonstration. This is not a claim of spontaneous transfer.
    teachObserved(
      sam,
      'example',
      {
        family: 'electrical',
        stage: 'intake',
        'requested-use': 'lantern:movement',
      },
      'verify:movement',
      'first-test-example',
      'success',
      state.now,
    );
    const before = saveGame(state);
    const commands: Command[] = [
      { type: 'assign', jobId, personId: 'sam' },
      { type: 'wait', minutes: 80 },
    ];
    for (const command of commands) state = act(state, command);
    const job = state.jobs.find((candidate) => candidate.id === jobId);
    expect(
      job?.evidence.some(
        (step) => step.actorId === 'sam' && step.kind === 'use' && step.condition === 'movement',
      ),
    ).toBe(true);
    expect(job?.status).toBe('delivered');
    expect(state.independentRepairs).toBe(0);
    let replay = loadGame(before);
    for (const command of commands) replay = act(replay, command);
    expect(saveGame(replay)).toBe(saveGame(state));
  });

  it('does not describe an unseen passed check or a hidden fault as the learner’s knowledge', () => {
    let state = createGame(42);
    const jobId = state.selectedJobId;
    state = act(state, { type: 'work', jobId, componentId: 'switch', intervention: 'replace' });
    state = act(state, { type: 'verify', jobId, condition: 'movement' });
    const job = state.jobs[0];
    const sam = state.people.sam;
    if (!job || !sam) throw new Error('Missing fixture');
    const unknown = helpFeedback(job, sam, []);
    expect(unknown).not.toContain('checks pass');
    const changed = structuredClone(job);
    for (const part of changed.model.components) part.condition = 'open';
    expect(helpFeedback(changed, sam, [])).toBe(unknown);
    const check = job.evidence.findLast((step) => step.kind === 'use');
    if (!check) throw new Error('Missing check');
    check.witnessedBy = ['sam'];
    expect(helpFeedback(job, sam, [])).toContain('returning it is the remaining task');
  });

  it('does not infer missing knowledge merely because someone chose help', () => {
    const state = createGame(42);
    const job = state.jobs[0];
    const sam = state.people.sam;
    if (!job || !sam) throw new Error('Missing fixture');
    teachObserved(
      sam,
      job.id,
      { family: 'electrical', stage: 'intake', 'requested-use': 'lantern:movement' },
      'verify:movement',
      'known-first-test',
      'success',
      state.now,
    );
    expect(helpFeedback(job, sam, ['verify:movement'])).toContain('remember a possible next step');
    expect(helpFeedback(job, sam, [])).toContain('available time or parts');
  });
});
