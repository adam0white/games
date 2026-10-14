import { requiredChecks } from '../game/engine';
import type { Job } from '../game/types';
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
      if (verb === 'deliver') label = `Returned ${job.title}`;
      else if (verb === 'inspect') label = `Inspected ${component}`;
      else if (verb === 'measure')
        label = `Measured ${component}${detail ? ` under ${detail}` : ''}`;
      else if (verb === 'probe')
        label = `Read ${target} between ${detail} and ${extra} under ${last}`;
      else if (verb === 'clean') label = `Cleaned ${component}`;
      else if (verb === 'adjust') label = `Adjusted ${component}`;
      else if (verb === 'replace') label = `Replaced ${component}`;
      else if (verb === 'calibrate') label = `Set ${component} collar to ${detail}`;
      else if (verb === 'verify') {
        const required = requiredChecks(job);
        label = `Ran ${required.includes(target as 'bench' | 'movement' | 'load') ? 'required ' : ''}${target} use check`;
      } else if (verb === 'complete-project') label = 'Completed this retained piece of work';
      else if (verb === 'install') label = `Installed for ${target}`;
      else if (verb === 'intake') label = 'Received the object';
      if (!label) continue;
      const grouped = actions.get(contribution.action);
      if (grouped) grouped.count++;
      else actions.set(contribution.action, { label, count: 1 });
    }
    if (job.status === 'delivered' && job.completedBy === 'sam') {
      const label = `Returned ${job.title}${job.returnedUnfinished ? ', unfinished' : ''}`;
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
