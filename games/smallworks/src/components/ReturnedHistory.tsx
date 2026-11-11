import { dayTime } from '../game/engine';
import type { GameState, Job } from '../game/types';
import { ReturnReceipt } from './ReturnReceipt';
export function ReturnedHistory({
  job,
  people,
  onOpen,
}: {
  job: Job;
  people: GameState['people'];
  onOpen: () => void;
}) {
  return (
    <details className="returned-history">
      <summary>
        <strong>{job.title}</strong>
        <span>
          {people[job.ownerId]?.name ?? job.ownerId} ·{' '}
          {job.returnedUnfinished ? 'returned unfinished' : 'checked return'}
          {job.deliveredAt !== undefined ? ` · ${dayTime(job.deliveredAt)}` : ''}
        </span>
      </summary>
      <ReturnReceipt job={job} people={people} onNext={onOpen} nextLabel="Open saved notebook" />
    </details>
  );
}
