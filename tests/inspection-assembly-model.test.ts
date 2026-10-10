import { Mesh, MeshStandardMaterial } from 'three';
import { expect, it } from 'vitest';
import type { ObjectView } from '../src/game/types';
import { createObjectModel } from '../src/ui/inspection/objectModel';

const base: ObjectView = {
  id: 'model-fixture',
  title: 'Fixture',
  owner: 'You',
  story: '',
  condition: 'Received',
  visual: 'flickering',
  form: 'lamp',
  appearance: 'reading',
  inspected: true,
  observations: [],
};
function assembly(
  kind: 'lamp' | 'torch' | 'bell',
  state: 'assembled' | 'open',
  workMarkers: string[] = [],
) {
  return {
    kind,
    state,
    revision: 1,
    retainedPieceIds:
      state === 'open'
        ? [`${kind === 'lamp' ? 'lamp-base-cover' : kind === 'torch' ? 'torch-cap' : 'bell-dome'}`]
        : [],
    workMarkers,
  };
}
function modelObject(
  kind: 'lamp' | 'torch' | 'bell',
  state: 'assembled' | 'open',
  extra: Partial<ObjectView> = {},
) {
  return {
    ...base,
    form: kind,
    appearance: kind === 'lamp' ? 'reading' : kind,
    assembly: assembly(kind, state),
    ...extra,
  } as ObjectView;
}
it('physical access removes the retained piece and exposes fitted component geometry', () => {
  for (const kind of ['lamp', 'torch', 'bell'] as const) {
    const closed = createObjectModel(modelObject(kind, 'assembled'));
    const open = createObjectModel(modelObject(kind, 'open'));
    const piece =
      kind === 'lamp' ? 'lamp-base-cover' : kind === 'torch' ? 'torch-cap' : 'bell-dome';
    expect(closed.root.getObjectByName(piece)?.position.toArray()).not.toEqual(
      open.root.getObjectByName(piece)?.position.toArray(),
    );
    expect(
      open.hitRegions.some((mesh) => mesh.name === piece && mesh.userData.repairTarget === 'cover'),
    ).toBe(true);
    const part = kind === 'bell' ? 'bell-striker' : 'fitted-battery';
    expect(closed.root.getObjectByName(part)).toBeUndefined();
    expect(open.root.getObjectByName(part)).toBeDefined();
    closed.dispose();
    open.dispose();
  }
});
it('a public repaired assembled light retains its visible glow after clearing selection', () => {
  const object = modelObject('lamp', 'assembled', { progress: 'repaired', visual: 'steady' });
  const model = createObjectModel(object);
  model.highlight(null);
  const glowing = model.hitRegions.filter(
    (mesh) =>
      mesh.material instanceof MeshStandardMaterial && mesh.material.emissive.getHex() !== 0,
  );
  expect(glowing.length).toBeGreaterThan(0);
  model.dispose();
  const opened = createObjectModel({ ...object, assembly: assembly('lamp', 'open') } as ObjectView);
  opened.highlight(null);
  expect(
    opened.hitRegions.every(
      (mesh) =>
        !(mesh.material instanceof MeshStandardMaterial) || mesh.material.emissive.getHex() === 0,
    ),
  ).toBe(true);
  opened.dispose();
});
it('unknown symptoms do not expose different anatomy or diagnostic geometry', () => {
  const summarize = (object: ObjectView) => {
    const model = createObjectModel(object);
    const shapes: unknown[] = [];
    model.root.traverse((child) => {
      if (child instanceof Mesh)
        shapes.push([
          child.name,
          child.geometry.type,
          child.position.toArray(),
          child.userData.repairTarget,
        ]);
    });
    model.dispose();
    return shapes;
  };
  expect(summarize({ ...base, inspected: false, visual: 'off' })).toEqual(
    summarize({ ...base, inspected: false, visual: 'broken', observations: ['Unexposed prose'] }),
  );
});

it('only observed restored assembled bells demonstrate bounded operation and settle identically', () => {
  const object = modelObject('bell', 'assembled', { progress: 'checked' });
  const before = JSON.stringify(object);
  const model = createObjectModel(object);
  const lever = model.root.getObjectByName('operating-striker');
  if (!lever) throw Error('Missing bell striker');
  const rest = lever.position.toArray();
  expect(model.animateOperation(0.25)).toBe(true);
  expect(lever.position.toArray()).not.toEqual(rest);
  model.animateOperation(1);
  expect(lever.position.toArray()).toEqual(rest);
  expect(JSON.stringify(object)).toBe(before);
  model.dispose();
  const opened = createObjectModel(modelObject('bell', 'open', { progress: 'checked' }));
  expect(opened.animateOperation(0.25)).toBe(false);
  opened.dispose();
  const unknown = createObjectModel(modelObject('bell', 'assembled'));
  expect(unknown.animateOperation(0.25)).toBe(false);
  unknown.dispose();
});
it('battery replacement never visually implies contact cleaning', () => {
  const make = (markers: string[]) =>
    createObjectModel({
      ...modelObject('lamp', 'open'),
      assembly: assembly('lamp', 'open', markers),
    } as ObjectView);
  const baseline = make([]),
    battery = make(['replace-battery']),
    cleaned = make(['clean-contact']);
  function color(model: ReturnType<typeof createObjectModel>) {
    const contact = model.root.getObjectByName('battery-contact');
    if (!(contact instanceof Mesh) || !(contact.material instanceof MeshStandardMaterial))
      throw Error('Missing contact');
    return contact.material.color.getHex();
  }
  expect(color(battery)).toBe(color(baseline));
  expect(color(cleaned)).not.toBe(color(baseline));
  baseline.dispose();
  battery.dispose();
  cleaned.dispose();
});

it('installed holder, torch cell and refitted cap show only their performed work', () => {
  function make(kind: 'lamp' | 'torch', state: 'open' | 'assembled', markers: string[]) {
    return createObjectModel({
      ...modelObject(kind, state),
      assembly: assembly(kind, state, markers),
    } as ObjectView);
  }
  function color(model: ReturnType<typeof createObjectModel>, name: string) {
    const part = model.root.getObjectByName(name);
    if (!(part instanceof Mesh) || !(part.material instanceof MeshStandardMaterial))
      throw Error(`Missing ${name}`);
    return part.material.color.getHex();
  }
  const oldHolder = make('lamp', 'open', []),
    newHolder = make('lamp', 'open', ['fit-holder']);
  expect(color(oldHolder, 'battery-holder')).not.toBe(color(newHolder, 'battery-holder'));
  expect(color(oldHolder, 'battery-contact')).toBe(color(newHolder, 'battery-contact'));
  const oldCell = make('torch', 'open', []),
    newCell = make('torch', 'open', ['replace-battery']);
  expect(color(oldCell, 'fitted-battery')).not.toBe(color(newCell, 'fitted-battery'));
  expect(color(oldCell, 'battery-contact')).toBe(color(newCell, 'battery-contact'));
  const originalCap = make('torch', 'assembled', []),
    seatedCap = make('torch', 'assembled', ['twist-cap']);
  expect(originalCap.root.getObjectByName('torch-cap')?.position.x).not.toBe(
    seatedCap.root.getObjectByName('torch-cap')?.position.x,
  );
  const removedCap = make('torch', 'open', ['twist-cap']);
  expect(removedCap.root.getObjectByName('torch-cap')?.position.y).toBeLessThan(0.3);
  for (const model of [oldHolder, newHolder, oldCell, newCell, originalCap, seatedCap, removedCap])
    model.dispose();
});
