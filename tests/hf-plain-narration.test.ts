import { exportRun, inspect, replay, restoreRun } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { createGame, dispatch } from '../src/game/engine';
import { loadGame, saveGame } from '../src/game/persistence';
import { SAVE_PROVENANCE } from '../src/game/recording';
import { replayRecordedRun } from '../src/game/replay';

describe('published HF narration and provenance', () => {
  it('preserves inspected narration and verifies the current archive replay', () => {
    let state = createGame(42);
    expect(SAVE_PROVENANCE.framework).toBe('4.6.0');
    state = dispatch(state, { type: 'request-lesson' }).state;
    const saved = saveGame(state);
    const archive = JSON.parse(saved).hf.archive;
    expect(archive.format).toBe('hf-run');
    expect(archive.version).toBe(5);
    expect(archive.hashes.full).toBe(
      '109a6a7bb88ec2cbde710d7330af3f1ec4629950df9ddabdba80d0a44abefb3c',
    );
    const restored = restoreRun(archive);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(JSON.stringify(restored.error));
    const view = inspect(restored.value, {
      perspective: { kind: 'host' },
      people: ['sam'],
      select: ['summary', 'events'],
      diagnostic: 'full-hash',
    });
    expect(view.ok).toBe(true);
    if (!view.ok) throw new Error(JSON.stringify(view.error));
    expect(view.value.fullHash).toBe(archive.hashes.full);
    const decisions = view.value.events.filter((event) => event.data.kind === 'decision');
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.some((event) => event.narration.some((line) => line.text.length > 0))).toBe(
      true,
    );
    const lastSamDecision = [...archive.current.events]
      .reverse()
      .find(
        (entry: { person?: string; data: { kind: string } }) =>
          entry.person === 'sam' && entry.data.kind === 'decision',
      );
    const samDecision = decisions.find((event) => event.id === lastSamDecision?.id);
    expect(samDecision).toBeDefined();
    expect(state.people.sam!.trace[0]!.narration).toBe(
      samDecision!.narration.map((line) => line.text).join(' '),
    );
    const nativeReplay = replay(archive);
    expect(nativeReplay.ok).toBe(true);
    if (!nativeReplay.ok) throw new Error(JSON.stringify(nativeReplay.error));
    expect(nativeReplay.value.verified).toBe(true);
    expect(nativeReplay.value.fullHash).toBe(archive.hashes.full);
    expect(exportRun(nativeReplay.value.run).hashes.full).toBe(archive.hashes.full);
    const gameReplay = replayRecordedRun(JSON.parse(saved), saved);
    expect(gameReplay.ok).toBe(true);
    if (gameReplay.ok) expect(gameReplay.save).toBe(saved);
  });

  it('refuses an earlier framework provenance with a start-fresh message', () => {
    const old = JSON.parse(saveGame(createGame(42)));
    old.provenance.framework = '3.0.0';
    expect(() => loadGame(JSON.stringify(old))).toThrow('Start fresh');
    const result = replayRecordedRun(old);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unsupported-version');
      expect(result.message).toContain('Start a new game');
    }
  });
});

describe('HF4 raw continuation', () => {
  it.each([7, 42, 1001])(
    'preserves every saved field, RNG and semantic narration history across resume for seed %i',
    (seed) => {
      let state = createGame(seed);
      const jobId = state.selectedJobId;
      const commands = [
        { type: 'verify', jobId, condition: 'movement' },
        { type: 'work', jobId, componentId: 'switch', intervention: 'replace' },
        { type: 'verify', jobId, condition: 'movement' },
        { type: 'deliver', jobId },
        { type: 'request-lesson' },
        { type: 'wait', minutes: 30 },
        { type: 'next-day' },
      ] as const;
      for (const command of commands) {
        const saved = saveGame(state);
        const restored = loadGame(saved);
        expect(saveGame(restored)).toBe(saved);
        const continuous = dispatch(state, command);
        const resumed = dispatch(restored, command);
        expect(resumed.ok).toBe(continuous.ok);
        expect(saveGame(resumed.state)).toBe(saveGame(continuous.state));
        if (command.type === 'next-day') {
          for (const person of Object.values(continuous.state.people)) {
            expect(person.body.asleep).toBe(false);
            expect(
              person.agenda.commitments.some(
                (commitment) =>
                  commitment.actions.includes('start-day') && commitment.status === 'kept',
              ),
            ).toBe(true);
          }
        }
        state = continuous.state;
      }
      const saved = saveGame(state);
      const gameReplay = replayRecordedRun(JSON.parse(saved), saved);
      expect(gameReplay.ok).toBe(true);
      if (gameReplay.ok) expect(gameReplay.save).toBe(saved);
      const archive = JSON.parse(saved).hf.archive;
      const nativeReplay = replay(archive);
      expect(nativeReplay.ok).toBe(true);
      if (!nativeReplay.ok) throw new Error(JSON.stringify(nativeReplay.error));
      expect(nativeReplay.value.verified).toBe(true);
      expect(nativeReplay.value.fullHash).toBe(archive.hashes.full);
      expect(exportRun(nativeReplay.value.run).hashes.full).toBe(archive.hashes.full);
    },
  );
});
