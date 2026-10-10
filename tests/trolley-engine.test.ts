import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import type { GameState, RepairObject } from '../src/game/types';

function fixture(permission = true, fault: RepairObject['fault'] = 'trolley-alignment') {
  const s = createGame(17);
  s.chapter = 'garage';
  const item: RepairObject = {
    id: 'test-trolley',
    title: 'Borrowed hand trolley',
    owner: 'Dad',
    story: 'Difficult to pull with parcels.',
    form: 'trolley',
    fault,
    trolley: { permission },
    location: 'bench',
    observations: [],
    inspected: false,
    tested: false,
    attempted: 0,
    repaired: false,
    verified: false,
    discovered: true,
  };
  s.objects.push(item);
  s.focusId = item.id;
  return s;
}
const act = (s: GameState, id: string) => transition(s, { type: 'action', id });
const actions = (s: GameState) => getView(s).actions.map((a) => a.id);
it('trolley intake reveals no fault-specific repair before both real comparisons', () => {
  for (const fault of ['trolley-alignment', 'trolley-rub'] as const) {
    let s = fixture(true, fault);
    expect(actions(s)).not.toContain('align-trolley-wheel');
    expect(actions(s)).not.toContain('clear-trolley-rub');
    s = act(s, 'inspect');
    s = act(s, 'test-trolley-unloaded');
    expect(actions(s)).not.toContain('align-trolley-wheel');
    expect(actions(s)).not.toContain('clear-trolley-rub');
    s = act(s, 'test-trolley-loaded');
    const id = fault === 'trolley-alignment' ? 'align-trolley-wheel' : 'clear-trolley-rub';
    expect(actions(s)).toContain(id);
    const before = s.now;
    s = act(s, id);
    expect(s.now).toBeGreaterThan(before);
    expect(actions(s)).not.toContain('verify');
    expect(actions(s)).not.toContain('test-battery');
    expect(s.objects.at(-1)?.verified).toBe(false);
    s = act(s, 'check-trolley-route');
    expect(s.objects.at(-1)).toMatchObject({ verified: true, trolley: { routeChecked: true } });
  }
});
it('borrowed trolley cannot be loaded or altered without its owner permission', () => {
  const s = act(fixture(false), 'inspect');
  expect(actions(s)).not.toContain('test-trolley-loaded');
  expect(() => act(s, 'test-trolley-loaded')).toThrow('not available');
  expect(() => act(s, 'align-trolley-wheel')).toThrow('not available');
});
