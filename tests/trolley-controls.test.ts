import { describe, expect, it } from 'vitest';
import {
  inspectRepair,
  performTrolleyRouteCheck,
  readLongCheck,
  repairTrolley,
  testTrolley,
} from '../src/game/repairs';
import type { RepairObject } from '../src/game/types';
import { createObjectModel } from '../src/ui/inspection/objectModel';
import { getMappedRepairActions } from '../src/ui/repairBindings';

function item(fault: 'trolley-alignment' | 'trolley-rub'): RepairObject {
  return {
    id: 'control',
    title: 'Borrowed trolley',
    owner: 'Leila',
    story: 'Store property',
    form: 'trolley',
    fault,
    location: 'bench',
    observations: [],
    inspected: false,
    tested: false,
    attempted: 0,
    repaired: false,
    verified: false,
    discovered: true,
    trolley: { permission: true, loadMode: 'full' },
  };
}
describe('attended trolley controls', () => {
  it('matching unloaded controls disclose no latent cause; loaded controls differentiate causal observations', () => {
    const wheel = item('trolley-alignment'),
      strap = item('trolley-rub');
    expect(inspectRepair(wheel)).toBe(inspectRepair(strap));
    expect(testTrolley(wheel, false)).toBe(testTrolley(strap, false));
    expect(wheel.tested).toBe(false);
    expect(strap.tested).toBe(false);
    expect(testTrolley(wheel, true)).toContain('Holding the loose strap clear makes no difference');
    expect(testTrolley(strap, true)).toContain('Holding that strap clear removes the drag');
    expect(wheel.evidence?.at(-1)).toBe('trolley-wanders');
    expect(strap.evidence?.at(-1)).toBe('trolley-rubs');
  });
  it('intervention needs permission and both actual comparisons, without consuming unrelated parts', () => {
    const t = item('trolley-rub');
    inspectRepair(t);
    testTrolley(t, false);
    expect(() => repairTrolley(t, 'clear-trolley-rub')).toThrow('Compare');
    if (!t.trolley) throw Error('missing trolley');
    t.trolley.permission = false;
    expect(() => testTrolley(t, true)).toThrow('owner must agree');
    expect(() => repairTrolley(t, 'clear-trolley-rub')).toThrow('permission');
    t.trolley.permission = true;
    testTrolley(t, true);
    expect(repairTrolley(t, 'align-trolley-wheel').succeeded).toBe(false);
    expect(t.repaired).toBe(false);
    expect(t.verified).toBe(false);
    expect(repairTrolley(t, 'clear-trolley-rub').succeeded).toBe(true);
    expect(t.attempted).toBe(2);
    expect(t.verified).toBe(false);
  });
  it('idle passage cannot certify loaded transport; the real finite route can', () => {
    const t = item('trolley-alignment');
    inspectRepair(t);
    testTrolley(t, false);
    testTrolley(t, true);
    repairTrolley(t, 'align-trolley-wheel');
    t.checkStarted = 10;
    expect(() => readLongCheck(t, 100000)).toThrow('attended');
    expect(t.verified).toBe(false);
    expect(() => performTrolleyRouteCheck(t, 10, 21)).toThrow('incomplete');
    expect(() => performTrolleyRouteCheck(t, 10, Infinity)).toThrow('incomplete');
    expect(performTrolleyRouteCheck(t, 10, 22)).toContain('stopping and turning');
    expect(t.verified).toBe(true);
    expect(t.trolley?.routeChecked).toBe(true);
    repairTrolley(t, 'align-trolley-wheel');
    expect(t.verified).toBe(false);
    expect(t.trolley?.routeChecked).toBe(false);
  });
  it('direct model controls bind wheel and strap work to an original trolley assembly', () => {
    const view = {
      id: 'control',
      title: 'Borrowed trolley',
      owner: 'Leila',
      story: 'Store property',
      condition: 'Empty and loaded controls are available.',
      form: 'trolley' as const,
      appearance: 'timer' as const,
      inspected: true,
      progress: 'inspected' as const,
      visual: 'off' as const,
      observations: [],
    };
    const actions = [
      { id: 'align-trolley-wheel', label: 'Seat mounting', intent: 'stay' as const },
      { id: 'clear-trolley-rub', label: 'Secure strap', intent: 'stay' as const },
    ];
    // The same procedural object is built from visible identity, not its hidden fault.
    const bindings = getMappedRepairActions(view, actions);
    expect(bindings.map((b) => b.target)).toEqual(['wheel', 'strap']);
    const model = createObjectModel(view, true, ['wheel', 'strap']);
    expect(model.root.getObjectByName('trolley-loading-deck')).toBeDefined();
    expect(model.root.getObjectByName('trolley-wheel')).toBeDefined();
    expect(model.root.getObjectByName('trolley-retained-strap-tail')).toBeDefined();
    expect(model.hitRegions.some((m) => m.userData.repairTarget === 'wheel')).toBe(true);
    expect(model.hitRegions.some((m) => m.userData.repairTarget === 'strap')).toBe(true);
    model.dispose();
  });
});
