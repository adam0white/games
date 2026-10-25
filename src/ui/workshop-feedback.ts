import type { Person } from '@adam0white/human-framework';
import { playerWordReading } from '../game/people';
import type { Job } from '../game/types';

/** Describe performed work, never the hidden fault or an untested result. */
export function componentWorkReading(job: Job, componentId: string) {
  const work = job.contributions.findLast((entry) =>
    ['clean', 'adjust', 'replace'].some((verb) => entry.action === `${verb}:${componentId}`),
  );
  const part = job.model.components.find((component) => component.id === componentId);
  if (!work || !part) return undefined;
  const kind = work.action.split(':')[0] as 'clean' | 'adjust' | 'replace';
  const text =
    kind === 'replace'
      ? `A replacement ${part.label.toLowerCase()} is fitted. Test the object to check the result.`
      : kind === 'clean'
        ? part.kind === 'contact' || part.kind === 'switch'
          ? 'The contact surfaces were cleaned. Cleaning does not prove the fault is fixed.'
          : `${part.label} was cleaned. Test the object to check the result.`
        : `${part.label} was adjusted. Test the object to check the result.`;
  return { kind, text };
}

/** Timing confidence and an honest return are different facts. Keep both visible. */
export function ownerPromiseAccount(person: Person, jobs: Job[]): string | undefined {
  const trust = playerWordReading(person);
  if (!trust) return undefined;
  const lateReturn = jobs.findLast(
    (job) =>
      job.ownerId === person.id &&
      job.returnedUnfinished &&
      job.deliveredAt !== undefined &&
      job.deliveredAt > job.due,
  );
  const outstanding = jobs.some(
    (job) =>
      job.ownerId === person.id && ['active', 'ready'].includes(job.status) && job.due < person.now,
  );
  return `${person.name} ${trust} about promised times.${lateReturn ? ` You returned ${lateReturn.title} honestly unfinished, after the promised time.` : ''}${outstanding ? ' This owner is still waiting for overdue work.' : ''}`;
}
