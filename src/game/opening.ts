import type { Person } from './hf.ts';

/** Initial read models are checked against reconstruction from the saved cast inputs. */
export function restoreOpeningPeople(value: unknown): Record<string, Person> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'halil,mum,nora,rafi,sam'
  )
    throw new Error('The saved workshop opening has an invalid list of people.');
  for (const [id, p] of Object.entries(value))
    if (!p || typeof p !== 'object' || p.id !== id || p.now !== 540)
      throw new Error('The saved workshop opening is invalid.');
  return structuredClone(value) as Record<string, Person>;
}
