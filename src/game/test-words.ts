import type { TestCondition } from './types';

export const testWords: Record<TestCondition, string> = {
  bench: 'on the table',
  movement: 'while carried',
  load: 'while working harder',
};

export function readingUnit(unit?: string): string {
  return unit === 'rpm Δ' ? 'turns per minute (difference)' : (unit ?? '');
}
