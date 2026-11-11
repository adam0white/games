/** Build historical test projections using the actual 4.11 engine and public inputs. */

import * as historical from '@adam0white/hf-fixture-411';
import { type RunArchive, readRunHistory } from '@adam0white/human-framework';

export function historicalPerson(
  archive: RunArchive,
  id: string,
  castId: string,
  castRevision: string,
) {
  const run = historical.createRun(archive.initial.spec);
  if (!run.ok) throw new Error(JSON.stringify(run.error));
  for (const person of archive.initial.people) {
    const created = historical.createPerson(run.value, person);
    if (!created.ok) throw new Error(JSON.stringify(created.error));
  }
  for (const tx of readRunHistory(archive)) {
    const result = historical.step(run.value, {
      until: tx.until,
      inputs: tx.inputs,
      fidelity: tx.fidelity,
    });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
  }
  const view = historical.inspect(run.value, {
    perspective: { kind: 'host' },
    people: [id],
    select: ['persona', 'calendar'],
    portable: { person: id, castId, castRevision },
  });
  if (!view.ok) throw new Error(JSON.stringify(view.error));
  const person = view.value.people[0];
  if (person?.kind !== 'host') throw new Error('Historical projection unavailable');
  const part = person.parts.find((item) => item.select === 'persona');
  if (part?.select !== 'persona') throw new Error('Historical projection unavailable');
  return part.value;
}
