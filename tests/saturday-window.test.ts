import { expect, it } from 'vitest';
import {
  completeSaturdayActivity,
  createSaturdayWindow,
  type SaturdayContext,
  type SaturdayWindowState,
  saturdayActions,
  saturdayView,
} from '../src/game/saturday-window';

const context: SaturdayContext = {
  noraAvailable: true,
  samAvailable: false,
  model: {
    id: 'paper-street',
    title: 'The unfinished paper street',
    appearance: 'model',
    held: true,
    rememberedFronts: true,
    currentFronts: false,
    moves: false,
  },
  objects: [],
  departureBlockers: [],
};
function perform(s: SaturdayWindowState, id: string, c = context, patch = {}) {
  const a = saturdayActions(s, c).find((a) => a.id === id);
  if (!a) throw Error(`Missing actual action ${id}`);
  return completeSaturdayActivity(s, c, {
    action: id,
    completed: true,
    attended: true,
    at: 100,
    minutes: a.minutes,
    participants: ['player', ...a.requires],
    ...patch,
  });
}
function agreed() {
  let s = createSaturdayWindow();
  s = perform(s, 'saturday-open-look').next;
  return perform(s, 'saturday-agree').next;
}
it('empty look conceals brace placement until the loaded comparison and actual underneath look', () => {
  let s = agreed();
  expect(saturdayView(s, context).shelfObject.shelfPresentation.observed).toBe('unknown');
  expect(saturdayActions(s, context).some((a) => a.id === 'saturday-refit-brace')).toBe(false);
  s = perform(s, 'saturday-compare-loaded').next;
  expect(saturdayView(s, context).shelfObject.shelfPresentation.observed).toBe('support-walks');
  expect(s.shelf.brace).toBe('unobserved');
  s = perform(s, 'saturday-look-under').next;
  expect(s.shelf.brace).toBe('above-stop');
  s = perform(s, 'saturday-refit-brace').next;
  expect(s.shelf.checked).toBe(false);
  expect(saturdayActions(s, context).some((a) => a.id === 'saturday-setup')).toBe(false);
  s = perform(s, 'saturday-display-remembered-model').next;
  s = perform(s, 'saturday-check-load').next;
  expect(s.stage).toBe('ready');
  expect(saturdayView(s, context).modelMoves).toBe(false);
  s = perform(s, 'saturday-go-afternoon').next;
  const setup = perform(s, 'saturday-setup');
  expect(setup.next.items.map((i) => i.id)).toEqual(['paper-street']);
  expect(setup.custodyMoves.some((m) => m.id === 'paper-street' && m.to === 'window')).toBe(true);
  const home = perform(setup.next, 'saturday-home');
  expect(home.next.stage).toBe('home');
  expect(home.next.items[0]?.location).toBe('origin');
  expect(home.next.shelf.custody).toBe('nora');
});
it('owner approved stationary alternative is useful but never claims a folding repair', () => {
  let s = agreed();
  s = perform(s, 'saturday-display-remembered-model').next;
  const before = structuredClone(s);
  expect(perform(s, 'saturday-choose-low', context, { participants: ['player'] }).performed).toBe(
    false,
  );
  expect(s).toEqual(before);
  s = perform(s, 'saturday-choose-low').next;
  expect(s.stage).toBe('ready');
  expect(saturdayView(s, context).shelf.foldingRepaired).toBe(false);
  expect(saturdayView(s, context).shelfObject.shelfPresentation.position).toBe('low');
  s = perform(s, 'saturday-go-afternoon').next;
  expect(perform(s, 'saturday-setup').next.stage).toBe('afternoon');
});
it('refusal and absence leave a complete solo private route without fabricated displayed objects', () => {
  const c = { ...context, noraAvailable: false, model: undefined };
  let s = createSaturdayWindow();
  expect(saturdayActions(s, c).some((a) => a.id === 'saturday-open-look')).toBe(false);
  s = perform(s, 'saturday-private', c).next;
  expect(s.items).toEqual([]);
  const before = structuredClone(s);
  expect(perform(s, 'saturday-setup-solo', c, { completed: false }).next).toEqual(before);
  s = perform(s, 'saturday-setup-solo', c).next;
  expect(s.stage).toBe('afternoon');
  expect(saturdayView(s, c).scene.location).toBe('garage');
  s = perform(s, 'saturday-home', c).next;
  expect(s.stage).toBe('home');
  expect(s.shelf.permission).toBe(false);
});
it('actual custody and permission remain required at setup; obligations never silently disappear', () => {
  let s = agreed();
  s = perform(s, 'saturday-display-remembered-model').next;
  s = perform(s, 'saturday-choose-low').next;
  s = perform(s, 'saturday-go-afternoon').next;
  const blocked = { ...context, departureBlockers: ['Return the promised case'] };
  expect(saturdayActions(s, blocked).some((a) => a.id === 'saturday-setup')).toBe(false);
  if (!context.model) throw Error('Missing authored model');
  const removed = { ...context, model: { ...context.model, held: false } };
  expect(perform(s, 'saturday-setup', removed).performed).toBe(false);
  expect(
    saturdayActions(s, {
      ...context,
      objects: [
        {
          id: 'sam-stand',
          title: 'Sam’s stand',
          appearance: 'label-stand',
          origin: 'sam',
          available: true,
          permission: false,
        },
      ],
    }).some((a) => a.id === 'saturday-display-objects'),
  ).toBe(false);
});

