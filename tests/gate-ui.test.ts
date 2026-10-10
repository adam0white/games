import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GateWalkScene } from '../src/ui/GateWalkScene';
import { type GateWalkView, gateAction, gatePose, gateTarget } from '../src/ui/gateBindings';
import { createGateModel } from '../src/ui/gateModel';

const daylight: GateWalkView = {
  stage: 'gate',
  title: 'As far as the gate',
  detail: '',
  light: 'daylight',
  samWithPlayer: true,
  handling: undefined,
  preference: undefined,
  actionIds: ['gate-walk-hold-gate', 'gate-walk-sam-first', 'gate-walk-return'],
};
const actions = daylight.actionIds.map((id) => ({
  id,
  label: id,
  minutes: 3,
  kind: 'quiet' as const,
}));
describe('gate contextual control parity', () => {
  it('exposes only the two actual practical choices and always a safe return', () => {
    const html = renderToStaticMarkup(
      createElement(GateWalkScene, {
        view: daylight,
        actions,
        disabled: false,
        onAction: () => {},
      }),
    );
    expect(html.match(/gate-context-target/g)).toHaveLength(2);
    expect(html).toContain('gate-walk-return');
    expect(html).not.toContain('gate-walk-hang');
    expect(html).not.toContain('select');
  });
  it('withholds practical input when attendance, actual torch or offered action is absent', () => {
    expect(gateAction(daylight, 'gate-walk-hold-gate', false)).toBe('gate-walk-hold-gate');
    expect(
      gateAction({ ...daylight, samWithPlayer: false }, 'gate-walk-hold-gate', false),
    ).toBeNull();
    expect(gateAction(daylight, 'gate-walk-hold-gate', true)).toBeNull();
    expect(gateAction({ ...daylight, actionIds: [] }, 'gate-walk-hold-gate', false)).toBeNull();
    expect(
      gateAction(
        { ...daylight, light: 'sam-torch', actionIds: ['gate-walk-hang'] },
        'gate-walk-hang',
        false,
      ),
    ).toBeNull();
    expect(gateTarget('gate-walk-watch')).toBeNull();
    expect(gateTarget('gate-walk-hang')).toBe('loop');
  });
  it('changes the actual hinge pose only for performed handling; authored latch remains attached', () => {
    const model = createGateModel();
    expect(gatePose(daylight)).toBe(0);
    expect(gatePose({ ...daylight, handling: 'gate-held' })).toBeGreaterThan(0.8);
    expect(model.latch.parent).toBe(model.gate);
    expect(model.hook.parent).toBe(model.gate);
    model.dispose();
  });
});
