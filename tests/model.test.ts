import { describe, expect, it } from 'vitest';
import {
  calibrate,
  compatiblePart,
  createModel,
  governorMultipliers,
  inspectComponent,
  intervene,
  measure,
  runUseTest,
  supportedFaults,
  terminals,
} from '../src/game/model';

describe('physical models', () => {
  it('separates weak source and dirty contact with loaded probes', () => {
    const weak = createModel('fan', 1, [{ componentId: 'cell', condition: 'weak' }]);
    const dirty = createModel('fan', 1, [{ componentId: 'contact', condition: 'dirty' }]);
    expect(runUseTest(weak, 'load').passes).toBe(false);
    expect(runUseTest(dirty, 'load').passes).toBe(false);
    expect(
      measure(weak, { mode: 'voltage', a: 'A', b: '0', condition: 'bench' }).value,
    ).toBeGreaterThan(3);
    expect(
      measure(weak, { mode: 'voltage', a: 'A', b: '0', condition: 'load' }).value,
    ).toBeLessThan(4);
    expect(
      measure(dirty, { mode: 'voltage', a: 'C', b: 'D', condition: 'load' }).value,
    ).toBeGreaterThan(2);
  });
  it('preserves worn switches through wrong interventions and repeated tests', () => {
    const model = createModel('lantern', 8, [{ componentId: 'switch', condition: 'worn' }]);
    expect(runUseTest(model, 'bench').passes).toBe(true);
    expect(runUseTest(model, 'movement').passes).toBe(false);
    const before = JSON.stringify(model);
    intervene(model, 'switch', 'clean');
    expect(JSON.stringify(model)).toBe(before);
    for (let i = 0; i < 10; i++) expect(runUseTest(model, 'movement').passes).toBe(false);
    intervene(model, 'switch', 'replace');
    expect(runUseTest(model, 'movement').passes).toBe(true);
  });
  it('requires power off for continuity and rejects unknown probes', () => {
    const model = createModel('lantern', 1, []);
    expect(
      measure(model, { mode: 'continuity', a: 'B', b: 'C', condition: 'bench' }).value,
    ).toBeNull();
    model.power = false;
    expect(
      measure(model, { mode: 'continuity', a: 'B', b: 'C', condition: 'bench' }).value,
    ).toBeLessThan(1);
    expect(
      measure(model, { mode: 'voltage', a: 'wat', b: 'C', condition: 'bench' }).value,
    ).toBeNull();
  });
  it('models mechanical ratios and slipping under resistance', () => {
    const good = createModel('music-box', 3, []);
    const slip = createModel('music-box', 3, [{ componentId: 'gear', condition: 'worn' }]);
    expect(runUseTest(good, 'load').passes).toBe(true);
    expect(runUseTest(slip, 'bench').passes).toBe(true);
    expect(runUseTest(slip, 'load').passes).toBe(false);
    expect(measure(slip, { mode: 'motion', a: '0', b: 'D', condition: 'load' }).value).toBeLessThan(
      measure(good, { mode: 'motion', a: '0', b: 'D', condition: 'load' }).value ?? 0,
    );
    expect(measure(good, { mode: 'voltage', a: 'A', b: '0', condition: 'bench' }).value).toBeNull();
  });
  it('keeps physical truth stable across save-like copies and pure queries', () => {
    const model = createModel('fan', 19);
    const before = JSON.stringify(model);
    inspectComponent(model, 'motor');
    measure(model, { mode: 'voltage', a: 'D', b: '0', condition: 'movement' });
    runUseTest(model, 'load');
    expect(JSON.stringify(model)).toBe(before);
    expect(createModel('fan', 19)).toEqual(model);
    expect(runUseTest(JSON.parse(before), 'load')).toEqual(runUseTest(model, 'load'));
  });
  it('repairs only matching physical conditions', () => {
    const model = createModel('lantern', 1, [
      { componentId: 'bulb', condition: 'open' },
      { componentId: 'contact', condition: 'dirty' },
    ]);
    intervene(model, 'bulb', 'clean');
    expect(model.components.find((c) => c.id === 'bulb')?.condition).toBe('open');
    intervene(model, 'contact', 'clean');
    expect(runUseTest(model, 'load').passes).toBe(false);
    intervene(model, 'bulb', 'replace');
    expect(runUseTest(model, 'load').passes).toBe(true);
    expect(compatiblePart(model, 'bulb')).toBe('bulb');
    expect(compatiblePart(model, 'missing')).toBeUndefined();
    expect(terminals(model)).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D', '0']));
  });
  it('uses one connected voltage model for every probe pair', () => {
    const model = createModel('fan', 1, [{ componentId: 'cell', condition: 'weak' }]);
    for (const condition of ['bench', 'load', 'movement'] as const) {
      const reading = (a: string, b: string) =>
        measure(model, { mode: 'voltage', a, b, condition }).value ?? NaN;
      expect(reading('A', '0')).toBe(reading('B', '0'));
      expect(reading('A', 'B')).toBe(0);
      expect(reading('A', '0')).toBe(-reading('0', 'A'));
      expect(
        reading('A', 'B') +
          reading('B', 'C') +
          reading('C', 'D') +
          reading('D', '0') +
          reading('0', 'A'),
      ).toBeCloseTo(0, 1);
    }
  });
  it('keeps observed mechanical cues equal when probe direction reverses', () => {
    for (const faults of [
      [],
      [{ componentId: 'gear', condition: 'worn' as const }],
      [{ componentId: 'drum', condition: 'jammed' as const }],
    ]) {
      const model = createModel('music-box', 1, faults);
      for (const [a, b] of [
        ['A', '0'],
        ['D', '0'],
        ['C', 'D'],
        ['A', 'B'],
      ]) {
        const forward = measure(model, {
          mode: 'motion',
          a: a ?? '',
          b: b ?? '',
          condition: 'load',
        });
        const reverse = measure(model, {
          mode: 'motion',
          a: b ?? '',
          b: a ?? '',
          condition: 'load',
        });
        expect(forward.cues).toEqual(reverse.cues);
        expect(forward.value).toBeCloseTo(-(reverse.value ?? NaN), 2);
      }
    }
    expect(
      measure(createModel('music-box', 1, []), {
        mode: 'motion',
        a: 'A',
        b: '0',
        condition: 'bench',
      }).cues.signal,
    ).toBe('rotation');
  });
  it('requires a measured collar choice rather than automatic adjustment', () => {
    const model = createModel('music-box', 2, [
      { componentId: 'governor', condition: 'misaligned' },
    ]);
    expect(runUseTest(model, 'bench').output).toBe(24);
    intervene(model, 'governor', 'adjust');
    expect(runUseTest(model, 'bench').output).toBe(24);
    expect(calibrate(model, 'governor', 0).ok).toBe(true);
    expect(runUseTest(model, 'bench').passes).toBe(false);
    expect(calibrate(model, 'governor', 1).ok).toBe(true);
    expect(runUseTest(model, 'load').passes).toBe(true);
    expect(runUseTest(model, 'load').output).toBe(12);
    calibrate(model, 'governor', 3);
    expect(runUseTest(model, 'load').output).toBe(18);
    const before = JSON.stringify(model);
    expect(calibrate(model, 'governor', 5).ok).toBe(false);
    expect(calibrate(model, 'gear', 2).ok).toBe(false);
    expect(JSON.stringify(model)).toBe(before);
  });
  it('keeps aged contact appearance independent of electrical resistance', () => {
    const good = createModel('lantern', 1, []);
    const dirty = createModel('lantern', 1, [{ componentId: 'contact', condition: 'dirty' }]);
    expect(inspectComponent(good, 'contact')).toEqual(inspectComponent(dirty, 'contact'));
    expect(
      measure(dirty, { mode: 'voltage', a: 'C', b: 'D', condition: 'load' }).value,
    ).toBeGreaterThan(
      measure(good, { mode: 'voltage', a: 'C', b: 'D', condition: 'load' }).value ?? 0,
    );
  });
  it('saves matched mechanical specifications and permits calibration of changed ratios', () => {
    const variants = [0, 1, 2].map((seed) => createModel('music-box', seed, []));
    expect(
      new Set(
        variants.map(
          (model) => measure(model, { mode: 'motion', a: '0', b: 'A', condition: 'bench' }).value,
        ),
      ).size,
    ).toBe(3);
    for (const model of variants) expect(runUseTest(model, 'load').output).toBe(15);
    const altered = variants[1];
    if (!altered) throw new Error('Missing test variant');
    (altered as typeof altered & { gearRatio: number }).gearRatio = 2;
    expect(runUseTest(altered, 'load').output).toBe(30);
    calibrate(altered, 'governor', 0);
    expect(runUseTest(altered, 'load').output).toBe(12);
    expect(runUseTest(altered, 'load').passes).toBe(true);
    expect(runUseTest(JSON.parse(JSON.stringify(altered)), 'load')).toEqual(
      runUseTest(altered, 'load'),
    );
  });
  it('distinguishes contamination, loose engagement and permanent wear at one gear', () => {
    const dirty = createModel('music-box', 0, [{ componentId: 'gear', condition: 'dirty' }]);
    const loose = createModel('music-box', 0, [{ componentId: 'gear', condition: 'misaligned' }]);
    const worn = createModel('music-box', 0, [{ componentId: 'gear', condition: 'worn' }]);
    expect(runUseTest(dirty, 'bench').passes).toBe(false);
    expect(runUseTest(loose, 'bench').passes).toBe(true);
    expect(runUseTest(worn, 'bench').passes).toBe(true);
    expect(runUseTest(loose, 'load').output).toBe(0);
    expect(runUseTest(worn, 'load').output).toBeGreaterThan(0);
    intervene(dirty, 'gear', 'adjust');
    expect(runUseTest(dirty, 'load').passes).toBe(false);
    intervene(dirty, 'gear', 'clean');
    expect(runUseTest(dirty, 'load').passes).toBe(true);
    intervene(loose, 'gear', 'clean');
    expect(runUseTest(loose, 'load').passes).toBe(false);
    expect(intervene(loose, 'gear', 'adjust').summary).toContain('spindle');
    expect(runUseTest(loose, 'load').passes).toBe(true);
    intervene(worn, 'gear', 'clean');
    intervene(worn, 'gear', 'adjust');
    expect(runUseTest(worn, 'load').passes).toBe(false);
    intervene(worn, 'gear', 'replace');
    expect(runUseTest(worn, 'load').passes).toBe(true);
  });
  it('requires different work on dirty, loose and worn contacts', () => {
    for (const condition of ['dirty', 'misaligned', 'worn', 'open'] as const) {
      const model = createModel('lantern', 0, [{ componentId: 'contact', condition }]);
      expect(runUseTest(model, condition === 'misaligned' ? 'movement' : 'load').passes).toBe(
        false,
      );
      intervene(model, 'contact', 'clean');
      expect(runUseTest(model, 'movement').passes).toBe(condition === 'dirty');
      intervene(model, 'contact', 'adjust');
      expect(runUseTest(model, 'movement').passes).toBe(
        condition === 'dirty' || condition === 'misaligned',
      );
      intervene(model, 'contact', 'replace');
      expect(runUseTest(model, 'movement').passes).toBe(true);
    }
  });
  it('every advertised fault changes functional output and remains repairable', () => {
    const devices = ['lantern', 'fan', 'music-box'] as const;
    for (const kind of devices) {
      const baseline = createModel(kind, 0, []);
      for (const component of baseline.components)
        for (const condition of supportedFaults[component.kind]) {
          const faulty = createModel(kind, 0, [{ componentId: component.id, condition }]);
          expect(
            ['bench', 'load', 'movement'].some(
              (test) => !runUseTest(faulty, test as 'bench' | 'load' | 'movement').passes,
            ),
            `${component.kind}/${condition}`,
          ).toBe(true);
          intervene(faulty, component.id, 'replace');
          for (const test of ['bench', 'load', 'movement'] as const)
            expect(runUseTest(faulty, test).passes, `${component.kind}/${condition}/${test}`).toBe(
              true,
            );
        }
    }
  });
  it('compares upstream readings to separate spring drag and slipping gears', () => {
    const drag = createModel('music-box', 1, [{ componentId: 'spring', condition: 'dirty' }]);
    const slip = createModel('music-box', 1, [{ componentId: 'gear', condition: 'worn' }]);
    const rpm = (model: typeof drag, node: string, test: 'bench' | 'load') =>
      measure(model, { mode: 'motion', a: '0', b: node, condition: test }).value ?? NaN;
    expect(rpm(drag, 'A', 'bench')).toBeLessThan(rpm(slip, 'A', 'bench'));
    expect(rpm(slip, 'A', 'load')).toBe(rpm(slip, 'A', 'bench'));
    expect(rpm(slip, 'B', 'load')).toBeLessThan(rpm(slip, 'B', 'bench'));
    intervene(drag, 'spring', 'clean');
    expect(runUseTest(drag, 'load').passes).toBe(true);
  });
  it('calibrates to distinct public owner pace requests rather than a canonical setting', () => {
    expect(governorMultipliers).toEqual([0.4, 0.8, 1, 1.2, 1.6]);
    for (const [desiredRPM, setting] of [
      [12, 1],
      [18, 3],
    ]) {
      const model = createModel('music-box', 1, []) as ReturnType<typeof createModel> & {
        desiredRPM: number;
        tolerance: number;
      };
      model.desiredRPM = desiredRPM ?? 15;
      model.tolerance = 1;
      expect(runUseTest(model, 'bench').passes).toBe(false);
      calibrate(model, 'governor', setting ?? 2);
      expect(runUseTest(model, 'load').passes).toBe(true);
      expect(runUseTest(model, 'load').summary).toContain(`requested ${desiredRPM}`);
      expect(model.components.find((c) => c.id === 'governor')?.condition).toBe('good');
    }
  });
  it('retains two separate problems until each physical intervention succeeds', () => {
    const model = createModel('music-box', 1, [
      { componentId: 'spring', condition: 'dirty' },
      { componentId: 'gear', condition: 'misaligned' },
    ]);
    const before = JSON.stringify(model);
    for (const condition of ['bench', 'load', 'movement'] as const)
      measure(model, { mode: 'motion', a: '0', b: 'D', condition });
    expect(JSON.stringify(model)).toBe(before);
    intervene(model, 'gear', 'adjust');
    expect(runUseTest(model, 'load').passes).toBe(false);
    intervene(model, 'spring', 'clean');
    expect(runUseTest(model, 'load').passes).toBe(true);
  });
  it('distinguishes dirty and open contact paths with power-off resistance', () => {
    const dirty = createModel('lantern', 0, [{ componentId: 'contact', condition: 'dirty' }]);
    const open = createModel('lantern', 0, [{ componentId: 'contact', condition: 'open' }]);
    dirty.power = false;
    open.power = false;
    expect(measure(dirty, { mode: 'continuity', a: 'C', b: 'D', condition: 'bench' }).value).toBe(
      10,
    );
    expect(
      measure(open, { mode: 'continuity', a: 'C', b: 'D', condition: 'bench' }).value,
    ).toBeNull();
    expect(inspectComponent(dirty, 'contact')).toEqual(inspectComponent(open, 'contact'));
  });
  it('separates contact wear from loose seating under load and movement', () => {
    const worn = createModel('fan', 0, [{ componentId: 'contact', condition: 'worn' }]);
    const loose = createModel('fan', 0, [{ componentId: 'contact', condition: 'misaligned' }]);
    expect(runUseTest(worn, 'bench').passes).toBe(true);
    expect(runUseTest(loose, 'bench').passes).toBe(true);
    expect(runUseTest(worn, 'load').passes).toBe(false);
    expect(runUseTest(loose, 'load').passes).toBe(true);
    expect(runUseTest(worn, 'movement').passes).toBe(false);
    expect(runUseTest(loose, 'movement').passes).toBe(false);
    intervene(worn, 'contact', 'adjust');
    intervene(loose, 'contact', 'adjust');
    expect(runUseTest(worn, 'movement').passes).toBe(false);
    expect(runUseTest(loose, 'movement').passes).toBe(true);
  });
  it('preserves circuit arithmetic for every electrical fault and operating condition', () => {
    for (const kind of ['lantern', 'fan'] as const) {
      const healthy = createModel(kind, 0, []);
      for (const part of healthy.components)
        for (const fault of supportedFaults[part.kind]) {
          const model = createModel(kind, 0, [{ componentId: part.id, condition: fault }]);
          for (const condition of ['bench', 'load', 'movement'] as const) {
            const read = (a: string, b: string) =>
              measure(model, { mode: 'voltage', a, b, condition }).value ?? NaN;
            expect(read('A', 'B')).toBe(0);
            expect(read('A', '0')).toBe(read('B', '0'));
            expect(
              read('A', 'B') + read('B', 'C') + read('C', 'D') + read('D', '0') + read('0', 'A'),
            ).toBeCloseTo(0, 1);
            expect(read('C', 'D')).toBeCloseTo(-read('D', 'C'), 2);
          }
        }
    }
  });
  it('distinguishes dirty brakes from load-dependent governor wear', () => {
    const dirty = createModel('music-box', 0, [{ componentId: 'governor', condition: 'dirty' }]);
    const worn = createModel('music-box', 0, [{ componentId: 'governor', condition: 'worn' }]);
    expect(runUseTest(dirty, 'bench').output).toBe(7.5);
    expect(runUseTest(worn, 'bench').output).toBe(15);
    expect(runUseTest(worn, 'load').output).toBe(22.5);
    intervene(dirty, 'governor', 'clean');
    intervene(worn, 'governor', 'clean');
    expect(runUseTest(dirty, 'load').passes).toBe(true);
    expect(runUseTest(worn, 'load').passes).toBe(false);
    const before = JSON.stringify(worn);
    measure(worn, { mode: 'motion', a: 'B', b: 'C', condition: 'load' });
    inspectComponent(worn, 'governor');
    expect(JSON.stringify(worn)).toBe(before);
  });
});
