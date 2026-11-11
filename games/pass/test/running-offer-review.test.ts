/** C1: a pass@20 HF4 review keeps the cook's running offer on the menu, so HF can choose to continue it. */
import { expect, it, vi } from 'vitest';
import { validateReplayFile } from '../src/sim/continuation.ts';
import { kitchenOffer, kitchenPeople, kitchenSpec } from '../src/sim/hf4-authoring.ts';
import { communityRun, verifyCommunity } from '../src/sim/hf4-person.ts';
import { KitchenRun } from '../src/sim/hf4-run.ts';
import {
  boardDefaults,
  cloneState,
  exportRun,
  newGame,
  offersFor,
  queueInput,
  remainingMinutes,
  restoreState,
  staffingOptions,
  step,
} from '../src/sim/kitchen.ts';

const MIN = 60000;
const raw = (s: ReturnType<typeof newGame>) => JSON.parse(JSON.stringify(cloneState(s)));

interface Review {
  at: number;
  person: string;
  menu: { id: string; minutes: number }[];
  suggestion: boolean;
  foreground: boolean;
  ordinaryScope: boolean;
  before?: { id: string; offer: string; end: number };
  after?: { id: string; offer: string; end: number };
  chosen: string | null;
  review: boolean;
}

/** Seed 7, ordinary inputs: default board, open, and the first offered cover for each staffing question. */
function play(until: number, requestBreakAt1114 = false) {
  const reviews: Review[] = [];
  let requestedActivity: { id: string; offer: string; start: number; end: number } | undefined;
  // These read-only cuts run only for the fixed ordinary-break policy.
  const checkpoint = (s: ReturnType<typeof newGame>) => {
    const a = communityRun(s.chef).active.find((a) => a.person === 'selim');
    return {
      minute: s.minute,
      native: a && {
        id: a.id,
        offer: a.offer.id,
        start: a.start / MIN,
        end: (a.start + a.offer.durationMs) / MIN,
      },
      pending: structuredClone(s.cooks.find((c) => c.id === 'selim')?.pending),
      activity: structuredClone(s.people.find((p) => p.id === 'selim')?.activity),
      foregroundAt: s.kitchen?.foregroundAt?.selim,
    };
  };
  let before1115: ReturnType<typeof checkpoint> | undefined;
  let after1115: ReturnType<typeof checkpoint> | undefined;
  let menu1115: ReturnType<typeof offersFor> | undefined;
  const original = KitchenRun.prototype.decide;
  const spy = vi.spyOn(KitchenRun.prototype, 'decide').mockImplementation(function (
    this: InstanceType<typeof KitchenRun>,
    person,
    offers,
    ...rest
  ) {
    const view = (a?: (typeof this.active)[number]) =>
      a && { id: a.id, offer: a.offer.id, end: (a.start + a.offer.durationMs) / MIN };
    // Record the actual call site; foreground guest starts are not cookMinute reviews.
    const ordinaryScope = /\bcookMinute\b/.test(new Error().stack ?? '');
    const before = view(this.active.find((a) => a.person === person));
    const result = original.call(this, person, offers, ...rest);
    const d = result.events.find((e) => e.data.kind === 'decision')?.data as
      | { decision: { chosenAffordanceId: string | null; review?: boolean } }
      | undefined;
    reviews.push({
      at: rest[0],
      person,
      menu: offers.map((o) => ({ id: o.id, minutes: o.durationMs / MIN })),
      suggestion: !!rest[1],
      foreground: !!rest[3],
      ordinaryScope,
      before,
      after: view(this.active.find((a) => a.person === person)),
      chosen: d?.decision.chosenAffordanceId ?? null,
      review: d?.decision.review ?? false,
    });
    return result;
  });
  const s = newGame(7, 'pass@20');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  const answered = new Set<number>();
  try {
    for (let i = 0; i < 900 && s.night === 1 && s.minute < until; i++) {
      // Optional fixed policy for the two actual-state contracts only. One public request; no retry.
      if (requestBreakAt1114 && s.minute === 1114)
        queueInput(s, { kind: 'ask', cook: 'selim', verb: 'break', insist: false });
      if (requestBreakAt1114 && s.minute === 1115) {
        before1115 = checkpoint(s);
        const hostBefore = JSON.stringify(raw(s));
        const nativeBefore = JSON.stringify(communityRun(s.chef).active);
        menu1115 = offersFor(s, 'selim');
        // Pure menu-building at the actual checkpoint, not an ordinary decision.
        expect(JSON.stringify(raw(s))).toBe(hostBefore);
        expect(JSON.stringify(communityRun(s.chef).active)).toBe(nativeBefore);
      }
      const processing1115 = requestBreakAt1114 && s.minute === 1115;
      step(s);
      if (processing1115) after1115 = checkpoint(s);
      if (requestBreakAt1114 && s.minute === 1115) {
        const a = communityRun(s.chef).active.find((a) => a.person === 'selim');
        if (a)
          requestedActivity = {
            id: a.id,
            offer: a.offer.id,
            start: a.start / MIN,
            end: (a.start + a.offer.durationMs) / MIN,
          };
      }
      for (const d of s.staffing ?? [])
        if (d.state === 'asking' && !answered.has(d.id)) {
          answered.add(d.id);
          queueInput(s, { kind: 'staff', id: d.id, cover: staffingOptions(s, d)[0] ?? null });
        }
    }
  } finally {
    spy.mockRestore();
  }
  expect(s.night).toBe(1);
  expect(s.minute).toBe(until);
  return { s, reviews, requestedActivity, before1115, after1115, menu1115 };
}

