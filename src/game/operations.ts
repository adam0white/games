/** Three finite adult episodes. This module owns requests, packing, explicit
 * transport work and the chosen continuing shape. HF supplies agreement and
 * continuation; the existing bench supplies all repair competence and checks.
 * Time passages grant no wages, parts, repairs or methods. No market is modelled. */

import {
  applyPersonalProjectAction,
  getPersonalProjectView,
  type PersonalProjectContext,
  type PersonalProjectState,
  personalProjectActions,
  personalProjectAway,
} from './personal-project';
import type { StoryLine } from './story';
import type { ActionView } from './types';
import {
  freshWorkshop,
  recordWorkshopEntry,
  type WorkshopJobSpec,
  type WorkshopState,
} from './workshop';

export type OperationsRoute = 'undecided' | 'regular' | 'favours' | 'private';
export interface OperationsJob {
  id: string;
  stage: 'invited' | 'offered' | 'accepted' | 'returned' | 'declined' | 'returned-unchecked';
  fee: number;
  collectionAt?: number;
  independent?: boolean;
  samWageReserved?: 200;
}
export interface OperationsDelivery {
  episode: number;
  by: 'player' | 'leila';
  status: 'working' | 'interrupted' | 'complete';
  from: number;
  until: number;
  advancedTo: number;
  wage: number;
  trolleyId?: string;
  mode: 'loaded-trolley' | 'split-trips' | 'bench-pickup';
  trolleyCustody?: 'with-leila' | 'route-stop' | 'store' | 'bench';
}
export interface OperationsCrates {
  ids: ['display-crate-a', 'display-crate-b'];
  count: 2;
  owner: 'shared-store';
  location: 'store' | 'bench' | 'with-player' | 'with-leila' | 'route-stop';
  borrowedFor?: number;
  transportAgreed: boolean;
}
export interface OperationsMovement {
  kind: 'fetch' | 'round' | 'recover';
  startedAt: number;
  until: number;
  mode?: 'loaded-trolley' | 'split-trips' | 'bench-pickup';
  trolleyId?: string;
}
export interface OperationsState {
  startedAt: number;
  episode: 1 | 2 | 3;
  episodeAt: number;
  route: OperationsRoute;
  jobs: OperationsJob[];
  packing: 'unplanned' | 'measured-card' | 'padded-crate' | 'stationary';
  display: 'unplanned' | 'old-frontage' | 'new-label';
  delivery?: OperationsDelivery;
  completedRounds: number[];
  samPaidHelp: boolean;
  conclusion: 'open' | 'regular' | 'favours' | 'private';
  crates: OperationsCrates;
  crateVisitArranged?: boolean;
  crateVisitAt?: number;
  pendingMovement?: OperationsMovement;
  personalProject?: PersonalProjectState;
  collectionPlan: 'unplanned' | 'store-display' | 'bench-pickup';
}
export interface OperationsGame {
  now: number;
  operations?: OperationsState;
  workshop?: WorkshopState;
}
export interface OperationsContext {
  visitAt?: (personId: string, earliest: number) => number;
  graduated: boolean;
  serviceConclusion: 'open' | 'regular' | 'small' | undefined;
  isHere: (id: string) => boolean;
  objectStatus: (id: string) => 'absent' | 'open' | 'ready' | 'returned' | 'unchecked';
  paperStreetMeasured?: boolean;
  paperStreetFrontage?: 'preserved' | 'rebuilt';
  noraCaseOutcome?: 'carry' | 'tray';
  chooseDelivery?: (personId: string, from: number, until: number) => boolean;
  continueDelivery?: (personId: string, from: number, until: number) => boolean;
  choosePaidHelp?: () => boolean;
  canPassYear?: boolean;
  yearBlockers?: string[];
  finishDelivery?: (trolleyId: string, at: number) => StoryLine[];
  paperStreet?: { present: boolean; repaired: boolean; verified: boolean };
  chooseOccasion?: PersonalProjectContext['chooseOccasion'];
}
export interface OperationsResult {
  lines: StoryLine[];
  minutes: number;
  job?: WorkshopJobSpec;
  personIds?: string[];
  visits?: { personId: string; at: number; activity: string }[];
  promise?: { ownerId: string; objectId: string; collectionAt: number };
  nextYearAt?: number;
  releaseCollectionId?: string;
  returnUnchangedObjectId?: string;
  returnCheckedObjectId?: string;
  completeMovement?: OperationsMovement;
  playerWork?: true;
  participantId?: string;
  focusObjectId?: string;
}
const DAY = 1440;
const line = (speaker: string, text: string, tone: StoryLine['tone'] = 'warm'): StoryLine => ({
  speaker,
  text,
  tone,
});
const result = (text: string, minutes = 5): OperationsResult => ({
  lines: [line('You', text, 'notice')],
  minutes,
});
const workResult = (text: string, minutes: number): OperationsResult => ({
  ...result(text, minutes),
  playerWork: true,
});
const trolley = (
  id: string,
  title: string,
  fault: 'trolley-alignment' | 'trolley-rub',
): WorkshopJobSpec => ({
  id,
  ownerId: 'leila',
  owner: 'Leila',
  title,
  fault,
  form: 'trolley',
  appearance: 'timer',
  story:
    'The shared store’s hand trolley is borrowed for this collection. Leila brings the store keeper’s written permission for accessible wheel and strap work only. The trolley and its existing straps remain the store’s property.',
  trolley: { permission: true, loadMode: 'full' },
  materialsBatteryProvided: false,
});
export const operationsJobSpecs: readonly WorkshopJobSpec[] = [
  trolley('operations-trolley-first', 'The borrowed collection trolley', 'trolley-alignment'),
  {
    id: 'operations-nora-collection',
    ownerId: 'nora',
    owner: 'Nora',
    title: 'Nora’s parcel-table timer',
    story:
      'A mechanical timer for the drying labels at Nora’s packing table. Its exposed dial catches, and she can use the wall clock if it cannot be repaired. The enclosed spring is left alone.',
    fault: 'jam',
    form: 'timer',
    appearance: 'timer',
    materialsBatteryProvided: false,
    inspectText:
      'The dial catches at one point; a dry paper fleck lies in its exposed rim. The enclosed winding spring stays closed.',
  },
  {
    id: 'operations-sam-counter',
    ownerId: 'sam',
    owner: 'Sam',
    title: 'Sam’s counter light',
    story:
      'A low battery light whose beam jumps when the counter is bumped. Sam brought the light from home and supplies a compatible cell; the counter shift itself is outside this job.',
    fault: 'contact',
    appearance: 'reading',
    materialsBatteryProvided: true,
  },
  trolley('operations-trolley-return', 'The loaded trolley, a month later', 'trolley-rub'),
  {
    id: 'operations-leila-year',
    ownerId: 'leila',
    owner: 'Leila',
    title: 'Leila’s storage-shelf light',
    story:
      'The following year Leila brings the shelf lamp rather than promising a continuing stream of work. Its light has faded evenly. She supplies the compatible cell.',
    fault: 'battery',
    appearance: 'bedside',
    materialsBatteryProvided: true,
  },
  {
    id: 'operations-nora-year',
    ownerId: 'nora',
    owner: 'Nora',
    title: 'Nora’s label box',
    story:
      'The following year Nora keeps her labels in a wooden box. Its accessible exterior catch scrapes the keeper even though the joint itself moves freely. She can use an open tray meanwhile; forcing the lid is unnecessary.',
    fault: 'catch-offset',
    form: 'box',
    appearance: 'timer',
    materialsBatteryProvided: false,
  },
];
const episodeSpecs = (episode: number) => operationsJobSpecs.slice((episode - 1) * 2, episode * 2);
function personalContext(ctx: OperationsContext): PersonalProjectContext {
  return {
    model: ctx.paperStreet,
    originalFrontage: ctx.paperStreetFrontage,
    measuredBefore: ctx.paperStreetMeasured,
    noraHere: ctx.isHere('nora'),
    noraCaseOutcome: ctx.noraCaseOutcome,
    chooseOccasion: ctx.chooseOccasion,
  };
}
export function freshOperations(now: number): OperationsState {
  return {
    startedAt: now,
    episodeAt: now,
    episode: 1,
    route: 'undecided',
    jobs: [],
    packing: 'unplanned',
    display: 'unplanned',
    completedRounds: [],
    samPaidHelp: false,
    conclusion: 'open',
    collectionPlan: 'unplanned',
    crates: {
      ids: ['display-crate-a', 'display-crate-b'],
      count: 2,
      owner: 'shared-store',
      location: 'store',
      transportAgreed: false,
    },
  };
}
function settled(w: OperationsState): boolean {
  return (
    w.jobs.every((j) => !['accepted', 'offered', 'invited'].includes(j.stage)) &&
    w.delivery?.status !== 'working' &&
    w.crates.location === 'store' &&
    !w.pendingMovement &&
    !personalProjectAway({ now: 0, operations: w })
  );
}
export function operationsActions(s: OperationsGame, ctx: OperationsContext): ActionView[] {
  if (!ctx.graduated || !ctx.serviceConclusion || ctx.serviceConclusion === 'open') return [];
  const actions: ActionView[] = [];
  const add = (id: string, label: string, detail: string) =>
    actions.push({ id, label, detail, intent: 'stay' });
  const w = s.operations;
  if (!w) {
    add(
      'operations-begin',
      'Open the collection-round page',
      'A collection afternoon, another month of shared work, then the following year. Choose each request separately.',
    );
    return actions;
  }
  if (w.conclusion !== 'open') return [];
  if (w.pendingMovement) return [];
  if (w.route === 'undecided') {
    add(
      'operations-route-regular',
      'Offer a priced collection afternoon',
      'Two finite requests this episode, each separately accepted.',
    );
    add(
      'operations-route-favours',
      'Offer occasional favours',
      'The same physical requests without fees or promised unpaid help.',
    );
    add(
      'operations-route-private',
      'Keep this period for a private bench',
      'Choose retained personal work and decline these requests. The following-year choice remains real.',
    );
    return actions;
  }
  actions.push(...personalProjectActions(s, personalContext(ctx)));
  if (w.route !== 'private') {
    if (w.collectionPlan === 'unplanned' && !w.completedRounds.includes(w.episode)) {
      add(
        'operations-plan-display',
        'Prepare one store display and its real return load',
        'The shared store wants the two labelled demonstration crates prepared for its level display table. Choose this transport work only if you want the occasion; the crates are a finite loan.',
      );
      add(
        'operations-plan-bench',
        'Keep this episode’s customer collections at the bench',
        'Choose attended pickup and retain your display at home. No borrowed display crates or paid transport are needed.',
      );
    }
    if (w.collectionPlan === 'bench-pickup' && !w.completedRounds.includes(w.episode))
      add(
        'operations-attend-collections',
        'Prepare the stable bench for the agreed collections',
        'Fifteen real minutes arranging the current request labels and stable object space. Each repair still needs its own checked return; no crate loan is required.',
      );
    if (
      w.collectionPlan === 'store-display' &&
      w.crates.location === 'store' &&
      !w.completedRounds.includes(w.episode)
    ) {
      if (!ctx.isHere('leila') && (!w.crateVisitArranged || s.now > (w.crateVisitAt ?? 0) + 60))
        add(
          'operations-arrange-crates',
          'Invite Leila to arrange the two display crates',
          'The same two store-owned crates are still at the store. Ask their custodian about this episode’s loan and return route.',
        );
      if (ctx.isHere('leila') && !w.crates.transportAgreed)
        add(
          'operations-agree-crate-loan',
          'Discuss permission for the two display crates',
          'Three actual minutes with Leila: the custodian’s written permission covers this episode and its return choices. The crates stay at the store until fetched.',
        );
      if (w.crates.transportAgreed)
        add(
          'operations-fetch-crates',
          'Agree the loan and fetch the two labelled display crates',
          'Leila conveys the store keeper’s permission for this episode: bring the same two crates, prepare them, and return by checked trolley, lighter hand trips or attended bench pickup. Fifteen actual minutes to fetch them.',
        );
    }
    for (const spec of episodeSpecs(w.episode)) {
      const job = w.jobs.find((j) => j.id === spec.id);
      if (!job) {
        add(
          `operations-hear-${spec.id}`,
          `Arrange to hear ${spec.owner} about ${spec.title}`,
          'Invite a specific visit. Hearing a request makes no promise.',
        );
        continue;
      }
      if (job.stage === 'invited' && ctx.isHere(spec.ownerId))
        add(
          `operations-request-${spec.id}`,
          `Hear ${spec.owner}’s actual request`,
          'Discuss the object, permission and requested use in person. Hearing is not accepting.',
        );
      if (job.stage === 'offered' && ctx.isHere(spec.ownerId)) {
        add(
          `operations-accept-${spec.id}`,
          `Accept ${spec.title}`,
          `${w.route === 'regular' ? '£5 on checked collection; ' : 'A no-fee favour; '}owner retains property. Agree tomorrow’s 16:00 collection and the described test use.`,
        );
        add(
          `operations-later-${spec.id}`,
          `Accept ${spec.title} for later pickup`,
          'Agree two days later at 16:00. The owner can make another arrangement meanwhile.',
        );
      }
      if (job.stage === 'offered' || job.stage === 'invited')
        add(
          `operations-decline-${spec.id}`,
          `Decline ${spec.title}`,
          'No object, fee, test permission or collection promise changes hands.',
        );
      if (job.stage === 'accepted' && ctx.objectStatus(spec.id) === 'unchecked')
        add(
          `operations-settle-${spec.id}`,
          `Close the unchecked ${spec.title} agreement`,
          'Record the honest no-fee return. No checked result or wage is claimed.',
        );
      if (
        job.stage === 'accepted' &&
        spec.form === 'trolley' &&
        ctx.objectStatus(spec.id) === 'open' &&
        ctx.isHere(spec.ownerId)
      )
        add(
          `operations-split-${spec.id}`,
          'Return the borrowed trolley unchanged and split the collection',
          'Agree lighter separate trips with Leila instead of repairing this borrowed trolley. No full-load check, repair fee or fixed wheel is claimed.',
        );
    }
    if (!w.samPaidHelp && ctx.isHere('sam'))
      add(
        'operations-sam-pay',
        'Offer Sam £2 for each whole independent collection repair',
        'A separate agreement for this finite chapter. Existing supervised work stays supervised; a rate teaches no methods.',
      );
    if (w.samPaidHelp && ctx.isHere('sam'))
      for (const job of w.jobs.filter((j) => j.stage === 'accepted' && !j.samWageReserved))
        add(
          `operations-reserve-sam-${job.id}`,
          `Reserve Sam’s agreed £2 for ${operationsJobSpecs.find((spec) => spec.id === job.id)?.title ?? job.id}`,
          'Reserve actual cash before asking him to begin. This applies to favours as well as priced repairs.',
        );
  }
  if (w.route === 'private' && !w.completedRounds.includes(w.episode) && !personalProjectAway(s))
    add(
      'operations-close-private-period',
      'Keep this period’s own work and turn the page when ready',
      'The model and any unfinished alteration remain labelled. Personal work is optional; no collection or new label is required.',
    );
  if (w.packing === 'unplanned' && w.route !== 'private' && w.crates.location === 'bench') {
    if (ctx.paperStreetMeasured)
      add(
        'operations-pack-card',
        'Make dividers from the saved paper-street measurements',
        'Use retained sizes and spare card to protect the drawn fronts. Nothing is cut from the model itself.',
      );
    add(
      'operations-pack-crate',
      'Measure a padded crate for this collection',
      'Twenty minutes of new measuring. Spare cloth and an existing crate stay labelled and reusable.',
    );
    if (ctx.noraCaseOutcome === 'tray')
      add(
        'operations-pack-stationary',
        'Keep the display stationary and collect beside it',
        'Nora’s case was checked as a stationary tray. Arrange pickup at the bench instead of treating it as a carrying case.',
      );
  }
  if (w.display === 'unplanned') {
    if (ctx.paperStreetFrontage)
      add(
        'operations-display-frontage',
        w.route === 'private'
          ? 'Use the retained paper shopfront beside your own-work notebook'
          : 'Use the retained paper shopfront beside the collection book',
        'Your earlier drawing remains yours; the model is protected on the stable bench.',
      );
    add(
      'operations-display-label',
      w.route === 'private' ? 'Make a label for your own work' : 'Make a plain collection label',
      'A new label works even if the childhood model was left in its box.',
    );
  }
  if (
    w.route !== 'private' &&
    w.packing !== 'unplanned' &&
    w.crates.location === 'bench' &&
    w.crates.transportAgreed &&
    !w.completedRounds.includes(w.episode) &&
    w.delivery?.status !== 'working'
  ) {
    const trolleyId = episodeSpecs(w.episode).find((spec) => spec.form === 'trolley')?.id;
    if (trolleyId && ctx.objectStatus(trolleyId) === 'ready')
      add(
        'operations-round-solo',
        'Take the two loaded display crates to the store on the checked trolley',
        'Twenty-five attended minutes. The store owns the crates and trolley; Leila has agreed this return route instead of bench pickup. Customer repairs remain separate.',
      );
    add(
      'operations-round-split',
      'Take the two display crates separately',
      'Two lighter hand-carried trips, forty minutes. Leave the trolley’s problem on its repair page; no full-load check is claimed.',
    );
    if (ctx.isHere('leila'))
      add(
        'operations-round-pickup',
        'Attend the store’s bench pickup',
        'Twenty-five minutes loading the store’s own collection crates at the bench. The stationary display stays in place; the trolley can remain deferred.',
      );
    if (!ctx.isHere('leila') && (!w.crateVisitArranged || s.now > (w.crateVisitAt ?? 0) + 60))
      add(
        'operations-arrange-delivery',
        'Invite Leila to discuss returning the crates',
        'A visit in twenty minutes to discuss paid transport or attended bench pickup. Her arrival is not agreement to paid work.',
      );
    if (
      trolleyId &&
      ctx.objectStatus(trolleyId) === 'ready' &&
      ctx.isHere('leila') &&
      (s.workshop?.cash ?? 0) - operationsReservedCash(s) >= 200
    )
      add(
        'operations-round-leila',
        'Offer Leila £2 to return the loaded crates and checked trolley',
        'Twenty-five actual route minutes with the two store-owned display crates. Her agreement and continued availability are required; pay only finished work.',
      );
  }
  if (w.delivery?.status === 'working')
    add(
      'operations-interrupt-delivery',
      'Recall the packing delivery',
      'Stop the uncompleted stretch. The packing is retained, and no wage or completed round is invented.',
    );
  if (w.delivery?.status === 'interrupted' && w.crates.location === 'route-stop')
    add(
      'operations-recover-route',
      'Bring the stopped crates and trolley back to the bench',
      'Twenty actual minutes to collect the same labelled load from the marked route stop. The incomplete delivery earns no wage; the trolley returns to the bench for your next decision.',
    );
  if (
    settled(w) &&
    w.completedRounds.includes(w.episode) &&
    (w.route === 'private' ||
      episodeSpecs(w.episode).every((spec) => w.jobs.some((j) => j.id === spec.id)))
  ) {
    if (w.episode < 3 && ctx.canPassYear !== false)
      add(
        'operations-next-period',
        w.episode === 1
          ? 'Close collection afternoon; turn to a month later'
          : 'Close shared work; turn to the following year',
        'Only after all accepted workshop obligations are settled. Objects, money and learned methods persist; unplayed time grants none.',
      );
    if (w.episode === 3) {
      add(
        'operations-finish-regular',
        'Keep one agreed collection afternoon',
        'A continuing shape, not an automatic income stream. Further jobs still need agreement.',
      );
      add(
        'operations-finish-favours',
        'Keep occasional favours beside personal work',
        'A complete ending without employees or advertised hours.',
      );
      add(
        'operations-finish-private',
        'Keep the bench private next year',
        'Retain your objects, measurements and people; no future customer work is promised.',
      );
    }
  }
  return actions;
}
export function applyOperationsAction(
  s: OperationsGame,
  id: string,
  ctx: OperationsContext,
): OperationsResult | null {
  if (!operationsActions(s, ctx).some((a) => a.id === id)) return null;
  if (id === 'operations-begin') {
    s.operations = freshOperations(s.now);
    return result(
      'You open a new page after the first service week. Leila has mentioned borrowing the shared store’s trolley again; a collection will need both sound work and an honest way to move it. You can still keep the bench private.',
    );
  }
  const w = s.operations;
  if (!w) return null;
  if (id.startsWith('operations-personal-')) {
    const personal = applyPersonalProjectAction(s, id, personalContext(ctx));
    return personal
      ? {
          ...personal,
          ...(personal.playerWork && !personalProjectAway(s)
            ? { focusObjectId: 'paper-street' }
            : {}),
        }
      : null;
  }
  if (id.startsWith('operations-route-')) {
    w.route = id.slice(17) as OperationsRoute;
    return result(
      w.route === 'private'
        ? 'You keep this period for your own bench. No customer work or unpaid help has been promised. You can still arrange your retained display and choose a different shape next period.'
        : `You choose ${w.route === 'regular' ? 'a priced afternoon' : 'occasional favours'}. Each request still belongs to its owner until separately accepted.`,
    );
  }
  if (id === 'operations-plan-display' || id === 'operations-plan-bench') {
    w.collectionPlan = id === 'operations-plan-display' ? 'store-display' : 'bench-pickup';
    return result(
      w.collectionPlan === 'store-display'
        ? 'You choose one store display, with the two demonstration crates prepared and returned on an agreed route. They stay the store’s property.'
        : 'You choose collections at the stable bench. Your display stays home, and there is no reason to fetch demonstration crates for this episode.',
      3,
    );
  }
  if (id === 'operations-attend-collections') {
    w.completedRounds.push(w.episode);
    return workResult(
      'You spend fifteen minutes setting out the actual request labels and stable collection space. Every customer object keeps its own check and collection agreement; your display remains at home.',
      15,
    );
  }
  if (id === 'operations-close-private-period') {
    w.completedRounds.push(w.episode);
    return result(
      'You keep your own model work, fitted and retained pieces together, ready to return to. The page can turn when your actual obligations are settled.',
      2,
    );
  }
  if (id.startsWith('operations-hear-')) {
    const spec = operationsJobSpecs.find((x) => id === `operations-hear-${x.id}`);
    if (!spec) return null;
    w.jobs.push({ id: spec.id, stage: 'invited', fee: 0 });
    const arrival = ctx.visitAt?.(spec.ownerId, s.now + 20) ?? s.now + 20;
    return {
      ...result(
        `You invite ${spec.owner} to discuss ${spec.title} ${arrival === s.now + 20 ? 'in twenty minutes' : `after their known plans, at ${String(Math.floor((arrival % 1440) / 60)).padStart(2, '0')}:${String(arrival % 60).padStart(2, '0')}`}. The request has not been heard or accepted yet.`,
      ),
      personIds: [spec.ownerId],
      visits: [{ personId: spec.ownerId, at: arrival, activity: `Discussing ${spec.title}` }],
    };
  }
  if (id === 'operations-arrange-crates' || id === 'operations-arrange-delivery') {
    w.crateVisitArranged = true;
    w.crateVisitAt = s.now + 20;
    return {
      ...result(
        id === 'operations-arrange-crates'
          ? 'You invite Leila to discuss borrowing the store’s two labelled display crates for this episode. They stay at the store until the loan is agreed.'
          : 'You invite Leila to discuss returning the labelled crates. No paid work has been agreed yet.',
        3,
      ),
      personIds: ['leila'],
      visits: [
        {
          personId: 'leila',
          at: s.now + 20,
          activity:
            id === 'operations-arrange-crates'
              ? 'Arranging the display-crate loan'
              : 'Discussing a crate return',
        },
      ],
    };
  }
  if (id === 'operations-fetch-crates') {
    w.crates.location = 'with-player';
    const movement: OperationsMovement = { kind: 'fetch', startedAt: s.now, until: s.now + 15 };
    w.pendingMovement = movement;
    delete w.crateVisitArranged;
    return {
      ...result(
        'Leila conveys the store keeper’s permission to borrow these same two labelled display crates for this episode and return them by the agreed route. You spend fifteen minutes fetching them from the store. Their labels and ownership stay with them.',
        15,
      ),
      completeMovement: movement,
      playerWork: true,
    };
  }
  if (id === 'operations-agree-crate-loan') {
    w.crates.borrowedFor = w.episode;
    w.crates.transportAgreed = true;
    return {
      ...result(
        'Leila shows the store keeper’s written permission for this episode’s two labelled demonstration crates. You agree to fetch the same pair, keep their labels and return them by checked trolley, lighter hand trips or attended bench pickup. They remain at the store until fetched.',
        3,
      ),
      participantId: 'leila',
    };
  }
  if (id.startsWith('operations-request-')) {
    const spec = operationsJobSpecs.find((x) => id === `operations-request-${x.id}`);
    const job = w.jobs.find((j) => j.id === spec?.id);
    if (!spec || !job) return null;
    job.stage = 'offered';
    return {
      lines: [
        line('You', spec.story, 'notice'),
        line(
          'You',
          'You record the requested use without accepting it. A later collection or a refusal is still possible.',
          'notice',
        ),
      ],
      minutes: 5,
      participantId: spec.ownerId,
    };
  }
  for (const verb of ['accept', 'later', 'decline', 'settle', 'split'] as const) {
    const spec = operationsJobSpecs.find((x) => id === `operations-${verb}-${x.id}`);
    if (!spec) continue;
    const job = w.jobs.find((j) => j.id === spec.id);
    if (!job) return null;
    if (verb === 'decline') {
      job.stage = 'declined';
      return result(
        `You decline ${spec.title}. ${spec.owner} keeps the object and its materials; no fee or promise is recorded.`,
      );
    }
    if (verb === 'settle') {
      job.stage = 'returned-unchecked';
      delete job.samWageReserved;
      return result(
        `The unchecked ${spec.title} is recorded as returned without a fee. Its missing check is preserved; no independent completion or pay is claimed.`,
      );
    }
    if (verb === 'split') {
      job.stage = 'returned-unchecked';
      delete job.samWageReserved;
      return {
        ...result(
          `You and Leila agree lighter separate collection trips and return the borrowed trolley unchanged to its custodian. The full-load problem remains unverified. No repair fee or independent repair credit is due; customer objects still need their separate checks.`,
        ),
        releaseCollectionId: spec.id,
        returnUnchangedObjectId: spec.id,
      };
    }
    job.stage = 'accepted';
    job.fee = w.route === 'regular' ? 500 : 0;
    if (w.samPaidHelp && (s.workshop?.cash ?? 0) - operationsReservedCash(s) >= 200)
      job.samWageReserved = 200;
    job.collectionAt = Math.floor(s.now / DAY) * DAY + (verb === 'later' ? 3 : 1) * DAY + 16 * 60;
    return {
      ...result(
        `${spec.owner} agrees ${verb === 'later' ? 'the later pickup' : 'tomorrow’s pickup'} at 16:00. ${job.fee ? '£5 is due only on a checked collection.' : 'This is a no-fee favour.'} ${spec.form === 'trolley' ? 'The written store permission covers the accessible wheel and strap and the agreed parcel test. Borrowing does not transfer ownership.' : spec.materialsBatteryProvided ? 'The supplied compatible cell remains with this job.' : 'Accessible exterior work only; no enclosed spring or borrowed material is opened.'}${w.samPaidHelp ? (job.samWageReserved ? ' Sam’s agreed £2 is set aside for this job.' : ' There is not £2 available to reserve for Sam; keep this job with you unless the paid arrangement can be funded later.') : ''}`,
      ),
      job: spec,
      personIds: [spec.ownerId],
      visits: [
        { personId: spec.ownerId, at: job.collectionAt, activity: `Collecting ${spec.title}` },
      ],
      promise: { ownerId: spec.ownerId, objectId: spec.id, collectionAt: job.collectionAt },
      participantId: spec.ownerId,
    };
  }
  if (id === 'operations-sam-pay') {
    const accepted = w.jobs.filter((job) => job.stage === 'accepted');
    const reservation = accepted.length * 200;
    if ((s.workshop?.cash ?? 0) - operationsReservedCash(s) < Math.max(200, reservation))
      return result(
        'You cannot cover Sam’s proposed £2 for the accepted work from the money in the book. Keep the jobs with you for now; no paid agreement is made.',
        2,
      );
    if (!ctx.choosePaidHelp?.())
      return {
        lines: [line('Sam', 'I cannot agree to that extra work now. The repairs stay with you.')],
        minutes: 3,
      };
    w.samPaidHelp = true;
    for (const job of accepted) job.samWageReserved = 200;
    return {
      lines: [
        line(
          'Sam',
          '£2 for a whole independent repair in this chapter, including a favour, paid on checked collection. Keep the money aside before asking me about each actual job; I still have my other hours.',
        ),
      ],
      minutes: 5,
      personIds: ['sam'],
      participantId: 'sam',
    };
  }
  if (id.startsWith('operations-reserve-sam-')) {
    const job = w.jobs.find((j) => id === `operations-reserve-sam-${j.id}`);
    if (!job) return null;
    if ((s.workshop?.cash ?? 0) - operationsReservedCash(s) < 200)
      return result(
        'There is not £2 available to set aside for this job. It stays with you; Sam has not been promised unpaid work.',
        2,
      );
    job.samWageReserved = 200;
    return result(
      'You set aside the agreed £2 for this particular job. Ask Sam about beginning it; the money alone does not start his work.',
      2,
    );
  }
  if (id.startsWith('operations-pack-')) {
    w.packing =
      id === 'operations-pack-card'
        ? 'measured-card'
        : id === 'operations-pack-stationary'
          ? 'stationary'
          : 'padded-crate';
    return workResult(
      w.packing === 'measured-card'
        ? 'The saved measurements let you fold spare-card dividers around the paper buildings without cutting the retained fronts. The new dividers stay yours; the trolley stays the store’s.'
        : w.packing === 'stationary'
          ? 'The stationary tray remains on the stable bench. You label this as bench pickup, keeping Nora’s actual checked use distinct from a carrying case.'
          : 'You measure the existing crate and pad it with spare cloth. The cloth, crate and new measurements are retained; nothing is taken from someone’s object.',
      w.packing === 'padded-crate' ? 20 : 10,
    );
  }
  if (id.startsWith('operations-display-')) {
    w.display = id === 'operations-display-frontage' ? 'old-frontage' : 'new-label';
    return workResult(
      w.display === 'old-frontage'
        ? `You place the retained drawing beside ${w.route === 'private' ? 'your own-work notebook' : 'the collection book'} on the stable bench. Its crooked REPAIRS lettering means something different here than it did in the school box.`
        : `You letter a plain ${w.route === 'private' ? 'own-work' : 'collection'} label and keep it beside the book. Skipping the childhood model has left room for something made now.`,
      15,
    );
  }
  if (id === 'operations-personal-session') {
    w.completedRounds.push(w.episode);
    return workResult(
      'You spend twenty-five minutes at your own bench, laying out the stored drawings and reading the labels on retained parts. The drawings stay yours. You have room to notice which piece you want to work on next.',
      25,
    );
  }
  if (['operations-round-solo', 'operations-round-split', 'operations-round-pickup'].includes(id)) {
    const trolleyId =
      id === 'operations-round-solo'
        ? episodeSpecs(w.episode).find((spec) => spec.form === 'trolley')?.id
        : undefined;
    const duration = id === 'operations-round-split' ? 40 : 25;
    const movement: OperationsMovement = {
      kind: 'round',
      startedAt: s.now,
      until: s.now + duration,
      mode:
        id === 'operations-round-solo'
          ? 'loaded-trolley'
          : id === 'operations-round-split'
            ? 'split-trips'
            : 'bench-pickup',
      trolleyId,
    };
    w.pendingMovement = movement;
    w.crates.location = id === 'operations-round-pickup' ? 'bench' : 'with-player';
    return {
      ...result(
        id === 'operations-round-pickup'
          ? 'You spend twenty-five minutes attending the store’s bench pickup. Its two reusable display crates leave with their custodian. The stationary tray and your drawings stay on the stable bench.'
          : id === 'operations-round-split'
            ? 'You make two lighter hand-carried trips in forty minutes, delivering both reusable display crates to their store. The trolley’s own repair and collection agreement remains on its page.'
            : 'You attend the twenty-five-minute loaded route, return both store-owned display crates and hand the checked borrowed trolley back to its custodian. Your own drawings remain protected at the bench.',
        id === 'operations-round-split' ? 40 : 25,
      ),
      returnCheckedObjectId: trolleyId,
      releaseCollectionId: trolleyId,
      completeMovement: movement,
      playerWork: true,
      participantId: id === 'operations-round-pickup' ? 'leila' : undefined,
    };
  }
  if (id === 'operations-round-leila') {
    const until = s.now + 25;
    if (!ctx.chooseDelivery?.('leila', s.now, until))
      return {
        lines: [
          line(
            'Leila',
            'I cannot take that stretch now. Keep the packing here; you can go yourself or ask another time.',
          ),
        ],
        minutes: 3,
      };
    const trolleyId = episodeSpecs(w.episode).find((spec) => spec.form === 'trolley')?.id;
    w.delivery = {
      episode: w.episode,
      by: 'leila',
      status: 'working',
      from: s.now,
      until,
      advancedTo: s.now,
      wage: 200,
      trolleyId,
      mode: 'loaded-trolley',
      trolleyCustody: 'with-leila',
    };
    w.crates.location = 'with-leila';
    return {
      lines: [
        line(
          'Leila',
          'I agree to return the two store-owned display crates and this checked trolley by the agreed route, instead of collecting it here later. £2 when the stretch is finished. Keep your drawings here; I am not taking customer repairs.',
        ),
      ],
      minutes: 2,
      personIds: ['leila'],
    };
  }
  if (id === 'operations-interrupt-delivery') {
    if (w.delivery) {
      w.delivery.status = 'interrupted';
      w.delivery.trolleyCustody = 'route-stop';
    }
    w.crates.location = 'route-stop';
    return result(
      'You send word to stop the uncompleted delivery at the marked route stop. The two crates and borrowed trolley remain there together, labelled for recovery. Leila’s unfinished stretch is not entered as completed.',
      2,
    );
  }
  if (id === 'operations-recover-route') {
    const movement: OperationsMovement = {
      kind: 'recover',
      startedAt: s.now,
      until: s.now + 20,
      trolleyId: w.delivery?.trolleyId,
    };
    w.pendingMovement = movement;
    w.crates.location = 'with-player';
    return {
      ...result(
        'You spend twenty minutes going to the marked route stop and bringing the same two labelled crates and borrowed trolley back to the bench. The route is still unfinished; you can choose another arrangement.',
        20,
      ),
      completeMovement: movement,
      playerWork: true,
    };
  }
  if (id === 'operations-next-period') {
    const days = w.episode === 1 ? 30 : 335;
    const target = Math.floor(w.episodeAt / DAY) * DAY + days * DAY + 9 * 60;
    w.episode = (w.episode + 1) as 2 | 3;
    w.episodeAt = Math.max(target, Math.floor(s.now / DAY) * DAY + DAY + 9 * 60);
    w.route = 'undecided';
    w.collectionPlan = 'unplanned';
    w.crates.transportAgreed = false;
    delete w.crates.borrowedFor;
    delete w.crateVisitArranged;
    delete w.delivery;
    return {
      ...result(
        w.episode === 2
          ? 'A month later, the old page is settled. Your fitted display, retained fronts and reusable preparation are still yours. You can return to the model, invite someone to see it, or choose another shape for customer work.'
          : 'The following year, your model and retained work are still together. The book holds the real returns and declined requests. You can choose which afternoons to keep for yourself.',
        0,
      ),
      nextYearAt: w.episodeAt,
    };
  }
  if (id.startsWith('operations-finish-')) {
    w.conclusion = id.slice(18) as 'regular' | 'favours' | 'private';
    return result(
      `You close the following-year page with ${w.conclusion === 'regular' ? 'one agreed collection afternoon' : w.conclusion === 'favours' ? 'occasional favours beside your own work' : 'a private bench'}. The real repairs and retained objects remain; this choice promises no offscreen work or income.`,
      10,
    );
  }
  return null;
}
export function completeOperationsJob(
  s: OperationsGame,
  id: string,
  outcome: { verified: boolean; independent: boolean; completedBy?: 'player' | 'sam'; at: number },
): StoryLine[] {
  const w = s.operations;
  const job = w?.jobs.find((j) => j.id === id);
  if (!w || !job || job.stage !== 'accepted' || !outcome.verified) return [];
  s.workshop ??= freshWorkshop();
  job.stage = 'returned';
  job.independent = outcome.independent;
  if (job.fee)
    recordWorkshopEntry(s.workshop, {
      id: `${id}:fee`,
      at: outcome.at,
      amount: job.fee,
      kind: 'repair-fee',
      jobId: id,
    });
  const wage =
    outcome.independent &&
    outcome.completedBy === 'sam' &&
    w.samPaidHelp &&
    job.samWageReserved === 200
      ? 200
      : 0;
  delete job.samWageReserved;
  if (wage)
    recordWorkshopEntry(s.workshop, {
      id: `${id}:sam`,
      at: outcome.at,
      amount: -wage,
      kind: 'sam-pay',
      jobId: id,
    });
  return [
    line(
      'You',
      `${operationsJobSpecs.find((spec) => spec.id === id)?.title ?? 'The object'} is collected checked. ${job.fee ? '£5 received.' : 'The agreed favour is complete.'}${wage ? ' Sam’s agreed £2 is entered for his independent work.' : ''} Ownership stays with the owner.`,
      'notice',
    ),
  ];
}
export function isOperationsWorking(s: OperationsGame, personId: string, at: number): boolean {
  const d = s.operations?.delivery;
  return Boolean(personId === 'leila' && d?.status === 'working' && at >= d.from && at < d.until);
}
export function advanceOperationsWork(
  s: OperationsGame,
  until: number,
  ctx: OperationsContext,
): StoryLine[] {
  const w = s.operations,
    d = w?.delivery;
  if (!w || !d || d.status !== 'working' || until <= d.advancedTo) return [];
  const end = Math.min(until, d.until);
  if (!ctx.continueDelivery?.('leila', d.advancedTo, end)) {
    d.status = 'interrupted';
    d.trolleyCustody = 'route-stop';
    w.crates.location = 'route-stop';
    return [
      line(
        'Leila',
        'I have to stop this stretch. The two labelled crates and borrowed trolley are together at the marked route stop; please arrange to bring them back.',
      ),
    ];
  }
  d.advancedTo = end;
  if (end < d.until) return [];
  s.workshop ??= freshWorkshop();
  if (s.workshop.cash < d.wage) {
    d.status = 'interrupted';
    return [
      line(
        'You',
        'The agreed delivery cannot be settled from the recorded cash. You keep it open without claiming a completed paid round.',
        'mistake',
      ),
    ];
  }
  d.status = 'complete';
  d.trolleyCustody = 'store';
  w.crates.location = 'store';
  if (!w.completedRounds.includes(d.episode)) w.completedRounds.push(d.episode);
  recordWorkshopEntry(s.workshop, {
    id: `operations-delivery-${d.episode}:leila`,
    at: d.until,
    amount: -d.wage,
    kind: 'delivery-pay',
    jobId: `operations-delivery-${d.episode}`,
  });
  return [
    line(
      'Leila',
      'Both display crates and the checked trolley are back at the store, and I am here again. That stretch is finished.',
    ),
    line('You', 'You record Leila’s agreed £2 beside the completed route.', 'notice'),
    ...(d.trolleyId ? (ctx.finishDelivery?.(d.trolleyId, d.until) ?? []) : []),
  ];
}
/** Only a finished player movement transfers custody. Its saved endpoint makes
 * retrieval/recovery a real action rather than a view or idle-time shortcut. */
