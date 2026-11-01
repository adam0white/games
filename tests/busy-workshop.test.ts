import { createHash } from 'node:crypto';
import { readRunHistory, replay } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import {
  canStartBusyWorkshop,
  createGame,
  dispatch,
  loadGame,
  replayCommands,
  saveGame,
} from '../src/game/engine';
import {
  chooseActivity,
  createPeople,
  finishActivity,
  startActivity,
  teachObserved,
} from '../src/game/people';
import { replayRecordedRun } from '../src/game/replay';
import { adoptResponsibility } from '../src/game/responsibility';
import { stockCount, takePart } from '../src/game/stock';
import type { Command, GameState } from '../src/game/types';
import { cloneGame } from './hf-fixture';
import { acceptRepairOffer } from './repair-offer';

function present<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture');
  return value;
}
function act(state: GameState, command: Command): GameState {
  const result = dispatch(state, command);
  expect(result.ok, result.message).toBe(true);
  return result.state;
}
function busy(): GameState {
  let state = createGame(416);
  const family = present(state.jobs[0]);
  state = act(state, {
    type: 'work',
    jobId: family.id,
    componentId: 'switch',
    intervention: 'replace',
  });
  state = act(state, { type: 'verify', jobId: family.id, condition: 'movement' });
  state = act(state, { type: 'deliver', jobId: family.id });
  return act(state, { type: 'start-busy-workshop' });
}

