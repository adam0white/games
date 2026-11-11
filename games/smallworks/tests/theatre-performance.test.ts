import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { TheatrePerformance } from '../src/components/TheatrePerformance';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import { replayRecordedRun } from '../src/game/replay';
import type { Command, GameState } from '../src/game/types';
import { theatrePerformance } from '../src/ui/theatre-performance';

it('shows only a currently earned working retained theatre; preserves broken readings and exact replay', () => {
  let state = createGame(42);
  const id = state.jobs.find((job) => job.isPersonal)?.id;
  if (!id) throw new Error('Missing personal theatre');
  const project = () => {
    const job = state.jobs.find((job) => job.id === id);
    if (!job) throw new Error('Lost retained project');
    return job;
  };
  const act = (command: Command) => {
    const result = dispatch(state, command);
    expect(result.ok, result.message).toBe(true);
    state = result.state;
  };
  const display = () => {
    const raw = saveGame(state);
    const result = theatrePerformance(project());
    const html = renderToStaticMarkup(createElement(TheatrePerformance, { job: project() }));
    expect(saveGame(state)).toBe(raw);
    return { result, html };
  };
  expect(display().html).not.toContain('observed-figures');
  act({ type: 'verify', jobId: id, condition: 'load' });
  expect(display().result?.working).toBe(false);
  expect(display().html).toContain(project().evidence.at(-1)?.summary);
  expect(display().html).not.toContain('observed-figures');
  act({ type: 'calibrate', jobId: id, componentId: 'governor', setting: 1 });
  expect(display().result).toBeUndefined();
  // Measuring a working mechanism is not a successful use check.
  act({
    type: 'measure',
    jobId: id,
    request: { mode: 'motion', a: '0', b: 'C', condition: 'load' },
  });
  expect(display().html).not.toContain('observed-figures');
  act({ type: 'verify', jobId: id, condition: 'load' });
  expect(display().result).toMatchObject({ working: true, output: 12 });
  expect(display().html).toContain('Watch the paper theatre');
  expect(display().html).toContain('observed-figures');
  expect(project().status).toBe('ready');
  expect(state.community).toBeUndefined();
  const raw = saveGame(state);
  state = loadGame(raw);
  expect(display().html).toContain('observed-figures');
  expect(saveGame(state)).toBe(raw);
  expect(
    replayRecordedRun(
      { seed: state.seed, inputs: state.inputs, provenance: state.provenance },
      raw,
    ),
  ).toMatchObject({ ok: true });
  act({ type: 'calibrate', jobId: id, componentId: 'governor', setting: 2 });
  expect(display().result).toBeUndefined();
  expect(display().html).not.toContain('observed-figures');
  act({ type: 'verify', jobId: id, condition: 'load' });
  expect(display().result?.working).toBe(false);
  expect(display().html).not.toContain('observed-figures');
});
