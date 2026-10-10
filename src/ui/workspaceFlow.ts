import type { ActionView, GameView } from '../game/types';
import { getMappedRepairActions } from './repairBindings';

export type WorkspacePanel = 'bench' | 'work' | 'people';
export interface ChapterProjection {
  stage: 'school' | 'workshop' | 'service';
  title: string;
  period: string;
  tutorial: boolean;
}
/** Read-only presentation. Neither navigating the room nor choosing a panel is a game action. */
export function projectChapter(view: GameView): ChapterProjection {
  const supplied = view.chapterFlow;
  if (supplied) return supplied;
  const adult = Boolean(view.lifeChapter?.label.includes('School finished')) || !view.lifeChapter;
  return {
    stage: adult ? (view.chapterClosure ? 'service' : 'workshop') : 'school',
    title: adult ? 'Your workshop' : 'A little light',
    period: view.lifeChapter?.label ?? 'At the bench',
    tutorial: !adult,
  };
}
const benchIds = new Set([
  'find-paper-street',
  'evening-bring-model',
  'talk-family',
  'talk-garage',
  'inspect',
  'open-access',
  'reassemble',
  'test-battery',
  'replace-battery',
  'clean-contact',
  'twist-cap',
  'path-torch-test-cap',
  'fit-holder',
  'clear-obstruction',
  'align-striker',
  'lubricate-hinge',
  'adjust-catch',
  'test-catch',
  'replace-spring',
  'fit-gear',
  'verify',
  'check-result',
  'wait-check',
  'return',
  'early-return',
  'shelve',
  'ask-mum',
  'ask-dad',
  'fit-case-catch',
  'check-case-carry',
  'check-case-tray',
  'try-case-replacement',
  'workshop-cabinet-close',
  'service-measure-donor',
  'service-recover-donor',
]);
export function actionDestination(action: ActionView, hasObject: boolean): WorkspacePanel | 'time' {
  if (
    /^(next-day|back-to-school|leave-school-holiday|wait-|rest$|service-next-day)/.test(action.id)
  )
    return 'time';
  if (
    benchIds.has(action.id) ||
    action.id.startsWith('leave-ready-') ||
    action.id.startsWith('childhood-') ||
    action.id.startsWith('saturday-') ||
    /^workshop-(cabinet|drawings|display-drawing|keep-drawing)/.test(action.id) ||
    (hasObject &&
      /^(fit-|test-|check-|clear-|adjust-|align-|lubricate-|replace-|open-|refit-)/.test(action.id))
  )
    return 'bench';
  if (
    action.kind === 'quiet' ||
    /^(talk-|ask-|tea$|explain-|show-|watch-|teach-|invite-|arrange-|read-sam|discuss-|reconsider-|supervised-|apprentice-)/.test(
      action.id,
    )
  )
    return 'people';
  return 'work';
}
export type PlanEntry = NonNullable<GameView['dayPlan']>['entries'][number];
export interface WorkspaceActions {
  bench: ActionView[];
  work: ActionView[];
  people: ActionView[];
  time: ActionView[];
  plans: (PlanEntry & { actions: ActionView[] })[];
  benchPlans: (PlanEntry & { actions: ActionView[] })[];
}
const focusedWork = new Set([
  'delegate-repair',
  'supervised-repair',
  'take-over-repair',
  'show-corrective-step',
  'reconsider-sam',
  'explain-step',
]);
function belongsWithObject(view: GameView, action: ActionView): boolean {
  return Boolean(
    view.focus && (focusedWork.has(action.id) || action.id.startsWith('neighbourhood-')),
  );
}
/** Every offered action has exactly one owner. Physical actions belong to the object before plans. */
export function projectActions(
  view: GameView,
  mappedIds: ReadonlySet<string> = new Set(),
  companionIds: ReadonlySet<string> = new Set(),
): WorkspaceActions {
  const result: WorkspaceActions = {
    bench: [],
    work: [],
    people: [],
    time: [],
    plans: [],
    benchPlans: [],
  };
  const actual = new Map(view.actions.map((action) => [action.id, action]));
  const owned = new Set([...mappedIds, ...companionIds]);
  const physical = new Set(
    view.focus
      ? getMappedRepairActions(view.focus, view.actions).map((binding) => binding.action.id)
      : [],
  );
  for (const entry of view.dayPlan?.entries ?? []) {
    const actions: ActionView[] = [];
    for (const id of entry.actionIds ?? []) {
      const action = actual.get(id);
      if (
        !action ||
        owned.has(id) ||
        physical.has(id) ||
        belongsWithObject(view, action) ||
        id === 'explain-step' ||
        id === 'wait-appointment'
      )
        continue;
      owned.add(id);
      actions.push(action);
    }
    const localCabinet = actions.some((action) => action.id.startsWith('workshop-cabinet-'));
    (localCabinet ? result.benchPlans : result.plans).push({ ...entry, actions });
  }
  for (const action of view.actions) {
    if (owned.has(action.id)) continue;
    owned.add(action.id);
    result[
      belongsWithObject(view, action) ? 'bench' : actionDestination(action, Boolean(view.focus))
    ].push(action);
  }
  return result;
}

export interface OutcomeCeremony {
  key: string;
  title: string;
  detail?: string;
  overline: string;
}
/** A ceremony follows an observed transition, never an inferred repair or an input spent to dismiss it. */
export function operationsCeremony(
  before: GameView,
  after: GameView,
  revision: number,
): OutcomeCeremony | null {
  const next = after.operations;
  if (!next) return null;
  if (before.operations && next.episode !== before.operations.episode)
    return {
      key: `operations-period:${next.episode}:${revision}`,
      title: next.episode === 2 ? 'A month later' : 'The following year',
      overline: 'Your working life',
    };
  if (next.conclusion !== 'open' && next.conclusion !== before.operations?.conclusion)
    return {
      key: `operations-ending:${next.conclusion}:${revision}`,
      title:
        next.conclusion === 'regular'
          ? 'A place for regular work'
          : next.conclusion === 'favours'
            ? 'Room for the work you choose'
            : 'A bench of your own',
      overline: 'The shape of the years ahead',
    };
  if (next.delivery?.status === 'complete' && before.operations?.delivery?.status !== 'complete')
    return {
      key: `operations-delivery:${next.episode}:${revision}`,
      title: 'The agreed delivery is complete',
      overline: next.delivery.by === 'leila' ? 'Leila’s completed stretch' : 'Back from the round',
    };
  if (next.roundComplete && !before.operations?.roundComplete && next.route !== 'private')
    return {
      key: `operations-round:${next.episode}:${revision}`,
      title: 'The collection arrangement is complete',
      overline: next.title,
    };
  return null;
}
