import type { Command } from './types';

export const MAX_RECORDED_INPUTS = 10_000;
export const SAVE_PROVENANCE = {
  engine: 'small-works@3',
  scenario: 'first-week@1',
  framework: '2.2.1',
  game: '3.0.0-alpha.3',
} as const;

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
    case 'prepare-event':
      return (
        keys(value, ['type', 'format']) && member(value.format, ['garden', 'reading', 'theatre'])
      );
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
        keys(value, ['type', 'jobId', 'componentId', 'intervention']) &&
        id(value.jobId) &&
        member(value.componentId, parts) &&
        member(value.intervention, ['clean', 'adjust', 'replace'])
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

export function isSupportedProvenance(value: unknown): boolean {
  return (
    object(value) &&
    keys(value, Object.keys(SAVE_PROVENANCE)) &&
    Object.entries(SAVE_PROVENANCE).every(([key, version]) => value[key] === version)
  );
}
