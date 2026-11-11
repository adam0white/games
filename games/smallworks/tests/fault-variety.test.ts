import { describe, expect, it } from 'vitest';
import { workshopTransfer } from '../src/game/cast';
import { createGame, dispatch } from '../src/game/engine';
import { measure, runUseTest } from '../src/game/model';
import { loadGame, saveGame } from '../src/game/persistence';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';

function step(state: GameState, command: Command): GameState {
  const result = dispatch(state, command);
  expect(result.ok, result.message).toBe(true);
  return result.state;
}
function twoFans(state: GameState): GameState {
  const lantern = state.selectedJobId;
  for (const command of [
    { type: 'verify', jobId: lantern, condition: 'movement' },
    { type: 'inspect', jobId: lantern, componentId: 'switch' },
    { type: 'work', jobId: lantern, componentId: 'switch', intervention: 'replace' },
    { type: 'verify', jobId: lantern, condition: 'movement' },
    { type: 'deliver', jobId: lantern },
  ] as Command[])
    state = step(state, command);
  const first = state.jobs.find((j) => j.kind === 'fan')!;
  for (const command of [
    { type: 'accept', jobId: first.id },
    { type: 'select', jobId: first.id },
    {
      type: 'measure',
      jobId: first.id,
      request: { mode: 'voltage', a: 'A', b: '0', condition: 'load' },
    },
    { type: 'work', jobId: first.id, componentId: 'cell', intervention: 'replace' },
    { type: 'verify', jobId: first.id, condition: 'load' },
    { type: 'deliver', jobId: first.id },
  ] as Command[])
    state = step(state, command);
  while (state.jobs.filter((j) => j.kind === 'fan').length < 2)
    state = step(state, { type: 'next-day' });
  return state;
}

describe('recorded new-world fan variety', () => {
  // SCOPE: host physical generation only. No HF faculty, winning actor or diagnosis disclosure.
  it('changes the second ordinary physical cause, conserves resources and replays the public repair', () => {
    let state = twoFans(createGame(4));
    const fans = state.jobs.filter((j) => j.kind === 'fan');
    const first = fans[0]!;
    const second = fans[1]!;
    expect(first.status).toBe('delivered');
    expect(first.model.components.every((c) => c.condition === 'good')).toBe(true);
    expect(state.faultVariety?.first?.model.components[0]?.condition).toBe('weak');
    expect(second.model.components[0]?.condition).toBe('good');
    expect(runUseTest(second.model, 'load').passes).toBe(false);
    expect(
      measure(second.model, { mode: 'voltage', a: 'A', b: '0', condition: 'load' }).value,
    ).not.toBe(first.evidence.find((e) => e.kind === 'measurement')?.value);
    state = step(state, { type: 'accept', jobId: second.id });
    state = step(state, { type: 'select', jobId: second.id });
    state = step(state, { type: 'buy', part: 'cell' });
    const before = { stock: state.stock.cell, cash: state.cash, now: state.now };
    state = step(state, {
      type: 'work',
      jobId: second.id,
      componentId: 'cell',
      intervention: 'replace',
    });
    expect(state.stock.cell).toBe(before.stock! - 1);
    expect(state.now).toBeGreaterThan(before.now);
    expect(runUseTest(state.jobs.find((j) => j.id === second.id)!.model, 'load').passes).toBe(
      false,
    );
    // Diagnose the retained seed4 control through public measurements, not a hidden-condition policy.
    state = step(state, { type: 'inspect', jobId: second.id, componentId: 'contact' });
    state = step(state, {
      type: 'measure',
      jobId: second.id,
      request: { mode: 'voltage', a: 'C', b: 'D', condition: 'load' },
    });
    expect(state.jobs.find((j) => j.id === second.id)!.evidence.at(-1)?.value).toBe(6);
    state = step(state, { type: 'power', jobId: second.id, on: false });
    state = step(state, {
      type: 'measure',
      jobId: second.id,
      request: { mode: 'continuity', a: 'C', b: 'D', condition: 'load' },
    });
    expect(state.jobs.find((j) => j.id === second.id)!.evidence.at(-1)?.value).toBe(null);
    const cash = state.cash;
    state = step(state, { type: 'buy', part: 'contact' });
    expect(state.cash).toBeLessThan(cash);
    state = step(state, {
      type: 'work',
      jobId: second.id,
      componentId: 'contact',
      intervention: 'replace',
    });
    state = step(state, { type: 'power', jobId: second.id, on: true });
    state = step(state, { type: 'verify', jobId: second.id, condition: 'load' });
    expect(runUseTest(state.jobs.find((j) => j.id === second.id)!.model, 'load').passes).toBe(true);
    state = step(state, { type: 'deliver', jobId: second.id });
    const raw = saveGame(state);
    expect(saveGame(loadGame(raw))).toBe(raw);
    expect(replayRecordedRun({ ...state, inputs: state.inputs }, raw)).toMatchObject({ ok: true });
    const forged = JSON.parse(raw);
    forged.faultVariety.second.fault.condition = 'weak';
    expect(() => loadGame(JSON.stringify(forged))).toThrow();
    delete forged.faultVariety;
    expect(() => loadGame(JSON.stringify(forged))).toThrow();
  });
  it('refuses altered generation before a source projection, preserving the world', async () => {
    const state = loadGame(saveGame(twoFans(createGame(4))));
    const original = saveGame(state);
    const changed = JSON.parse(original);
    changed.faultVariety.generationSeed++;
    await expect(workshopTransfer(changed.people.nora!, changed)).rejects.toThrow();
    await expect(workshopTransfer(state.people.nora!, state)).rejects.toThrow('read-only');
    expect(saveGame(state)).toBe(original);
  });
});
