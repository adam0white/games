import { dayTime, requiredChecks } from '../game/engine';
import type { GameState, Job } from '../game/types';

function intention(job: Job): string {
  if (job.returnedUnfinished) return 'I can make another plan now that I know what remains.';
  if (job.isPersonal) return 'This can stay on the shelf for another performance.';
  if (job.ownerId === 'mum')
    return job.kind === 'lantern'
      ? 'I can carry the light out to the garden table.'
      : 'I can keep the room comfortable with the fan.';
  if (job.ownerId === 'nora')
    return job.kind === 'lantern'
      ? 'I can keep this beside my book while I read.'
      : job.kind === 'music-box'
        ? 'I can keep this tune in its old box.'
        : 'I can use this for a quiet hour with my own projects.';
  if (job.ownerId === 'sam') return 'I can run my toy at the pace I asked for.';
  if (job.ownerId === 'rafi')
    return job.kind === 'fan'
      ? 'I can put the fan back beside my desk.'
      : 'I can put this back where we use it at home.';
  return 'I can put this back into use.';
}
export function ReturnReceipt({
  job,
  people,
  onNext,
  nextLabel = 'Choose another object →',
}: {
  job: Job;
  people: GameState['people'];
  onNext: () => void;
  nextLabel?: string;
}) {
  const onTime = job.deliveredAt !== undefined && job.deliveredAt <= job.due;
  const checked =
    !job.returnedUnfinished && requiredChecks(job).every((check) => job.verified.includes(check));
  const payment = checked ? (onTime ? job.reward : Math.floor(job.reward * 0.7)) : 0;
  return (
    <article className={`return-receipt ${checked ? 'checked-return' : 'unfinished-return'}`}>
      <div className="receipt-heading">
        <p className="eyebrow">
          {people[job.ownerId]?.name ?? job.ownerId} · {job.title}
        </p>
        <span>
          {job.returnedUnfinished
            ? 'Returned unfinished'
            : checked
              ? 'Checked return'
              : 'Return recorded'}
          {onTime ? ' · on time' : ' · late'}
        </span>
      </div>
      <h2>
        {job.returnedUnfinished
          ? 'An honest unfinished return'
          : job.ownerId === 'mum' && job.kind === 'lantern'
            ? 'A light its owner can carry'
            : job.ownerId === 'nora' && job.kind === 'lantern'
              ? 'A reading light for Nora'
              : job.ownerId === 'nora' && job.kind === 'music-box'
                ? 'Nora’s keepsake can play again'
                : job.ownerId === 'rafi' && job.kind === 'fan'
                  ? 'The desk fan can return'
                  : job.ownerId === 'sam'
                    ? 'Sam’s toy can run again'
                    : job.isPersonal
                      ? 'Kept for another performance'
                      : 'Ready for its intended use'}
      </h2>
      <p className="receipt-intention">“{intention(job)}”</p>
      <small className="authored-intention">Intended use</small>
      <div className="receipt-context">
        <p>
          <strong>Original request</strong> {job.description}
        </p>
        <p>
          <strong>Recorded checks</strong>{' '}
          {checked
            ? requiredChecks(job)
                .map((check) => `${check} passed`)
                .join(', ')
            : job.returnedUnfinished
              ? 'Returned without claiming a completed repair.'
              : job.verified.length
                ? job.verified.join(', ')
                : 'No successful required check recorded.'}
        </p>
        <p>
          <strong>Returned</strong>{' '}
          {job.deliveredAt === undefined ? 'Time not recorded' : dayTime(job.deliveredAt)}
          {job.completedBy === 'sam' ? ' · Sam handled the return.' : ''}
        </p>
      </div>
      <div className="receipt-payment">
        <span>
          {job.reward === 0
            ? 'Family favour'
            : job.returnedUnfinished
              ? 'No repair payment'
              : onTime
                ? 'Agreed payment'
                : 'Late return · reduced payment'}
        </span>
        <strong>£{payment}</strong>
      </div>
      <button type="button" onClick={onNext}>
        {nextLabel}
      </button>
    </article>
  );
}
