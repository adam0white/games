import type { ActionView, GameInput, GameView } from '../../game/types';

export interface WorkshopPlace {
  id: string;
  label: string;
  detail: string;
  kind:
    | 'bench'
    | 'shelf'
    | 'object'
    | 'parts'
    | 'cabinet'
    | 'journal'
    | 'intake'
    | 'checking'
    | 'collection'
    | 'people'
    | 'crates'
    | 'display';
  input?: GameInput;
  actionLabel?: string;
  navigation?: 'focus' | 'cabinet' | 'workboard' | 'people';
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
  if (view.roomFacts?.intakeSpace) {
    places.push({
      id: 'intake',
      kind: 'intake',
      label: 'Intake workbook',
      detail: 'The agreed intake space keeps work and collection arrangements together.',
      navigation: 'workboard',
      actionLabel: 'Open workboard',
    });
    places.push({
      id: 'people',
      kind: 'people',
      label: 'People and arrangements',
      detail: 'Read received availability and agreed work.',
      navigation: 'people',
      actionLabel: 'See people',
    });
  }
  if (view.scene === 'garage' && view.roomFacts?.checkingPlaces)
    places.push({
      id: 'checking',
      kind: 'checking',
      label: 'Checking trays',
      detail: `${view.roomFacts.checkingPlaces} checking place${view.roomFacts.checkingPlaces === 1 ? '' : 's'} available.`,
      navigation: 'workboard',
      actionLabel: 'See workboard',
    });
  if (view.shelf.some((item) => item.object?.progress === 'checked' && item.object.owner !== 'You'))
    places.push({
      id: 'collection',
      kind: 'collection',
      label: 'Checked work',
      detail: 'Checked objects remain here until their actual handover.',
      navigation: 'workboard',
      actionLabel: 'See collection arrangements',
    });
  if (view.roomFacts?.storeCratesAtBench)
    places.push({
      id: 'crates',
      kind: 'crates',
      label: 'Borrowed store crates',
      detail: 'The two labelled store-owned crates are here on loan.',
      navigation: 'workboard',
      actionLabel: 'See return arrangements',
    });
  if (view.roomFacts?.mechanicalCorner)
    places.push({
      id: 'sam-corner',
      kind: 'people',
      label: 'Sam’s corner',
      detail: view.apprenticeObject
        ? `Sam’s current work: ${view.apprenticeObject.title}. ${view.apprenticeObject.condition}`
        : 'The separate work mat is clear.',
      navigation: 'people',
      actionLabel: 'See Sam’s agreed work',
    });
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
  mechanicalCorner: boolean;
  apprenticeObject?: GameView['apprenticeObject'];
  shelf: (GameView['shelf'][number] & { awaitingCollection: boolean })[];
  showShelf: boolean;
  showParts: boolean;
  showCabinet: boolean;
  cabinetStage?: NonNullable<GameView['workshopCabinet']>['stage'];
  journal: boolean;
  intakeSpace: boolean;
  checkingPlaces: number;
  storeCratesAtBench: boolean;
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
    trolleyPresentation: object.trolleyPresentation,
    personalPresentation: object.personalPresentation,
    mechanicalPresentation: object.mechanicalPresentation,
    shelfPresentation: object.shelfPresentation,
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
    mechanicalCorner: view.roomFacts?.mechanicalCorner ?? false,
    apprenticeObject: view.apprenticeObject ? objectGeometry(view.apprenticeObject) : undefined,
    focus: view.focus ? objectGeometry(view.focus) : null,
    shelf: view.shelf.map(({ id, object }) => ({
      id,
      title: '',
      note: '',
      awaitingCollection: object?.progress === 'checked' && object.owner !== 'You',
      ...(object ? { object: objectGeometry(object) } : {}),
    })),
    showShelf: places.some((place) => place.kind === 'shelf'),
    showParts: places.some((place) => place.kind === 'parts'),
    showCabinet: places.some((place) => place.kind === 'cabinet'),
    cabinetStage: view.workshopCabinet?.stage,
    journal,
    intakeSpace: view.roomFacts?.intakeSpace ?? false,
    checkingPlaces: view.scene === 'garage' ? (view.roomFacts?.checkingPlaces ?? 0) : 0,
    storeCratesAtBench: view.roomFacts?.storeCratesAtBench ?? false,
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
