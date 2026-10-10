import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { ObjectView } from '../src/game/types';
import { createObjectModel } from '../src/ui/inspection/objectModel';
import { ObjectIllustration } from '../src/ui/ObjectIllustration';

const base: ObjectView = {
  id: 'paper-street',
  title: 'Your model',
  owner: 'You',
  story: 'Retained model',
  form: 'box',
  appearance: 'model',
  inspected: true,
  progress: 'checked',
  visual: 'off',
  observations: [],
  condition: 'Retained model',
};
it('the actual removable edition retains original fronts and fitted support as separate geometry', () => {
  const remembered = createObjectModel(base);
  const updated = createObjectModel({
    ...base,
    personalPresentation: {
      fitted: 'updated',
      originalFronts: 'retained-envelope',
      insert: 'fitted',
      support: 'fitted',
      sleeve: 'retained',
      circuitChecked: true,
      custody: 'player',
    },
  });
  expect(remembered.root.getObjectByName('remembered-original-front')).toBeDefined();
  expect(remembered.root.getObjectByName('updated-removable-front')).toBeUndefined();
  expect(updated.root.getObjectByName('updated-removable-front')).toBeDefined();
  expect(updated.root.getObjectByName('updated-repair-door')).toBeDefined();
  expect(updated.root.getObjectByName('updated-nora-sample-window')).toBeDefined();
  expect(updated.root.getObjectByName('updated-paper-delivery-gate')).toBeDefined();
  expect(updated.root.getObjectByName('remembered-paper-shutter')).toBeUndefined();
  expect(remembered.root.getObjectByName('remembered-wide-shop-window')).toBeDefined();
  expect(remembered.root.getObjectByName('remembered-paper-shutter')).toBeDefined();
  expect(remembered.root.getObjectByName('updated-repair-door')).toBeUndefined();
  expect(updated.root.getObjectByName('retained-original-front-envelope')).toBeDefined();
  expect(updated.root.getObjectByName('fitted-removable-support')).toBeDefined();
  expect(updated.root.getObjectByName('paper-street-base')?.userData.repairTarget).toBe('support');
  remembered.dispose();
  updated.dispose();
});
it('known loaded observations and performed work visibly alter the same trolley assembly', () => {
  const view: ObjectView = {
    ...base,
    id: 'borrowed-trolley',
    form: 'trolley',
    appearance: 'timer',
  };
  const known = { comparison: 'compared' as const, loadMode: 'full' as const, routeChecked: false };
  const neutral = createObjectModel({
    ...view,
    trolleyPresentation: { ...known, observed: 'unknown' },
  });
  const wandering = createObjectModel({
    ...view,
    trolleyPresentation: { ...known, observed: 'wanders' },
  });
  const aligned = createObjectModel({
    ...view,
    trolleyPresentation: { ...known, observed: 'wanders', intervention: 'wheel-aligned' },
  });
  function wheelAngles(model: ReturnType<typeof createObjectModel>) {
    const values: number[] = [];
    model.root.traverse((m) => {
      if (m.name === 'trolley-wheel') values.push(m.rotation.y);
    });
    return values;
  }
  expect(wheelAngles(neutral)).toEqual([0, 0]);
  expect(wheelAngles(wandering)).toEqual([0, 0.18]);
  expect(wheelAngles(aligned)).toEqual([0, 0]);
  const rubbing = createObjectModel({
    ...view,
    trolleyPresentation: { ...known, observed: 'rubs' },
  });
  const secured = createObjectModel({
    ...view,
    trolleyPresentation: { ...known, observed: 'rubs', intervention: 'strap-secured' },
  });
  expect(rubbing.root.getObjectByName('trolley-retained-strap-tail')?.position.y).toBe(0.29);
  expect(secured.root.getObjectByName('trolley-retained-strap-tail')?.position.y).toBe(0.7);
  for (const model of [neutral, wandering, aligned, rubbing, secured]) model.dispose();
});

it('the illustrated fallback shows only the actually fitted frontage, without claiming drive motion', () => {
  const remembered = renderToStaticMarkup(createElement(ObjectIllustration, { object: base }));
  const updated = renderToStaticMarkup(
    createElement(ObjectIllustration, {
      object: {
        ...base,
        personalPresentation: {
          fitted: 'updated',
          originalFronts: 'retained-envelope',
          insert: 'fitted',
          support: 'unmade',
          sleeve: 'unmade',
          circuitChecked: false,
          custody: 'player',
        },
      },
    }),
  );
  expect(remembered).toContain('data-frontage="remembered"');
  expect(remembered).toContain('data-part="paper-shutters"');
  expect(remembered).not.toContain('data-part="repair-door"');
  for (const part of ['repair-door', 'sample-window', 'delivery-gate'])
    expect(updated).toContain(`data-part="${part}"`);
  expect(updated).not.toContain('data-frontage="remembered"');
  expect(updated).not.toContain('<animate');
});
