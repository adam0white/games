import { expect, it } from 'vitest';
import { createGame, getView } from '../src/game/engine';
import { freshOperations, getOperationsView } from '../src/game/operations';
import { operationsCeremony, projectActions, projectChapter } from '../src/ui/workspaceFlow';

it('the household tutorial has no management phase and the public graduation ends it', () => {
  const view = getView(createGame());
  expect(projectChapter(view).tutorial).toBe(true);
  const graduated = { ...view, lifeChapter: { label: 'School finished · age 18' } };
  delete (graduated as { chapterFlow?: unknown }).chapterFlow;
  expect(projectChapter(graduated).tutorial).toBe(false);
});
it('actions have one owner, duplicate plans cannot repeat choices, and physical work stays with its object', () => {
  const view = getView(createGame());
  view.actions = [
    { id: 'clean-contact', label: 'Clean' },
    { id: 'show-corrective-step', label: 'Show Sam' },
    { id: 'service-begin', label: 'Plan your first working week' },
    { id: 'leave-school-holiday', label: 'School' },
    { id: 'unknown-future-operation', label: 'A new option' },
  ];
  view.dayPlan = {
    summary: 'Today',
    entries: [
      {
        id: 'sam',
        label: 'Sam',
        detail: 'Help',
        status: 'underway',
        actionIds: ['show-corrective-step', 'clean-contact'],
      },
      {
        id: 'duplicate',
        label: 'Other',
        detail: '',
        status: 'agreed',
        actionIds: ['show-corrective-step'],
      },
    ],
  };
  const groups = projectActions(view, new Set(['clean-contact']));
  const ids = [
    ...groups.bench,
    ...groups.work,
    ...groups.people,
    ...groups.time,
    ...groups.plans.flatMap((p) => p.actions),
  ].map((a) => a.id);
  expect(ids).toHaveLength(4);
  expect(new Set(ids).size).toBe(ids.length);
  expect(groups.plans[0]?.actions.map((a) => a.id)).toEqual(['show-corrective-step']);
  expect(groups.time.map((a) => a.id)).toEqual(['leave-school-holiday']);
  expect(groups.work.map((a) => a.id)).toContain('unknown-future-operation');
  expect(groups.work.map((a) => a.id)).toContain('service-begin');
});
it('projecting a fresh view does not mutate story or view', () => {
  const game = createGame();
  const view = getView(game);
  const before = JSON.stringify({ game, view });
  projectChapter(view);
  projectActions(view);
  expect(JSON.stringify({ game, view })).toBe(before);
});

it('a chapter ceremony follows actual episode and delivery changes, never idle view navigation', () => {
  const view = getView(createGame());
  const operations = getOperationsView({ now: 100, operations: freshOperations(100) });
  if (!operations) throw Error('Expected operations projection');
  const before = { ...view, operations };
  expect(operationsCeremony(before, before, 1)).toBeNull();
  const later = { ...before, operations: { ...operations, episode: 2 as const } };
  expect(operationsCeremony(before, later, 2)?.title).toBe('A month later');
  expect(
    operationsCeremony(
      before,
      {
        ...before,
        operations: {
          ...operations,
          delivery: {
            by: 'leila' as const,
            status: 'interrupted' as const,
            until: 200,
            trolleyCustody: 'route-stop' as const,
          },
        },
      },
      3,
    ),
  ).toBeNull();
  const complete = {
    ...before,
    operations: {
      ...operations,
      delivery: {
        by: 'leila' as const,
        status: 'complete' as const,
        until: 200,
        trolleyCustody: 'store' as const,
      },
    },
  };
  expect(operationsCeremony(before, complete, 4)?.title).toBe('The agreed delivery is complete');
  expect(operationsCeremony(complete, complete, 5)).toBeNull();
});
