import { writeFile } from 'node:fs/promises';
import { replay } from '@adam0white/human-framework';
import { canonicalCast } from '@adam0white/lab-client';
import {
  createPeopleRuntime,
  createPerson,
  projectPerson,
  promise,
  snapshotRuntime,
} from './hf.ts';

const ids = { nora: 'hf.cast.nora.smallworks', rafi: 'hf.cast.rafi.pass' };
const output = {};
for (const [key, id, prayerFrom] of [
  ['nora', 'nora', 0],
  ['rafi', 'rafi', 0],
  ['nora-prayer', 'nora', 540],
  ['nora-prayer-later', 'nora', 600],
]) {
  const castId = ids[id],
    cast = canonicalCast(castId);
  const runtime = createPeopleRuntime(17, 540, prayerFrom ? ['rest', 'pray'] : ['rest']);
  const person = createPerson(runtime, {
    id,
    name: cast.name,
    age: cast.age,
    sex: id === 'nora' ? 'female' : 'male',
    now: 540,
    traits: { honesty: 0.91 },
    body: { fitness: 0.37 },
  });
  if (prayerFrom)
    promise(person, {
      kind: 'worship',
      actions: ['pray'],
      from: prayerFrom,
      until: prayerFrom + 60,
      importance: 1,
      label: 'A retained prayer duty',
    });
  const archive = snapshotRuntime(runtime).archive,
    result = replay(archive);
  if (!result.ok || !result.value.verified) throw Error('Producer replay failed');
  const portable = projectPerson(person, castId, cast.revision);
  if (portable.source.engine !== '4.11.0') throw Error('Wrong producer');
  output[key] = portable;
}
await writeFile(process.argv[2], JSON.stringify(output, null, 2) + '\n');
