import { promise } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { methodQuestion, methodReport, methodResponse } from '../src/game/method-response';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';

const act = (s: GameState, c: Command) => {
  const r = dispatch(s, c);
  expect(r.ok, r.message).toBe(true);
  return r.state;
};
function repaired(intervention: 'clean' | 'replace') {
  let s = act(createGame(42), { type: 'next-day' });
  const j = s.jobs.find(
    (j) => j.ownerId === 'nora' && j.kind === 'music-box' && j.status === 'offer',
  );
  if (!j) throw Error('No actual Nora job');
  for (const c of [
    { type: 'accept', jobId: j.id },
    { type: 'inspect', jobId: j.id, componentId: 'gear' },
    { type: 'work', jobId: j.id, componentId: 'gear', intervention },
    { type: 'verify', jobId: j.id, condition: 'load' },
  ] as Command[])
    s = act(s, c);
  return s;
}
it('responds to actual performed methods on the same native job and preserves independent physical/return outcomes', () => {
  const reports = [];
  for (const method of ['clean', 'replace'] as const) {
    const before = repaired(method);
    const s = act(before, methodQuestion(before, before.selectedJobId, 'gear'));
    const r = s.methodResponses?.[0];
    expect(r?.attended).toBe(true);
    expect(r?.response).toContain(
      method === 'clean' ? 'kept the original parts' : 'replaced the gear',
    );
    expect(r?.response).toContain('I do not want new parts');
    expect(s.jobs).toEqual(before.jobs);
    expect(s.cash).toBe(before.cash);
    expect(s.stock).toEqual(before.stock);
    expect(s.now).toBe(before.now + 5);
    reports.push(r?.response);
    const raw = saveGame(s);
    expect(saveGame(loadGame(raw))).toBe(raw);
    for (const packet of [s, { seed: s.seed, inputs: s.inputs, provenance: s.provenance }])
      expect(replayRecordedRun({ ...packet, inputs: packet.inputs }, raw).ok).toBe(true);
    const forged = JSON.parse(raw);
    forged.methodResponses[0].report.evidence[0].summary = 'Invented method';
    expect(() => loadGame(JSON.stringify(forged))).toThrow();
    const missing = JSON.parse(raw);
    delete missing.inputs;
    expect(() => loadGame(JSON.stringify(missing))).toThrow();
    const later = act(s, {
      type: 'work',
      jobId: s.selectedJobId,
      componentId: 'gear',
      intervention: 'clean',
    });
    let rolled = later;
    if (method === 'replace')
      for (let n = 0; n < 81; n++) {
        if ((rolled.now % 1440) + 10 > 1020) rolled = act(rolled, { type: 'next-day' });
        rolled = act(rolled, { type: 'inspect', jobId: rolled.selectedJobId, componentId: 'gear' });
      }
    const returned = act(rolled, {
      type: 'deliver',
      jobId: rolled.selectedJobId,
      unfinished: true,
    });
    expect(saveGame(loadGame(saveGame(returned)))).toBe(saveGame(returned));
    expect(dispatch(s, methodQuestion(s, s.selectedJobId, 'gear')).ok).toBe(false);
  }
  expect(reports[0]).not.toBe(reports[1]);
});
it('leaves unavailable people alone and never invents an old method', () => {
  const s = repaired('clean');
  const owner = s.people.nora;
  if (!owner) throw Error('No owner');
  promise(owner, {
    kind: 'promise',
    actions: ['personal'],
    from: s.now,
    until: s.now + 20,
    importance: 1,
    label: 'Actual appointment',
  });
  const result = dispatch(s, methodQuestion(s, s.selectedJobId, 'gear'));
  expect(result.ok).toBe(false);
  expect(saveGame(result.state)).toBe(saveGame(s));
  const old = structuredClone(s);
  delete old.inputs;
  expect(methodReport(old, old.selectedJobId, 'gear')?.known).toBe(false);
});
it('supports the actual recording capacity and later native continuation without enlarging limits', () => {
  let s = repaired('replace');
  s = act(s, methodQuestion(s, s.selectedJobId, 'gear'));
  while (s.inputs) s = act(s, { type: 'select', jobId: s.selectedJobId });
  expect(s.methodResponses?.[0]?.recordingClosedAtInput).toBe(10000);
  s = act(s, { type: 'work', jobId: s.selectedJobId, componentId: 'gear', intervention: 'clean' });
  s = act(s, { type: 'deliver', jobId: s.selectedJobId, unfinished: true });
  expect(saveGame(s).length).toBeLessThan(2_000_000);
  expect(saveGame(loadGame(saveGame(s)))).toBe(saveGame(s));
}, 120000);

