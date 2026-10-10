/** Finite Saturday shelf/custody owner. Host receives invitation and completes
 * real HF activities before calling this module. No actor/time/skill policy,
 * stock creation, invented visitors, promises discharged or automatic teaching. */
import { type SaturdayDisplay, saturdayInvitation } from './saturday-story';
export type SaturdayStage =
  | 'invitation'
  | 'viewing'
  | 'agreed'
  | 'preparing'
  | 'ready'
  | 'afternoon'
  | 'home';
export interface SaturdayWindowState {
  stage: SaturdayStage;
  display?: SaturdayDisplay;
  declined: boolean;
  arrived?: boolean;
  displayAccess?: 'protected' | 'within-reach';
  visitorTried?: boolean;
  agreedAt?: number;
  /** Received latest completed arrival for this specific afternoon. */
  arrivalBy?: number;
  itemOrigins?: Record<string, 'bench' | 'shelf' | 'returned'>;
  shelf: {
    position: 'folded' | 'open' | 'low';
    emptyObserved: boolean;
    loadedObserved: boolean;
    understood: boolean;
    brace: 'unobserved' | 'above-stop' | 'seated';
    checked: boolean;
    custody: 'nora' | 'workshop' | 'window';
    permission: boolean;
  };
  items: {
    id: string;
    title: string;
    appearance: string;
    origin: 'garage' | 'nora' | 'sam';
    location: 'origin' | 'window' | 'bench';
  }[];
  events: { action: string; at: number; minutes: number; participants: string[] }[];
}
export interface SaturdayContext {
  now?: number;
  noraAvailable: boolean;
  samAvailable: boolean;
  model?: {
    id: string;
    title: string;
    appearance: string;
    held: boolean;
    canFetch?: boolean;
    rememberedFronts: boolean;
    currentFronts: boolean;
    moves: boolean;
  };
  objects: {
    id: string;
    title: string;
    appearance: string;
    origin: 'garage' | 'nora' | 'sam';
    available: boolean;
    permission: boolean;
  }[];
  /** Host names obligations; this module never silently resolves them. */
  departureBlockers: string[];
  blockerObjects?: { id: string; title: string; owner: string }[];
}
export interface SaturdayReceipt {
  action: string;
  completed: boolean;
  attended: boolean;
  at: number;
  minutes: number;
  participants: string[];
}
export interface SaturdayAction {
  id: string;
  label: string;
  minutes: number;
  requires: string[];
}
export function createSaturdayWindow(): SaturdayWindowState {
  return {
    stage: 'invitation',
    declined: false,
    shelf: {
      position: 'folded',
      emptyObserved: false,
      loadedObserved: false,
      understood: false,
      brace: 'unobserved',
      checked: false,
      custody: 'nora',
      permission: false,
    },
    items: [],
    events: [],
  };
}
function availableDisplays(c: SaturdayContext): SaturdayDisplay[] {
  return [
    ...(c.model?.held && c.model.rememberedFronts ? ['remembered-model' as const] : []),
    ...(c.model?.held && c.model.currentFronts ? ['current-model' as const] : []),
    ...(c.objects.some((o) => o.available && o.permission) ? ['objects' as const] : []),
    'private',
  ];
}
function arrivalDeadline(s: SaturdayWindowState): number | undefined {
  return s.arrivalBy ?? (s.agreedAt === undefined ? undefined : s.agreedAt + 30);
}
function canArrive(s: SaturdayWindowState, now: number | undefined): boolean {
  const by = arrivalDeadline(s);
  return now === undefined || by === undefined || now + 10 <= by;
}
export function saturdayActions(s: SaturdayWindowState, c: SaturdayContext): SaturdayAction[] {
  const actions: SaturdayAction[] = [];
  const add = (id: string, label: string, minutes: number, requires: string[] = []) =>
    actions.push({ id, label, minutes, requires });
  if (s.stage === 'home') return actions;
  if (s.stage === 'invitation') {
    if (c.noraAvailable) add('saturday-open-look', 'Look at the shelf with Nora', 8, ['nora']);
    add('saturday-private', 'Keep the afternoon at the home bench', 2);
    add('saturday-later', 'Leave the window for another time', 2);
    return actions;
  }
  if (s.stage === 'viewing') {
    if (c.noraAvailable) add('saturday-agree', 'Agree on one afternoon at the window', 8, ['nora']);
    add('saturday-private', 'Keep the afternoon at home', 2);
    add('saturday-later', 'Leave it for another time', 2);
    return actions;
  }
  if (['agreed', 'preparing', 'ready'].includes(s.stage)) {
    if (c.model?.canFetch && !c.model.held)
      add('saturday-fetch-model', 'Bring your own paper street back from home', 5);
    for (const choice of availableDisplays(c))
      add(
        `saturday-display-${choice}`,
        choice === 'remembered-model'
          ? 'Show the street as remembered'
          : choice === 'current-model'
            ? 'Show the newer fronts'
            : choice === 'objects'
              ? 'Show the things actually available'
              : 'Keep a private bench afternoon',
        2,
      );
    if (s.display === 'private') {
      if (c.noraAvailable)
        add('saturday-setup', 'Spend the afternoon at the bench with Nora', 12, ['nora']);
      add('saturday-setup-solo', 'Set out a quiet afternoon at the bench', 10);
      return actions;
    }
    if (s.shelf.permission && !s.shelf.checked && s.shelf.position !== 'low') {
      if (!s.shelf.loadedObserved) add('saturday-compare-loaded', 'Try the agreed sample load', 6);
      else if (!s.shelf.understood)
        add('saturday-look-under', 'Look beneath the walking support', 4);
      else if (s.shelf.brace !== 'seated')
        add('saturday-refit-brace', 'Refit the retained brace against its stop', 6);
      else add('saturday-check-load', 'Attend the full load check', 8);
      if (c.noraAvailable)
        add('saturday-choose-low', 'Ask Nora about a lower stationary display', 6, ['nora']);
    }
    if (
      s.stage === 'ready' &&
      s.display &&
      c.departureBlockers.length === 0 &&
      !s.arrived &&
      canArrive(s, c.now)
    )
      add('saturday-go-afternoon', 'Go to the agreed afternoon within Nora’s arrival window', 10);
    if (
      s.stage === 'ready' &&
      !s.arrived &&
      c.now !== undefined &&
      s.agreedAt !== undefined &&
      !canArrive(s, c.now) &&
      c.noraAvailable
    )
      add('saturday-reschedule', 'Ask Nora for another afternoon', 6, ['nora']);
    if (s.stage === 'ready' && s.display && c.departureBlockers.length === 0 && s.arrived) {
      if (c.noraAvailable)
        add('saturday-setup', 'Set out the agreed afternoon with Nora', 12, ['nora']);
      add('saturday-setup-solo', 'Set out the smaller agreed display yourself', 10);
    }
  }
  if (s.stage === 'afternoon') {
    if (!s.displayAccess && c.noraAvailable) {
      add('saturday-keep-protected', 'Look at the sample in Nora’s hands', 4, ['nora']);
      if (s.display === 'private' || s.shelf.checked || s.shelf.position === 'low')
        add('saturday-share-sample', 'Handle Nora’s sample together', 4, ['nora']);
    }
    add('saturday-home', 'Pack up the same things and go home', 8);
  }
  return actions;
}
function chosenItems(choice: SaturdayDisplay, c: SaturdayContext): SaturdayWindowState['items'] {
  if (choice === 'private')
    return c.model?.held
      ? [
          {
            id: c.model.id,
            title: c.model.title,
            appearance: c.model.appearance,
            origin: 'garage',
            location: 'origin',
          },
        ]
      : [];
  if (choice === 'remembered-model' || choice === 'current-model')
    return c.model?.held
      ? [
          {
            id: c.model.id,
            title: c.model.title,
            appearance: c.model.appearance,
            origin: 'garage',
            location: 'origin',
          },
        ]
      : [];
  return c.objects
    .filter((o) => o.available && o.permission)
    .map((o) => ({
      id: o.id,
      title: o.title,
      appearance: o.appearance,
      origin: o.origin,
      location: 'origin',
    }));
}
function refreshStage(s: SaturdayWindowState) {
  if (s.display && (s.display === 'private' || s.shelf.checked || s.shelf.position === 'low'))
    s.stage = 'ready';
  else s.stage = s.display ? 'preparing' : 'agreed';
}
export function completeSaturdayActivity(
  s: SaturdayWindowState,
  c: SaturdayContext,
  r: SaturdayReceipt,
): {
  next: SaturdayWindowState;
  performed: boolean;
  story?: 'first-look' | 'empty' | 'loaded' | 'underneath' | 'checked' | 'low' | 'display' | 'home';
  custodyMoves: { id: string; from: string; to: string }[];
} {
  const unchanged = () => ({ next: structuredClone(s), performed: false, custodyMoves: [] });
  if (!r.completed || !r.attended) return unchanged();
  if (
    r.action === 'saturday-go-afternoon' &&
    s.agreedAt !== undefined &&
    (r.at < s.agreedAt || r.at > (arrivalDeadline(s) ?? s.agreedAt))
  )
    return unchanged();
  const a = saturdayActions(s, c).find((a) => a.id === r.action);
  if (!a) return unchanged();
  if (
    r.action.startsWith('saturday-setup') &&
    s.items.some(
      (item) => !chosenItems(s.display ?? 'private', c).some((actual) => actual.id === item.id),
    )
  )
    return unchanged();
  if (
    r.minutes !== a.minutes ||
    !Number.isFinite(r.at) ||
    !a.requires.every((id) => r.participants.includes(id))
  )
    return unchanged();
  const next = structuredClone(s);
  const custodyMoves: { id: string; from: string; to: string }[] = [];
  let story:
    | 'first-look'
    | 'empty'
    | 'loaded'
    | 'underneath'
    | 'checked'
    | 'low'
    | 'display'
    | 'home'
    | undefined;
  switch (r.action) {
    case 'saturday-open-look':
      next.stage = 'viewing';
      next.shelf.position = 'open';
      next.shelf.emptyObserved = true;
      story = 'first-look';
      break;
    case 'saturday-agree':
      next.shelf.permission = true;
      next.shelf.custody = 'workshop';
      next.stage = 'agreed';
      custodyMoves.push({ id: 'nora-folding-shelf', from: 'nora', to: 'workshop' });
      break;
    case 'saturday-private':
      next.display = 'private';
      next.items = chosenItems('private', c);
      next.stage = 'ready';
      break;
    case 'saturday-later':
      next.declined = true;
      next.stage = 'home';
      break;
    case 'saturday-compare-loaded':
      next.shelf.loadedObserved = true;
      next.shelf.checked = false;
      story = 'loaded';
      break;
    case 'saturday-look-under':
      next.shelf.understood = true;
      next.shelf.brace = 'above-stop';
      story = 'underneath';
      break;
    case 'saturday-refit-brace':
      next.shelf.brace = 'seated';
      next.shelf.checked = false;
      break;
    case 'saturday-check-load':
      if (next.shelf.emptyObserved && next.shelf.loadedObserved && next.shelf.brace === 'seated') {
        next.shelf.checked = true;
        refreshStage(next);
        story = 'checked';
      }
      break;
    case 'saturday-choose-low':
      next.shelf.position = 'low';
      next.shelf.checked = false;
      refreshStage(next);
      story = 'low';
      break;
    case 'saturday-fetch-model':
      break;
    case 'saturday-reschedule':
      next.arrived = false;
      break;
    case 'saturday-go-afternoon':
      next.arrived = true;
      break;
    case 'saturday-setup':
    case 'saturday-setup-solo':
      next.stage = 'afternoon';
      story = 'display';
      if (next.display !== 'private') {
        custodyMoves.push({ id: 'nora-folding-shelf', from: next.shelf.custody, to: 'window' });
        next.shelf.custody = 'window';
      }
      for (const item of next.items) {
        item.location = next.display === 'private' ? 'bench' : 'window';
        custodyMoves.push({ id: item.id, from: item.origin, to: item.location });
      }
      break;
    case 'saturday-keep-protected':
      next.displayAccess = 'protected';
      break;
    case 'saturday-share-sample':
      next.displayAccess = 'within-reach';
      next.visitorTried = true;
      break;
    case 'saturday-home':
      next.stage = 'home';
      story = 'home';
      for (const item of next.items) {
        custodyMoves.push({ id: item.id, from: item.location, to: item.origin });
        item.location = 'origin';
      }
      if (next.shelf.custody !== 'nora') {
        custodyMoves.push({ id: 'nora-folding-shelf', from: next.shelf.custody, to: 'nora' });
        next.shelf.custody = 'nora';
      }
      break;
    default: {
      const display = r.action.replace('saturday-display-', '') as SaturdayDisplay;
      if (!availableDisplays(c).includes(display)) return unchanged();
      next.display = display;
      next.items = chosenItems(display, c);
      refreshStage(next);
    }
  }
  next.events.push({
    action: r.action,
    at: r.at,
    minutes: r.minutes,
    participants: [...r.participants],
  });
  return { next, performed: true, story, custodyMoves };
}
function clockLabel(at: number): string {
  return `${String(Math.floor((at % 1440) / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
}
export function saturdayView(s: SaturdayWindowState, c: SaturdayContext) {
  const displayNames: Record<SaturdayDisplay, string> = {
    'remembered-model': 'The street as remembered',
    'current-model': 'The newer fronts',
    objects: 'Your available working objects',
    private: 'A quiet afternoon at home',
  };
  const daysAway =
    s.agreedAt === undefined
      ? undefined
      : Math.floor(s.agreedAt / 1440) - Math.floor((c.now ?? s.agreedAt) / 1440);
  const time = s.agreedAt === undefined ? '' : clockLabel(s.agreedAt);
  const windowEnd = arrivalDeadline(s);
  const interval = windowEnd === undefined ? time : `${time}–${clockLabel(windowEnd)}`;
  return {
    stage: s.stage,
    agreedAt: s.agreedAt,
    arrivalBy: arrivalDeadline(s),
    title:
      s.stage === 'invitation'
        ? 'A note from Nora'
        : s.stage === 'viewing'
          ? 'Nora’s old counter shelf'
          : s.stage === 'afternoon'
            ? s.display === 'private'
              ? 'An afternoon at home'
              : 'At the low window'
            : s.stage === 'home'
              ? 'Back at the bench'
              : 'Getting ready for one afternoon',
    selectedDisplay: s.display ? displayNames[s.display] : undefined,
    appointmentLabel:
      s.agreedAt === undefined || s.display === 'private'
        ? undefined
        : (windowEnd ?? s.agreedAt) < (c.now ?? s.agreedAt)
          ? `Earlier agreed arrival window: ${interval}`
          : `${daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `In ${daysAway} days`}: arrive ${interval}`,
    preparation: s.shelf.checked
      ? 'The shelf is ready for the sample load.'
      : s.shelf.position === 'low'
        ? 'The lower display is ready; the folding supports are still unfinished.'
        : s.shelf.permission
          ? 'Prepare the shelf before setting out the display.'
          : undefined,
    blockerObjects: [...(c.blockerObjects ?? [])],
    display: s.display,
    displayAccess: s.displayAccess,
    visitorTried: s.visitorTried,
    shelfObject: {
      id: 'nora-folding-shelf',
      title: 'Nora’s retained folding display shelf',
      appearance: 'folding-shelf',
      shelfPresentation: {
        position: s.shelf.position,
        brace: s.shelf.brace === 'seated' ? ('seated' as const) : ('original' as const),
        load: s.shelf.checked ? ('samples' as const) : ('empty' as const),
        observed: s.shelf.checked
          ? ('steady' as const)
          : s.shelf.understood
            ? ('brace-high' as const)
            : s.shelf.loadedObserved
              ? ('support-walks' as const)
              : ('unknown' as const),
        checked: s.shelf.checked,
      },
    },
    shelf: {
      position: s.shelf.position,
      loadedObserved: s.shelf.loadedObserved,
      brace: s.shelf.brace,
      checked: s.shelf.checked,
      foldingRepaired: s.shelf.checked,
      custody: s.shelf.custody,
    },
    scene: {
      location:
        s.display === 'private' || s.stage !== 'afternoon'
          ? ('garage' as const)
          : ('window' as const),
      items:
        s.stage === 'afternoon' || s.stage === 'home'
          ? s.items.map(({ id, title, appearance }) => ({
              id,
              title,
              appearance:
                appearance === 'model'
                  ? s.display === 'current-model'
                    ? 'model-current'
                    : 'model-remembered'
                  : appearance,
            }))
          : [],
      caption:
        s.stage === 'invitation'
          ? saturdayInvitation()
          : s.stage === 'home'
            ? 'The afternoon is finished. The same things are back with their owners.'
            : s.stage === 'afternoon'
              ? s.display === 'private'
                ? 'There is time to look at the small things on your bench.'
                : s.displayAccess === 'within-reach'
                  ? 'Nora’s sample is within reach beside the display.'
                  : s.displayAccess === 'protected'
                    ? 'Nora’s cloth stays protected beside the display.'
                    : 'The display is set out in the low window.'
              : s.display === 'private'
                ? 'A small afternoon at the home bench.'
                : s.shelf.position === 'low'
                  ? 'The folded shelf rests on the low counter; its folding supports remain unrepaired.'
                  : s.shelf.checked
                    ? 'The fitted brace held through the attended sample-load check.'
                    : s.shelf.loadedObserved
                      ? 'The sample load made a support walk inward.'
                      : s.shelf.emptyObserved
                        ? 'The open shelf stands empty.'
                        : 'Nora’s folded shelf waits for an actual shared look.',
    },
    modelMoves: Boolean(c.model?.moves && s.items.some((item) => item.id === c.model?.id)),
    departureBlockers: [...c.departureBlockers],
    actions: saturdayActions(s, c),
  };
}
