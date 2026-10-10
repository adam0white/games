import { expect, it } from 'vitest';
import {
  createLabelStandModel,
  describeLabelStand,
  type MechanicalPresentation,
} from '../src/ui/inspection/labelStand';

const base = { appearance: 'label-stand' };
const presentation: MechanicalPresentation = {
  tray: 'fitted',
  load: 'loaded',
  observed: 'unknown',
  cleared: false,
  motion: 'stopped',
};
function names(model: ReturnType<typeof createLabelStandModel>) {
  const result: string[] = [];
  model.root.traverse((node) => result.push(node.name));
  return result;
}
it('unknown assemblies disclose no cause or actionable hidden component', () => {
  const model = createLabelStandModel(base, true, ['mechanism']);
  expect(names(model).some((name) => name.includes('scrap') || name.includes('empty-drive'))).toBe(
    false,
  );
  expect(model.root.getObjectByName('sealed-spring-casing')?.userData.repairTarget).toBeUndefined();
  expect(describeLabelStand(base)).not.toContain('obstruction');
  model.dispose();
});
it('the same four cards are loaded or retained beside the empty tray', () => {
  for (const load of ['empty', 'loaded'] as const) {
    const model = createLabelStandModel(
      { ...base, mechanicalPresentation: { ...presentation, load, tray: 'removed' } },
      true,
      ['cover'],
    );
    expect(
      names(model).filter((name) => /^retained-(?:unloaded-)?card-\d$/.test(name)),
    ).toHaveLength(4);
    expect(model.root.getObjectByName('moving-tray-assembly')?.position.x).toBe(1.08);
    expect(model.hitRegions.every((mesh) => mesh.userData.repairTarget === 'cover')).toBe(true);
    model.dispose();
  }
});
it('observed obstruction requires exposed access; performed clearance retains its scrap', () => {
  const closed = createLabelStandModel({
    ...base,
    mechanicalPresentation: { ...presentation, observed: 'rim-obstruction' },
  });
  expect(closed.root.getObjectByName('observed-folded-card-scrap')).toBeUndefined();
  closed.dispose();
  const open = createLabelStandModel({
    ...base,
    mechanicalPresentation: { ...presentation, tray: 'removed', observed: 'rim-obstruction' },
  });
  expect(open.root.getObjectByName('observed-folded-card-scrap')).toBeDefined();
  open.dispose();
  const repaired = createLabelStandModel({
    ...base,
    mechanicalPresentation: { ...presentation, cleared: true },
  });
  expect(repaired.root.getObjectByName('retained-cleared-scrap')).toBeDefined();
  repaired.dispose();
});
it('checked motion is bounded and reduced motion has an immediate equivalent', () => {
  const model = createLabelStandModel({
    ...base,
    mechanicalPresentation: { ...presentation, motion: 'checked' },
  });
  expect(model.animateOperation(0.5)).toBe(true);
  expect(model.root.getObjectByName('moving-tray-assembly')?.rotation.y).toBe(Math.PI);
  expect(model.animateOperation(1)).toBe(false);
  expect(model.animateOperation(0, true)).toBe(false);
  model.dispose();
  for (const patch of [
    { tray: 'removed' },
    { load: 'empty' },
    { observed: 'missing-drive-part' },
  ] as const) {
    const invalid = createLabelStandModel({
      ...base,
      mechanicalPresentation: { ...presentation, motion: 'checked', ...patch },
    });
    expect(invalid.animateOperation(1)).toBe(false);
    invalid.dispose();
  }
});
it('missing wheel is public only after access and descriptions agree with geometry', () => {
  const object = {
    appearance: 'display-carousel',
    mechanicalPresentation: {
      ...presentation,
      tray: 'removed' as const,
      observed: 'missing-drive-part' as const,
    },
  };
  const model = createLabelStandModel(object);
  expect(model.root.getObjectByName('observed-empty-drive-seat')).toBeDefined();
  expect(model.root.getObjectByName('retained-drive-wheel')).toBeUndefined();
  expect(describeLabelStand(object)).toContain('drive seat is empty');
  let meshes = 0;
  model.root.traverse((node) => {
    if (node.type === 'Mesh') meshes++;
  });
  expect(meshes).toBeLessThanOrEqual(20);
  model.dispose();
});
