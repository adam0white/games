import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { GameView, ObjectView } from '../src/game/types';
import { fitWorkshopObject, shelfBay } from '../src/ui/workshop/workshopModel';
import {
  moveRoomGesture,
  roomSelectionAllowed,
  workshopGeometry,
  workshopPlaces,
} from '../src/ui/workshop/workshopView';

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
const lamp: ObjectView = {
  id: 'lamp',
  title: 'Known lamp',
  owner: 'Mum',
  story: '',
  condition: 'Unexamined',
  visual: 'off',
  form: 'lamp',
  observations: [],
};

describe('workshop geometry projection', () => {
  it('does not rebuild geometry for conversation, time, notes, or action prose', () => {
    const first = base();
    first.shelf = [{ id: lamp.id, title: lamp.title, note: 'Waiting', object: lamp }];
    const second = {
      ...first,
      timeLabel: 'later',
      note: 'An unrelated event',
      subtitle: 'Later',
      shelf: first.shelf.map((item) => ({ ...item, note: 'A new written note' })),
      actions: [{ id: 'tea', label: 'Have tea' }],
    };
    expect(workshopGeometry(first, true)).toEqual(workshopGeometry(second, true));
    expect(workshopGeometry({ ...first, shelf: [] }, true)).not.toEqual(
      workshopGeometry(first, true),
    );
  });
  it('retains original known forms and access state rather than inferring from shelf prose', () => {
    const view = base();
    view.shelf = [{ id: lamp.id, title: lamp.title, note: 'Possibly a torch?', object: lamp }];
    expect(workshopGeometry(view, false).shelf[0]?.object).toMatchObject({
      id: lamp.id,
      form: 'lamp',
    });
    expect(
      workshopGeometry({ ...view, shelf: [{ id: 'legacy', title: 'Torch?', note: '' }] }, false)
        .shelf[0]?.object,
    ).toBeUndefined();
  });
  it('changes room geometry when the actual trolley work changes its known appearance', () => {
    const trolley: ObjectView = {
      ...lamp,
      id: 'borrowed-trolley',
      form: 'trolley',
      trolleyPresentation: {
        comparison: 'unexamined',
        observed: 'unknown',
        loadMode: 'full',
        routeChecked: false,
      },
    };
    const before = { ...base(), focus: trolley };
    const after = {
      ...before,
      focus: {
        ...trolley,
        trolleyPresentation: {
          comparison: 'compared' as const,
          observed: 'rolls' as const,
          loadMode: 'full' as const,
          routeChecked: true,
        },
      },
    };
    expect(workshopGeometry(before, false)).not.toEqual(workshopGeometry(after, false));
    expect(
      workshopGeometry(
        {
          ...after,
          focus: null,
          shelf: [{ id: trolley.id, title: 'Trolley', note: 'Checked', object: after.focus }],
        },
        false,
      ).shelf[0]?.object?.trolleyPresentation,
    ).toEqual(after.focus.trolleyPresentation);
  });
  it('uses the exposed cabinet entry when present and focuses details for an already-open project', () => {
    const cabinet = { stage: 'measured' as const, detail: 'Hinge marks are ready.' };
    const closed = {
      ...base(),
      workshopCabinet: cabinet,
      actions: [{ id: 'workshop-cabinet-open', label: 'Return to the cabinet doors' }],
    };
    const opened = {
      ...closed,
      actions: [{ id: 'workshop-cabinet-hang', label: 'Ask Dad to hang the doors' }],
    };
    expect(workshopPlaces(closed).find((place) => place.id === 'cabinet')).toMatchObject({
      input: { type: 'action', id: 'workshop-cabinet-open' },
    });
    const place = workshopPlaces(opened).find((entry) => entry.id === 'cabinet');
    expect(place?.input).toBeUndefined();
    expect(place?.navigation).toBe('cabinet');
    expect(place?.actionLabel).toBe('See cabinet project details');
  });
  it('keeps known cabinet progress available without inventing an action', () => {
    const view = {
      ...base(),
      workshopCabinet: { stage: 'hung' as const, detail: 'The kitchen doors need alignment.' },
    };
    expect(workshopPlaces(view).find((place) => place.id === 'cabinet')).toMatchObject({
      detail: view.workshopCabinet.detail,
    });
    expect(workshopPlaces(view).find((place) => place.id === 'cabinet')?.input).toBeUndefined();
    expect(workshopGeometry(view, false).cabinetStage).toBe('hung');
    expect(workshopPlaces(view).find((place) => place.id === 'cabinet')).toMatchObject({
      navigation: 'cabinet',
      actionLabel: 'See cabinet project details',
    });
  });
});

describe('bounded complete assemblies', () => {
  it('fits a wide open assembly and its retained pieces in a single bay', () => {
    const root = new Group();
    const geometry = new BoxGeometry(1, 2, 1);
    const material = new MeshBasicMaterial();
    root.add(new Mesh(geometry, material));
    const retainedCover = new Mesh(geometry, material);
    retainedCover.position.set(4, -0.2, 1);
    root.add(retainedCover);
    const bay = shelfBay(5, 18);
    fitWorkshopObject(root, bay.centre, bay.size);
    const bounds = new Box3().setFromObject(root);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeLessThanOrEqual(bay.size.x + 0.00001);
    expect(size.y).toBeLessThanOrEqual(bay.size.y + 0.00001);
    expect(size.z).toBeLessThanOrEqual(bay.size.z + 0.00001);
    expect(bounds.min.y).toBeCloseTo(bay.centre.y);
    geometry.dispose();
    material.dispose();
  });
  it('keeps every bay separate even with thirty known objects', () => {
    const bays = Array.from({ length: 30 }, (_, i) => shelfBay(i, 30));
    for (let i = 0; i < bays.length; i++)
      for (let j = i + 1; j < bays.length; j++) {
        const a = bays[i];
        const b = bays[j];
        if (!a || !b) continue;
        expect(
          Math.abs(a.centre.x - b.centre.x) > (a.size.x + b.size.x) / 2 ||
            Math.abs(a.centre.y - b.centre.y) > Math.max(a.size.y, b.size.y),
        ).toBe(true);
      }
  });
});

describe('gesture history', () => {
  it('never reclassifies an out-and-back orbit as selection', () => {
    const start = { id: 1, x: 0, y: 0, lastX: 0, moved: false };
    const moved = moveRoomGesture(start, 1, 20, 0);
    const back = moveRoomGesture(moved, 1, 0, 0);
    expect(roomSelectionAllowed(back, 1, 0, 0)).toBe(false);
    expect(moveRoomGesture(start, 2, 50, 50)).toBe(start);
    expect(roomSelectionAllowed(start, 2, 0, 0)).toBe(false);
    expect(roomSelectionAllowed(null, 1, 0, 0)).toBe(false);
    expect(roomSelectionAllowed(start, 1, 1, 1)).toBe(true);
  });
});
