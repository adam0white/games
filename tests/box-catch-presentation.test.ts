import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MeshStandardMaterial } from 'three';
import { expect, it } from 'vitest';
import { createGame, getView, transition } from '../src/game/engine';
import { applyRepair, testCatch } from '../src/game/repairs';
import type { ObjectView } from '../src/game/types';
import { createObjectModel } from '../src/ui/inspection/objectModel';
import { ObjectIllustration } from '../src/ui/ObjectIllustration';

const box: ObjectView = {
  id: 'exterior-box',
  title: 'Box',
  owner: 'Neighbour',
  story: '',
  condition: 'Unknown',
  form: 'box',
  appearance: 'box',
  visual: 'off',
  inspected: false,
  observations: [],
};
it('only an actual rubbing-keeper observation offsets the keeper in both presentations', () => {
  for (const observed of [
    undefined,
    'keeper-rubs',
    'hinge-stiff-clear',
    'mechanism-working',
  ] as const) {
    const view = { ...box, catchPresentation: observed ? { observed } : undefined };
    const model = createObjectModel(view, false, ['mechanism']);
    expect(model.root.getObjectByName('box-keeper')?.position.x).toBe(
      observed === 'keeper-rubs' ? 0.075 : 0,
    );
    const svg = renderToStaticMarkup(createElement(ObjectIllustration, { object: view }));
    expect(svg.includes('translate(8 0)')).toBe(observed === 'keeper-rubs');
    model.dispose();
  }
});
it('mechanism work selects the catch and keeper; whole-object inspection remains available', () => {
  const model = createObjectModel(box, false, ['mechanism']);
  const lit = () =>
    model.hitRegions.filter(
      (mesh) =>
        mesh.material instanceof MeshStandardMaterial && mesh.material.emissive.getHex() !== 0,
    );
  model.highlight('mechanism');
  expect(
    lit()
      .map((mesh) => mesh.name)
      .sort(),
  ).toEqual(['box-catch', 'box-keeper']);
  model.highlight('shell');
  expect(lit().length).toBe(model.hitRegions.length);
  model.highlight(null);
  expect(lit()).toHaveLength(0);
  model.dispose();
});

it('the public projection follows actual catch evidence and current successful work, never the latent cause', () => {
  const state = transition(createGame(1701), { type: 'action', id: 'talk-family' });
  const item = state.objects.find((candidate) => candidate.id === 'family');
  if (!item) throw Error('Missing object fixture');
  item.form = 'box';
  item.appearance = 'box';
  item.access = undefined;
  item.inspected = true;
  item.evidence = [];
  for (const fault of ['hinge', 'catch-offset'] as const) {
    item.fault = fault;
    expect(getView(state).focus?.catchPresentation).toBeUndefined();
  }
  item.fault = 'hinge';
  testCatch(item);
  expect(getView(state).focus?.catchPresentation).toEqual({ observed: 'hinge-stiff-clear' });
  item.evidence = [];
  item.fault = 'catch-offset';
  testCatch(item);
  expect(getView(state).focus?.catchPresentation).toEqual({ observed: 'keeper-rubs' });
  expect(applyRepair(item, 'adjust-catch', state.parts).succeeded).toBe(true);
  expect(getView(state).focus?.catchPresentation).toEqual({ observed: 'mechanism-working' });
  expect(applyRepair(item, 'lubricate-hinge', state.parts).succeeded).toBe(false);
  expect(item.evidence).toContain('mechanism-working');
  expect(getView(state).focus?.catchPresentation).toEqual({ observed: 'keeper-rubs' });
});