describe('opt-in busy workshop', () => {
  it('pins the HF4 ordinary continuation independently of the busy scenario', () => {
    let state = createGame(416);
    for (const command of [
      { type: 'wait', minutes: 45 },
      { type: 'next-day' },
      { type: 'next-day' },
    ] as Command[])
      state = act(state, command);
    const saved = saveGame(state);
    expect(saveGame(loadGame(saved))).toBe(saved);
    expect(replay(state.hf.archive)).toMatchObject({ ok: true, value: { verified: true } });
    expect(replayRecordedRun({ ...state, inputs: state.inputs }, saved).ok).toBe(true);
    expect(createHash('sha256').update(saved).digest('hex')).toBe(
      'a1de1f3a698617f4bb9a9191fa8eda58564248b348728038279602f6712cadf7',
    );
  });
  it('turns accepting everything into a real stock/deadline choice, without changing ordinary play', () => {
    let state = busy();
    const offers = state.jobs.filter((j) => j.status === 'offer');
    expect(offers).toHaveLength(3);
    expect(offers.map((j) => j.due)).toEqual([870, 900, 930]);
    expect(state.now).toBe(810);
    expect(state.stock.switch).toBe(1);
    for (const job of offers) state = act(state, { type: 'accept', jobId: job.id });
    const first = present(offers[0]);
    state = act(state, {
      type: 'work',
      jobId: first.id,
      componentId: 'switch',
      intervention: 'replace',
    });
    state = act(state, { type: 'verify', jobId: first.id, condition: 'movement' });
    state = act(state, { type: 'deliver', jobId: first.id });
    expect(present(state.jobs.find((j) => j.id === first.id)).deliveredAt).toBeLessThanOrEqual(
      first.due,
    );
    const blocked = dispatch(state, {
      type: 'work',
      jobId: present(offers[1]).id,
      componentId: 'switch',
      intervention: 'replace',
    });
    expect(blocked.ok).toBe(false);
    expect(dispatch(state, { type: 'buy', part: 'switch' }).ok).toBe(false);
    state = act(state, {
      type: 'salvage',
      jobId: present(state.jobs.find((j) => j.isDonor)).id,
      componentId: 'switch',
    });
    state = act(state, {
      type: 'work',
      jobId: present(offers[1]).id,
      componentId: 'switch',
      intervention: 'replace',
      source: 'recovered',
    });
    expect(state.stock.switch).toBe(0);
    expect(
      present(present(state.jobs.find((j) => j.id === present(offers[1]).id)).evidence.at(-1))
        .summary,
    ).toContain('recovered');
    expect(state.now).toBeGreaterThan(present(offers[1]).due);
    const saved = saveGame(state);
    expect(saveGame(loadGame(saved))).toBe(saved);
    expect(replayRecordedRun({ ...state, inputs: state.inputs }, saved).ok).toBe(true);
    expect(createGame(416).jobs).toHaveLength(3);
  });
  it('reserves and refunds the actual recovered part when HF chooses Sam’s repair, with the bench shared', () => {
    let state = busy();
    const target = present(state.jobs.find((j) => j.status === 'offer'));
    state = act(state, { type: 'accept', jobId: target.id });
    state = act(state, {
      type: 'salvage',
      jobId: present(state.jobs.find((j) => j.isDonor)).id,
      componentId: 'switch',
    });
    // Isolate stock source choice: install prior HF method evidence, not a host skill/training flag.
    const sam = present(state.people.sam);
    const methods = [
      [{ family: 'electrical', stage: 'intake' }, 'inspect:switch'],
      [
        { family: 'electrical', stage: 'examined', part: 'switch', signal: 'intact' },
        'measure:switch:movement',
      ],
      [
        { family: 'electrical', stage: 'measured', part: 'switch', signal: 'high-drop' },
        'replace:switch',
      ],
    ] as const;
    for (const [i, [cues, action]] of methods.entries())
      teachObserved(sam, 'prior', cues, action, `prior-${i}`, 'success', state.now);
    // Use the new switch elsewhere, so Sam’s real replacement must reserve the recovered one.
    const other = present(state.jobs.find((j) => j.status === 'offer'));
    state = act(state, { type: 'accept', jobId: other.id });
    state = act(state, {
      type: 'work',
      jobId: other.id,
      componentId: 'switch',
      intervention: 'replace',
      source: 'new',
    });
    state = acceptRepairOffer(state, target.id);
    for (let step = 0; step < 8 && !state.npcWork.some((w) => w.reservedPart); step++) {
      const work = state.npcWork.find((w) => w.personId === 'sam');
      if (!work) break;
      state = act(state, { type: 'wait', minutes: work.endsAt - state.now });
    }
    const replacement = present(state.npcWork.find((w) => w.reservedPart));
    expect(replacement.reservedRecovered).toBe(true);
    expect(stockCount(state, 'switch', 'recovered')).toBe(0);
    expect(
      dispatch(state, { type: 'inspect', jobId: other.id, componentId: 'switch' }).message,
    ).toContain('only bench');
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
    state = act(state, { type: 'recall', jobId: target.id });
    expect(stockCount(state, 'switch', 'recovered')).toBe(1);
    expect(state.stock.switch).toBe(1);
  });
  it('keeps a broken promise in a later request and replays the whole challenge week exactly', () => {
    let state = busy();
    const job = present(state.jobs.find((j) => j.status === 'offer' && j.ownerId === 'nora'));
    state = act(state, { type: 'accept', jobId: job.id });
    state = act(state, { type: 'next-day' });
    state = act(state, { type: 'deliver', jobId: job.id, unfinished: true });
    for (let day = state.day; day < 8; day++) state = act(state, { type: 'next-day' });
    expect(
      state.jobs.some(
        (j) =>
          j.ownerId === 'nora' && j.description.includes('came back after the time you gave me'),
      ),
    ).toBe(true);
    expect(state.jobs.filter((j) => j.title === 'The meeting-room fan')).toHaveLength(0);
    state = act(state, { type: 'continue' });
    const saved = saveGame(state);
    expect(saveGame(loadGame(saved))).toBe(saved);
    expect(replayRecordedRun({ ...state, inputs: state.inputs }, saved).ok).toBe(true);
    const damaged = JSON.parse(saved);
    damaged.busyWorkshop.recoveredStock.switch = 99;
    expect(() => loadGame(JSON.stringify(damaged))).toThrow();
  });
  it('checks an actual outing rather than treating a planned time as absence', () => {
    let state = busy();
    const owner = present(state.people.mum);
    // Presence-boundary unit fixture, not evidence that this is HF’s natural schedule choice.
    // Begin an actual public-HF activity; never infer departure from the agenda alone.
    const current = state.npcWork.find((w) => w.personId === 'mum');
    if (current) finishActivity(owner, current.option, false, state.now);
    state.npcWork = state.npcWork.filter((w) => w.personId !== 'mum');
    const job = present(state.jobs.find((j) => j.status === 'offer'));
    job.ownerId = 'mum';
    state = act(state, { type: 'accept', jobId: job.id });
    expect(dispatch(state, { type: 'deliver', jobId: job.id, unfinished: true }).ok).toBe(true);
    const person = present(state.people.mum);
    const option = {
      id: 'personal',
      action: 'personal',
      label: 'Visit a neighbour',
      duration: 30,
      effort: 0.02,
    };
    chooseActivity(person, 'ordinary-day', {}, [option], state.now);
    expect(startActivity(person, option, state.now)).toBe(true);
    state.npcWork.push({ personId: 'mum', option, startedAt: state.now, endsAt: state.now + 30 });
    const blocked = dispatch(state, { type: 'deliver', jobId: job.id, unfinished: true });
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toContain('is away');
    expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
  });
  it('keeps a valid selection when the optional scenario replaces an offer that was selected', () => {
    let state = createGame(416);
    const family = present(state.jobs[0]);
    state = act(state, {
      type: 'work',
      jobId: family.id,
      componentId: 'switch',
      intervention: 'replace',
    });
    state = act(state, { type: 'verify', jobId: family.id, condition: 'movement' });
    state = act(state, { type: 'deliver', jobId: family.id });
    state = act(state, {
      type: 'select',
      jobId: present(state.jobs.find((j) => j.status === 'offer')).id,
    });
    state = act(state, { type: 'start-busy-workshop' });
    expect(() => loadGame(saveGame(state))).not.toThrow();
    expect(replayRecordedRun({ ...state, inputs: state.inputs }, saveGame(state)).ok).toBe(true);
  });
  it('keeps a pending native repair off the occupied bench during player recovery, with a second-bench control', () => {
    let initial = busy();
    // A controlled public opening isolates bench capacity from HF3's old rest timing.
    initial.people = createPeople(initial.seed, initial.now);
    initial.npcWork = [];
    const sam = present(initial.people.sam);
    teachObserved(
      sam,
      'prior',
      { family: 'electrical', stage: 'intake' },
      'inspect:switch',
      'prior-inspection',
      'success',
      initial.now,
    );
    const rest = {
      id: 'capacity-rest',
      action: 'rest',
      label: 'Take a short break',
      duration: 10,
      effort: 0,
    };
    chooseActivity(sam, 'ordinary-day', {}, [rest], initial.now);
    expect(startActivity(sam, rest, initial.now)).toBe(true);
    initial.npcWork.push({
      personId: sam.id,
      option: rest,
      startedAt: initial.now,
      endsAt: initial.now + 10,
    });
    const target = present(initial.jobs.find((j) => j.status === 'offer'));
    initial = act(initial, { type: 'accept', jobId: target.id });
    initial = act(initial, { type: 'assign', jobId: target.id, personId: 'sam' });
    expect(initial.pendingRequest?.kind).toBe('repair');
    expect(initial.npcWork.find((w) => w.personId === 'sam')?.option.action).toBe('rest');
    expect(initial.npcWork.find((w) => w.personId === 'sam')?.endsAt).toBe(820);
    for (const secondBench of [false, true]) {
      let state = cloneGame(initial);
      // Physical-capacity fixture; it changes no HF state or decision.
      if (secondBench) state.upgrades.push('second-bench');
      state = act(state, {
        type: 'salvage',
        jobId: present(state.jobs.find((j) => j.isDonor)).id,
        componentId: 'switch',
      });
      const inspection = state.jobs
        .find((j) => j.id === target.id)
        ?.contributions.some(
          (c) => c.actorId === 'sam' && c.action === 'inspect:switch' && c.at < 835,
        );
      expect(
        inspection,
        secondBench
          ? 'The second bench permits actual parallel work'
          : 'The only bench stays occupied until835',
      ).toBe(secondBench);
      expect(state.now).toBe(835);
      expect(state.stock.switch).toBe(2);
      expect(stockCount(state, 'switch', 'recovered')).toBe(1);
      expect(saveGame(loadGame(saveGame(state)))).toBe(saveGame(state));
      if (!secondBench) {
        // Retry only through the ordinary request route and actual activity boundaries.
        // No lingering reservation may hide eligible physical work after recovery ends.
        for (let attempt = 0; attempt < 8; attempt++) {
          if (
            state.jobs
              .find((j) => j.id === target.id)
              ?.contributions.some((c) => c.actorId === 'sam' && c.action === 'inspect:switch')
          )
            break;
          if (state.jobs.find((j) => j.id === target.id)?.blocked && !state.pendingRequest)
            state = act(state, { type: 'retry-sam', jobId: target.id });
          const work = state.npcWork.find((w) => w.personId === 'sam');
          if (!work) break;
          state = act(state, { type: 'wait', minutes: work.endsAt - state.now });
        }
        expect(
          state.jobs
            .find((j) => j.id === target.id)
            ?.contributions.some((c) => c.actorId === 'sam' && c.action === 'inspect:switch'),
        ).toBe(true);
      }
    }
  });
});