it('the received arrival window accepts a short late departure only when the full journey fits', () => {
  const s = agreed();
  s.stage = 'ready';
  s.display = 'remembered-model';
  s.agreedAt = 14 * 60;
  s.arrivalBy = 14 * 60 + 30;
  const actionsAt = (now: number) => saturdayActions(s, { ...context, now }).map((a) => a.id);
  expect(actionsAt(14 * 60 + 4)).toContain('saturday-go-afternoon');
  expect(actionsAt(14 * 60 + 20)).toContain('saturday-go-afternoon');
  expect(actionsAt(14 * 60 + 21)).not.toContain('saturday-go-afternoon');
  expect(actionsAt(14 * 60 + 21)).toContain('saturday-reschedule');
  expect(saturdayView(s, { ...context, now: 14 * 60 + 4 }).appointmentLabel).toContain(
    '14:00–14:30',
  );
  const valid = perform(
    s,
    'saturday-go-afternoon',
    { ...context, now: 14 * 60 + 4 },
    { at: 14 * 60 + 14 },
  );
  expect(valid.performed).toBe(true);
  expect(valid.next.arrived).toBe(true);
  expect(valid.next.shelf.custody).toBe(s.shelf.custody);
  expect(valid.custodyMoves).toEqual([]);
  const late = perform(
    s,
    'saturday-go-afternoon',
    { ...context, now: 14 * 60 + 20 },
    { at: 14 * 60 + 31 },
  );
  expect(late.performed).toBe(false);
  const early = perform(
    s,
    'saturday-go-afternoon',
    { ...context, now: 13 * 60 },
    { at: 13 * 60 + 10 },
  );
  expect(early.performed).toBe(false);
  const withheld = perform(
    s,
    'saturday-go-afternoon',
    { ...context, now: 14 * 60 + 4 },
    { at: 14 * 60 + 14, attended: false },
  );
  expect(withheld.performed).toBe(false);
});
it('older unpublished afternoon agreements receive the same bounded clarification, never an unlimited grace period', () => {
  const s = agreed();
  s.stage = 'ready';
  s.display = 'remembered-model';
  s.agreedAt = 14 * 60;
  expect(
    saturdayActions(s, { ...context, now: 14 * 60 + 4 }).some(
      (a) => a.id === 'saturday-go-afternoon',
    ),
  ).toBe(true);
  expect(
    saturdayActions(s, { ...context, now: 14 * 60 + 31 }).some(
      (a) => a.id === 'saturday-go-afternoon',
    ),
  ).toBe(false);
  expect(saturdayView(s, { ...context, now: 14 * 60 + 31 }).appointmentLabel).toContain(
    'Earlier agreed arrival window',
  );
});
