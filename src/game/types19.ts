import type { Person } from '@repair/hf-engine5';
import type { NeighbourhoodState } from './neighbourhood19';
import type { getOperationsView, OperationsState } from './operations19';
import type { PersonalProjectPresentation } from './personal-project19';
import type { RepairAccess } from './repair-access19';
import type { CaseFittings, RepairCue } from './repairs19';
import type { ServiceWeekState } from './service-week19';
import type { WorkshopState } from './workshop19';

export type Fault =
  | 'contact'
  | 'battery'
  | 'holder'
  | 'cap'
  | 'jam'
  | 'striker'
  | 'hinge'
  | 'catch-offset'
  | 'worn-catch'
  | 'spring'
  | 'gear'
  | 'trolley-alignment'
  | 'trolley-rub';
export type Chapter = 'family' | 'bench' | 'later' | 'garage';
export type GameInput = { type: 'action'; id: string } | { type: 'select'; id: string };

export interface RepairObject {
  access?: RepairAccess;
  id: string;
  title: string;
  owner: string;
  story: string;
  inspectText?: string;
  repairText?: string;
  caseFittings?: CaseFittings;
  trolley?: {
    permission: boolean;
    unloaded?: boolean;
    loaded?: boolean;
    loadMode?: 'full' | 'split';
    routeChecked?: boolean;
  };
  requestedUse?: string;
  appearance?:
    | 'reading'
    | 'bedside'
    | 'kitchen'
    | 'torch'
    | 'timer'
    | 'bell'
    | 'box'
    | 'clip'
    | 'model';
  form: 'lamp' | 'torch' | 'timer' | 'bell' | 'box' | 'clip' | 'trolley';
  fault: Fault;
  location: 'bench' | 'shelf' | 'returned';
  observations: string[];
  evidence?: RepairCue[];
  inspected: boolean;
  tested: boolean;
  attempted: number;
  repaired: boolean;
  verified: boolean;
  discovered: boolean;
  assignedTo?: 'sam';
  independent?: boolean;
  playerAssisted?: boolean;
  completedBy?: 'player' | 'sam';
  stepDecisions?: {
    at: number;
    action: string | null;
    methods: string[];
    hostPreparation?: 'open-access' | 'reassemble';
  }[];
  checkStarted?: number;
  awaitingCollection?: boolean;
  collectedAt?: number;
  returnedEarly?: boolean;
  callbackAt?: number;
  callbackSeen?: boolean;
}

export interface ConversationLine {
  id: number;
  at?: number;
  timeLabel?: string;
  speaker: string;
  text: string;
  tone?: 'warm' | 'notice' | 'mistake';
}

export interface LoggedInput {
  at: number;
  input: GameInput;
}

export interface GameState {
  operationsPurposeIds?: Record<string, string>;
  operations?: OperationsState;
  conversationPause?: {
    participantId: string;
    actionId: string;
    activityId: string;
    until: number;
    label: string;
  };
  neighbourhood?: NeighbourhoodState;
  serviceWeek?: ServiceWeekState;
  checkingPlaces?: number;
  workshop?: WorkshopState;
  campaign?: {
    holiday: number;
    lastSchoolRepairs: number;
    graduated: boolean;
    startedAt: number;
    holidayStartedAt?: number;
  };
  apprentice?: {
    visitUntil: number;
    arranged: boolean;
    supervisedCompleted: boolean;
    independentCompleted: number;
    jobId?: string;
    pending?: { step: string; endsAt: number; preparation?: 'open-access' | 'reassemble' };
    needsHelp?: string;
    pauseReason?: string;
    pausedStep?: { step: string; remaining: number; preparation?: 'open-access' | 'reassemble' };
    role: 'observer' | 'trainee' | 'repairer';
    completedJobIds: string[];
    supervised?: boolean;
    lastLesson?: {
      objectId: string;
      step: string;
      cue: RepairCue;
      success: boolean;
      eventId: string;
      explained: boolean;
    };
  };
  samPlans?: {
    invitation: 'pending' | 'accepted';
    heardAt: number;
    routineShiftKnown?: boolean;
    availableAfter?: number;
    availabilityReason?: string;
  };
  world?: { presence: Record<string, { awayUntil: number; activity: string }>; day: number };
  engine3Save?: string;
  engine3InputCount?: number;
  schema: 1;
  scenario: 1;
  framework: string;
  seed: number;
  now: number;
  chapter: Chapter;
  focusId: string | null;
  objects: RepairObject[];
  people: Record<string, Person>;
  parts: {
    batteries: number;
    holders: number;
    springs?: number;
    gears?: number;
    gearTargets?: string[];
  };
  unlocked: string[];
  conversation: ConversationLine[];
  inputs: LoggedInput[];
  discoveries: number;
  repairs: number;
  requests: number;
  worldRng: number;
  legacySave?: string;
  legacyInputCount?: number;
  humanNote?: string | null;
  journal?: ConversationLine[];
  nextLineId?: number;
  eventStartId?: number;
  feedbackRevisionFrom?: number;
}