// A controlled opening isolates the real HF interruption receipt and host inventory.
it('refunds an interrupted replacement once and keeps recovered-part provenance', () => {
  let state = busy();
  const donor = present(state.jobs.find((job) => job.isDonor));
  state = act(state, { type: 'salvage', jobId: donor.id, componentId: 'switch' });
  state.people = createPeople(state.seed, state.now);
  state.npcWork = [];
  const sam = present(state.people.sam);
  const job = present(state.jobs.find((job) => job.status === 'offer'));
  job.status = 'active';
  job.acceptedAt = state.now;
  job.assignedTo = sam.id;
  job.responsibility = adoptResponsibility(sam, job.id, state.now);
  const model = structuredClone(job.model);
  const total = state.stock.switch;
  const recovered = stockCount(state, 'switch', 'recovered');
  const replacement = {
    id: 'replace:switch',
    action: 'replace:switch',
    label: 'Replace the switch',
    duration: 30,
    effort: 0.1,
  };
  chooseActivity(sam, job.id, {}, [replacement], state.now);
  expect(startActivity(sam, replacement, state.now)).toBe(true);
  expect(takePart(state, 'switch', 'recovered')).toBe(true);
  state.npcWork.push({
    personId: sam.id,
    jobId: job.id,
    option: replacement,
    startedAt: state.now,
    endsAt: state.now + 30,
    reservedPart: 'switch',
    reservedRecovered: true,
  });
  const rest = {
    id: 'interrupting-rest',
    action: 'rest',
    label: 'Take a break',
    duration: 10,
    effort: 0,
  };
  chooseActivity(sam, 'ordinary-day', {}, [rest], state.now);
  expect(startActivity(sam, rest, state.now)).toBe(true);
  state.npcWork.push({
    personId: sam.id,
    option: rest,
    startedAt: state.now,
    endsAt: state.now + 10,
  });
  job.blocked = {
    at: state.now,
    kind: 'help',
    reason: 'Controlled responsibility waiting during the break.',
  };
  state = act(state, { type: 'wait', minutes: 1 });
  expect(
    readRunHistory(state.hf.archive).some((tx) =>
      tx.inputs.some(
        (input) =>
          input.kind === 'action.resolved' &&
          input.payload.stage === 'interrupt' &&
          input.payload.disposition === 'interrupted',
      ),
    ),
  ).toBe(true);
  expect(state.stock.switch).toBe(total);
  expect(stockCount(state, 'switch', 'recovered')).toBe(recovered);
  expect(state.jobs.find((candidate) => candidate.id === job.id)?.model).toEqual(model);
  expect(state.npcWork.some((work) => work.option.id === replacement.id)).toBe(false);
  expect(state.people.sam?.activity?.affordance.id).toBe(rest.id);
  const raw = saveGame(state);
  expect(saveGame(loadGame(raw))).toBe(raw);
  state = act(state, { type: 'wait', minutes: 1 });
  expect(state.stock.switch).toBe(total);
  expect(stockCount(state, 'switch', 'recovered')).toBe(recovered);
});

