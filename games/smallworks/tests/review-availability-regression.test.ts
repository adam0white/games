import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SamOffer } from '../src/components/SamOffer';
import { SamRequest } from '../src/components/SamRequest';
import { createGame, dispatch, saveGame } from '../src/game/engine';
import { chooseActivity, createPeople, reportDelivery, startActivity } from '../src/game/people';
import type { Command, WorkOption } from '../src/game/types';
import { native, nativeOf } from './hf-fixture';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture');
  return value;
}

describe('independent availability and return review', () => {
  it('describes the lesson window that actually fits before closing', () => {
    let state = dispatch(createGame(42), { type: 'wait', minutes: 420 }).state;
    state = dispatch(state, { type: 'request-lesson' }).state;
    const current = state.npcWork.find((work) => work.personId === 'sam');
    if (!current) throw new Error('Expected busy Sam');
    state = dispatch(state, { type: 'wait', minutes: current.endsAt - state.now }).state;
    expect(state.pendingRequest?.status).toBe('ready');
    const markup = renderToStaticMarkup(createElement(SamRequest, { state, act: () => {} }));
    const started = dispatch(state, { type: 'start-lesson' }).state;
    // Engine 4 gave 55 minutes here; engine 5's fuller, tireable Sam spends the afternoon differently. The
    // property is that the offer shows the window that actually fits before closing.
    const window = required(started.watchUntil) - started.now;
    expect(window).toBeGreaterThan(0);
    expect(started.now + window).toBeLessThanOrEqual(Math.floor(started.now / 1440) * 1440 + 1020);
    expect(markup).toContain(String(window));
    expect(markup).not.toContain('90-minute');
  });

  it('lets an owner perceive both unfinished return and missed promised time', () => {
    let state = dispatch(createGame(42), { type: 'next-day' }).state;
    const job = state.jobs[0];
    if (!job) throw new Error('Expected family repair');
    expect(state.now).toBeGreaterThan(job.due);
    state = dispatch(state, { type: 'deliver', jobId: job.id, unfinished: true }).state;
    const reports = nativeOf(state.people[job.ownerId])?.memory.episodes.filter(
      (episode) => episode.targetId === job.id,
    );
    expect(reports?.some((episode) => episode.summary.includes('unfinished'))).toBe(true);
    expect(reports?.some((episode) => episode.summary.includes('promised time'))).toBe(true);
    // Engine 5 words lateness by how late it is; engine 4 said 'later than promised'.
    expect(
      state.log.some((entry) =>
        /later than (promised|you said)|past your time|stopped expecting/.test(entry.text),
      ),
    ).toBe(true);
  });

  it('keeps on-time honesty distinct from lateness without doubling the old late-return effect', () => {
    const onTime = required(createPeople(42, 540).mum);
    const lateUnfinished = required(createPeople(42, 540).mum);
    const lateChecked = required(createPeople(42, 540).mum);
    const explicitLateChecked = required(createPeople(42, 540).mum);
    reportDelivery(onTime, 'repair', 'unfinished', 540);
    reportDelivery(lateUnfinished, 'repair', 'unfinished', 540, 'player', 'Lantern', false);
    reportDelivery(lateChecked, 'repair', 'late', 540);
    reportDelivery(explicitLateChecked, 'repair', 'late', 540, 'player', 'repair', false);
    expect(
      native(onTime).memory.episodes.some((episode) => episode.action === 'repair-return:late'),
    ).toBe(false);
    const relationship = (person: typeof onTime) =>
      person.social.relationships.find((entry) => entry.otherId === 'player');
    expect(relationship(lateUnfinished)?.trust).toBeLessThan(relationship(onTime)?.trust ?? 0);
    expect(explicitLateChecked.social).toEqual(lateChecked.social);
    expect(native(explicitLateChecked).memory.episodes).toEqual(
      native(lateChecked).memory.episodes,
    );
  });

  it('rejects donor repair requests without spending resources, time, or recorded inputs', () => {
    const state = createGame(42);
    const donor = required(state.jobs.find((job) => job.isDonor));
    const before = saveGame(state);
    const commands: Command[] = [
      { type: 'assign', jobId: donor.id, personId: 'sam' },
      { type: 'work', jobId: donor.id, componentId: 'cell', intervention: 'replace' },
      { type: 'work', jobId: donor.id, componentId: 'switch', intervention: 'clean' },
      { type: 'work', jobId: donor.id, componentId: 'switch', intervention: 'adjust' },
      { type: 'calibrate', jobId: donor.id, componentId: 'cell', setting: 2 },
    ];
    for (const command of commands) {
      const result = dispatch(state, command);
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/spare object|casing is ruined/);
      expect(result.state).toBe(state);
      expect(saveGame(result.state)).toBe(before);
    }
    expect(dispatch(state, { type: 'inspect', jobId: donor.id, componentId: 'switch' }).ok).toBe(
      true,
    );
    const component = required(donor.model.components.find((part) => part.id === 'switch'));
    expect(
      dispatch(state, {
        type: 'measure',
        jobId: donor.id,
        request: {
          mode: 'voltage',
          a: required(component.terminals[0]),
          b: required(component.terminals[1]),
          condition: 'movement',
        },
      }).ok,
    ).toBe(true);
    expect(dispatch(state, { type: 'verify', jobId: donor.id, condition: 'movement' }).ok).toBe(
      true,
    );
    expect(dispatch(state, { type: 'salvage', jobId: donor.id, componentId: 'switch' }).ok).toBe(
      true,
    );
  });

  it('cannot credit or return a donor through a pre-existing NPC delivery activity', () => {
    const state = createGame(42);
    const donor = required(state.jobs.find((job) => job.isDonor));
    const sam = required(state.people.sam);
    donor.assignedTo = sam.id;
    donor.status = 'ready';
    donor.verified = ['movement'];
    for (const component of donor.model.components) component.condition = 'good';
    const option: WorkOption = {
      id: 'deliver',
      action: 'deliver',
      label: 'Return donor',
      duration: 10,
      effort: 0.04,
    };
    expect(chooseActivity(sam, donor.id, {}, [option], state.now).chosenId).toBe('deliver');
    expect(startActivity(sam, option, state.now)).toBe(true);
    state.npcWork.push({
      personId: sam.id,
      jobId: donor.id,
      option,
      startedAt: state.now,
      endsAt: state.now + 10,
    });
    const result = dispatch(state, { type: 'wait', minutes: 10 }).state;
    expect(result.jobs.find((job) => job.id === donor.id)?.status).not.toBe('delivered');
    expect(result.independentRepairs).toBe(0);
    expect(result.reputation).toBe(state.reputation);
    expect(result.cash).toBe(state.cash);
    expect(result.jobs).toHaveLength(state.jobs.length);
    expect(result.log.some((entry) => entry.text.includes('back in use'))).toBe(false);
  });
});

it('renders the offer only after its presentation gate opens', () => {
  const action = createElement(
    'button',
    { type: 'button' },
    'Ask Sam to take charge of the repair',
  );
  const locked = renderToStaticMarkup(
    createElement(SamOffer, { available: false, actions: action }),
  );
  const open = renderToStaticMarkup(createElement(SamOffer, { available: true, actions: action }));
  expect(locked).not.toContain('<button');
  expect(locked).toContain('three checked objects');
  expect(open).toContain('<button');
  expect(open).toContain('Sam decides whether to accept');
});
