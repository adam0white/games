import { requiredChecks } from '../game/engine';
import { testWords } from '../game/test-words';
import type { Job, TestCondition } from '../game/types';
export interface SamWorkRow {
  jobId: string;
  title: string;
  actions: { label: string; count: number }[];
}
export function samWorkRows(jobs: Job[]): SamWorkRow[] {
  return jobs.flatMap((job) => {
    const actions = new Map<string, { label: string; count: number }>();
    for (const contribution of job.contributions) {
      if (contribution.actorId !== 'sam') continue;
      const [verb, target, detail, extra, last] = contribution.action.split(':');
      const component =
        job.model.components.find((c) => c.id === target)?.label ?? target ?? 'component';
      let label: string | undefined;
      if (verb === 'deliver') label = `Sam returned ${job.title}.`;
      else if (verb === 'inspect') label = `Sam examined the ${component}.`;
      else if (verb === 'measure')
        label = `Sam measured the ${component}${detail ? ` ${testWords[detail as TestCondition] ?? 'under the recorded conditions'}` : ''}.`;
      else if (verb === 'probe')
        label = `Sam measured ${target} between ${detail} and ${extra} ${testWords[last as TestCondition] ?? 'under the recorded conditions'}.`;
      else if (verb === 'clean') label = `Sam cleaned the ${component}.`;
      else if (verb === 'adjust') label = `Sam adjusted the ${component}.`;
      else if (verb === 'replace') label = `Sam replaced the ${component}.`;
      else if (verb === 'calibrate') label = `Sam set the speed control ring to ${detail}.`;
      else if (verb === 'verify') {
        const required = requiredChecks(job);
        label = `Sam ran the ${required.includes(target as 'bench' | 'movement' | 'load') ? 'required ' : ''}test ${testWords[target as TestCondition] ?? 'under the recorded conditions'}.`;
      } else if (verb === 'complete-project') label = 'Sam completed this project, which you kept.';
      else if (verb === 'install') label = `Sam installed the object for ${target}.`;
      else if (verb === 'intake') label = 'Sam received the object.';
      if (!label) continue;
      const grouped = actions.get(contribution.action);
      if (grouped) grouped.count++;
      else actions.set(contribution.action, { label, count: 1 });
    }
    if (job.status === 'delivered' && job.completedBy === 'sam') {
      const label = `Sam returned ${job.title}${job.returnedUnfinished ? ' unfinished' : ''}.`;
      const recorded = actions.get('deliver');
      if (recorded) recorded.label = label;
      else actions.set('deliver', { label, count: 1 });
    }
    return actions.size
      ? [{ jobId: job.id, title: job.title, actions: [...actions.values()] }]
      : [];
  });
}
export function SamWorkAccount({ jobs }: { jobs: Job[] }) {
  const rows = samWorkRows(jobs);
  return (
    <section className="sam-work-account" aria-labelledby="sam-work-title">
      <h3 id="sam-work-title">Work Sam carried out</h3>
      {rows.length ? (
        <ul>
          {rows.map((row) => (
            <li key={row.jobId}>
              <strong>{row.title}</strong>
              <span>
                {row.actions
                  .map(
                    (action) =>
                      `${action.label}${action.count > 1 ? ` (${action.count} times)` : ''}`,
                  )
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No completed repair work by Sam is recorded this week.</p>
      )}
    </section>
  );
}
