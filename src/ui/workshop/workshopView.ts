import type { ActionView, GameInput, GameView } from '../../game/types';

export interface WorkshopPlace {
  id: string;
  label: string;
  detail: string;
  kind: 'bench' | 'shelf' | 'object' | 'parts' | 'cabinet' | 'journal';
  input?: GameInput;
  actionLabel?: string;
}

/** Presentation derived exclusively from discovered, player-facing information.
 * It never diagnoses, advances time, or supplies a new engine action. */
export function workshopPlaces(view: GameView, journal = false): WorkshopPlace[] {
  const places: WorkshopPlace[] = [
    {
      id: 'bench',
      kind: 'bench',
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
  if (cabinet) {
    places.push({
      id: 'cabinet',
      kind: 'cabinet',
      label: 'Family cabinet',
      detail: cabinet.detail ?? cabinet.label,
      input: { type: 'action', id: cabinet.id },
      actionLabel: cabinet.label,
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
