import { describe, expect, it } from 'vitest';
import {
  applyNeighbourhoodAction,
  freshNeighbourhood,
  modelMemoryLines,
  type NeighbourhoodContext,
  neighbourhoodActions,
} from '../src/game/neighbourhood';
import {
  adaptCaseTray,
  checkCaseCarry,
  checkCaseTray,
  fitCaseCatch,
  freshCaseFittings,
  measureCaseFittings,
} from '../src/game/repairs';
import type { RepairObject } from '../src/game/types';

const object = (): RepairObject => ({
  id: 'nora-sample-case',
  title: 'Case',
  owner: 'Nora',
  story: 'Samples',
  form: 'box',
  fault: 'worn-catch',
  location: 'bench',
  observations: [],
  inspected: false,
  tested: false,
  attempted: 0,
  repaired: false,
  verified: false,
  discovered: true,
});
const context = (): NeighbourhoodContext => ({
  weekConcluded: true,
  noraHere: true,
  drawingsShared: false,
  agree: () => true,
  frontageAvailable: true,
  compatibleSourceKnown: true,
});
describe('old-window request', () => {
  it('hearing does not accept, and a refused optional visit does not gate the case', () => {
    const s = { now: 10, neighbourhood: freshNeighbourhood() };
    const c = context();
    applyNeighbourhoodAction(s, 'neighbourhood-remember', c);
    c.frontageAvailable = false;
    const failed = applyNeighbourhoodAction(s, 'neighbourhood-frontage', c);
    expect(failed?.minutes).toBe(0);
    expect(s.neighbourhood.frontage).toBe('unasked');
    applyNeighbourhoodAction(s, 'neighbourhood-hear-case', c);
    expect(s.neighbourhood.caseStage).toBe('offered');
    expect(neighbourhoodActions(s, c).map((a) => a.id)).toContain('neighbourhood-decline-case');
  });
  it('describes all model histories without exposing stored drawings', () => {
    expect(
      modelMemoryLines(undefined, false)
        .map((l) => l.text)
        .join(' '),
    ).not.toContain('checked');
    const m = object();
    m.id = 'paper-street';
    expect(
      modelMemoryLines(m, false)
        .map((l) => l.text)
        .join(' '),
    ).toContain('unfinished');
    m.repaired = true;
    expect(
      modelMemoryLines(m, false)
        .map((l) => l.text)
        .join(' '),
    ).toContain('still needs its longer check');
    m.verified = true;
    expect(
      modelMemoryLines(m, false)
        .map((l) => l.text)
        .join(' '),
    ).toContain('checked paper street');
    expect(
      modelMemoryLines(m, false)
        .map((l) => l.text)
        .join(' '),
    ).toContain('remain put away');
  });
  it('refused revised use retains original request and cannot return an adaptation', () => {
    const n = freshNeighbourhood();
    n.introduced = true;
    n.caseStage = 'accepted';
    const s = { now: 0, neighbourhood: n };
    const c = context();
    c.agree = () => false;
    expect(applyNeighbourhoodAction(s, 'neighbourhood-tray-consent', c)?.adaptTray).toBeUndefined();
    expect(n.useConsent).toBe('original');
    expect(neighbourhoodActions(s, c).map((a) => a.id)).not.toContain('neighbourhood-return-tray');
  });
});
describe('retained physical case hardware', () => {
  it('measurement rejects the incompatible label without consuming or crediting it', () => {
    const item = object();
    const f = freshCaseFittings();
    const before = structuredClone(f);
    expect(fitCaseCatch(item, f, 'replacement').succeeded).toBe(false);
    expect(f).toEqual(before);
    measureCaseFittings(item, f);
    expect(fitCaseCatch(item, f, 'replacement').succeeded).toBe(false);
    expect(f.replacement).toBe('retained');
    expect(item.attempted).toBe(0);
    expect(item.verified).toBe(false);
  });
  it('requires source permission and repeated closure for the original outcome', () => {
    const item = object();
    const f = freshCaseFittings();
    measureCaseFittings(item, f);
    f.compatible = {
      source: 'Nora retained catch',
      permission: false,
      spacing: 24,
      status: 'retained',
    };
    expect(fitCaseCatch(item, f, 'compatible').succeeded).toBe(false);
    f.compatible.permission = true;
    expect(fitCaseCatch(item, f, 'compatible').succeeded).toBe(true);
    expect(item.verified).toBe(false);
    checkCaseCarry(item, f);
    expect(item.verified).toBe(true);
    expect(f.original).toBe('retained');
    expect(f.replacement).toBe('retained');
  });
  it('adaptation requires consent and keeps distinct physical credit', () => {
    const item = object();
    const f = freshCaseFittings();
    expect(() => adaptCaseTray(item, f, false)).toThrow('not agreed');
    adaptCaseTray(item, f, true);
    checkCaseTray(item, f);
    expect(f.trayChecked).toBe(true);
    expect(item.repaired).toBe(false);
    expect(item.verified).toBe(false);
    expect(f.original).toBe('retained');
    expect(f.replacement).toBe('retained');
  });
});

