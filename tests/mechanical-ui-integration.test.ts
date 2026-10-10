import { expect, it } from 'vitest';
import type { GameView, ObjectView } from '../src/game/types';
import { createObjectModel } from '../src/ui/inspection/objectModel';
import {
  getMappedRepairActions,
  getRepairToolName,
  resolveRepairAction,
} from '../src/ui/repairBindings';
import { validPlaceInput, workshopGeometry, workshopPlaces } from '../src/ui/workshop/workshopView';

const object: ObjectView = {
  id: 'stand',
  title: 'Sam’s label stand',
  owner: 'Sam',
  form: 'timer',
  appearance: 'label-stand',
  visual: 'off',
  inspected: true,
  progress: 'inspected',
  story: '',
  condition: 'Tray fitted.',
  observations: [],
  mechanicalPresentation: {
    tray: 'fitted',
    load: 'loaded',
    observed: 'unknown',
    cleared: false,
    motion: 'stopped',
  },
};
it('every offered mechanical operation has the same keyboard and physical dispatch', () => {
  const actions = [
    'inspect',
    'test-mechanical-empty',
    'test-mechanical-loaded',
    'open-access',
    'clear-obstruction',
    'reassemble',
    'check-result',
  ].map((id) => ({ id, label: id }));
  const bindings = getMappedRepairActions(object, actions);
  expect(bindings).toHaveLength(actions.length);
  const model = createObjectModel(
    object,
    false,
    bindings.map((b) => b.target),
  );
  for (const binding of bindings) {
    expect(model.hitRegions.some((mesh) => mesh.userData.repairTarget === binding.target)).toBe(
      true,
    );
    expect(resolveRepairAction(bindings, binding.action.id, binding.target, false)).toBe(
      binding.action.id,
    );
  }
  expect(getRepairToolName(object, { id: 'open-access', label: 'Lift' })).toBe('Lift tray');
  expect(getMappedRepairActions(object, [])).toEqual([]);
  expect(model.root.getObjectByName('observed-folded-card-scrap')).toBeUndefined();
  model.highlight('cover');
  expect(model.root.getObjectByName('sealed-spring-casing')?.userData.repairTarget).toBeUndefined();
  model.dispose();
});
it('the earned corner retains the actual separate job and navigation never supplies work', () => {
  const view: GameView = {
    title: '',
    subtitle: '',
    scene: 'garage',
    focus: null,
    actions: [],
    conversation: [],
    shelf: [],
    parts: [],
    note: null,
    apprenticeObject: object,
    roomFacts: {
      mechanicalCorner: false,
      intakeSpace: false,
      checkingPlaces: 0,
      storeCratesAtBench: false,
    },
  };
  expect(workshopPlaces(view).some((p) => p.id === 'sam-corner')).toBe(false);
  view.roomFacts = {
    mechanicalCorner: true,
    intakeSpace: false,
    checkingPlaces: 0,
    storeCratesAtBench: false,
  };
  expect(workshopPlaces(view).find((p) => p.id === 'sam-corner')).toMatchObject({
    navigation: 'people',
    detail: expect.stringContaining(object.title),
  });
  expect(validPlaceInput(view, 'sam-corner')).toBeNull();
  expect(workshopGeometry(view, false).apprenticeObject?.mechanicalPresentation).toEqual(
    object.mechanicalPresentation,
  );
  const before = workshopGeometry(view, false);
  view.apprenticeObject = { ...object, condition: 'A newly received explanation.' };
  expect(workshopGeometry(view, false)).toEqual(before);
});
