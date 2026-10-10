import { describe, expect, it } from 'vitest';
import { eveningTarget } from '../src/ui/EveningTable';

describe('evening physical controls', () => {
  it('binds actual physical moves and views, keeping received conversation and exit ordinary', () => {
    for (const id of [
      'evening-model-front',
      'evening-turn-angled',
      'evening-original',
      'evening-run-circuit',
      'evening-look-under',
    ])
      expect(eveningTarget(id)).toBe('model');
    expect(eveningTarget('evening-light-near')).toBe('light');
    for (const id of ['evening-show-mum', 'evening-put-away', 'evening-bring-lamp'])
      expect(eveningTarget(id)).toBeNull();
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { type EveningSceneView, EveningTable, eveningActionGroup } from '../src/ui/EveningTable';

it('groups actual choices once with direct movement and visible optional-discovery hints', () => {
  const ids = [
    'evening-model-front',
    'evening-turn-angled',
    'evening-light-near',
    'evening-original',
    'evening-look-under',
    'evening-run-circuit',
    'evening-show-mum',
    'evening-keep-wall',
    'evening-put-away',
  ];
  const view: EveningSceneView = {
    stage: 'table',
    title: 'Street',
    detail: '',
    light: 'room',
    lampPosition: 'side',
    modelPosition: 'back',
    modelAngle: 'facing',
    packagingRevealed: false,
    mumPresent: false,
    actionIds: ids,
  };
  const html = renderToStaticMarkup(
    createElement(EveningTable, {
      view,
      actions: ids.map((id) => ({ id, label: id })),
      disabled: false,
      onAction: () => {},
    }),
  );
  for (const id of ids) expect(html.split(`>${id}</button>`)).toHaveLength(2);
  expect(html).toContain('Look closer');
  expect(html).toContain('Underside · Circuit');
  expect(html).toContain('Paper street');
  expect(html).not.toContain('Apply at');
  expect(eveningActionGroup('evening-original')).toBe('fronts');
  expect(eveningActionGroup('evening-unknown-future-choice')).toBe('other');
});
