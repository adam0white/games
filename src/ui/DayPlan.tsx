import type { ReactNode } from 'react';
import type { ActionView, GameView } from '../game/types';

type PlanEntry = NonNullable<GameView['dayPlan']>['entries'][number];
const statusLabels: Record<PlanEntry['status'], string> = {
  agreed: 'Agreed',
  invitation: 'Invitation',
  routine: 'Usual hours',
  underway: 'Underway',
  late: 'Ended agreement',
};

export function DayPlan({
  entries,
  actions,
  renderAction,
}: {
  entries: PlanEntry[];
  actions: ActionView[];
  renderAction: (action: ActionView) => ReactNode;
}) {
  const shownActions = new Set<string>();
  const plans = entries.map((entry) => ({
    ...entry,
    actions: (entry.actionIds ?? []).flatMap((id) => {
      const action = actions.find((candidate) => candidate.id === id);
      if (!action || shownActions.has(id)) return [];
      shownActions.add(id);
      return [action];
    }),
  }));
  const current = plans.filter((entry) => entry.status !== 'late');
  const ended = plans.filter((entry) => entry.status === 'late');
  const [next, ...later] = current;
  if (plans.length === 0) return null;
  function renderEntry(entry: (typeof plans)[number]) {
    return (
      <section className="day-plan-entry" key={entry.id} aria-label={entry.label}>
        <span className="plan-status">{statusLabels[entry.status]}</span>
        <p>
          <strong>{entry.label}</strong>
        </p>
        <p className="plan-detail">{entry.detail}</p>
        {entry.actions.length > 0 && (
          <div className="choice-buttons plan-actions">{entry.actions.map(renderAction)}</div>
        )}
      </section>
    );
  }
  return (
    <aside className="day-plan" aria-label="Plans">
      <h2>Plans</h2>
      {next && renderEntry(next)}
      {later.length > 0 && (
        <details className="other-plans">
          <summary>Other known plans · {later.length}</summary>
          {later.map(renderEntry)}
        </details>
      )}
      {ended.length > 0 && (
        <details className="other-plans">
          <summary>Previous arrangements · {ended.length}</summary>
          {ended.map(renderEntry)}
        </details>
      )}
    </aside>
  );
}