it('preserves an accepted community fan and actual discarded generation through the recording cut', () => {
  let state = createGame(4);
  state = act(state, { type: 'next-day' });
  state = act(state, { type: 'next-day' });
  const family = present(state.jobs[0]);
  for (const command of [
    { type: 'work', jobId: family.id, componentId: 'switch', intervention: 'replace' },
    { type: 'verify', jobId: family.id, condition: 'movement' },
    { type: 'deliver', jobId: family.id },
  ] as Command[])
    state = act(state, command);
  const community = present(state.jobs.find((job) => job.title === 'The community room fan'));
  const accepted = act(state, { type: 'accept', jobId: community.id });
  const before = saveGame(accepted);
  expect(canStartBusyWorkshop(accepted)).toBe(false);
  const rejected = dispatch(accepted, { type: 'start-busy-workshop' });
  expect(rejected.ok).toBe(false);
  expect(saveGame(rejected.state)).toBe(before);
  expect(saveGame(loadGame(before))).toBe(before);
  state = act(state, { type: 'start-busy-workshop' });
  expect(state.busyWorkshop?.discardedGeneration.some((job) => job.id === community.id)).toBe(true);
  const filled = replayCommands(
    state,
    Array.from(
      { length: 10001 - state.inputs!.length },
      (): Command => ({ type: 'select', jobId: state.selectedJobId }),
    ),
  );
  expect(filled.ok).toBe(true);
  if (!filled.ok) throw new Error(filled.message);
  state = filled.state;
  expect(state.inputs).toBeUndefined();
  const raw = saveGame(state),
    cold = loadGame(raw);
  expect(saveGame(cold)).toBe(raw);
  const changed = JSON.parse(raw);
  changed.busyWorkshop.discardedGeneration.pop();
  expect(() => loadGame(JSON.stringify(changed))).toThrow();
  const warmNext = act(state, { type: 'next-day' }),
    coldNext = act(cold, { type: 'next-day' });
  expect(saveGame(coldNext)).toBe(saveGame(warmNext));
  expect(saveGame(loadGame(saveGame(coldNext)))).toBe(saveGame(coldNext));
}, 600000);