const ordinary = (r: Review) => r.ordinaryScope && !r.suggestion && !r.foreground;

// Preregistered endpoint: process 1145 once, while prayer remains legitimate through 1155.
// Missing running/continued/switched witnesses fail; do not extend again.
it('a scheduled review offers the running activity with its remaining time and no suggestion', () => {
  const { reviews } = play(1146);
  const withRunning = reviews.filter((r) => r.before && ordinary(r));
  expect(withRunning.length, 'the played prefix reaches scheduled reviews of running work').toBeGreaterThan(
    0,
  );
  for (const r of withRunning) {
    const own = r.menu.find((o) => o.id === r.before?.offer);
    expect(own, `${r.person} at ${r.at}: running offer ${r.before?.offer} is on the menu`).toBeDefined();
    // The offered time is what is left, so a review cannot lengthen the activity.
    expect(own?.minutes).toBeCloseTo((r.before?.end ?? 0) - r.at, 1);
  }
});

it('choosing the running offer continues the same activity with an unchanged end; a different choice interrupts without starting', () => {
  const { reviews } = play(1146);
  const kept = reviews.filter((r) => r.before && ordinary(r) && r.chosen === r.before.offer);
  expect(kept.length, 'HF continues running work at least once in this prefix').toBeGreaterThan(0);
  for (const r of kept) {
    expect(r.review).toBe(true);
    expect(r.after?.id).toBe(r.before?.id);
    expect(r.after?.end).toBe(r.before?.end);
  }
  const switched = reviews.filter(
    (r) => r.before && ordinary(r) && r.chosen !== null && r.chosen !== r.before.offer,
  );
  expect(switched.length, 'HF chooses something else at least once in this prefix').toBeGreaterThan(0);
  for (const r of switched) {
    expect(r.review).toBe(false);
    expect(r.after).toBeUndefined();
  }
});

it('pure menu-building at the actual 1115 checkpoint keeps legitimate offers; processing 1115 protects the renewed native toilet activity', async () => {
  const { s, reviews, requestedActivity, before1115, after1115, menu1115 } = play(1146, true);
  expect(s.inputs.filter((input) => input.kind === 'ask')).toEqual([
    { kind: 'ask', cook: 'selim', verb: 'break', insist: false, at: 1114 },
  ]);
  // The request actually renews toilet; it does not start the requested break.
  const renewed = {
    id: '6281d456add333aa4b095b72aae3bad7a4e85e352e3d21a0778bd22d3370b7ba',
    offer: 'toilet',
    start: 1114.0000166666666,
    end: 1117.0000166666666,
  };
  expect(requestedActivity).toEqual(renewed);
  const request1114 = reviews.filter(
    (r) => r.person === 'selim' && r.at === 1114 && r.ordinaryScope && r.suggestion && !r.foreground,
  );
  expect(request1114).toHaveLength(1);
  expect(request1114[0]?.chosen).toBe('toilet');
  expect(request1114[0]?.before).toBeUndefined();
  expect(request1114[0]?.after).toEqual({ id: renewed.id, offer: renewed.offer, end: renewed.end });

  // Cut 1: offersFor alone is pure at this actual state. This is no HF choice.
  expect(before1115).toBeDefined();
  expect(before1115?.minute).toBe(1115);
  expect(before1115?.native).toEqual(renewed);
  expect(menu1115).toBeDefined();
  for (const id of ['pray', 'toilet', 'break', 'home', renewed.offer])
    expect(
      menu1115?.some((offer) => offer.id === id),
      `1115 pure menu includes ${id}`,
    ).toBe(true);

  // Cut 2: the source cookMinute protection returns before the ordinary review.
  // Observe both sides of processing 1115; do not substitute a foreground call.
  expect(after1115).toBeDefined();
  expect(after1115?.minute).toBe(1116);
  expect(after1115?.native).toEqual(renewed);
  for (const cut of [before1115, after1115]) {
    expect(cut?.pending).toBeNull();
    // Native identity is asserted on cut.native; Activity exposes offer and time.
    expect(cut?.activity?.affordanceId).toBe('toilet');
    expect(cut?.activity?.startedAt).toBe(renewed.start);
    expect(cut?.activity?.endsAt).toBe(renewed.end);
    expect(cut?.foregroundAt).not.toBe(renewed.start);
  }
  expect(reviews.filter((r) => r.person === 'selim' && r.at === 1115 && ordinary(r))).toHaveLength(0);
  expect(reviews.filter((r) => r.person === 'selim' && r.at === 1115)).toHaveLength(0);
  expect(s.kitchen?.guests.some((g) => g.who === 'selim' && g.at === 1115)).toBe(false);
  // Neither cut proves prayer beside running work in an ordinary scheduled review.
  const replayed = await validateReplayFile(exportRun(s, '4.12.0')),
    cold = restoreState(raw(s));
  expect(raw(replayed)).toEqual(raw(s));
  expect(raw(cold)).toEqual(raw(s));
  for (const state of [s, replayed, cold]) expect(verifyCommunity(state.chef).verified).toBe(true);
  const next = { kind: 'ask', cook: 'dilek', verb: 'cold' } as const;
  for (const state of [s, replayed, cold]) queueInput(state, next);
  for (let i = 0; i < 8; i++) {
    step(s);
    step(replayed);
    step(cold);
  }
  expect(raw(replayed)).toEqual(raw(s));
  expect(raw(cold)).toEqual(raw(s));
  for (const state of [s, replayed, cold]) expect(verifyCommunity(state.chef).verified).toBe(true);
}, 120000);

