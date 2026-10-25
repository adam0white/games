import { dayTime } from '../game/engine';
import { readingUnit, testWords } from '../game/test-words';
import type { Evidence, Job, TestCondition } from '../game/types';
export function ReadingComparison({ job }: { job: Job }) {
  const rows = new Map<
    string,
    { mode: string; a: string; b: string; readings: Partial<Record<TestCondition, Evidence>> }
  >();
  for (const evidence of job.evidence) {
    const r = evidence.request;
    if (evidence.kind !== 'measurement' || !r) continue;
    const key = `${r.mode}:${r.a}:${r.b}`;
    const row = rows.get(key) ?? { mode: r.mode, a: r.a, b: r.b, readings: {} };
    row.readings[r.condition] = evidence;
    rows.set(key, row);
  }
  if (!rows.size) return null;
  return (
    <div className="reading-comparison">
      <table>
        <caption>This table shows the latest recorded reading for each condition.</caption>
        <thead>
          <tr>
            <th scope="col">Mode / probes</th>
            {(['bench', 'movement', 'load'] as const).map((c) => (
              <th scope="col" key={c}>
                {testWords[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...rows.entries()].map(([id, row]) => (
            <tr key={id}>
              <th scope="row">
                {row.mode}
                <small>
                  {row.a} → {row.b}
                </small>
              </th>
              {(['bench', 'movement', 'load'] as const).map((c) => {
                const e = row.readings[c];
                return (
                  <td
                    key={testWords[c]}
                    title={
                      e
                        ? `${e.summary} This was recorded at ${dayTime(e.at)}.`
                        : 'No measurement has been recorded.'
                    }
                  >
                    {e
                      ? e.value === null
                        ? '—'
                        : `${e.value?.toFixed(2) ?? '—'} ${readingUnit(e.unit)}`
                      : '—'}
                    {e &&
                      job.evidence.some((later) => later.kind === 'work' && later.id > e.id) && (
                        <small>This reading was taken before the later repair work.</small>
                      )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
