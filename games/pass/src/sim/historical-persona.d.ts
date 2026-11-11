/**
 * Type-only historical display contract derived from Human Framework 3.0.0 MIT declarations.
 * Copyright (c) 2026 Adam White. See public/THIRD-PARTY-NOTICES.txt.
 * These declarations contain no engine execution.
 */
import type { Commitment, Episode, Person, Skill } from './historical-display.ts';
export interface PersonaEpisodeMap {
  id: string;
  action?: string;
  actorId?: string;
  targetId?: string;
  placeId?: string;
  voiceId?: string;
  /** Tags are semantic keys too; omitted means no portable tags. */
  tags?: string[];
}
export interface PersonaCommitmentMap {
  id: string;
  actions: string[];
  toId?: string;
  targetId?: string;
  normId?: string;
  chain?: string;
  /** Explicit target-calendar window. Duration and recurrence must remain identical. */
  from: number;
  until: number;
}
export interface PersonaProjection {
  version: string;
  skills: Record<string, string>;
  episodes?: Record<string, PersonaEpisodeMap>;
  /** Every pending or continuing recurring obligation requires a named binding. */
  commitments?: Record<string, PersonaCommitmentMap>;
}
export interface PersonaProjectionSnapshot {
  format: 'hf-persona-state/1';
  mappingVersion: string;
  source: {
    schema: Person['schema'];
    engine: string;
    id: string;
    now: number;
  };
  name: string;
  life: Person['life'];
  rng: Person['rng'];
  traits: Person['traits'];
  values: Person['values'];
  health: {
    health: number;
    fitness: number;
    circadianPeak: number;
  };
  family: Person['family'] | null;
  bonds: Person['bonds'] | null;
  skills: Record<string, Skill>;
  skillRetention: Person['skillRetention'] | null;
  episodes: Episode[];
  /** Already bound to the target calendar by the explicitly versioned host mapping. */
  commitments: Commitment[];
  limitations: string[];
}
export interface PersonaAdmission {
  mappingVersion: string;
  sourceId: string;
  targetId: string;
}
export interface PersonaAdmissionResult {
  person: Person;
  report: {
    mappingVersion: string;
    offset: number;
    limitations: string[];
  };
}
/** Validates untrusted portable data without restoring defaults or accepting extra live fields. */
export declare function validatePersonaProjection(input: unknown): PersonaProjectionSnapshot;
/** Hosts must migrate supported old saves first. No random draws or mutation occur here. */
export declare function projectPersona(source: Person, mapping: PersonaProjection): PersonaProjectionSnapshot;
/** Return a detached target opening; a later shelf change cannot affect it. Host owns cast/branch/death authority. */
export declare function admitPersona(
  input: unknown,
  target: Person,
  policy: PersonaAdmission,
): PersonaAdmissionResult;