it('binds historical evidence, context and exact nested receipt shapes to actual recorded execution', () => {
  let state = repaired('replace');
  state = act(state, methodQuestion(state, state.selectedJobId, 'gear'));
  state = act(state, { type: 'wait', minutes: 7 });
  const raw = saveGame(state);
  const rebind = (
    v: GameState & {
      methodResponses: [NonNullable<GameState['methodResponses']>[number]];
      inputs: Command[];
    },
  ) => {
    const r = v.methodResponses[0];
    r.activation.command.reportText = JSON.stringify(r.report);
    v.inputs[r.activation.index] = structuredClone(r.activation.command);
    r.response = methodResponse(r);
  };
  const invented = JSON.parse(raw);
  invented.methodResponses[0].report.evidence.push({
    id: 987654,
    at: invented.methodResponses[0].askedAt,
    kind: 'use',
    summary: 'Fabricated successful test never performed or received.',
    cues: {},
  });
  rebind(invented);
  expect.soft(() => loadGame(JSON.stringify(invented))).toThrow();
  const time = JSON.parse(raw);
  time.methodResponses[0].askedAt++;
  time.methodResponses[0].answeredAt++;
  expect.soft(() => loadGame(JSON.stringify(time))).toThrow();
  const delivery = JSON.parse(raw);
  delivery.methodResponses[0].report.status = 'delivered';
  delivery.methodResponses[0].report.deliveredAt = delivery.methodResponses[0].askedAt;
  rebind(delivery);
  expect.soft(() => loadGame(JSON.stringify(delivery))).toThrow();
  const closure = JSON.parse(raw);
  delete closure.inputs;
  closure.methodResponses[0].recordingClosedAtInput = 10000;
  expect.soft(() => loadGame(JSON.stringify(closure))).toThrow();
  for (const target of ['receipt', 'report', 'activation', 'evidence', 'decision']) {
    const v = JSON.parse(raw),
      r = v.methodResponses[0];
    const where =
      target === 'receipt'
        ? r
        : target === 'report'
          ? r.report
          : target === 'activation'
            ? r.activation
            : target === 'evidence'
              ? r.report.evidence[0]
              : r.decision;
    where.unrecordedAcceptance = true;
    if (target === 'report' || target === 'evidence') rebind(v);
    expect.soft(() => loadGame(JSON.stringify(v))).toThrow();
  }
});
it('binds the historical receipt to its extant actual job, owner terms and retained performed history', () => {
  let s = repaired('replace');
  s = act(s, methodQuestion(s, s.selectedJobId, 'gear'));
  const raw = saveGame(s);
  for (const edit of ['owner', 'request', 'orphan', 'performed']) {
    const v = JSON.parse(raw),
      r = v.methodResponses[0],
      j = v.jobs.find((j: { id: string }) => j.id === r.jobId);
    if (edit === 'owner') j.ownerId = 'rafi';
    if (edit === 'request') j.description = 'Different owner terms never stated in this execution.';
    if (edit === 'orphan') {
      v.jobs = v.jobs.filter((j: { id: string }) => j.id !== r.jobId);
      v.selectedJobId = v.jobs[0].id;
    }
    if (edit === 'performed')
      j.contributions.find((w: { action: string }) => w.action === 'replace:gear').action =
        'clean:gear';
    expect.soft(() => loadGame(JSON.stringify(v))).toThrow();
  }
});