it('replays the continued-work state exactly and keeps an actual next input equal', async () => {
  const { s } = play(1146);
  const replayed = await validateReplayFile(exportRun(s, '4.12.0'));
  expect(raw(replayed)).toEqual(raw(s));
  const next = { kind: 'ask', cook: 'dilek', verb: 'cold' } as const;
  queueInput(s, next);
  queueInput(replayed, next);
  for (let i = 0; i < 8; i++) {
    step(s);
    step(replayed);
  }
  expect(raw(replayed)).toEqual(raw(s));
}, 120000);

it('HF wrapper boundary: one millisecond left is offered as one millisecond; the activity keeps its identity and end', () => {
  const run = new KitchenRun(kitchenSpec(7), kitchenPeople());
  const work = kitchenOffer('selim', {
    id: 'grill',
    action: 'grill',
    label: 'work at the grill',
    duration: 5,
    effort: 0.4,
    advertises: { competence: 0.3 },
  });
  run.decide('selim', [work], 540);
  const started = run.active.find((a) => a.person === 'selim');
  expect(started).toBeDefined();
  const end = (started?.start ?? 0) + (started?.offer.durationMs ?? 0);
  // Tick to one millisecond before the end, as cookMinute does before a review.
  run.advance(end - 1);
  const before = run.active.find((a) => a.person === 'selim');
  expect(before?.id).toBe(started?.id);
  const minutes = remainingMinutes(end / MIN, (end - 1) / MIN);
  const offered = kitchenOffer('selim', {
    id: 'grill',
    action: 'grill',
    label: 'work at the grill',
    duration: minutes,
    effort: 0.4,
    advertises: { competence: 0.3 },
  });
  expect(offered.durationMs).toBe(1);
  const result = run.decide('selim', [offered], Math.floor((end - 1) / MIN));
  const decision = result.events.find((e) => e.data.kind === 'decision')?.data as
    | { decision: { chosenAffordanceId: string | null; review?: boolean } }
    | undefined;
  // HF answered with a review frame; the original activity was neither replaced nor extended.
  expect(decision?.decision.review ?? false).toBe(
    decision?.decision.chosenAffordanceId === 'grill' || decision?.decision.chosenAffordanceId === null,
  );
  const after = run.active.find((a) => a.person === 'selim');
  if (after) {
    expect(after.id).toBe(started?.id);
    expect(after.start + after.offer.durationMs).toBe(end);
  }
  expect(run.verify().verified).toBe(true);
});

it('remaining time keeps whole-millisecond precision and never goes below one millisecond', () => {
  expect(remainingMinutes(1151, 1130)).toBe(21);
  expect(remainingMinutes(1151.0000333333, 1130)).toBeCloseTo(21.0000333333, 9);
  expect(remainingMinutes(1130.0000000167, 1130) * MIN).toBe(1);
  expect(remainingMinutes(1130, 1130) * MIN).toBe(1);
});
