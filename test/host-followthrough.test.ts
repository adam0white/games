/** Scope: finite heard words, consent-based private time and physical abandoned plates.
 * HF chooses the activity; these controls never set a Person's feelings or decision.
 */
import { expect, it, vi } from 'vitest';
import { PRIVATE_CLUES } from '../src/sim/cast-scenes.ts';
import { replayExport } from '../src/sim/continuation.ts';
import { communityRun, interrupt, verifyCommunity } from '../src/sim/hf4-person.ts';
import { KitchenRun } from '../src/sim/hf4-run.ts';
import {
  boardDefaults,
  cloneState,
  contactAvailable,
  exportRun,
  newGame,
  personOf,
  queueInput,
  replay,
  restoreState,
  stationOf,
  step,
} from '../src/sim/kitchen.ts';
import {
  clearingAvailable,
  heardTopic,
  heardTopics,
  privateConversationAvailable,
} from '../src/sim/kitchen-edition.ts';
import { offerUnavailable } from '../src/ui/people-offers.ts';
import clearingPrefix from './fixtures/host-clearing-prefix.json';

function service() {
  const s = newGame(42, 'pass@20');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  return s;
}
const raw = (s: ReturnType<typeof service>) => JSON.parse(JSON.stringify(cloneState(s)));

it('keeps private words unheard until an actual conversation completes, then offers their source', () => {
  const s = service();
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'invite' });
  expect(s.kitchen?.conversations.at(-1)?.verdict).toBe('deferred');
  expect(s.said.some((line) => line.text === PRIVATE_CLUES.dilek)).toBe(false);
  for (let i = 0; i < 5; i++) step(s);
  expect(privateConversationAvailable(s, 'dilek')).toBe(true);
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'invite' });
  expect(personOf(s, 'dilek').activity?.affordanceId).toBe('conversation');
  expect(stationOf(s, 'dilek')).toBeNull();
  expect(s.said.some((line) => line.text === PRIVATE_CLUES.dilek)).toBe(false);
  const restored = restoreState(raw(s));
  for (let i = 0; i < 5; i++) {
    step(s);
    step(restored);
  }
  expect(s.said.filter((line) => line.text === PRIVATE_CLUES.dilek)).toHaveLength(1);
  expect(privateConversationAvailable(s, 'dilek')).toBe(false);
  // Source-causal presentation control: real HF settlement remains fractional,
  // while the actual coverage call uses a whole-minute public clock.
  expect(s.staffing?.some((gap) => !Number.isInteger(gap.until))).toBe(true);
  const calls = s.said.filter((line) => line.kind === 'call' && line.text.includes('Someone needs to work'));
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.every((line) => !/\d{2}:\d{2}\.\d/.test(line.text))).toBe(true);
  expect(heardTopics(s, 'dilek').some((topic) => topic.text === PRIVATE_CLUES.dilek)).toBe(true);
  expect(heardTopics(s, 'selim').some((topic) => topic.text === PRIVATE_CLUES.dilek)).toBe(false);
  expect(raw(restored)).toEqual(raw(s));
  const topic = heardTopics(s, 'dilek').find((topic) => topic.text === PRIVATE_CLUES.dilek);
  if (!topic) throw new Error('Missing actually heard account.');
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'follow-up', topic: topic.id });
  expect(s.kitchen?.conversations.at(-1)?.source).toEqual({ at: topic.at, text: topic.text });
  expect(contactAvailable(s, 'dilek', 'follow-up')).toBe(false);
  expect(s.said.some((line) => line.who === 'chef' && line.text.includes(topic.text))).toBe(true);
  expect(raw(replayExport(exportRun(s, '4.12.0')))).toEqual(raw(s));
  expect(verifyCommunity(s.chef).verified).toBe(true);
  // Presentation retention control: evict the rolling speech log, leaving actual
  // completed work and HF untouched. This edited-log fixture makes no host replay claim.
  const aged = restoreState(raw(s));
  aged.said = [];
  for (let i = 0; i < 5; i++) step(aged);
  expect(privateConversationAvailable(aged, 'dilek')).toBe(false);
  expect(offerUnavailable(aged, 'dilek')).toContain('already heard');
  expect(heardTopics(aged, 'dilek').some((entry) => entry.text === PRIVATE_CLUES.dilek)).toBe(true);
  const cold = restoreState(raw(aged));
  expect(heardTopics(cold, 'dilek')).toEqual(heardTopics(aged, 'dilek'));
}, 120000);

