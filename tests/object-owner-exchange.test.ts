import { gunzipSync, gzipSync } from 'node:zlib';
import { noteVoicePromise, promise } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { isRecordedCommand } from '../src/game/recording';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';

function act(s: GameState, c: Command) {
  const r = dispatch(s, c);
  expect(r.ok, r.message).toBe(true);
  return r.state;
}
function observed() {
  let s = act(createGame(42), { type: 'next-day' });
  const job = s.jobs.find(
    (j) => j.ownerId === 'nora' && j.kind === 'music-box' && j.status === 'offer',
  );
  if (!job) throw Error('No Nora keepsake');
  s = act(s, { type: 'accept', jobId: job.id });
  s = act(s, { type: 'inspect', jobId: job.id, componentId: 'gear' });
  s = act(s, { type: 'verify', jobId: job.id, condition: 'load' });
  return s;
}
function question(s: GameState): Command {
  const j = s.jobs.find((j) => j.id === s.selectedJobId);
  if (!j) throw Error('No selected object');
  return {
    type: 'ask-owner-about-object',
    jobId: j.id,
    ownerId: 'nora',
    componentId: 'gear',
    intervention: 'replace',
    evidenceIds: j.evidence.filter((e) => e.kind !== 'work').map((e) => e.id),
    evidenceText: JSON.stringify(j.evidence.filter((e) => e.kind !== 'work')),
  } as Command;
}