export function completeOperationsMovement(
  s: OperationsGame,
  movement: OperationsMovement,
  at: number,
): StoryLine[] {
  const w = s.operations,
    pending = w?.pendingMovement;
  if (
    !w ||
    !pending ||
    pending.kind !== movement.kind ||
    pending.startedAt !== movement.startedAt ||
    pending.until !== movement.until ||
    pending.trolleyId !== movement.trolleyId ||
    !Number.isFinite(at) ||
    at < pending.until
  )
    return [];
  delete w.pendingMovement;
  if (pending.kind === 'fetch' || pending.kind === 'recover') {
    w.crates.location = 'bench';
    if (pending.kind === 'recover' && w.delivery) w.delivery.trolleyCustody = 'bench';
    return [
      line(
        'You',
        pending.kind === 'fetch'
          ? 'Both original labelled crates are now at the bench on the agreed loan.'
          : 'Both labelled crates and the borrowed trolley are back at the bench. The unfinished delivery remains in the book.',
        'notice',
      ),
    ];
  }
  w.crates.location = 'store';
  if (!w.completedRounds.includes(w.episode)) w.completedRounds.push(w.episode);
  return [
    line(
      'You',
      'The store has received its same two labelled display crates. You enter the completed return in the book.',
      'notice',
    ),
  ];
}
export function isOperationsObjectAway(s: OperationsGame, objectId: string): boolean {
  if (objectId === 'paper-street' && personalProjectAway(s)) return true;
  const w = s.operations;
  return Boolean(
    w?.pendingMovement?.trolleyId === objectId ||
      (w?.delivery?.trolleyId === objectId &&
        ['with-leila', 'route-stop'].includes(w.delivery.trolleyCustody ?? '')),
  );
}
export function operationsReservedCash(s: OperationsGame): number {
  return (
    (s.operations?.delivery?.status === 'working' ? s.operations.delivery.wage : 0) +
    (s.operations?.jobs.reduce(
      (sum, job) => sum + (job.stage === 'accepted' ? (job.samWageReserved ?? 0) : 0),
      0,
    ) ?? 0)
  );
}
export function operationsSamWorkPermitted(s: OperationsGame, objectId: string): boolean {
  const job = s.operations?.jobs.find((j) => j.id === objectId && j.stage === 'accepted');
  return !job || !s.operations?.samPaidHelp || job.samWageReserved === 200;
}
export function getOperationsView(s: OperationsGame, ctx?: OperationsContext) {
  const w = s.operations;
  if (!w) return undefined;
  return {
    title:
      (w.route === 'private'
        ? [
            'An afternoon of your own',
            'Your model, a month later',
            'Your own bench, the following year',
          ]
        : ['The collection afternoon', 'Back at the bench', 'The following year'])[w.episode - 1] ??
      'The collection round',
    episode: w.episode,
    route: w.route,
    conclusion: w.conclusion,
    packing: w.packing,
    display: w.display,
    collectionPlan: w.collectionPlan,
    personalProject: getPersonalProjectView(s),
    crates: {
      count: w.crates.count,
      owner: 'The shared store',
      location: w.crates.location,
      borrowedFor: w.crates.borrowedFor,
    },
    delivery: w.delivery
      ? {
          by: w.delivery.by,
          status: w.delivery.status,
          until: w.delivery.until,
          trolleyCustody: w.delivery.trolleyCustody,
        }
      : undefined,
    jobs: w.jobs.map((j) => ({
      ...j,
      title: operationsJobSpecs.find((spec) => spec.id === j.id)?.title ?? j.id,
    })),
    remaining: w.jobs.filter((j) => ['invited', 'offered', 'accepted'].includes(j.stage)).length,
    roundComplete: w.completedRounds.includes(w.episode),
    blockedReasons: [
      ...(ctx?.yearBlockers ?? []),
      ...(w.crates.location !== 'store'
        ? ['Return the store’s two labelled crates before leaving this period.']
        : []),
      ...(w.delivery?.status === 'working'
        ? ['Finish or recall the agreed delivery stretch before leaving this period.']
        : []),
      ...(personalProjectAway(s)
        ? ['Receive your loaned paper street back before leaving this period.']
        : []),
    ],
    description:
      w.conclusion !== 'open'
        ? 'The page is settled. Your bench and its retained work remain yours.'
        : w.route === 'private'
          ? 'This period belongs to your own bench. Retained drawings and labelled parts leave room for something you want to make.'
          : w.episode === 1
            ? 'Two display crates need to return to their store. Agree the requests and choose how to move the load.'
            : w.episode === 2
              ? 'A month later, share supported work if people agree and keep room for your own bench.'
              : 'The following year brings two familiar neighbours and another choice about your afternoons.',
  };
}