export interface ActionView {
  id: string;
  label: string;
  detail?: string;
  kind?: 'primary' | 'quiet';
  intent?: 'stay' | 'pause' | 'leave';
}

export interface ObjectView {
  personalPresentation?: PersonalProjectPresentation;
  trolleyPresentation?: {
    intervention?: 'wheel-aligned' | 'strap-secured';
    comparison: 'unexamined' | 'empty-only' | 'loaded-only' | 'compared';
    observed: 'unknown' | 'wanders' | 'rubs' | 'rolls';
    loadMode: 'full' | 'split';
    routeChecked: boolean;
  };
  assembly?: Pick<RepairAccess, 'kind' | 'state' | 'revision' | 'retainedPieceIds' | 'workMarkers'>;
  casePresentation?: {
    mode: 'carrying-case' | 'stationary-tray';
    catch: 'original' | 'compatible' | 'none';
    comparisonKnown: boolean;
  };
  id: string;
  title: string;
  owner: string;
  story: string;
  condition: string;
  visual: 'flickering' | 'steady' | 'off' | 'broken' | 'warm';
  form: 'lamp' | 'torch' | 'timer' | 'bell' | 'box' | 'clip' | 'trolley';
  observations: string[];
  inspected?: boolean;
  progress?: 'closed' | 'inspected' | 'repaired' | 'checked';
  appearance?:
    | 'reading'
    | 'bedside'
    | 'kitchen'
    | 'torch'
    | 'timer'
    | 'bell'
    | 'box'
    | 'clip'
    | 'model';
}

export interface GameView {
  roomFacts?: { intakeSpace: boolean; checkingPlaces: number; storeCratesAtBench: boolean };
  operations?: ReturnType<typeof getOperationsView>;
  chapterFlow?: {
    stage: 'school' | 'workshop' | 'service';
    title: string;
    period: string;
    tutorial: boolean;
  };
  workshopCabinet?: { stage: 'looked' | 'measured' | 'hung' | 'finished'; detail: string };
  chapterClosure?: { sourcekey: string; title: string; detail: string; outcomes: string[] };
  milestone?: { sourcekey: string; title: string; detail: string };
  knownAppointments?: { personId: string; name: string; at: number; detail: string }[];
  collectionPlans?: { objectId: string; title: string; owner: string; detail: string }[];
  lifeChapter?: { label: string; detail?: string };
  dayPlan?: {
    summary: string;
    entries: {
      id: string;
      label: string;
      detail: string;
      status: 'agreed' | 'invitation' | 'routine' | 'underway' | 'late' | 'kept';
      actionIds?: string[];
    }[];
  };
  apprenticeship?: {
    name: string;
    activity: string;
    responsibility: string;
    availability?: string;
    nextEvent?: { at: number; label: string; detail: string };
  };
  timeLabel?: string;
  whereabouts?: { id: string; name: string; activity: string }[];
  title: string;
  subtitle: string;
  scene: 'home' | 'garage';
  focus: ObjectView | null;
  actions: ActionView[];
  conversation: ConversationLine[];
  shelf: { id: string; title: string; note: string; object?: ObjectView }[];
  parts: { id: string; label: string; count: number }[];
  note: string | null;
  humanNote?: string | null;
  moment?: string;
  currentDialogue?: ConversationLine[];
  journal?: ConversationLine[];
}
