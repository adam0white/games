/** Read projections captured from the original HF 4.11 test engine. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { RunArchive } from '@adam0white/human-framework';

export function historicalPerson(
  archive: RunArchive,
  id: string,
  castId: string,
  castRevision: string,
) {
  const key = createHash('sha256')
    .update(JSON.stringify([archive, id, castId, castRevision]))
    .digest('hex');
  const fixture = JSON.parse(
    readFileSync(
      new URL(`./fixtures/hf411-projections/repair-hf411-${key}.fixture`, import.meta.url),
      'utf8',
    ),
  );
  if (fixture.key !== key) throw new Error('Historical fixture does not match source inputs');
  return fixture.person;
}