it('reveals no account from an interrupted private activity or a later ordinary completion', () => {
  const s = service();
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'invite' });
  for (let i = 0; i < 5; i++) step(s);
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'invite' });
  expect(personOf(s, 'dilek').activity?.affordanceId).toBe('conversation');
  // Receipt control: interrupt the real activity through HF. No Person fields are edited.
  interrupt(personOf(s, 'dilek'), s.minute, 'control:conversation-interrupted');
  for (let i = 0; i < 5; i++) step(s);
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'check-in' });
  for (let i = 0; i < 5; i++) step(s);
  expect(
    s.kitchen?.conversations.find((entry) => entry.private && entry.activity)?.interrupted,
  ).toBeDefined();
  expect(s.said.some((line) => line.text === PRIVATE_CLUES.dilek)).toBe(false);
  expect(heardTopics(s, 'dilek').some((topic) => topic.text === PRIVATE_CLUES.dilek)).toBe(false);
  expect(verifyCommunity(s.chef).verified).toBe(true);
}, 120000);

it('clears one real abandoned meal, conserves its plate, and retains fallback after interruption', () => {
  // New authored public manager policy, not the original successful prefix.
  // Retain all 21 inputs, Dilek room2650, Selim grill
  // INSIST2664, Rafi room2667, seed42/end2670. No search, forced reply or retry.
  // kitchenTask can offer Rafi room work; only HF's actual start can supply a
  // roomDelivery carrier with end > plating minute + 2. No receipt handoff is needed.
  // The failed 23-input policy (Selim2663, no new Rafi request), tape and provenance
  // remain immutable in pass-three-gaps-trace1102/run-root-01 and its policies.json.
  expect(clearingPrefix.seed).toBe(42);
  expect(clearingPrefix.minute).toBe(2670);
  expect(clearingPrefix.inputs).toHaveLength(21);
  const additions: Parameters<typeof replay>[1] = [
    { kind: 'kitchen-task', who: 'dilek', task: 'room', at: 2650 },
    { kind: 'ask', cook: 'selim', verb: 'grill', insist: true, at: 2664 },
    { kind: 'kitchen-task', who: 'rafi', task: 'room', at: 2667 },
  ];
  // Stable merge: retain the original order, including equal-time original inputs.
  const inputs = [...(clearingPrefix.inputs as Parameters<typeof replay>[1]), ...additions]
    .map((input, index) => ({ input, index }))
    .sort((a, b) => a.input.at - b.input.at || a.index - b.index)
    .map(({ input }) => input);
  expect(inputs).toHaveLength(24);
  expect(inputs.filter((input) => !additions.includes(input))).toEqual(clearingPrefix.inputs);
  const completed: KitchenRun['completed'] = [];
  const clearCompleted = KitchenRun.prototype.clearCompleted;
  // Observe actual completion receipts before the host drains them. Do not change settlement.
  const spy = vi.spyOn(KitchenRun.prototype, 'clearCompleted').mockImplementation(function (
    this: KitchenRun,
  ) {
    completed.push(...this.completed);
    return clearCompleted.call(this);
  });
  let s: ReturnType<typeof replay>;
  try {
    s = replay(clearingPrefix.seed, inputs, clearingPrefix.minute, 'pass@20');
  } finally {
    spy.mockRestore();
  }
  expect(s.minute).toBe(2670);
  expect(s.phase).toBe('service');
  expect(s.inputs).toEqual(inputs);
  expect(s.applied).toBe(inputs.length);
  expect(
    completed.some(
      (work) =>
        work.person === 'dilek' &&
        work.action === 'room' &&
        work.status === 'completed' &&
        work.at > 2650 * 60000 &&
        work.at <= 2670 * 60000,
    ),
    'Dilek actually completes room work before the fixed deadline',
  ).toBe(true);
  expect(
    s.said.some(
      (line) =>
        line.who === 'dilek' &&
        line.at === 2650 &&
        line.text === 'I will take the dining room for fifteen minutes. I cannot cook while I am there.',
    ),
  ).toBe(true);
  // Admit the original clearing guards only with the proposed physical chain.
  const room = personOf(s, 'rafi').activity;
  const nativeRoom = communityRun(s.chef).active.find((a) => a.person === 'rafi');
  expect(room?.affordanceId).toBe('room');
  expect(Math.floor(room?.startedAt ?? 0)).toBe(2667);
  expect(room?.endsAt).toBeGreaterThan(2668 + 2);
  expect(nativeRoom).toBeDefined();
  expect(nativeRoom?.offer.id).toBe('room');
  expect((nativeRoom?.start ?? 0) / 60000).toBe(room?.startedAt);
  expect(((nativeRoom?.start ?? 0) + (nativeRoom?.offer.durationMs ?? 0)) / 60000).toBe(room?.endsAt);
  expect(
    s.said.some(
      (line) =>
        line.who === 'rafi' &&
        line.at === 2667 &&
        line.text === 'I will take the dining room for fifteen minutes. I cannot cook while I am there.',
    ),
  ).toBe(true);
  const meal = s.tickets.find((t) => t.id === 10);
  expect(meal).toMatchObject({ status: 'walked', platedAt: 2668 });
  expect(meal?.doneGrill).toBe(meal?.grill);
  expect(meal?.servedAt).toBeUndefined();
  expect(s.kitchen?.followup?.deliveries.find((d) => d.ticket === 10)).toMatchObject({
    who: 'rafi',
    at: 2668,
    arrives: 2670,
    outcome: 'carrying',
  });
  expect(
    s.said.some(
      (line) =>
        line.at === 2669 &&
        line.kind === 'journal' &&
        line.text ===
          `Table ${meal?.table} left after waiting 39 minutes. ₺${meal?.price} in meal payment was lost.`,
    ),
  ).toBe(true);
  expect(s.plates.dirty.find((plate) => plate.abandonedTicket === 10)?.at).toBe(2687);
  const ticket = s.tickets.find((ticket) => clearingAvailable(s, ticket.id));
  if (!ticket) throw new Error('The actual played prefix must leave an abandoned plate.');
  expect(ticket.id).toBe(10);
  expect(ticket.status).toBe('walked');
  expect(ticket.platedAt).toBeDefined();
  expect(
    heardTopics(s, 'dilek').some((topic) => topic.text.includes('dining room for fifteen minutes')),
  ).toBe(true);
  expect(heardTopic(s, 'dilek')).toBeDefined();
  const fallback = s.plates.dirty.find((plate) => plate.abandonedTicket === ticket.id)?.at;
  expect(fallback).toBeGreaterThan(s.minute + 3);
  // A plated meal holds its plate until service or abandonment queues its return.
  // This ordinary-meal prefix has no wedding trays; count each in-service plate once.
  const inService = (state: ReturnType<typeof service>) =>
    state.tickets.filter(
      (t) =>
        t.status === 'open' &&
        t.platedAt !== undefined &&
        t.servedAt === undefined &&
        !state.plates.dirty.some((plate) => plate.abandonedTicket === t.id),
    ).length;
  const plates = (state = s) =>
    state.plates.clean + state.plates.pile + state.plates.dirty.length + inService(state);
  const total = plates(),
    till = s.till;
  // The retained observer records Dilek accepting first. Selim's duplicate is
  // blocked before HF chooses again. This source correction is not a rerun.
  const clearingActivity = 'b55effcf4aed3a9c0b5680edccdf3379de8592de8080bd193a3fdd23a611b841';
  const clearingEntry = {
    ticket: ticket.id,
    who: 'dilek',
    activity: clearingActivity,
    at: 2670,
    outcome: 'clearing',
  };
  expect(s.kitchen?.clearings ?? []).toHaveLength(0);
  const choices = vi.spyOn(KitchenRun.prototype, 'decide');
  try {
    queueInput(s, { kind: 'clear-table', who: 'dilek', ticket: ticket.id });
    expect(choices).toHaveBeenCalledTimes(1);
    expect(s.kitchen?.clearings).toEqual([clearingEntry]);
    const active = communityRun(s.chef).active;
    expect(active.filter((a) => a.offer.id === 'clear-table')).toHaveLength(1);
    expect(active.find((a) => a.id === clearingActivity)).toMatchObject({
      person: 'dilek',
      offer: { id: 'clear-table' },
    });
    expect(personOf(s, 'dilek').activity?.affordanceId).toBe('clear-table');
    expect(stationOf(s, 'dilek')).toBeNull();
    expect(clearingAvailable(s, ticket.id)).toBe(false);
    const firstNative = JSON.parse(JSON.stringify(active));
    queueInput(s, { kind: 'clear-table', who: 'selim', ticket: ticket.id });
    expect(choices).toHaveBeenCalledTimes(1);
    expect(s.kitchen?.clearings).toEqual([clearingEntry]);
    expect(communityRun(s.chef).active).toEqual(firstNative);
    expect(personOf(s, 'dilek').activity?.affordanceId).toBe('clear-table');
    expect(stationOf(s, 'dilek')).toBeNull();
    expect(personOf(s, 'selim').activity?.affordanceId).toBe('grill');
    expect(stationOf(s, 'selim')).toBe('grill');
    expect(clearingAvailable(s, ticket.id)).toBe(false);
  } finally {
    choices.mockRestore();
  }
  expect(s.till).toBe(till);
  const restored = restoreState(raw(s));
  const interrupted = restoreState(raw(s));
  interrupt(personOf(interrupted, 'dilek'), interrupted.minute, 'control:clearing-interrupted');
  for (let i = 0; i < 5; i++) {
    step(s);
    step(restored);
    step(interrupted);
    for (const state of [s, restored, interrupted]) expect(plates(state)).toBe(total);
  }
  expect(s.kitchen?.clearings?.at(-1)?.outcome).toBe('returned');
  expect(s.plates.dirty.some((plate) => plate.abandonedTicket === ticket.id)).toBe(false);
  expect(s.tickets.find((t) => t.id === 11)).toMatchObject({ status: 'open', platedAt: 2673 });
  expect(s.tickets.find((t) => t.id === 11)?.servedAt).toBeUndefined();
  expect(inService(s)).toBe(1);
  expect(plates()).toBe(total);
  expect(ticket.status).toBe('walked');
  expect(interrupted.kitchen?.clearings?.at(-1)?.outcome).toBe('interrupted');
  expect(interrupted.plates.dirty.find((plate) => plate.abandonedTicket === ticket.id)?.at).toBe(fallback);
  expect(raw(restored)).toEqual(raw(s));
  expect(raw(replayExport(exportRun(s, '4.12.0')))).toEqual(raw(s));
  expect(verifyCommunity(s.chef).verified).toBe(true);
}, 300000);

it('rejects an unheard topic without choosing an activity or speaking', () => {
  const s = service();
  const before = raw(s);
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'follow-up', topic: 'said:999999' });
  expect(s.said).toEqual(before.said);
  expect(raw(s).hf4).toEqual(before.hf4);
}, 120000);
