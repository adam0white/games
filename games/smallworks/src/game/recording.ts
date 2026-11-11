import { OUTCOME_ACTIONS } from './outcomes.ts';
import type { Command } from './types.ts';

export const MAX_RECORDED_INPUTS = 10_000;
export const SAVE_PROVENANCE = {
  engine: 'small-works@5',
  scenario: 'canonical-workshop@3',
  framework: '4.17.0',
  game: '4.3.0+hf4',
} as const;
/**
 * Engine-4 behaviour, kept so historical exports and old autosaves restore and replay exactly. A legacy world keeps
 * these rules until `upgradeRules` moves it to the current engine at a recorded input index.
 */
export const LEGACY_PROVENANCE = {
  engine: 'small-works@4',
  scenario: 'first-week@1',
  framework: '2.2.1',
  game: '3.0.0-alpha.4',
} as const;
export type Provenance = { engine: string; scenario: string; framework: string; game: string };
/** A world that began under engine 4 and continued under the current rules from input `atInput`. */
export interface MigratedFrom {
  engine: 'small-works@4';
  atInput: number;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const member = (value: unknown, choices: readonly string[]): boolean =>
  typeof value === 'string' && choices.includes(value);
const keys = (value: Record<string, unknown>, allowed: string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));
const finite = (value: unknown, min: number, max: number): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const parts = ['cell', 'switch', 'contact', 'bulb', 'motor', 'spring', 'gear', 'governor', 'drum'];
const conditions = ['bench', 'movement', 'load'];

