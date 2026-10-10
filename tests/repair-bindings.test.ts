import { expect, it } from 'vitest';
import { createGame, getView, serializeGame, transition } from '../src/game/engine';
import type { ObjectView } from '../src/game/types';
import { getMappedRepairActions, pointerWasDrag } from '../src/ui/repairBindings';

const object: ObjectView = {
  id: 'fixture',
  title: 'Torch',
  owner: 'You',
  story: '',
  condition: 'Unreliable',
  form: 'torch',
  visual: 'off',
  observations: [],
  inspected: true,
};
it('binds only currently exposed physical choices, without inferring parts from prose or symptoms', () => {
  const actions = [
    { id: 'inspect', label: 'Look' },
    { id: 'test-battery', label: 'Test' },
    { id: 'talk-garage', label: 'Talk' },
  ];
  const mapped = getMappedRepairActions(object, actions);
  expect(mapped.map((b) => b.action.id)).toEqual(['inspect', 'test-battery']);
  expect(
    getMappedRepairActions(
      { ...object, observations: ['Broken holder, cap and gear'], visual: 'broken' },
      actions,
    ),
  ).toEqual(mapped);
  expect(
    getMappedRepairActions({ ...object, inspected: false }, actions).map((b) => b.action.id),
  ).toEqual(['inspect']);
  expect(getMappedRepairActions(object, [])).toEqual([]);
});
it('uses honest whole-mechanism targets across mechanical forms', () => {
  for (const form of ['bell', 'timer', 'box', 'clip'] as const) {
    expect(
      getMappedRepairActions({ ...object, form }, [{ id: 'clear-obstruction', label: 'Clear' }])[0]
        ?.target,
    ).toBe('mechanism');
  }
});
it('a drag can never become a repair click', () => {
  expect(pointerWasDrag({ x: 10, y: 10 }, { x: 13, y: 13 })).toBe(false);
  expect(pointerWasDrag({ x: 10, y: 10 }, { x: 17, y: 10 })).toBe(true);
});
it('the public physical binding dispatch matches the existing action exactly', () => {
  let game = createGame();
  for (let i = 0; i < 15 && !getView(game).focus; i++) {
    const action = getView(game).actions[0];
    if (!action) break;
    game = transition(game, { type: 'action', id: action.id });
  }
  const view = getView(game);
  expect(view.focus).not.toBeNull();
  if (!view.focus) throw Error('Missing focused object');
  const binding = getMappedRepairActions(view.focus, view.actions).find(
    (b) => b.action.id === 'inspect',
  );
  expect(binding).toBeDefined();
  if (!binding) throw Error('Missing inspection action');
  expect(serializeGame(transition(game, { type: 'action', id: binding.action.id }))).toBe(
    serializeGame(transition(game, { type: 'action', id: 'inspect' })),
  );
  const before = serializeGame(game);
  pointerWasDrag({ x: 0, y: 0 }, { x: 100, y: 0 });
  expect(serializeGame(game)).toBe(before);
});

it('retains drag history out and back, ignores other pointers and rejects cancellation', async () => {
  const { updateRepairGesture, repairClickAllowed } = await import('../src/ui/repairBindings');
  const start = { id: 1, x: 0, y: 0, startX: 0, startY: 0, moved: false };
  const away = updateRepairGesture(start, 1, 40, 0);
  const back = updateRepairGesture(away, 1, 0, 0);
  expect(repairClickAllowed(back, 1, 0, 0)).toBe(false);
  expect(updateRepairGesture(start, 2, 40, 0)).toBe(start);
  expect(repairClickAllowed(start, 2, 0, 0)).toBe(false);
  expect(repairClickAllowed(start, 1, 0, 0, true)).toBe(false);
  expect(repairClickAllowed(null, 1, 0, 0)).toBe(false);
});
it('canvas target dispatch and accessible control yield equal serialized public transitions', async () => {
  const { resolveRepairAction } = await import('../src/ui/repairBindings');
  let game = createGame();
  for (let i = 0; i < 15 && !getView(game).focus; i++) {
    const action = getView(game).actions[0];
    if (!action) break;
    game = transition(game, { type: 'action', id: action.id });
  }
  game = transition(game, { type: 'action', id: 'inspect' });
  const view = getView(game);
  if (!view.focus) throw Error('Missing inspected object');
  const bindings = getMappedRepairActions(view.focus, view.actions);
  expect(bindings.length).toBeGreaterThan(1);
  for (const binding of bindings) {
    const canvasAction = resolveRepairAction(bindings, binding.action.id, binding.target, false);
    if (!canvasAction) throw Error('Missing target dispatch');
    expect(serializeGame(transition(game, { type: 'action', id: canvasAction }))).toBe(
      serializeGame(transition(game, { type: 'action', id: binding.action.id })),
    );
    expect(resolveRepairAction(bindings, binding.action.id, binding.target, true)).toBeNull();
    expect(resolveRepairAction(bindings, null, binding.target, false)).toBeNull();
  }
  expect(resolveRepairAction(bindings, 'clean-contact', 'battery', false)).toBeNull();
  expect(resolveRepairAction([], 'clean-contact', 'contact', false)).toBeNull();
});

it('names physical disassembly literally and targets the actual cover when reopening', async () => {
  const { getRepairToolName } = await import('../src/ui/repairBindings');
  const inspect = { id: 'inspect', label: 'Look closely' };
  const physical = {
    ...object,
    assembly: {
      kind: 'torch' as const,
      state: 'assembled' as const,
      revision: 0,
      retainedPieceIds: [],
      workMarkers: [],
    },
  };
  expect(getRepairToolName(physical, inspect)).toBe('Open & examine');
  expect(
    getRepairToolName({ ...physical, assembly: { ...physical.assembly, state: 'open' } }, inspect),
  ).toBe('Examine');
  expect(getRepairToolName(object, inspect)).toBe('Look');
  expect(
    getMappedRepairActions(physical, [{ id: 'open-access', label: 'Open the cap' }])[0]?.target,
  ).toBe('cover');
});

it('fitted access pieces are never labelled retained after reassembly', async () => {
  const { getRepairTargetLabel } = await import('../src/ui/repairBindings');
  for (const kind of ['lamp', 'torch', 'bell'] as const) {
    const closed = {
      ...object,
      assembly: {
        kind,
        state: 'assembled' as const,
        revision: 2,
        retainedPieceIds: [],
        workMarkers: [],
      },
    };
    expect(getRepairTargetLabel(closed, 'cover')).toMatch(/^Fitted /);
    const open = { ...closed, assembly: { ...closed.assembly, state: 'open' as const } };
    expect(getRepairTargetLabel(open, 'cover')).toMatch(/^Retained /);
    expect(
      getMappedRepairActions(closed, [{ id: 'open-access', label: 'Open' }])[0]?.label,
    ).toMatch(/^Fitted /);
  }
});
