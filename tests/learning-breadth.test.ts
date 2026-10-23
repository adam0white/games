import { methodEvidence } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { createGame, dispatch, loadGame, saveGame } from '../src/game/engine';
import type { Command, GameState, Job } from '../src/game/types';

function campaign(attended: string[]) {
  let state = createGame(416);
  const commands: Command[] = [];
  const act = (command: Command) => {
    commands.push(command);
    const result = dispatch(state, command);
    expect(result.ok, `${command.type}: ${result.message}`).toBe(true);
    state = result.state;
  };
  const lesson = () => {
    for (let attempt = 0; attempt < 12 && !state.watching; attempt++) {
      if (state.pendingRequest?.status === 'ready') act({ type: 'start-lesson' });
      else if (!state.pendingRequest) act({ type: 'watch', enabled: true });
      if (state.watching) break;
      const activity = state.npcWork.find((work) => work.personId === 'sam');
      if (!activity) break;
      act({ type: 'wait', minutes: activity.endsAt - state.now });
    }
    expect(state.watching).toBe(true);
  };
  const repair = (
    target: Job,
    componentId: string,
    condition: 'movement' | 'load',
    intervention: 'clean' | 'replace',
  ) => {
    if (attended.includes(componentId)) lesson();
    act({ type: 'inspect', jobId: target.id, componentId });
    const component = target.model.components.find((part) => part.id === componentId);
    if (!component) throw new Error('Missing component');
    act({
      type: 'measure',
      jobId: target.id,
      request: {
        mode: 'voltage',
        a: component.terminals[0],
        b: component.terminals[1],
        condition,
      },
    });
    act({ type: 'work', jobId: target.id, componentId, intervention });
    act({ type: 'verify', jobId: target.id, condition });
    act({ type: 'deliver', jobId: target.id });
    act({ type: 'watch', enabled: false });
  };
  const mum = state.jobs[0];
  if (!mum) throw new Error('Missing family object');
  repair(mum, 'switch', 'movement', 'replace');
  const nora = state.jobs.find((target) => target.status === 'offer' && target.kind === 'lantern');
  const evan = state.jobs.find((target) => target.status === 'offer' && target.kind === 'fan');
  if (!nora || !evan) throw new Error('Missing initial neighbourhood offers');
  act({ type: 'next-day' });
  act({ type: 'accept', jobId: nora.id });
  repair(nora, 'contact', 'load', 'clean');
  act({ type: 'accept', jobId: evan.id });
  repair(evan, 'cell', 'load', 'replace');
  act({ type: 'next-day' });
  // Held-out selection is a causal control, not information supplied to the actor.
  const target = state.jobs.find(
    (candidate) =>
      candidate.status === 'offer' &&
      candidate.title === 'Halil’s visiting lantern' &&
      candidate.kind === 'lantern' &&
      candidate.requiredConditions?.includes('movement') &&
      candidate.model.components.filter((part) => part.condition !== 'good').length === 1 &&
      candidate.model.components.some((part) => part.id === 'switch' && part.condition === 'worn'),
  );
  if (!target) throw new Error('Missing authored held-out carried-light repair');
  act({ type: 'accept', jobId: target.id });
  act({ type: 'buy', part: 'switch' });
  expect(target.evidence).toHaveLength(0);
  const before = saveGame(state);
  const transferCommands: Command[] = [];
  const transfer = (command: Command) => {
    transferCommands.push(command);
    act(command);
  };
  for (let attempt = 0; attempt < 12; attempt++) {
    if (state.jobs.find((candidate) => candidate.id === target.id)?.assignedTo === 'sam') break;
    if (!state.pendingRequest) transfer({ type: 'assign', jobId: target.id, personId: 'sam' });
    const activity = state.npcWork.find((work) => work.personId === 'sam');
    if (!activity) break;
    transfer({ type: 'wait', minutes: activity.endsAt - state.now });
  }
  const consent = state.npcWork.find(
    (work) => work.personId === 'sam' && work.option.action === 'accept-repair',
  );
  if (consent) transfer({ type: 'wait', minutes: consent.endsAt - state.now });
  const sam = state.people.sam;
  if (!sam) throw new Error('Missing Sam');
  const support = methodEvidence(sam, 'inspect:switch', target.id).support;
  const choice = state.npcWork.find((work) => work.jobId === target.id)?.option.action;
  for (let step = 0; step < 20; step++) {
    const current = state.jobs.find((candidate) => candidate.id === target.id);
    if (current?.status === 'delivered' || current?.blocked) break;
    const activity = state.npcWork.find((work) => work.personId === 'sam');
    if (!activity) break;
    transfer({ type: 'wait', minutes: activity.endsAt - state.now });
  }
  let replay = loadGame(before);
  for (const command of transferCommands) {
    const result = dispatch(replay, command);
    expect(result.ok, `Resumed replay ${command.type}: ${result.message}`).toBe(true);
    replay = result.state;
  }
  expect(saveGame(replay)).toBe(saveGame(state));
  let fromStart = createGame(416);
  for (const command of commands) {
    const result = dispatch(fromStart, command);
    expect(result.ok, `Seed replay ${command.type}: ${result.message}`).toBe(true);
    fromStart = result.state;
  }
  expect(saveGame(fromStart)).toBe(saveGame(state));
  return { state, targetId: target.id, before: loadGame(before), support, choice };
}

function physical(state: GameState) {
  return {
    now: state.now,
    rng: state.rng,
    cash: state.cash,
    stock: state.stock,
    jobs: state.jobs.map((target) => ({
      title: target.title,
      kind: target.kind,
      model: target.model,
      status: target.status,
      due: target.due,
    })),
  };
}

describe('ordinary attended teaching across multiple repair briefs', () => {
  it('retains earlier complete methods after teaching three valid intake procedures', () => {
    const broad = campaign(['switch', 'contact', 'cell']);
    const switchOnly = campaign(['switch']);
    const withheld = campaign(['contact', 'cell']);
    expect(physical(broad.before)).toEqual(physical(switchOnly.before));
    expect(physical(broad.before)).toEqual(physical(withheld.before));
    for (const run of [broad, switchOnly]) {
      expect(run.support).toBeGreaterThan(0.2);
      expect(run.choice).toBe('inspect:switch');
      const target = run.state.jobs.find((candidate) => candidate.id === run.targetId);
      expect(target?.status).toBe('delivered');
      expect(target?.completedBy).toBe('sam');
      expect(target?.contributions.map((entry) => entry.action)).toEqual([
        'intake',
        'inspect:switch',
        'measure:switch:movement',
        'replace:switch',
        'verify:movement',
      ]);
      expect(target?.contributions.every((entry) => entry.actorId === 'sam')).toBe(true);
      expect(run.state.independentRepairs).toBe(1);
    }
    expect(withheld.support).toBe(0);
    expect(withheld.choice).toBe('ask-help');
    expect(
      withheld.state.jobs.find((candidate) => candidate.id === withheld.targetId)?.blocked?.kind,
    ).toBe('help');
    expect(withheld.state.independentRepairs).toBe(0);
  }, 30_000);
});
