import type { ActionView, GameInput, GameView } from '../../game/types';

export interface WorkshopPlace {
  id: string;
  label: string;
  detail: string;
  kind: 'bench' | 'shelf' | 'object' | 'parts' | 'cabinet' | 'journal';
  input?: GameInput;
  actionLabel?: string;
  navigation?: 'focus' | 'cabinet';
}

/** Presentation derived exclusively from discovered, player-facing information.
 * It never diagnoses, advances time, or supplies a new engine action. */
export function workshopPlaces(view: GameView, journal = false): WorkshopPlace[] {
  const places: WorkshopPlace[] = [
    {
      id: 'bench',
      kind: 'bench',
      navigation: 'focus',
      label: 'Work bench',
      detail: view.focus ? view.focus.title : 'The bench is clear.',
    },
  ];
  const shelve = view.actions.find((action) => action.id === 'shelve');
  if (view.shelf.length || shelve) {
    places.push({
      id: 'shelf',
      kind: 'shelf',
      label: 'Waiting shelf',
      detail: view.shelf.length
        ? `${view.shelf.length} waiting to be picked up again.`
        : 'A safe place for unfinished work.',
      ...(shelve
        ? { input: { type: 'action' as const, id: shelve.id }, actionLabel: shelve.label }
        : {}),
    });
  }
  for (const item of view.shelf) {
    places.push({
      id: `object:${item.id}`,
      kind: 'object',
      label: item.title,
      detail: item.note,
      input: { type: 'select', id: item.id },
      actionLabel: `Pick up ${item.title}`,
    });
  }
  if (view.parts.length) {
    places.push({
      id: 'parts',
      kind: 'parts',
      label: 'Parts tray',
      detail: view.parts.map((part) => `${part.label}: ${part.count}`).join(' · '),
    });
  }
  const cabinet: ActionView | undefined = view.actions.find((action) =>
    ['workshop-cabinet-look', 'workshop-cabinet-open'].includes(action.id),
  );
  if (cabinet || view.workshopCabinet) {
    places.push({
      id: 'cabinet',
      kind: 'cabinet',
      label: 'Family cabinet',
      detail: view.workshopCabinet?.detail ?? cabinet?.detail ?? cabinet?.label ?? '',
      ...(cabinet
        ? { input: { type: 'action' as const, id: cabinet.id }, actionLabel: cabinet.label }
        : { navigation: 'cabinet' as const, actionLabel: 'See cabinet project details' }),
    });
  }
  if (journal)
    places.push({ id: 'journal', kind: 'journal', label: 'Notebook', detail: 'Read your notes.' });
  return places;
}

export function validPlaceInput(view: GameView, placeId: string): GameInput | null {
  return workshopPlaces(view).find((place) => place.id === placeId)?.input ?? null;
}

export function isRoomTap(
  start: { x: number; y: number },
  end: { x: number; y: number },
  cancelled = false,
) {
  return !cancelled && Math.hypot(end.x - start.x, end.y - start.y) <= 7;
}

export interface WorkshopGeometry {
  focus: GameView['focus'];
  shelf: GameView['shelf'];
  showShelf: boolean;
  showParts: boolean;
  showCabinet: boolean;
  cabinetStage?: NonNullable<GameView['workshopCabinet']>['stage'];
  journal: boolean;
}

function objectGeometry(object: NonNullable<GameView['focus']>): NonNullable<GameView['focus']> {
  return {
    id: object.id,
    form: object.form,
    visual: object.visual,
    appearance: object.appearance,
    inspected: object.inspected,
    progress: object.progress,
    assembly: object.assembly,
    casePresentation: object.casePresentation,
    title: '',
    owner: '',
    story: '',
    condition: '',
    observations: [],
  };
}

/** Keep conversation, clock and action prose out of renderer/model lifetime. */
export function workshopGeometry(view: GameView, journal: boolean): WorkshopGeometry {
  const places = workshopPlaces(view, journal);
  return {
    focus: view.focus ? objectGeometry(view.focus) : null,
    shelf: view.shelf.map(({ id, object }) => ({
      id,
      title: '',
      note: '',
      ...(object ? { object: objectGeometry(object) } : {}),
    })),
    showShelf: places.some((place) => place.kind === 'shelf'),
    showParts: places.some((place) => place.kind === 'parts'),
    showCabinet: places.some((place) => place.kind === 'cabinet'),
    cabinetStage: view.workshopCabinet?.stage,
    journal,
  };
}

export interface RoomGesture {
  id: number;
  x: number;
  y: number;
  lastX: number;
  moved: boolean;
}
export function moveRoomGesture(prior: RoomGesture, id: number, x: number, y: number): RoomGesture {
  if (prior.id !== id) return prior;
  return { ...prior, lastX: x, moved: prior.moved || !isRoomTap(prior, { x, y }) };
}
export function roomSelectionAllowed(prior: RoomGesture | null, id: number, x: number, y: number) {
  return !!prior && prior.id === id && !prior.moved && isRoomTap(prior, { x, y });
}