/** Validate data before a recorded command can reach the world dispatcher. */
export function isRecordedCommand(value: unknown): value is Command {
  if (!object(value)) return false;
  switch (value.type) {
    case 'discuss-repair-method':
      return (
        keys(value, ['type', 'jobId', 'ownerId', 'componentId', 'reportText']) &&
        id(value.jobId) &&
        member(value.ownerId, ['sam', 'mum', 'nora', 'rafi', 'halil']) &&
        member(value.componentId, parts) &&
        typeof value.reportText === 'string' &&
        value.reportText.length <= 100_000
      );
    case 'ask-owner-about-object':
      return (
        keys(value, [
          'type',
          'jobId',
          'ownerId',
          'componentId',
          'intervention',
          'evidenceIds',
          'evidenceText',
        ]) &&
        id(value.jobId) &&
        member(value.ownerId, ['sam', 'mum', 'nora', 'rafi', 'halil']) &&
        member(value.componentId, parts) &&
        value.intervention === 'replace' &&
        typeof value.evidenceText === 'string' &&
        value.evidenceText.length <= 1_000_000 &&
        Array.isArray(value.evidenceIds) &&
        value.evidenceIds.length > 0 &&
        value.evidenceIds.length <= 80 &&
        new Set(value.evidenceIds).size === value.evidenceIds.length &&
        value.evidenceIds.every(
          (n) => Number.isSafeInteger(n) && finite(n, 1, Number.MAX_SAFE_INTEGER),
        )
      );
    case 'cast-outcome':
      return keys(value, ['type', 'action']) && member(value.action, OUTCOME_ACTIONS);
    case 'start-cast-outcomes':
    case 'stop-cast-outcome':
      return keys(value, ['type']);
    case 'reply-personal':
      return (
        keys(value, ['type', 'personId', 'statementId', 'jobId', 'choice']) &&
        member(value.personId, ['sam', 'nora', 'rafi', 'halil']) &&
        Number.isSafeInteger(value.statementId) &&
        finite(value.statementId, 1, Number.MAX_SAFE_INTEGER) &&
        id(value.jobId) &&
        member(value.choice, ['acknowledge', 'decline'])
      );
    case 'ask-about-work':
      return (
        keys(value, ['type', 'personId']) &&
        member(value.personId, ['sam', 'nora', 'rafi', 'halil'])
      );
    case 'prepare-event':
      return (
        keys(value, ['type', 'format']) && member(value.format, ['garden', 'reading', 'theatre'])
      );
    case 'start-busy-workshop':
    case 'pause-chapter':
    case 'resume-chapter':
    case 'wait-for-site':
    case 'request-lesson':
    case 'start-lesson':
    case 'cancel-request':
    case 'next-day':
    case 'continue':
      return keys(value, ['type']);
    case 'accept':
    case 'decline':
    case 'retry-sam':
    case 'recall':
    case 'select':
      return keys(value, ['type', 'jobId']) && id(value.jobId);
    case 'inspect':
    case 'salvage':
      return (
        keys(value, ['type', 'jobId', 'componentId']) &&
        id(value.jobId) &&
        member(value.componentId, parts)
      );
    case 'measure': {
      const request = value.request;
      return (
        keys(value, ['type', 'jobId', 'request']) &&
        id(value.jobId) &&
        object(request) &&
        keys(request, ['mode', 'a', 'b', 'condition']) &&
        member(request.mode, ['voltage', 'continuity', 'motion']) &&
        member(request.a, ['0', 'A', 'B', 'C', 'D']) &&
        member(request.b, ['0', 'A', 'B', 'C', 'D']) &&
        member(request.condition, conditions)
      );
    }
    case 'power':
      return (
        keys(value, ['type', 'jobId', 'on']) && id(value.jobId) && typeof value.on === 'boolean'
      );
    case 'work':
      return (
        keys(value, ['type', 'jobId', 'componentId', 'intervention', 'source']) &&
        id(value.jobId) &&
        member(value.componentId, parts) &&
        member(value.intervention, ['clean', 'adjust', 'replace']) &&
        (value.source === undefined ||
          (value.intervention === 'replace' && member(value.source, ['new', 'recovered'])))
      );
    case 'calibrate':
      return (
        keys(value, ['type', 'jobId', 'componentId', 'setting']) &&
        id(value.jobId) &&
        member(value.componentId, parts) &&
        finite(value.setting, 0, 4) &&
        Number.isInteger(value.setting)
      );
    case 'verify':
      return (
        keys(value, ['type', 'jobId', 'condition']) &&
        id(value.jobId) &&
        member(value.condition, conditions)
      );
    case 'deliver':
      return (
        keys(value, ['type', 'jobId', 'unfinished']) &&
        id(value.jobId) &&
        (value.unfinished === undefined || typeof value.unfinished === 'boolean')
      );
    case 'buy':
      return keys(value, ['type', 'part']) && member(value.part, parts);
    case 'upgrade':
      return keys(value, ['type', 'id']) && member(value.id, ['second-bench', 'precision-meter']);
    case 'watch':
      return keys(value, ['type', 'enabled']) && typeof value.enabled === 'boolean';
    case 'assign':
      return (
        keys(value, ['type', 'jobId', 'personId']) && id(value.jobId) && value.personId === 'sam'
      );
    case 'wait':
      return (
        keys(value, ['type', 'minutes']) &&
        finite(value.minutes, 1, 480) &&
        Number.isInteger(value.minutes)
      );
    default:
      return false;
  }
}

export function isInputRecording(value: unknown): value is Command[] {
  return (
    Array.isArray(value) && value.length <= MAX_RECORDED_INPUTS && value.every(isRecordedCommand)
  );
}

const matches = (value: unknown, expected: Provenance): boolean =>
  object(value) &&
  keys(value, Object.keys(expected)) &&
  Object.entries(expected).every(([key, version]) => value[key] === version);
export const isCurrentProvenance = (value: unknown): boolean => matches(value, SAVE_PROVENANCE);
export const isLegacyProvenance = (value: unknown): boolean => matches(value, LEGACY_PROVENANCE);
export function isSupportedProvenance(value: unknown): boolean {
  return isCurrentProvenance(value) || isOutcomeProvenance(value);
}
export function isMigratedFrom(value: unknown): value is MigratedFrom {
  return (
    object(value) &&
    keys(value, ['engine', 'atInput']) &&
    value.engine === 'small-works@4' &&
    finite(value.atInput, 0, MAX_RECORDED_INPUTS) &&
    Number.isInteger(value.atInput)
  );
}

export const OUTCOME_PROVENANCE = { ...SAVE_PROVENANCE, scenario: 'cast-outcomes@1' } as const;
export const isOutcomeProvenance = (value: unknown): boolean => matches(value, OUTCOME_PROVENANCE);
