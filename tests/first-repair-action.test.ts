import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FirstRepairGuide } from '../src/components/FirstRepairGuide';
import { MeterContext } from '../src/components/MeterContext';
import { createGame, dispatch, saveGame } from '../src/game/engine';

function buttons(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [...(node.type === 'button' ? [node] : []), ...buttons(node.props.children as ReactNode)];
}

function fixture(ready = false, disabled = false) {
  let state = createGame(42);
  const id = state.jobs[0]?.id;
  if (!id) throw new Error('Missing lantern');
  state = dispatch(state, {
    type: 'work',
    jobId: id,
    componentId: 'switch',
    intervention: 'replace',
  }).state;
  if (ready) state = dispatch(state, { type: 'verify', jobId: id, condition: 'movement' }).state;
  const before = state;
  const job = state.jobs[0];
  if (!job) throw new Error('Missing repaired lantern');
  let pane = 'repair';
  const guide = FirstRepairGuide({
    state,
    job,
    pane: 'repair',
    opened: true,
    disabled,
    onOpen: () => {},
    onSkip: () => {},
    onPane: (next) => {
      pane = next;
    },
    onTest: () => {
      state = dispatch(state, { type: 'verify', jobId: id, condition: 'movement' }).state;
    },
  });
  const action = buttons(guide).find((button) => button.props.className === 'guide-next');
  if (!action) throw new Error('Missing guide action');
  return { guide, action, before, after: () => state, pane: () => pane };
}

describe('first repair test action', () => {
  it('names the test and its carry cost before the player taps it', () => {
    const { guide } = fixture();
    const html = renderToStaticMarkup(guide);
    expect(html).toContain('Test the lantern');
    expect(html).toContain('15 min · carry');
    expect(html).not.toContain('Try the lantern');
  });

  it('performs one movement check when the test button is pressed', () => {
    const f = fixture();
    (f.action.props.onClick as () => void)();
    expect(f.pane()).toBe('object');
    expect(f.after().now).toBe(f.before.now + 15);
    expect(f.after().inputs?.length).toBe((f.before.inputs?.length ?? 0) + 1);
    expect(f.after().inputs?.at(-1)).toEqual({
      type: 'verify',
      jobId: f.before.jobs[0]?.id,
      condition: 'movement',
    });
  });

  it('only navigates back when the lantern has already passed', () => {
    const f = fixture(true);
    expect(renderToStaticMarkup(f.guide)).toContain('Back to lantern');
    (f.action.props.onClick as () => void)();
    expect(f.pane()).toBe('object');
    expect(f.after()).toBe(f.before);
  });

  it('disables the test while the object is unavailable', () => {
    expect(fixture(false, true).action.props.disabled).toBe(true);
  });
});

// The later meter explanation uses the recorded request and the object's required check.
it('shows the recorded voltage context and the required condition without diagnosing a part', () => {
  const state = createGame(42);
  const job = state.jobs[0];
  if (!job) throw new Error('Missing opening object');
  const measured = dispatch(state, {
    type: 'measure',
    jobId: job.id,
    request: { mode: 'voltage', a: 'A', b: '0', condition: 'bench' },
  });
  expect(measured.ok).toBe(true);
  const current = measured.state.jobs[0];
  if (!current) throw new Error('Missing measured object');
  const before = saveGame(measured.state);
  const html = renderToStaticMarkup(
    createElement(MeterContext, {
      job: current,
      reading: current.evidence.at(-1),
      condition: 'bench',
    }),
  );
  expect(html).toContain('while carried');
  expect(html).toContain('on the table');
  expect(html).toContain('does not identify a faulty part');
  expect(saveGame(measured.state)).toBe(before);
});
