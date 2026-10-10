import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { createGame, getView } from '../src/game/engine';
import { cabinetPose, createCabinetModel, resolveCabinetAction } from '../src/ui/cabinetModel';
import { projectActions } from '../src/ui/workspaceFlow';

it('shows actual finite cabinet clearance and springback without computing game evidence', () => {
  const original = cabinetPose({ position: 'original', door: 'caught' });
  const worse = cabinetPose({ position: 'worse', door: 'caught' });
  const aligned = cabinetPose({ position: 'aligned', door: 'closed' });
  expect(worse.swing).toBeGreaterThan(original.swing);
  expect(worse.tilt).toBeGreaterThan(original.tilt);
  expect(aligned).toEqual({ tilt: 0, swing: 0 });
  const model = createCabinetModel();
  expect(model.root.getObjectByName('moving-door')).toBe(model.right);
  expect([...model.targets.keys()]).toEqual(['handle', 'upper', 'lower', 'gap']);
  expect(model.paper.visible).toBe(false);
  expect(model.left.children.length).toBeGreaterThan(4);
  const upperClearance = (tilt: number) => {
    model.right.rotation.z = tilt;
    model.root.updateMatrixWorld(true);
    return new Vector3(-1.14, 1, 0).applyMatrix4(model.right.matrixWorld).x - -0.04;
  };
  expect(upperClearance(worse.tilt)).toBeLessThan(upperClearance(original.tilt));
  expect(upperClearance(original.tilt)).toBeLessThan(upperClearance(aligned.tilt));
  model.dispose();
});
it('physical input requires the selected currently offered action and matching target', () => {
  const ids = ['workshop-cabinet-upper', 'workshop-cabinet-try-close'] as const;
  expect(resolveCabinetAction(ids, null, 'upper')).toBeNull();
  expect(resolveCabinetAction(ids, ids[0], 'lower')).toBeNull();
  expect(resolveCabinetAction(ids, ids[0], 'upper', true)).toBeNull();
  expect(resolveCabinetAction([], ids[0], 'upper')).toBeNull();
  expect(resolveCabinetAction(ids, ids[0], 'upper')).toBe(ids[0]);
  expect(resolveCabinetAction(ids, ids[1], 'handle')).toBe(ids[1]);
});
it('cabinet physical controls belong once to their surface while leaving remains an ordinary choice', () => {
  const view = getView(createGame());
  view.actions = [
    { id: 'workshop-cabinet-upper', label: 'Upper hinge' },
    { id: 'workshop-cabinet-leave', label: 'Leave safely' },
  ];
  view.dayPlan = {
    summary: 'Family project',
    entries: [
      {
        id: 'cabinet',
        label: 'Cabinet',
        detail: '',
        status: 'underway',
        actionIds: view.actions.map((a) => a.id),
      },
    ],
  };
  const groups = projectActions(view, new Set(['workshop-cabinet-upper']));
  expect(groups.benchPlans.flatMap((entry) => entry.actions).map((action) => action.id)).toEqual([
    'workshop-cabinet-leave',
  ]);
  expect(groups.bench).toEqual([]);
});
