import type { Person } from '@adam0white/human-framework';

export type DeviceKind = 'lantern' | 'fan' | 'music-box';
export type ComponentKind =
  | 'cell'
  | 'switch'
  | 'contact'
  | 'bulb'
  | 'motor'
  | 'spring'
  | 'gear'
  | 'governor'
  | 'drum';
export type Condition = 'good' | 'weak' | 'dirty' | 'open' | 'worn' | 'jammed' | 'misaligned';
export type TestCondition = 'bench' | 'movement' | 'load';
export type MeterMode = 'voltage' | 'continuity' | 'motion';
export type Intervention = 'clean' | 'adjust' | 'replace';
export interface Component {
  id: string;
  kind: ComponentKind;
  label: string;
  terminals: [string, string];
  x: number;
  y: number;
  condition: Condition;
  setting?: number;
}
export interface DeviceModel {
  kind: DeviceKind;
  components: Component[];
  power: boolean;
  sourceVolts: number;
  ratedDrive?: number;
  gearRatio?: number;
  desiredRPM?: number;
  tolerance?: number;
}
export interface MeasurementRequest {
  mode: MeterMode;
  a: string;
  b: string;
  condition: TestCondition;
}
export interface Measurement {
  value: number | null;
  unit: string;
  summary: string;
  cues: Record<string, string>;
}
export interface UseResult {
  passes: boolean;
  output: number;
  summary: string;
  cues: Record<string, string>;
}
export interface Observation {
  summary: string;
  cues: Record<string, string>;
}
export interface Evidence extends Observation {
  id: number;
  at: number;
  kind: 'inspection' | 'measurement' | 'use' | 'work';
  witnessedBy?: string[];
  actorId?: string;
  componentId?: string;
  request?: MeasurementRequest;
  value?: number | null;
  unit?: string;
  condition?: TestCondition;
}
export type JobStatus = 'offer' | 'active' | 'ready' | 'delivered' | 'declined' | 'salvaged';
export interface Job {
  id: string;
  title: string;
  ownerId: string;
  description: string;
  importance: string;
  requiredConditions?: TestCondition[];
  kind: DeviceKind;
  model: DeviceModel;
  status: JobStatus;
  due: number;
  reward: number;
  evidence: Evidence[];
  contributions: { actorId: string; action: string; at: number }[];
  pendingLessons: {
    observerId: string;
    action: string;
    cues: Record<string, string>;
    demonstrationId: string;
    baseline?: Evidence;
  }[];
  inspected: string[];
  verified: TestCondition[];
  assignedTo?: string;
  responsibility?: import('./responsibility').Responsibility;
  blocked?: { at: number; reason: string; kind: 'help' | 'unavailable' };
  acceptedAt?: number;
  deliveredAt?: number;
  completedBy?: string;
  returnedUnfinished?: boolean;
  isPersonal?: boolean;
  isDonor?: boolean;
  quote?: string;
  /** Engine 5: the owner has noticed the promised return time pass. */
  overdueNoted?: boolean;
  overdueAgain?: boolean;
  withheldNoted?: boolean;
  /** Engine 5: this late return already sent its owner's next request elsewhere once. */
  wentElsewhere?: boolean;
}
export interface WorkOption {
  id: string;
  action: string;
  label: string;
  duration: number;
  effort: number;
  advances?: string[];
}
export interface PersonChoice {
  chosenId?: string;
  narration: string;
  reason: string;
  terms: Record<string, number>;
  /** Engine 5: how Sam answered the player's own ask, in his words, when the player asked. */
  answer?: { verdict: string; says: string; reason: string };
}
export interface NpcWork {
  personId: string;
  jobId?: string;
  option: WorkOption;
  endsAt: number;
  startedAt: number;
  reservedPart?: ComponentKind;
  reservedRecovered?: boolean;
}
export interface LogEntry {
  id: number;
  at: number;
  speaker: string;
  text: string;
  tone: 'ordinary' | 'good' | 'warning';
}
export interface PendingRequest {
  kind: 'lesson' | 'repair';
  status: 'requested' | 'ready';
  requestedAt: number;
  readyUntil?: number;
  jobId?: string;
}
export interface GameState {
  schema: 'small-works@4' | 'small-works@5';
  provenance?: import('./recording').Provenance;
  /** Present when an engine-4 world continued under engine 5 (see `upgradeRules`). */
  migratedFrom?: import('./recording').MigratedFrom;
  inputs?: Command[];
  discoveries?: string[];
  /** Complete target-clock initial people; never refreshed from live browser continuity. */
  castChapter?: import('./cast').CastChapter;
  chapterPaused?: boolean;
  openingPeople?: Record<string, Person>;
  community?: import('./community').CommunityState;
  seed: number;
  rng: number;
  now: number;
  day: number;
  cash: number;
  reputation: number;
  stock: Partial<Record<ComponentKind, number>>;
  /** Recorded opt-in host scenario; absent worlds retain canonical-workshop@2 rules. */
  busyWorkshop?: {
    edition: 'busy-workshop@1';
    startedAt: number;
    restockAt: number;
    recoveredStock: Partial<Record<ComponentKind, number>>;
  };
  jobs: Job[];
  people: Record<string, Person>;
  npcWork: NpcWork[];
  watching: boolean;
  watchUntil?: number;
  pendingRequest?: PendingRequest;
  selectedJobId: string;
  log: LogEntry[];
  nextId: number;
  upgrades: string[];
  independentRepairs: number;
  weekReviewed: boolean;
  ended: boolean;
  dailyCostsPaid: number;
}
export type Command =
  | { type: 'pause-chapter' | 'resume-chapter' }
  | { type: 'ask-about-work'; personId: 'sam' | 'nora' | 'rafi' | 'halil' }
  | { type: 'prepare-event'; format: import('./community').CommunityFormat }
  | { type: 'wait-for-site' }
  | { type: 'start-busy-workshop' }
  | { type: 'accept'; jobId: string }
  | { type: 'decline'; jobId: string }
  | { type: 'inspect'; jobId: string; componentId: string }
  | { type: 'measure'; jobId: string; request: MeasurementRequest }
  | { type: 'power'; jobId: string; on: boolean }
  | {
      type: 'work';
      jobId: string;
      componentId: string;
      intervention: Intervention;
      source?: 'new' | 'recovered';
    }
  | { type: 'calibrate'; jobId: string; componentId: string; setting: number }
  | { type: 'verify'; jobId: string; condition: TestCondition }
  | { type: 'deliver'; jobId: string; unfinished?: boolean }
  | { type: 'salvage'; jobId: string; componentId: string }
  | { type: 'buy'; part: ComponentKind }
  | { type: 'upgrade'; id: string }
  | { type: 'watch'; enabled: boolean }
  | { type: 'request-lesson' }
  | { type: 'start-lesson' }
  | { type: 'cancel-request' }
  | { type: 'retry-sam'; jobId: string }
  | { type: 'assign'; jobId: string; personId: string }
  | { type: 'recall'; jobId: string }
  | { type: 'wait'; minutes: number }
  | { type: 'next-day' }
  | { type: 'select'; jobId: string }
  | { type: 'continue' };

export interface CommandResult {
  state: GameState;
  ok: boolean;
  message: string;
}
