import { expect, it } from 'vitest';
import { createFoldingShelfModel, type ShelfPresentation } from '../src/ui/inspection/foldingShelf';

const known: ShelfPresentation = {
  position: 'open',
  brace: 'original',
  load: 'empty',
  observed: 'unknown',
  checked: false,
};
it('rotating an unknown shelf cannot reveal the high brace; actual observation changes its pose', () => {
  const unknown = createFoldingShelfModel(known, ['cover', 'mechanism', 'operation']);
  expect(unknown.root.getObjectByName('retained-cross-brace')?.rotation.z).toBe(0);
  expect(unknown.hitRegions.some((m) => m.userData.repairTarget === 'cover')).toBe(true);
  expect(unknown.hitRegions.some((m) => m.userData.repairTarget === 'operation')).toBe(true);
  const seen = createFoldingShelfModel({ ...known, observed: 'brace-high' });
  expect(seen.root.getObjectByName('retained-cross-brace')?.rotation.z).not.toBe(0);
  const fixed = createFoldingShelfModel({
    ...known,
    observed: 'brace-high',
    brace: 'seated',
    load: 'samples',
    checked: true,
  });
  expect(fixed.root.getObjectByName('retained-cross-brace')?.rotation.z).toBe(0);
  expect(fixed.root.getObjectByName('retained-cloth-sample-2')).toBeDefined();
  for (const model of [unknown, seen, fixed]) model.dispose();
});
it('folded low use stays visibly different from a standing repaired shelf', () => {
  const low = createFoldingShelfModel({ ...known, position: 'low' });
  expect(low.root.getObjectByName('retained-display-top')?.position.y).toBe(0.24);
  expect(low.animateOperation(1)).toBe(false);
  low.dispose();
});
