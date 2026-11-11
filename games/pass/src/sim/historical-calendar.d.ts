/** Type-only historical display contract, derived from Human Framework 3.0.0 MIT declarations.
 * Copyright (c) 2026 Adam White. See public/THIRD-PARTY-NOTICES.txt. No engine execution. */

import {
  type Commitment,
  type HeldNorm,
  type NormDefinition,
  type OwedMakeUp,
  type Person,
} from './historical-display.ts';
import {
  type PersonaAdmission,
  type PersonaAdmissionResult,
  type PersonaProjection,
  type PersonaProjectionSnapshot,
} from './historical-persona.ts';
export interface PersonaCalendarMap {
  version: 'hf-persona-calendar-map/1';
  /** Exactly target opening minus source departure. All retained calendar timestamps use this offset. */
  offset: number;
  references: {
    commitments: Record<string, string>;
    chains: Record<string, string>;
    actions: Record<string, string>;
    entities: Record<string, string>;
    norms: Record<string, string>;
  };
  sourceNorms: NormDefinition[];
}
export interface CalendarPersonaProjection extends Omit<PersonaProjection, 'commitments'> {
  calendar: PersonaCalendarMap;
}
export interface CalendarPersonaSnapshot {
  format: 'hf-persona-calendar/1';
  person: PersonaProjectionSnapshot;
  calendar: {
    offset: number;
    commitments: Commitment[];
    owed: OwedMakeUp[];
    lapse: Person['agenda']['lapse'] | null;
    heldNorms: HeldNorm[];
    norms: NormDefinition[];
  };
}
export interface CalendarPersonaAdmission extends PersonaAdmission {
  targetNorms: NormDefinition[];
}
/** Validate portable calendar data strictly; no restore defaults or debt settlement. */
export declare function validateCalendarPersona(input: unknown): CalendarPersonaSnapshot;
/** Source declares a complete semantic ID map, a clock offset and source-backed norm catalog. */
export declare function projectCalendarPersona(
  source: Person,
  mapping: CalendarPersonaProjection,
): CalendarPersonaSnapshot;
/** Receiver declares identical norm meanings and a clean calendar at the exact declared opening clock. */
export declare function admitCalendarPersona(
  input: unknown,
  target: Person,
  policy: CalendarPersonaAdmission,
): PersonaAdmissionResult;
