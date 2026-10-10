import type { ReactNode } from 'react';
import type { ActionView, GameView } from '../game/types';
import { ActionLane } from './WorkspaceCards';

type OperationsView = NonNullable<GameView['operations']>;
const jobStatus: Record<OperationsView['jobs'][number]['stage'], string> = {
  invited: 'Visit invited',
  offered: 'Request heard · not accepted',
  accepted: 'Accepted',
  returned: 'Checked & returned',
  'returned-unchecked': 'Returned unfinished',
  declined: 'Declined',
};
const routeLabels: Record<OperationsView['route'], string> = {
  undecided: 'Choose your arrangement',
  regular: 'Priced repairs',
  favours: 'Occasional favours',
  private: 'A private bench',
};
const deliveryLabels = {
  working: 'The agreed stretch is underway',
  interrupted: 'The stretch stopped unfinished',
  complete: 'The agreed stretch is complete',
};

/** Only received host projections are shown. A completed transport stretch never implies a customer repair. */
export function OperationsBoard({
  operations,
  actions,
  renderAction,
}: {
  operations: OperationsView;
  actions: ActionView[];
  renderAction: (action: ActionView) => ReactNode;
}) {
  const assigned = new Set<string>();
  const cards = operations.jobs.map((job) => {
    const choices = actions.filter((action) => action.id.endsWith(`-${job.id}`));
    for (const action of choices) assigned.add(action.id);
    return { job, choices };
  });
  const remaining = actions.filter((action) => !assigned.has(action.id));
  const progressing = remaining.filter((action) =>
    /^operations-(next-period|review-open-work|finish-)/.test(action.id),
  );
  const sharedWork = remaining.filter((action) =>
    /^operations-(round|interrupt-delivery|recover-route|sam-pay|reserve-sam)/.test(action.id),
  );
  const personalWork = remaining.filter((action) => action.id.startsWith('operations-personal-'));
  const other = remaining.filter(
    (action) =>
      !progressing.includes(action) &&
      !sharedWork.includes(action) &&
      !personalWork.includes(action),
  );
  const current = cards.filter(({ job }) => ['invited', 'offered', 'accepted'].includes(job.stage));
  const settled = cards.filter(
    ({ job }) => !['invited', 'offered', 'accepted'].includes(job.stage),
  );
  const renderJob = ({ job, choices }: (typeof cards)[number]) => (
    <article className={`operation-job job-${job.stage}`} key={job.id}>
      <span className="card-overline">{jobStatus[job.stage]}</span>
      <h3>{job.title}</h3>
      {job.stage === 'accepted' && (
        <p>{job.fee > 0 ? `£${job.fee / 100} on a checked collection.` : 'An agreed favour.'}</p>
      )}
      <div className="choice-buttons">{choices.map(renderAction)}</div>
    </article>
  );
  return (
    <section className="operations-board" aria-label={operations.title}>
      <div className="operation-heading">
        <div>
          <span className="card-overline">
            Chapter {operations.episode} · {routeLabels[operations.route]}
          </span>
          <h2>{operations.title}</h2>
        </div>
        <span className="chapter-index" aria-hidden="true">
          0{operations.episode}
        </span>
      </div>
      <p className="operations-description">{operations.description}</p>
      <ActionLane
        title={
          operations.route === 'undecided' ? 'Choose a shape for the work' : 'Arrange the next step'
        }
        actions={other}
        renderAction={renderAction}
      />
      {(operations.personalProject || personalWork.length > 0) && (
        <section className="personal-project-card">
          <span className="card-overline">Your retained paper street</span>
          {operations.personalProject && (
            <>
              <h3>
                {operations.personalProject.fitted === 'updated'
                  ? 'The street as it is now'
                  : 'The remembered street'}
              </h3>
              <p>
                {operations.personalProject.custody === 'nora'
                  ? 'Nora has your same model for the agreed afternoon. It is away from your bench until the actual handover.'
                  : operations.personalProject.originalFronts === 'retained-envelope'
                    ? 'The original fronts are retained in their labelled envelope; the new removable insert is fitted.'
                    : 'The original paper fronts are on the model. Any new insert stays retained flat.'}
              </p>
              <p>
                {operations.personalProject.support === 'fitted'
                  ? 'A broad removable support keeps the display stable on a level table.'
                  : operations.personalProject.support === 'retained'
                    ? 'The folded support is retained beside the model, ready to fit.'
                    : 'The model uses its original base on the level bench.'}
              </p>
              {operations.personalProject.comparison && (
                <p>{operations.personalProject.comparison}</p>
              )}
              {!operations.personalProject.circuitChecked && (
                <p>The fitted arrangement still needs its complete-circuit comparison.</p>
              )}
              <p>
                {operations.personalProject.cardSheets} spare packaging{' '}
                {operations.personalProject.cardSheets === 1 ? 'card remains' : 'cards remain'} in
                your own model box.
              </p>
              {operations.personalProject.occasion === 'shown' && (
                <p>Nora has seen the complete street at your stable bench.</p>
              )}
              {operations.personalProject.occasion === 'returned' && (
                <p>
                  Nora returned the model and retained fronts after the single afternoon. You
                  checked its circuit again.
                </p>
              )}
            </>
          )}
          <div className="choice-buttons">{personalWork.map(renderAction)}</div>
        </section>
      )}
      {current.length > 0 && <div className="operation-jobs">{current.map(renderJob)}</div>}
      {(operations.delivery ||
        operations.crates.location !== 'store' ||
        operations.collectionPlan === 'store-display' ||
        sharedWork.length > 0) && (
        <section className="delivery-strip">
          <span className="card-overline">Transport & shared work</span>
          {(operations.collectionPlan === 'store-display' ||
            operations.crates.location !== 'store') && (
            <p>
              <strong>
                {operations.crates.count} crates · {operations.crates.owner}
              </strong>
              <br />
              {
                {
                  store: 'At the shared store',
                  bench: 'At your bench',
                  'with-player': 'With you on the route',
                  'with-leila': 'With Leila on the agreed route',
                  'route-stop': 'Waiting at the route stop — the load still needs collecting',
                }[operations.crates.location]
              }
            </p>
          )}

          {operations.delivery && (
            <p>
              <strong>{operations.delivery.by === 'leila' ? 'Leila' : 'You'}</strong> ·{' '}
              {deliveryLabels[operations.delivery.status]}
            </p>
          )}
          <div className="choice-buttons">{sharedWork.map(renderAction)}</div>
        </section>
      )}
      {operations.blockedReasons && operations.blockedReasons.length > 0 && (
        <section className="chapter-blockers">
          <h3>Before you turn the page</h3>
          <ul>
            {operations.blockedReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      )}
      <ActionLane
        title="The next chapter"
        actions={progressing}
        renderAction={renderAction}
        className="chapter-next"
      />
      {settled.length > 0 && (
        <details className="settled-round">
          <summary>Settled requests · {settled.length}</summary>
          <div className="operation-jobs">{settled.map(renderJob)}</div>
        </details>
      )}
    </section>
  );
}
