import { Box3, Mesh, Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameView } from '../src/game/types';
import { createWorkshopModel } from '../src/ui/workshop/workshopModel';
import { validPlaceInput, workshopGeometry, workshopPlaces } from '../src/ui/workshop/workshopView';

const base = (): GameView => ({
  title: '',
  subtitle: '',
  scene: 'garage',
  focus: null,
  actions: [],
  conversation: [],
  shelf: [],
  parts: [],
  note: null,
});
afterEach(() => vi.unstubAllGlobals());
function room(view: GameView) {
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => null }),
  });
  return createWorkshopModel(workshopGeometry(view, false));
}
describe('earned physical workshop space', () => {
  it('starts without future intake, checking equipment or borrowed crates', () => {
    const model = room(base());
    expect(model.targets.map((target) => target.userData.placeId)).not.toContain('intake');
    expect(model.targets.map((target) => target.userData.placeId)).not.toContain('crates');
    expect(workshopPlaces(base()).map((place) => place.id)).toEqual(['bench']);
    model.dispose();
  });
  it('adds one actual tray, then a second distinct tray without rebuilding unrelated public prose', () => {
    const first = {
      ...base(),
      roomFacts: { intakeSpace: true, checkingPlaces: 1, storeCratesAtBench: false },
    };
    const second = { ...first, roomFacts: { ...first.roomFacts, checkingPlaces: 2 } };
    for (const [view, count] of [
      [first, 1],
      [second, 2],
    ] as const) {
      const model = room(view);
      const trays: Mesh[] = [];
      model.root.traverse((node) => {
        if (node instanceof Mesh && node.userData.station === 'checking-tray') trays.push(node);
      });
      expect(trays).toHaveLength(count);
      if (count === 2 && trays[0] && trays[1])
        expect(
          new Box3().setFromObject(trays[0]).intersectsBox(new Box3().setFromObject(trays[1])),
        ).toBe(false);
      model.dispose();
    }
    expect(workshopGeometry(first, false)).toEqual(
      workshopGeometry({ ...first, note: 'Later', timeLabel: 'Later' }, false),
    );
    expect(workshopPlaces(first).find((place) => place.id === 'intake')?.navigation).toBe(
      'workboard',
    );
    expect(validPlaceInput(first, 'intake')).toBeNull();
    expect(validPlaceInput(first, 'people')).toBeNull();
  });
  it('keeps checked personal work out of the customer handover rack', () => {
    const object = {
      id: 'paper-street',
      title: 'Paper street',
      owner: 'You',
      story: '',
      condition: '',
      visual: 'steady' as const,
      form: 'box' as const,
      observations: [],
      progress: 'checked' as const,
    };
    const view = {
      ...base(),
      shelf: [{ id: object.id, title: object.title, note: 'Checked', object }],
    };
    expect(workshopGeometry(view, false).shelf[0]?.awaitingCollection).toBe(false);
    expect(workshopPlaces(view).some((place) => place.id === 'collection')).toBe(false);
    const customer = {
      ...view,
      shelf: [
        {
          ...view.shelf[0],
          id: 'customer',
          title: 'Customer box',
          note: '',
          object: { ...object, id: 'customer', owner: 'Nora' },
        },
      ],
    };
    expect(workshopGeometry(customer, false).shelf[0]?.awaitingCollection).toBe(true);
    expect(workshopPlaces(customer).some((place) => place.id === 'collection')).toBe(true);
  });
  it('shows borrowed crates only from their explicit bench custody and keeps them inside the floor', () => {
    const view = {
      ...base(),
      roomFacts: { intakeSpace: true, checkingPlaces: 2, storeCratesAtBench: true },
    };
    const model = room(view);
    const crateMeshes = model.targets.filter((mesh) => mesh.userData.placeId === 'crates');
    expect(crateMeshes.length).toBeGreaterThan(10);
    const centers = new Set(
      crateMeshes.map((mesh) =>
        Math.round(new Box3().setFromObject(mesh).getCenter(new Vector3()).x * 100),
      ),
    );
    expect(centers.size).toBeGreaterThan(2);
    for (const mesh of crateMeshes)
      expect(new Box3().setFromObject(mesh).min.y).toBeGreaterThanOrEqual(0);
    expect(
      workshopPlaces({ ...view, roomFacts: { ...view.roomFacts, storeCratesAtBench: false } }).some(
        (place) => place.id === 'crates',
      ),
    ).toBe(false);
    model.dispose();
  });
});
