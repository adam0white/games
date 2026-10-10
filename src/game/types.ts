import type { Person } from '@adam0white/human-framework';

export type Fault = 'contact' | 'battery' | 'holder' | 'cap';
export type Chapter = 'family' | 'bench' | 'later' | 'garage';
export type GameInput = { type: 'action'; id: string } | { type: 'select'; id: string };

export interface RepairObject {
  id: string;
  title: string;
  owner: string;
  story: string;
  form: 'lamp' | 'torch';
  fault: Fault;
  location: 'bench' | 'shelf' | 'returned';
  observations: string[];
  inspected: boolean;
  tested: boolean;
  attempted: number;
  repaired: boolean;
  verified: boolean;
  discovered: boolean;
  checkStarted?: number;
  returnedEarly?: boolean;
  callbackAt?: number;
  callbackSeen?: boolean;
}

export interface ConversationLine {
  id: number;
  speaker: string;
  text: string;
  tone?: 'warm' | 'notice' | 'mistake';
}

export interface LoggedInput {
  at: number;
  input: GameInput;
}

export interface GameState {
  schema: 1;
  scenario: 1;
  framework: string;
  seed: number;
  now: number;
  chapter: Chapter;
  focusId: string | null;
  objects: RepairObject[];
  people: Record<string, Person>;
  parts: { batteries: number; holders: number };
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
}

export interface ActionView {
  id: string;
  label: string;
  detail?: string;
  kind?: 'primary' | 'quiet';
  intent?: 'stay' | 'pause' | 'leave';
}

export interface ObjectView {
  id: string;
  title: string;
  owner: string;
  story: string;
  condition: string;
  visual: 'flickering' | 'steady' | 'off' | 'broken' | 'warm';
  form: 'lamp' | 'torch';
  observations: string[];
  appearance?: 'reading' | 'bedside' | 'kitchen' | 'torch';
}

export interface GameView {
  title: string;
  subtitle: string;
  scene: 'home' | 'garage';
  focus: ObjectView | null;
  actions: ActionView[];
  conversation: ConversationLine[];
  shelf: { id: string; title: string; note: string }[];
  parts: { id: string; label: string; count: number }[];
  note: string | null;
  humanNote?: string | null;
  moment?: string;
  currentDialogue?: ConversationLine[];
  journal?: ConversationLine[];
}
