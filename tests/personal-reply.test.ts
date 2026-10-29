import { gunzipSync, gzipSync } from 'node:zlib';
import { exportRun, readRunHistory, restoreRun, step } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { discoveredAccounts } from '../src/game/cast-content';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { exportPersonRun } from '../src/game/hf';
import { isRecordedCommand } from '../src/game/recording';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';
import { cloneGame, native } from './hf-fixture';

function act(s: GameState, c: Command) {
  const r = dispatch(s, c);
  expect(r.ok, r.message).toBe(true);
  return r.state;
}
function heard() {
  let s = createGame(42);
  s = act(s, { type: 'request-lesson' });
  s = act(s, { type: 'start-lesson' });
  s = act(s, { type: 'verify', jobId: s.selectedJobId, condition: 'movement' });
  return act(s, { type: 'ask-about-work', personId: 'sam' });
}
function reply(s: GameState, choice = 'acknowledge') {
  return {
    type: 'reply-personal',
    personId: 'sam',
    statementId: s.log.find((e) => e.text === discoveredAccounts.sam)?.id ?? 99999,
    jobId: s.selectedJobId,
    choice,
  } as Command;
}

describe('finite personal reply receipt', () => {
  // Catches accepting fabricated speech or awarding a scene outcome for acknowledgment.
  it('requires actual heard words and records literal receipt in HF without solving the account', () => {
    const fresh = createGame(42);
    const rejected = dispatch(fresh, reply(fresh));
    expect(rejected?.ok).toBe(false);
    expect(saveGame(rejected.state)).toBe(saveGame(fresh));
    const before = heard();
    expect(isRecordedCommand(reply(before))).toBe(true);
    const s = act(before, reply(before));
    expect(
      s.log.some(
        (e) =>
          e.speaker === 'You' &&
          e.text.includes('I heard you say you copied the report without checking it.'),
      ),
    ).toBe(true);
    expect(JSON.stringify(readRunHistory(exportPersonRun(s.people.sam!)))).toContain(
      'personal-reply-received',
    );
    expect(s.cash).toBe(before.cash);
    expect(s.jobs).toEqual(before.jobs);
    expect(s.now).toBe(before.now);
    expect(s.castOutcomes).toBeUndefined();
    expect(dispatch(s, reply(before)).ok).toBe(false);
    const raw = saveGame(s);
    expect(saveGame(loadGame(raw))).toBe(raw);
    for (const packet of [s, { seed: s.seed, inputs: s.inputs, provenance: s.provenance }]) {
      const full = JSON.parse(gunzipSync(gzipSync(JSON.stringify(packet))).toString());
      const replay = replayRecordedRun(full, raw);
      expect(replay.ok).toBe(true);
      if (replay.ok) {
        expect(replay.save).toBe(raw);
        expect(saveGame(act(replay.state, { type: 'wait', minutes: 7 }))).toBe(
          saveGame(act(loadGame(raw), { type: 'wait', minutes: 7 })),
        );
      }
    }
  });

  it('allows refusal or no answer and rejects wrong objects, departure and late replies', () => {
    const s = heard();
    const raw = saveGame(s);
    // Reading or leaving the account is not a recorded answer.
    expect(saveGame(loadGame(raw))).toBe(raw);
    const donor = s.jobs.find((j) => j.isDonor);
    if (!donor) throw new Error('No donor object');
    const wrong = { ...reply(s), jobId: donor.id } as Command;
    expect(dispatch(s, wrong)?.ok).toBe(false);
    const paused = act(s, { type: 'pause-chapter' });
    expect(dispatch(paused, reply(s)).ok).toBe(false);
    const late = act(s, { type: 'wait', minutes: 31 });
    expect(dispatch(late, reply(s)).ok).toBe(false);
    const declined = act(s, reply(s, 'decline'));
    expect(
      declined.log.some(
        (e) => e.speaker === 'You' && e.text.includes('I do not want to discuss this now.'),
      ),
    ).toBe(true);
    expect(declined.jobs).toEqual(s.jobs);
    expect(declined.cash).toBe(s.cash);
    expect(isRecordedCommand({ ...reply(s), choice: 'repair-everything' })).toBe(false);
    expect(isRecordedCommand({ ...reply(s), statementId: -1 })).toBe(false);
  });
  it('acknowledges Halil’s actual Nuran statement without changing his body, obligations or activity', () => {
    let s = createGame(42);
    s = act(s, { type: 'next-day' });
    s = act(s, { type: 'next-day' });
    const object = s.jobs.find((j) => j.ownerId === 'halil' && j.status === 'offer');
    if (!object) throw new Error('No Halil visit');
    s = act(s, { type: 'accept', jobId: object.id });
    s = act(s, { type: 'verify', jobId: object.id, condition: 'movement' });
    s = act(s, { type: 'ask-about-work', personId: 'halil' });
    const statement = s.log.find((e) => e.text === discoveredAccounts.halil);
    if (!statement) throw new Error('No actual Halil statement');
    const before = cloneGame(s);
    const command: Command = {
      type: 'reply-personal',
      personId: 'halil',
      statementId: statement.id,
      jobId: object.id,
      choice: 'acknowledge',
    };
    s = act(s, command);
    expect(
      s.log.some(
        (e) =>
          e.speaker === 'You' && e.text.includes('Nuran asking why you would not name a price.'),
      ),
    ).toBe(true);
    // Receiving the words consumes native milliseconds. Compare the body with the same
    // elapsed time without that observation, rather than freezing ordinary physiology.
    const baseline = restoreRun(exportPersonRun(before.people.halil!));
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) throw new Error('The matched body control did not restore.');
    const elapsed = step(baseline.value, {
      until: exportPersonRun(s.people.halil!).current.at,
      inputs: [],
    });
    expect(elapsed.ok).toBe(true);
    expect(native(s.people.halil!).body).toEqual(
      exportRun(baseline.value).current.people.halil!.body,
    );
    expect(s.people.halil?.activity).toEqual(before.people.halil?.activity);
    expect(s.people.halil?.agenda).toEqual(before.people.halil?.agenda);
    expect(s.cash).toBe(before.cash);
    expect(s.jobs).toEqual(before.jobs);
    const occupied = act(before, { type: 'wait', minutes: 5 });
    expect(dispatch(occupied, command).ok).toBe(false);
  });
  it('answers Nora after an honest unfinished return without claiming permission for a repair', () => {
    let s = act(createGame(42), { type: 'next-day' });
    const object = s.jobs.find(
      (j) => j.ownerId === 'nora' && j.kind === 'music-box' && j.status === 'offer',
    );
    if (!object) throw new Error('No keepsake request');
    s = act(s, { type: 'accept', jobId: object.id });
    s = act(s, { type: 'verify', jobId: object.id, condition: 'load' });
    s = act(s, { type: 'deliver', jobId: object.id, unfinished: true });
    s = act(s, { type: 'select', jobId: object.id });
    s = act(s, { type: 'ask-about-work', personId: 'nora' });
    const statement = s.log.find((e) => e.text === discoveredAccounts.nora);
    if (!statement) throw new Error('No actual Nora statement');
    const before = cloneGame(s);
    s = act(s, {
      type: 'reply-personal',
      personId: 'nora',
      statementId: statement.id,
      jobId: object.id,
      choice: 'acknowledge',
    });
    expect(s.jobs).toEqual(before.jobs);
    expect(s.log.some((e) => e.speaker === 'You' && e.text.includes('your brother helped'))).toBe(
      true,
    );
  });
});
