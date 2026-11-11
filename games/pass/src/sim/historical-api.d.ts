import type { CalendarPersonaSnapshot } from './historical-calendar.ts';
/** Type-only historical call shapes. These functions have no implementation. */
import type {
  Affordance,
  AgendaState,
  BodyReadout,
  Commitment,
  DecisionRecord,
  NormDefinition,
  Outcome,
  Percept,
  Person,
  SocialEvent,
  Suggestion,
} from './historical-display.ts';
import type { PersonaProjectionSnapshot } from './historical-persona.ts';
export declare function decide(
  p: Person,
  offers: readonly Affordance[],
  options?: { now?: number; suggestion?: Suggestion; settleForeground?: boolean },
): DecisionRecord;
export declare function finish(p: Person, outcome: Outcome): unknown;
export declare function readPerson(p: Person): { body: BodyReadout };
export declare function promise(p: Person, value: Omit<Commitment, 'id' | 'status'>): unknown;
export declare function socialEvent(p: Person, event: SocialEvent): unknown;
export declare function predictAs(
  observer: Person,
  target: Person,
  offers: readonly Affordance[],
  suggestion: Suggestion,
  options?: { now?: number; necessity?: boolean; others?: readonly Suggestion[]; scarcity?: number },
): unknown;
export declare function reviewLine(
  p: Person,
  options?: { variety?: boolean; cause?: 'ordered' | 'interrupted' },
): string | undefined;
export declare function perceive(p: Person, percepts: readonly Percept[]): unknown;
export declare function adoptVoiceTrust(...args: any[]): any;
export declare function diffChronicle(...args: any[]): any;
export declare function enablePromptings(...args: any[]): any;
export declare function promptingLine(...args: any[]): any;
export declare function restore(...args: any[]): Person;
export declare function snapshot(...args: any[]): Person;
export declare function validatePersonaProjection(...args: any[]): PersonaProjectionSnapshot;
export declare function admitPersona(...args: any[]): any;
export declare function createAgenda(...args: any[]): AgendaState;
export declare function projectPersona(...args: any[]): PersonaProjectionSnapshot;
export declare function releaseCommitment(...args: any[]): any;
export declare function admitCalendarPersona(...args: any[]): any;
export declare function isContinuingCommitment(...args: any[]): any;
export declare function projectCalendarPersona(...args: any[]): CalendarPersonaSnapshot;
export declare function tick(...args: any[]): any;
export declare function validateCalendarPersona(...args: any[]): CalendarPersonaSnapshot;
export declare const DEFAULT_NORMS: NormDefinition[];
export declare const MINUTES_PER_YEAR: number;
