import { describe, expect, it } from 'vitest';
import { createGame, dispatch, replayCommands } from '../src/game/engine';
import { loadGame, saveGame } from '../src/game/persistence';
import {
  isInputRecording,
  isRecordedCommand,
  isSupportedProvenance,
  SAVE_PROVENANCE,
} from '../src/game/recording';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';

function apply(state: GameState, commands: Command[]): GameState {
  for (const command of commands) {
    const result = dispatch(state, command);
    expect(result.ok, result.message).toBe(true);
    state = result.state;
  }
  return state;
}

function commands(state: GameState): Command[] {
  return [
    { type: 'inspect', jobId: state.selectedJobId, componentId: 'cell' },
    { type: 'power', jobId: state.selectedJobId, on: true },
    { type: 'verify', jobId: state.selectedJobId, condition: 'bench' },
    { type: 'wait', minutes: 30 },
  ];
}

describe('recorded run replay', () => {
  it('reports unsupported versions before replaying commands or comparing state', () => {
    const start = createGame(42);
    const expected = JSON.parse(saveGame(start));
    const invalidInput = [{ type: 'select', jobId: 'missing-object' }];
    expected.provenance.framework = '2.2.0';
    expect(
      replayRecordedRun({ seed: 42, inputs: invalidInput }, JSON.stringify(expected)),
    ).toMatchObject({ ok: false, reason: 'unsupported-version' });
    expect(
      replayRecordedRun({
        seed: 42,
        inputs: [],
        provenance: { ...SAVE_PROVENANCE, engine: 'small-works@1' },
      }),
    ).toMatchObject({ ok: false, reason: 'unsupported-version' });
    expect(
      replayRecordedRun({ seed: 42, inputs: [], provenance: SAVE_PROVENANCE }, saveGame(start)).ok,
    ).toBe(true);
  });

  it('refuses the earlier text edition so resumed old prose cannot produce a broken export', () => {
    const oldSave = JSON.parse(saveGame(createGame(42)));
    oldSave.provenance.game = '4.0.0';
    expect(() => loadGame(JSON.stringify(oldSave))).toThrow('Start fresh');
    expect(replayRecordedRun(oldSave, JSON.stringify(oldSave))).toMatchObject({
      ok: false,
      reason: 'unsupported-version',
    });
  });

  it('rejects fractional clock advances without breaking its own export', () => {
    const start = createGame(42);
    const result = dispatch(start, { type: 'wait', minutes: 0.5 });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(start);
    expect(isRecordedCommand({ type: 'wait', minutes: 0.5 })).toBe(false);
    expect(saveGame(loadGame(saveGame(result.state)))).toBe(saveGame(start));
  });
  it('reproduces the entire world including people and random state', () => {
    const start = createGame(42);
    const inputs = commands(start);
    const finish = apply(start, inputs);
    const result = replayRecordedRun({ seed: 42, inputs }, saveGame(finish));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save).toBe(saveGame(finish));
  });

  it('reproduces a save-and-resume branch', () => {
    const start = createGame(42);
    const inputs = commands(start);
    const prefix = apply(start, inputs.slice(0, 2));
    const resumed = apply(loadGame(saveGame(prefix)), inputs.slice(2));
    expect(replayRecordedRun({ seed: 42, inputs }, saveGame(resumed)).ok).toBe(true);
  });

  it('detects a changed seed or accepted input', () => {
    const start = createGame(42);
    const inputs = commands(start);
    const expected = saveGame(apply(start, inputs));
    expect(replayRecordedRun({ seed: 43, inputs }, expected)).toMatchObject({
      ok: false,
      reason: 'state-mismatch',
    });
    const changed = [...inputs.slice(0, -1), { type: 'wait', minutes: 31 }];
    expect(replayRecordedRun({ seed: 42, inputs: changed }, expected)).toMatchObject({
      ok: false,
      reason: 'state-mismatch',
    });
  });

  it('reports the first command rejected by the world', () => {
    const input: Command = { type: 'select', jobId: 'missing-object' };
    expect(replayRecordedRun({ seed: 42, inputs: [input] })).toMatchObject({
      ok: false,
      reason: 'command-failed',
      index: 0,
      command: input,
    });
  });

  it('rejects malformed recordings before running commands', () => {
    for (const inputs of [
      [{ type: 'wait', minutes: Infinity }],
      [{ type: 'wait', minutes: -1 }],
      [{ type: 'power', jobId: 'a', on: 'true' }],
      [{ type: 'continue', extra: true }],
      [{ type: 'unknown' }],
      new Array(10001).fill({ type: 'next-day' }),
    ]) {
      expect(replayRecordedRun({ seed: 42, inputs })).toMatchObject({
        ok: false,
        reason: 'invalid-recording',
      });
    }
    expect(replayRecordedRun({ seed: -1, inputs: [] }).ok).toBe(false);
    expect(isInputRecording(undefined)).toBe(false);
  });

  it('records accepted inputs exactly and leaves failed inputs unchanged', () => {
    const start = createGame(42);
    const command: Command = { type: 'inspect', jobId: start.selectedJobId, componentId: 'cell' };
    const result = dispatch(start, command);
    expect(result.state.inputs).toEqual([command]);
    command.componentId = 'switch';
    expect(result.state.inputs?.[0]).toMatchObject({ componentId: 'cell' });
    expect(start.inputs).toEqual([]);
    const failed = dispatch(result.state, { type: 'select', jobId: 'missing' });
    expect(failed.ok).toBe(false);
    expect(failed.state).toBe(result.state);
    expect(failed.state.inputs).toHaveLength(1);
  });

  it('isolates nested caller commands, prior recordings and world state on success and failure', () => {
    const start = createGame(42);
    const command: Extract<Command, { type: 'measure' }> = {
      type: 'measure',
      jobId: start.selectedJobId,
      request: { mode: 'voltage', a: 'A', b: '0', condition: 'bench' },
    };
    const before = saveGame(start);
    const result = dispatch(start, command);
    expect(result.ok, result.message).toBe(true);
    expect(saveGame(start)).toBe(before);
    const saved = saveGame(result.state);
    command.request.condition = 'load';
    expect(saveGame(result.state)).toBe(saved);
    const next = dispatch(result.state, { type: 'select', jobId: start.selectedJobId });
    expect(next.ok).toBe(true);
    const recorded = next.state.inputs?.[0];
    if (recorded?.type !== 'measure') throw Error('Missing recorded measurement');
    recorded.request.a = 'B';
    next.state.jobs[0]?.evidence.splice(0);
    expect(saveGame(result.state)).toBe(saved);
    const invalid: Command = {
      type: 'measure',
      jobId: start.selectedJobId,
      request: { mode: 'continuity', a: 'A', b: 'B', condition: 'bench' },
    };
    const failed = dispatch(result.state, invalid);
    expect(failed.ok).toBe(false);
    expect(failed.state).toBe(result.state);
    expect(saveGame(failed.state)).toBe(saved);
  });

  it('keeps replay-owned recordings isolated and reports the exact failed command', () => {
    const start = createGame(42);
    const inputs: Command[] = [
      {
        type: 'measure',
        jobId: start.selectedJobId,
        request: { mode: 'voltage', a: 'A', b: '0', condition: 'bench' },
      },
      { type: 'select', jobId: start.selectedJobId },
    ];
    const before = saveGame(start);
    const result = replayCommands(start, inputs);
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.message);
    expect(saveGame(result.state)).toBe(saveGame(apply(start, inputs)));
    const saved = saveGame(result.state);
    const first = inputs[0];
    if (first?.type !== 'measure') throw Error('Missing measurement');
    first.request.b = 'B';
    start.jobs[0]?.evidence.splice(0);
    expect(saveGame(result.state)).toBe(saved);
    const recorded = result.state.inputs?.[0];
    if (recorded?.type !== 'measure') throw Error('Missing replay measurement');
    recorded.request.a = 'C';
    expect(first.request.a).toBe('A');
    expect(saveGame(start)).toBe(before);
    const invalid: Command = {
      type: 'measure',
      jobId: start.selectedJobId,
      request: { mode: 'continuity', a: 'A', b: 'B', condition: 'bench' },
    };
    const failure = replayCommands(start, [inputs[1] as Command, invalid]);
    const publicFailure = dispatch(start, invalid);
    expect(publicFailure.ok).toBe(false);
    expect(failure).toEqual({
      ok: false,
      index: 1,
      command: invalid,
      message: publicFailure.message,
    });
    if (failure.ok || failure.command.type !== 'measure')
      throw Error('Expected failed measurement');
    failure.command.request.a = 'D';
    expect(invalid.request.a).toBe('A');
    expect(saveGame(start)).toBe(before);
  });

  it('keeps playing after the input limit and never invents legacy history', () => {
    const start = createGame(42);
    start.inputs = new Array(10000).fill({ type: 'select', jobId: start.selectedJobId });
    const result = dispatch(start, { type: 'select', jobId: start.selectedJobId });
    expect(result.ok).toBe(true);
    expect(result.state.inputs).toBeUndefined();
    const legacy = JSON.parse(saveGame(createGame(42)));
    delete legacy.inputs;
    delete legacy.provenance;
    expect(() => loadGame(JSON.stringify(legacy))).toThrow('Start fresh');
  });

  it('rejects invalid provenance and recording metadata on import', () => {
    for (const patch of [
      { provenance: { ...SAVE_PROVENANCE, scenario: 'old-campaign@18' } },
      { provenance: undefined },
      { inputs: [{ type: 'wait', minutes: 481 }] },
      { inputs: new Array(10001).fill({ type: 'next-day' }) },
    ]) {
      const packet = { ...JSON.parse(saveGame(createGame(42))), ...patch };
      expect(() => loadGame(JSON.stringify(packet))).toThrow();
    }
  });

  it('replays queued learning, partial work, and native consent through save branches', () => {
    let state = createGame(42);
    const act = (command: Command) => {
      state = apply(state, [command]);
      state = loadGame(saveGame(state));
      expect(
        replayRecordedRun({ seed: state.seed, inputs: state.inputs }, saveGame(state)).ok,
      ).toBe(true);
    };
    act({ type: 'wait', minutes: 1 });
    act({ type: 'request-lesson' });
    expect(state.pendingRequest?.status).toBe('requested');
    const endsAt = state.npcWork.find((work) => work.personId === 'sam')?.endsAt;
    if (endsAt === undefined) throw new Error('Missing actual Sam activity');
    act({ type: 'wait', minutes: endsAt - state.now });
    act({ type: 'start-lesson' });
    act({ type: 'inspect', jobId: state.selectedJobId, componentId: 'switch' });
    act({ type: 'verify', jobId: state.selectedJobId, condition: 'movement' });
    act({
      type: 'work',
      jobId: state.selectedJobId,
      componentId: 'switch',
      intervention: 'replace',
    });
    act({ type: 'watch', enabled: false });
    act({ type: 'assign', jobId: state.selectedJobId, personId: 'sam' });
    for (let attempt = 0; attempt < 8; attempt++) {
      const work = state.npcWork.find((candidate) => candidate.personId === 'sam');
      if (!work || work.endsAt <= state.now) break;
      act({ type: 'wait', minutes: work.endsAt - state.now });
      if (state.jobs[0]?.assignedTo === 'sam' && work.option.action === 'accept-repair') break;
    }
    expect(state.people.sam?.trace.some((trace) => trace.chosenAction === 'accept-repair')).toBe(
      true,
    );
  });

  it('replays preparation and actual community attendance from a fresh seed', () => {
    let state = createGame(416);
    const act = (command: Command) => {
      state = apply(state, [command]);
    };
    const jobId = state.selectedJobId;
    act({ type: 'work', jobId, componentId: 'switch', intervention: 'replace' });
    act({ type: 'power', jobId, on: true });
    for (const condition of ['bench', 'movement', 'load'] as const)
      act({ type: 'verify', jobId, condition });
    act({ type: 'deliver', jobId });
    for (let day = 0; day < 3; day++) act({ type: 'next-day' });
    act({ type: 'wait-for-site' });
    act({ type: 'prepare-event', format: 'garden' });
    state = loadGame(saveGame(state));
    act({ type: 'wait', minutes: 90 });
    expect(state.community?.decisions.length).toBeGreaterThan(0);
    expect(replayRecordedRun({ seed: state.seed, inputs: state.inputs }, saveGame(state)).ok).toBe(
      true,
    );
  });

  it('validates measurement fields and exact supported provenance', () => {
    expect(
      isRecordedCommand({
        type: 'measure',
        jobId: 'job-1',
        request: { mode: 'voltage', a: 'A', b: '0', condition: 'load' },
      }),
    ).toBe(true);
    expect(
      isRecordedCommand({
        type: 'measure',
        jobId: 'job-1',
        request: { mode: 'voltage', a: 'A', b: '0', condition: 'load', extra: true },
      }),
    ).toBe(false);
    expect(isSupportedProvenance(SAVE_PROVENANCE)).toBe(true);
    expect(isSupportedProvenance({ ...SAVE_PROVENANCE, framework: '2.1.0' })).toBe(false);
    expect(isSupportedProvenance({ ...SAVE_PROVENANCE, unknown: 'version' })).toBe(false);
  });
});
