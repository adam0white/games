import { dayTime } from '../game/engine';
import type { Evidence, Job, TestCondition } from '../game/types';
import { plainText } from '../ui/plain-text';
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
        <caption>Recorded comparisons · latest reading per condition</caption>
        <thead>
          <tr>
            <th scope="col">Mode / probes</th>
            {(['bench', 'movement', 'load'] as const).map((c) => (
              <th scope="col" key={c}>
                {c}
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
                    key={c}
                    title={
                      e
                        ? `${plainText(e.summary)} Recorded ${dayTime(e.at)}.`
                        : 'No measurement recorded'
                    }
                  >
                    {e
                      ? e.value === null
                        ? '—'
                        : `${e.value?.toFixed(2) ?? '—'} ${e.unit ?? ''}`
                      : '—'}
                    {e &&
                      job.evidence.some((later) => later.kind === 'work' && later.id > e.id) && (
                        <small>before work</small>
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
