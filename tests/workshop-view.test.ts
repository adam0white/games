import { describe, expect, it } from 'vitest';
import { getView, transition } from '../src/game/engine';
import type { GameView } from '../src/game/types';
import { isRoomTap, validPlaceInput, workshopPlaces } from '../src/ui/workshop/workshopView';
import { opening } from './support/school-route';

const base = (): GameView => ({
  title: '',
  subtitle: '',
  scene: 'home',
  focus: null,
  actions: [],
  conversation: [],
  shelf: [],
  parts: [],
  note: null,
});
describe('player-facing workshop projection', () => {
  it('does not invent objects, people, parts, cabinet access or future stations', () => {
    expect(workshopPlaces(base()).map((place) => place.id)).toEqual(['bench']);
    expect(validPlaceInput(base(), 'object:secret')).toBeNull();
  });
  it('shows only known shelf titles and notes with the same selection input as the engine', () => {
    const view = { ...base(), shelf: [{ id: 'known', title: 'Old box', note: 'Still unopened.' }] };
    expect(workshopPlaces(view).find((place) => place.id === 'object:known')).toMatchObject({
      label: 'Old box',
      detail: 'Still unopened.',
      input: { type: 'select', id: 'known' },
    });
    expect(validPlaceInput(view, 'shelf')).toBeNull();
  });
  it('takes the current action label and removes stale work when its offer disappears', () => {
    const view = {
      ...base(),
      actions: [
        { id: 'shelve', label: 'Put this away carefully' },
        { id: 'workshop-cabinet-open', label: 'Look at the doors' },
      ],
    };
    expect(workshopPlaces(view).find((place) => place.id === 'shelf')?.actionLabel).toBe(
      'Put this away carefully',
    );
    expect(validPlaceInput(view, 'cabinet')).toEqual({
      type: 'action',
      id: 'workshop-cabinet-open',
    });
    expect(validPlaceInput(base(), 'shelf')).toBeNull();
  });
  it('does not turn parts counts or notebook navigation into repair inputs', () => {
    const view = { ...base(), parts: [{ id: 'holder', label: 'Recovered holder', count: 2 }] };
    expect(workshopPlaces(view, true).find((place) => place.id === 'parts')?.detail).toBe(
      'Recovered holder: 2',
    );
    expect(validPlaceInput(view, 'parts')).toBeNull();
    expect(validPlaceInput(view, 'journal')).toBeNull();
  });
  it('all projected starting inputs pass the real engine validator', () => {
    const state = opening(12);
    for (const item of state.objects) {
      item.discovered = true;
      item.location = 'shelf';
    }
    state.focusId = null;
    const before = JSON.stringify(state);
    const places = workshopPlaces(getView(state));
    expect(places.some((place) => place.input?.type === 'select')).toBe(true);
    for (const place of places) {
      const input = place.input;
      if (input) expect(() => transition(state, input)).not.toThrow();
    }
    expect(JSON.stringify(state)).toBe(before);
  });
});
describe('room gesture classification', () => {
  it('accepts a steady tap but rejects drag and cancellation', () => {
    expect(isRoomTap({ x: 10, y: 10 }, { x: 13, y: 12 })).toBe(true);
    expect(isRoomTap({ x: 10, y: 10 }, { x: 30, y: 10 })).toBe(false);
    expect(isRoomTap({ x: 10, y: 10 }, { x: 10, y: 10 }, true)).toBe(false);
  });
});