describe('finite object-owner replacement question', () => {
  // Removing actual HF choice or scoping the receipt to a biography would break this control.
  it('gets an actual limited response about received evidence, while an existing promise prevents asking', () => {
    const before = observed();
    const command = question(before);
    expect(isRecordedCommand(command)).toBe(true);
    const s = act(before, command);
    const receipt = s.ownerExchanges?.at(-1);
    expect(receipt?.jobId).toBe(before.selectedJobId);
    expect(receipt?.componentId).toBe('gear');
    expect(receipt?.intervention).toBe('replace');
    expect(receipt?.ownerId).toBe('nora');
    expect(receipt?.originalRequest).toContain('I do not want new parts');
    expect(receipt?.evidence.map((e) => e.id)).toEqual(
      (command as { evidenceIds: number[] }).evidenceIds,
    );
    expect(receipt?.decision.chosenId).toBe('owner-one-part');
    expect(receipt?.terms).toBe('one-part');
    expect(receipt?.decision.answer?.verdict).toBe('assented');
    expect(receipt?.response).toContain('gear');
    expect(s.now).toBe(before.now + 5);
    expect(s.jobs).toEqual(before.jobs);
    expect(s.stock).toEqual(before.stock);
    expect(s.cash).toBe(before.cash);
    expect(s.discoveries).toEqual(before.discoveries);
    expect(JSON.stringify(s.people.nora)).toContain('object-proposal-received');
    expect(dispatch(s, command).ok).toBe(false);
    // Same object, evidence, resources and proposal. Only public HF voice history differs.
    const distrust = structuredClone(before);
    const distrustingOwner = distrust.people.nora;
    if (!distrustingOwner) throw Error('No Nora');
    for (let n = 0; n < 12; n++)
      noteVoicePromise(distrustingOwner, 'player', {
        kept: false,
        at: distrust.now,
        action: 'deliver',
      });
    const declined = act(distrust, question(distrust));
    expect(declined.ownerExchanges?.at(-1)?.terms).not.toBe('one-part');
    expect(declined.ownerExchanges?.at(-1)?.response).toContain('not agreeing');
    expect(declined.jobs).toEqual(before.jobs);
    expect(declined.stock).toEqual(before.stock);
    expect(declined.now).toBe(before.now + 5);
    const committed = structuredClone(before);
    const p = committed.people.nora;
    if (!p) throw Error('No Nora');
    promise(p, {
      kind: 'promise',
      actions: ['personal'],
      from: committed.now,
      until: committed.now + 20,
      importance: 1,
      label: 'Keep my agreed appointment',
    });
    const refused = dispatch(committed, question(committed));
    expect(refused.ok).toBe(false);
    expect(saveGame(refused.state)).toBe(saveGame(committed));
    const raw = saveGame(s);
    expect(saveGame(loadGame(raw))).toBe(raw);
    const missingInputs = JSON.parse(raw);
    delete missingInputs.inputs;
    expect.soft(() => loadGame(JSON.stringify(missingInputs))).toThrow();
    const fabricated = JSON.parse(raw);
    fabricated.ownerExchanges[0].evidence[0].summary =
      'A fabricated observation never received by the owner.';
    expect.soft(() => loadGame(JSON.stringify(fabricated))).toThrow();
    const forged = JSON.parse(raw);
    forged.ownerExchanges[0].componentId = 'spring';
    expect(() => loadGame(JSON.stringify(forged))).toThrow();
    const silent = JSON.parse(raw);
    silent.inputs = silent.inputs.filter((c: Command) => c.type !== 'ask-owner-about-object');
    expect(() => loadGame(JSON.stringify(silent))).toThrow();
    for (const packet of [s, { seed: s.seed, inputs: s.inputs, provenance: s.provenance }]) {
      const native = JSON.parse(gunzipSync(gzipSync(JSON.stringify(packet))).toString());
      const replay = replayRecordedRun(native, raw);
      expect(replay.ok).toBe(true);
      if (replay.ok) {
        expect(replay.save).toBe(raw);
        expect(saveGame(act(replay.state, { type: 'wait', minutes: 7 }))).toBe(
          saveGame(act(loadGame(raw), { type: 'wait', minutes: 7 })),
        );
      }
    }
  });
  it('retains exact activation after later physical work and the original real input-cap deletion', () => {
    let s = act(observed(), question(observed()));
    s = act(s, {
      type: 'work',
      jobId: s.selectedJobId,
      componentId: 'gear',
      intervention: 'replace',
    });
    s = act(s, { type: 'verify', jobId: s.selectedJobId, condition: 'load' });
    expect(saveGame(loadGame(saveGame(s)))).toBe(saveGame(s));
    while (s.inputs !== undefined) s = act(s, { type: 'select', jobId: s.selectedJobId });
    expect(s.inputs).toBeUndefined();
    expect(s.ownerExchanges?.[0]?.recordingClosedAtInput).toBe(10000);
    const raw = saveGame(s);
    expect(saveGame(loadGame(raw))).toBe(raw);
    const tampered = JSON.parse(raw);
    tampered.ownerExchanges[0].evidence[0].summary = 'Not the observation actually shown';
    expect(() => loadGame(JSON.stringify(tampered))).toThrow();
    s = act(s, { type: 'wait', minutes: 7 });
    expect(saveGame(loadGame(saveGame(s)))).toBe(saveGame(s));
  }, 60000);

  it('rejects wrong owner/part, uninspected or stale evidence and a returned object without changing state', () => {
    const s = observed(),
      q = question(s);
    for (const bad of [
      { ...q, ownerId: 'rafi' },
      { ...q, componentId: 'motor' },
      { ...q, componentId: 'spring' },
      { ...q, jobId: s.jobs[0]?.id },
      { ...q, evidenceIds: [] },
      { ...q, evidenceIds: [99999] },
    ] as Command[]) {
      const r = dispatch(s, bad);
      expect(r.ok).toBe(false);
      expect(saveGame(r.state)).toBe(saveGame(s));
    }
    const changed = act(s, {
      type: 'work',
      jobId: s.selectedJobId,
      componentId: 'gear',
      intervention: 'clean',
    });
    expect(dispatch(changed, q).ok).toBe(false);
    const returned = act(s, { type: 'deliver', jobId: s.selectedJobId, unfinished: true });
    expect(dispatch(returned, q).ok).toBe(false);
    expect(isRecordedCommand({ ...q, evidenceIds: [1, 1] })).toBe(false);
    expect(isRecordedCommand({ ...q, intervention: 'diagnose' })).toBe(false);
  });
});