describe('episode ownership boundaries', () => {
  it('requires actual source-use agreement after comparison, with no automatic transfer', () => {
    const n = freshNeighbourhood();
    n.introduced = true;
    n.caseStage = 'accepted';
    const s = { now: 120, neighbourhood: n };
    const c = context();
    c.fittings = freshCaseFittings();
    c.fittings.measured = true;
    c.compatibleSourceKnown = false;
    c.agree = () => false;
    expect(neighbourhoodActions(s, c).map((a) => a.id)).not.toContain('neighbourhood-source');
    const compared = applyNeighbourhoodAction(s, 'neighbourhood-compare-source', c);
    expect(compared?.minutes).toBe(5);
    expect(compared?.sourceFitting).toBeUndefined();
    expect(c.fittings.compatible).toBeUndefined();
    expect(applyNeighbourhoodAction(s, 'neighbourhood-source', c)?.sourceFitting).toBeUndefined();
    expect(s.now).toBe(120);
    c.agree = () => true;
    expect(applyNeighbourhoodAction(s, 'neighbourhood-source', c)?.sourceFitting?.permission).toBe(
      true,
    );
  });
  it('a checked tray never offers the original repaired return', () => {
    const n = freshNeighbourhood();
    n.introduced = true;
    n.caseStage = 'accepted';
    n.useConsent = 'stationary-tray';
    const s = { now: 0, neighbourhood: n };
    const c = context();
    c.caseObject = object();
    c.fittings = freshCaseFittings();
    adaptCaseTray(c.caseObject, c.fittings, true);
    checkCaseTray(c.caseObject, c.fittings);
    expect(neighbourhoodActions(s, c).map((a) => a.id)).toContain('neighbourhood-return-tray');
    expect(neighbourhoodActions(s, c).map((a) => a.id)).not.toContain(
      'neighbourhood-return-repaired',
    );
    expect(applyNeighbourhoodAction(s, 'neighbourhood-return-tray', c)?.returnCase).toBe(
      'adapted-checked',
    );
    expect(c.caseObject.verified).toBe(false);
  });
  it('accepting the case does not accept the optional light', () => {
    const n = freshNeighbourhood();
    n.introduced = true;
    n.caseStage = 'offered';
    const s = { now: 0, neighbourhood: n };
    const c = context();
    expect(applyNeighbourhoodAction(s, 'neighbourhood-accept-case', c)?.job).toBeUndefined();
    expect(n.lamp).toBe('unheard');
    expect(applyNeighbourhoodAction(s, 'neighbourhood-hear-light', c)?.job).toBeUndefined();
    expect(n.lamp).toBe('offered');
    expect(applyNeighbourhoodAction(s, 'neighbourhood-accept-light', c)?.job?.id).toBe(
      'workshop-neighbourhood-nora-light',
    );
  });
});

// These are physical/module controls; runtime tests separately exercise real HF consent and clocks.
describe('agreed physical mode', () => {
  it('cannot fit or certify a carrying catch after checked tray adaptation', () => {
    const item = object();
    const f = freshCaseFittings();
    measureCaseFittings(item, f);
    f.compatible = {
      source: 'Nora retained catch',
      permission: true,
      spacing: 24,
      status: 'retained',
    };
    adaptCaseTray(item, f, true);
    checkCaseTray(item, f);
    const before = structuredClone({ item, f });
    expect(fitCaseCatch(item, f, 'compatible').succeeded).toBe(false);
    expect(() => checkCaseCarry(item, f)).toThrow('stationary use');
    expect({ item, f }).toEqual(before);
    expect(item.verified).toBe(false);
    expect(f.trayChecked).toBe(true);
  });
});
