import { expect, it } from 'vitest';
import {
  completeMechanicalWork,
  createMechanicalDisplay,
  type MechanicalItem,
  type MechanicalStep,
  mechanicalMinutes,
  mechanicalPresentation,
  mechanicalSteps,
} from '../src/game/mechanical-display';

const fresh = (
  cause: MechanicalItem['mechanicalCause'] = 'rim-obstruction',
  permission = true,
): MechanicalItem => ({
  id: 'finite-owned-display',
  appearance: 'label-stand',
  mechanicalCause: cause,
  mechanicalDisplay: createMechanicalDisplay(permission),
});
function work(item: MechanicalItem, action: MechanicalStep, patch = {}) {
  const result = completeMechanicalWork(item, {
    completed: true,
    attended: true,
    objectId: item.id,
    action,
    actor: 'player',
    at: 840,
    minutes: mechanicalMinutes[action],
    ...patch,
  });
  item.mechanicalDisplay = result.next;
  return result;
}
function compareAndOpen(item: MechanicalItem) {
  work(item, 'test-mechanical-empty');
  work(item, 'test-mechanical-loaded');
  work(item, 'open-access');
}
it('latent supported and missing-part objects have equal initial public geometry and offers', () => {
  const supported = fresh(),
    missing = fresh('missing-drive-part');
  expect(mechanicalPresentation(supported)).toEqual(mechanicalPresentation(missing));
  expect(mechanicalSteps(supported)).toEqual(mechanicalSteps(missing));
});
it('both actual comparisons plus lifted access are required before known clearance', () => {
  const item = fresh();
  work(item, 'open-access');
  expect(item.mechanicalDisplay.observed).toBe('unknown');
  expect(mechanicalSteps(item)).not.toContain('clear-obstruction');
  work(item, 'reassemble');
  work(item, 'test-mechanical-empty');
  work(item, 'open-access');
  expect(item.mechanicalDisplay.observed).toBe('unknown');
  work(item, 'reassemble');
  work(item, 'test-mechanical-loaded');
  work(item, 'open-access');
  expect(item.mechanicalDisplay.observed).toBe('rim-obstruction');
  expect(mechanicalSteps(item)).toContain('clear-obstruction');
});
it('supported repair requires clearance, refit and actual attended full-circuit check', () => {
  const item = fresh();
  compareAndOpen(item);
  work(item, 'clear-obstruction');
  expect(mechanicalPresentation(item).motion).toBe('stopped');
  expect(work(item, 'check-result').performed).toBe(false);
  work(item, 'reassemble');
  expect(work(item, 'check-result', { attended: false }).performed).toBe(false);
  expect(work(item, 'check-result').verified).toBe(true);
  expect(mechanicalPresentation(item).motion).toBe('checked');
  work(item, 'test-mechanical-empty');
  expect(mechanicalPresentation(item).motion).toBe('stopped');
  expect(item.mechanicalDisplay.cleared).toBe(true);
});
it('missing wheel cannot become clearance or success and has an honest attended deferral', () => {
  const item = fresh('missing-drive-part');
  compareAndOpen(item);
  expect(item.mechanicalDisplay.observed).toBe('missing-drive-part');
  expect(work(item, 'clear-obstruction').performed).toBe(false);
  work(item, 'reassemble');
  const result = work(item, 'check-result');
  expect(result.deferred).toBe(true);
  expect(result.verified).toBe(false);
  expect(mechanicalPresentation(item).motion).toBe('stopped');
});
it('withheld permission, refusal and interruptions preserve all saved observations and pieces', () => {
  for (const patch of [{ completed: false }, { attended: false }]) {
    const item = fresh();
    const before = structuredClone(item.mechanicalDisplay);
    expect(work(item, 'test-mechanical-empty', patch).performed).toBe(false);
    expect(item.mechanicalDisplay).toEqual(before);
  }
  const item = fresh('rim-obstruction', false);
  const before = structuredClone(item.mechanicalDisplay);
  expect(work(item, 'open-access').performed).toBe(false);
  expect(item.mechanicalDisplay).toEqual(before);
  expect(mechanicalSteps(item)).toEqual([]);
});
it('completion receipt must identify exact object and actual interval; no passive waiting API exists', () => {
  const item = fresh();
  expect(() => work(item, 'test-mechanical-empty', { minutes: 0 })).toThrow('receipt');
  expect(() => work(item, 'open-access', { objectId: 'other-object' })).toThrow('receipt');
  expect(item.mechanicalDisplay.events).toHaveLength(0);
});
it('tray/cards persist through shelving-equivalent JSON replay without generating replacement stock', () => {
  const item = fresh();
  compareAndOpen(item);
  const raw = JSON.stringify(item);
  const restored = JSON.parse(raw) as MechanicalItem;
  expect(mechanicalPresentation(restored)).toEqual(mechanicalPresentation(item));
  expect(restored.mechanicalDisplay.retainedPieceIds).toEqual(['display-tray']);
  work(restored, 'clear-obstruction');
  work(restored, 'reassemble');
  expect(restored.mechanicalDisplay.retainedPieceIds).toEqual([]);
  expect(
    restored.mechanicalDisplay.events.filter((event) => event.action === 'clear-obstruction'),
  ).toHaveLength(1);
});
