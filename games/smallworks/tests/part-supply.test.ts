import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import type { Command, GameState } from '../src/game/types';
import { partSupplyDetail, partSupplyTarget } from '../src/ui/part-supply';

it('routes the held toy to its existing spring drawer without changing a raw save, then buys normally', () => {
  function act(state: GameState, command: Command) {
    const result = dispatch(state, command);
    expect(result.ok, result.message).toBe(true);
    return result.state;
  }
  let state = createGame(42);
  // The ordinary visitor schedule introduces Sam's toy. No hidden faults or fixture edits.
  while (!state.jobs.some((job) => job.title === 'Sam’s winding toy') && state.day < 7) {
    state = act(state, { type: 'next-day' });
  }
  const toy = state.jobs.find((job) => job.title === 'Sam’s winding toy');
  expect(toy).toBeDefined();
  if (!toy) throw new Error('The public schedule did not offer the winding toy');
  state = act(state, { type: 'accept', jobId: toy.id });
  state = act(state, { type: 'select', jobId: toy.id });
  state = act(state, {
    type: 'measure',
    jobId: toy.id,
    request: { mode: 'motion', a: '0', b: 'A', condition: 'load' },
  });
  expect(state.stock.spring ?? 0).toBe(0);
  const raw = saveGame(state);
  const held = state.selectedJobId;
  const evidence = state.jobs.find((job) => job.id === held)?.evidence;
  expect(evidence?.some((entry) => entry.kind === 'measurement')).toBe(true);
  const selected = toy.model.components.find((part) => part.id === 'spring');
  if (!selected) throw new Error('No selected spring');
  const target = partSupplyTarget(selected.kind);
  expect(target).toBe('supply-spring');
  expect(partSupplyDetail(state, selected.kind)).toBe(
    'Spring · Supplier · £12 · 20 min supplier trip.',
  );
  expect(saveGame(state)).toBe(raw);
  const direct = act(loadGame(raw), { type: 'buy', part: 'spring' });
  const routed = act(state, { type: 'buy', part: selected.kind });
  expect(saveGame(routed)).toBe(saveGame(direct));
  expect(routed.cash).toBe(state.cash - 12);
  expect(routed.now).toBe(state.now + 20);
  expect(routed.stock.spring).toBe(1);
  expect(routed.selectedJobId).toBe(held);
  expect(routed.jobs.find((job) => job.id === held)?.evidence).toEqual(evidence);
  if (process.env.PART_SUPPLY_PROOF) {
    writeFileSync(
      process.env.PART_SUPPLY_PROOF,
      JSON.stringify({ raw, target, bought: saveGame(routed) }),
    );
  }
});

it('keeps the actual busy supplier restriction visible instead of promising an available switch', () => {
  let state = createGame(42);
  const id = state.jobs[0]?.id;
  if (!id) throw new Error('Missing opening object');
  for (const command of [
    { type: 'work', jobId: id, componentId: 'switch', intervention: 'replace' },
    { type: 'verify', jobId: id, condition: 'movement' },
    { type: 'deliver', jobId: id },
    { type: 'start-busy-workshop' },
  ] as Command[]) {
    const result = dispatch(state, command);
    expect(result.ok, result.message).toBe(true);
    state = result.state;
  }
  const raw = saveGame(state);
  expect(partSupplyDetail(state, 'switch')).toContain(
    'Switch · Supplier · £9 · 20 min supplier trip. No supplier stock until',
  );
  expect(partSupplyDetail(state, 'switch')).toContain(
    'recover one from the spare lantern or return work unfinished',
  );
  expect(dispatch(state, { type: 'buy', part: 'switch' }).ok).toBe(false);
  expect(saveGame(state)).toBe(raw);
});
