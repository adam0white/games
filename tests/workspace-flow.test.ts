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

it('the companion invitation has one owner beside the work and optional discussion stays with People', () => {
  const view = getView(createGame());
  view.actions = [
    { id: 'arrange-learning', label: 'Join this work' },
    { id: 'explain-step', label: 'Talk through (optional)', kind: 'quiet' },
  ];
  view.dayPlan = {
    summary: 'Sam',
    entries: [
      {
        id: 'sam-work',
        label: 'Sam',
        detail: 'An invitation',
        status: 'invitation',
        actionIds: ['arrange-learning', 'explain-step'],
      },
    ],
  };
  const grouped = projectActions(view, new Set(), new Set(['arrange-learning']));
  expect(grouped.plans.flatMap((p) => p.actions)).toEqual([]);
  expect(grouped.people.map((a) => a.id)).toEqual(['explain-step']);
  expect([...grouped.bench, ...grouped.work, ...grouped.time]).toEqual([]);
});

it('keeps the focused case discussion and handback beside the case before generic quiet-action routing', () => {
  const view = getView(createGame());
  view.focus = {
    id: 'nora-sample-case',
    title: 'Nora’s sample case',
    owner: 'Nora',
    story: '',
    condition: 'Examined',
    visual: 'flickering',
    form: 'box',
    appearance: 'box',
    inspected: true,
    observations: [],
    casePresentation: { mode: 'carrying-case', catch: 'original', comparisonKnown: true },
  };
  view.actions = [
    { id: 'neighbourhood-source', label: 'Ask Nora for the measured catch', kind: 'quiet' },
    { id: 'neighbourhood-return-repaired', label: 'Return the checked case', kind: 'quiet' },
    { id: 'delegate-repair', label: 'Work together' },
  ];
  view.dayPlan = {
    summary: 'Known work',
    entries: [
      {
        id: 'case',
        label: 'Case',
        detail: '',
        status: 'underway',
        actionIds: view.actions.map((a) => a.id),
      },
    ],
  };
  const groups = projectActions(view);
  expect(groups.bench.map((action) => action.id)).toEqual(view.actions.map((action) => action.id));
  expect(groups.people).toEqual([]);
  expect(groups.work).toEqual([]);
  expect(groups.plans[0]?.actions).toEqual([]);
});
it('shows the canonical due cabinet appointment beside current work once, including cancellation', () => {
  const view = getView(createGame());
  view.actions = [
    { id: 'workshop-cabinet-attend', label: 'Go to your agreed time' },
    { id: 'workshop-cabinet-cancel', label: 'Cancel it' },
    { id: 'inspect', label: 'Examine the current object' },
  ];
  view.dayPlan = {
    summary: 'Today',
    entries: [
      {
        id: 'known-dad-3825',
        label: 'Cabinet time',
        detail: 'Dad may keep his plans.',
        status: 'agreed',
        actionIds: ['workshop-cabinet-attend', 'workshop-cabinet-cancel'],
      },
    ],
  };
  const groups = projectActions(view);
  expect(groups.benchPlans[0]?.actions.map((action) => action.id)).toEqual([
    'workshop-cabinet-attend',
    'workshop-cabinet-cancel',
  ]);
  expect(groups.plans).toEqual([]);
  expect(groups.bench.map((action) => action.id)).toEqual(['inspect']);
  const inProject = projectActions(
    view,
    new Set(['workshop-cabinet-attend', 'workshop-cabinet-cancel']),
  );
  expect(inProject.benchPlans).toEqual([]);
  expect(inProject.plans[0]?.actions).toEqual([]);
});

it('actual appointment waiting lives once beside ordinary time controls while its promise stays recorded', () => {
  const view = getView(createGame());
  view.actions = [
    { id: 'wait-appointment', label: 'Wait until Evan’s arranged visit', detail: 'Evan ·15:00' },
  ];
  view.dayPlan = {
    summary: 'Today',
    entries: [
      {
        id: 'evan',
        label: 'Evan ·15:00',
        detail: 'Agreed visit',
        status: 'agreed',
        actionIds: ['wait-appointment'],
      },
    ],
  };
  const groups = projectActions(view);
  expect(groups.time.map((a) => a.id)).toEqual(['wait-appointment']);
  expect(groups.plans[0]?.actions).toEqual([]);
  expect(groups.plans[0]?.label).toBe('Evan ·15:00');
});
