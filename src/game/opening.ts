import { type Person, restore } from '@adam0white/human-framework';

const roster = 'halil,mum,nora,rafi,sam';
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );

/** Strict target-clock snapshot validation. This does not admit a source passport. */
export function restoreOpeningPeople(value: unknown): Record<string, Person> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== roster
  )
    throw new Error('The saved workshop opening has an invalid list of people.');
  return Object.fromEntries(
    Object.entries(value).map(([id, saved]) => {
      const person = restore(saved);
      if (person.id !== id || person.now !== 540 || canonical(person) !== canonical(saved))
        throw new Error('The saved workshop opening is invalid or belongs to another version.');
      return [id, person];
    }),
  );
}
