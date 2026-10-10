import { expect, it } from 'vitest';
import { createGame, getView, serializeGame, transition } from '../src/game/engine';
import { projectActions } from '../src/ui/workspaceFlow';

it('the actual public opening pause has one actor card and one offered wait without changing the story', () => {
  let state = createGame(1701);
  // First nine inputs of /tmp/repair20-public-activity-pause-export.json.
  for (const id of [
    'talk-family',
    'inspect',
    'rest',
    'test-battery',
    'clean-contact',
    'reassemble',
    'verify',
    'rest',
    'ask-mum',
  ])
    state = transition(state, { type: 'action', id });
  expect(state.now).toBe(931);
  expect(state.chapter).toBe('bench');
  const before = serializeGame(state);
  const view = getView(state);
  const pause = view.dayPlan?.entries;
  expect(pause).toHaveLength(1);
  expect(pause?.[0]).toMatchObject({
    id: 'conversation-pause',
    actionIds: ['wait-conversation-activity'],
  });
  expect(pause?.[0]?.label).toContain('Mum · Taking a quiet break until');
  const groups = projectActions(view);
  expect(groups.plans).toHaveLength(1);
  const all = [
    ...groups.bench,
    ...groups.work,
    ...groups.people,
    ...groups.time,
    ...groups.plans.flatMap((p) => p.actions),
    ...groups.benchPlans.flatMap((p) => p.actions),
  ];
  expect(all.filter((a) => a.id === 'wait-conversation-activity')).toHaveLength(1);
  expect(serializeGame(state)).toBe(before);
  state = transition(state, { type: 'action', id: 'wait-conversation-activity' });
  expect(getView(state).actions.some((a) => a.id === 'wait-conversation-activity')).toBe(false);
  expect(getView(state).dayPlan).toBeUndefined();
});
