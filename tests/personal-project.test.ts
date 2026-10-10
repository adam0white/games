import { describe, expect, it } from 'vitest';
import {
  applyPersonalProjectAction,
  getPersonalProjectView,
  type PersonalProjectContext,
  type PersonalProjectGame,
  personalProjectActions,
  personalProjectAway,
} from '../src/game/personal-project';

function fixture(repaired = true) {
  const s: PersonalProjectGame = { now: 540, operations: { episode: 1 } };
  const ctx: PersonalProjectContext = {
    model: { present: true, repaired, verified: repaired },
    noraHere: true,
    chooseOccasion: () => true,
  };
  const act = (key: string) => {
    const r = applyPersonalProjectAction(s, `operations-personal-${key}`, ctx);
    expect(r, key).not.toBeNull();
    s.now += r?.minutes ?? 0;
    return r;
  };
  return { s, ctx, act };
}
describe('the retained paper street', () => {
  it('can arrange a missed return visit again while the same model remains with Nora', () => {
    const { s, ctx, act } = fixture();
    act('open');
    const p = s.operations?.personalProject;
    if (!p) throw Error('Missing project');
    p.custody = 'nora';
    p.occasion = 'loaned';
    p.returnAt = s.now;
    ctx.noraHere = false;
    act('arrange-return');
    expect(
      personalProjectActions(s, ctx).some((a) => a.id === 'operations-personal-arrange-return'),
    ).toBe(false);
    s.now += 90;
    expect(
      personalProjectActions(s, ctx).some((a) => a.id === 'operations-personal-arrange-return'),
    ).toBe(true);
    const result = act('arrange-return');
    expect(result?.visits).toHaveLength(1);
    expect(p.custody).toBe('nora');
    expect(p.occasion).toBe('loaned');
    expect(p.cardSheets).toBe(2);
  });

  it('makes a removable updated street from finite card and retains the actual original fronts', () => {
    const { s, act } = fixture();
    act('open');
    act('measure');
    act('make-insert');
    act('fit-updated');
    expect(s.operations?.personalProject).toMatchObject({
      fitted: 'updated',
      originalFronts: 'retained-envelope',
      cardSheets: 1,
      insert: 'fitted',
      circuitChecked: false,
    });
    act('check-circuit');
    act('keep-edition');
    expect(getPersonalProjectView(s)?.comparison).toContain('no card rubs');
    act('fit-remembered');
    expect(s.operations?.personalProject?.circuitChecked).toBe(false);
    expect(s.operations?.personalProject).toMatchObject({
      fitted: 'remembered',
      originalFronts: 'on-model',
      insert: 'retained',
      cardSheets: 1,
    });
    act('fit-updated');
    expect(s.operations?.personalProject?.cardSheets).toBe(1);
  });
  it('a display alteration does not invent a repaired drive or full circuit for a missing gear', () => {
    const { s, ctx, act } = fixture(false);
    act('open');
    act('measure');
    act('make-insert');
    act('fit-updated');
    expect(personalProjectActions(s, ctx).some((a) => a.id.endsWith('check-circuit'))).toBe(false);
    expect(applyPersonalProjectAction(s, 'operations-personal-check-circuit', ctx)).toBeNull();
    act('put-aside');
    expect(s.operations?.personalProject?.circuitChecked).toBe(false);
    expect(ctx.model?.repaired).toBe(false);
    if (s.operations) s.operations.episode = 2;
    act('invite-nora');
    act('hear-occasion');
    expect(
      personalProjectActions(s, ctx).some(
        (a) => a.id.endsWith('agree-loan') || a.id.endsWith('agree-bench'),
      ),
    ).toBe(false);
    act('decline-occasion');
    expect(s.operations?.personalProject?.custody).toBe('player');
  });
  it('stable support changes the actual arrangement and requires a new circuit', () => {
    const { s, ctx, act } = fixture();
    act('open');
    act('measure');
    act('check-circuit');
    act('make-support');
    act('fit-support');
    expect(s.operations?.personalProject?.circuitChecked).toBe(false);
    act('check-circuit');
    expect(getPersonalProjectView(s)?.comparison).toContain('remembered street');
    expect(s.operations?.personalProject?.cardSheets).toBe(1);
    act('make-sleeve');
    expect(s.operations?.personalProject?.cardSheets).toBe(0);
    expect(personalProjectActions(s, ctx).some((a) => a.id.endsWith('make-insert'))).toBe(false);
  });
  it('actual occasion refusal transfers no model, time promise or successful showing', () => {
    const { s, ctx, act } = fixture();
    act('open');
    act('check-circuit');
    act('keep-edition');
    if (s.operations) s.operations.episode = 2;
    act('invite-nora');
    ctx.noraHere = false;
    expect(applyPersonalProjectAction(s, 'operations-personal-hear-occasion', ctx)).toBeNull();
    ctx.noraHere = true;
    act('hear-occasion');
    ctx.chooseOccasion = () => false;
    const decline = act('agree-bench');
    expect(decline?.lines[0]?.text).toContain('cannot');
    expect(s.operations?.personalProject?.occasion).toBe('offered');
    expect(personalProjectAway(s)).toBe(false);
  });
  it('stationary case history supports a real attended showing without a fabricated carrying case', () => {
    const { s, ctx, act } = fixture();
    act('open');
    act('measure');
    act('make-support');
    act('fit-support');
    act('check-circuit');
    act('keep-edition');
    if (s.operations) s.operations.episode = 2;
    ctx.noraCaseOutcome = 'tray';
    act('invite-nora');
    act('hear-occasion');
    expect(personalProjectActions(s, ctx).some((a) => a.id.endsWith('agree-loan'))).toBe(false);
    act('agree-bench');
    const shown = act('show-bench');
    expect(shown?.minutes).toBe(20);
    expect(shown?.participantId).toBe('nora');
    expect(s.operations?.personalProject).toMatchObject({
      occasion: 'shown',
      custody: 'player',
      occasionMode: 'stationary',
      support: 'fitted',
    });
  });
  it('protected loan removes the same model from player custody until actual return and repeated circuit', () => {
    const { s, ctx, act } = fixture();
    act('open');
    act('measure');
    act('make-insert');
    act('fit-updated');
    act('make-sleeve');
    act('check-circuit');
    act('keep-edition');
    if (s.operations) s.operations.episode = 2;
    act('invite-nora');
    act('hear-occasion');
    act('agree-loan');
    act('loan-model');
    const saved = JSON.parse(JSON.stringify(s)) as PersonalProjectGame;
    expect(personalProjectAway(saved)).toBe(true);
    expect(personalProjectActions(s, ctx).some((a) => a.id.endsWith('fit-remembered'))).toBe(false);
    expect(applyPersonalProjectAction(s, 'operations-personal-arrange-return', ctx)).toBeNull();
    s.now += 120;
    act('arrange-return');
    ctx.noraHere = false;
    expect(applyPersonalProjectAction(s, 'operations-personal-receive-model', ctx)).toBeNull();
    ctx.noraHere = true;
    const returned = act('receive-model');
    expect(returned?.minutes).toBe(12);
    expect(s.operations?.personalProject).toMatchObject({
      custody: 'player',
      occasion: 'returned',
      fitted: 'updated',
      originalFronts: 'retained-envelope',
      cardSheets: 0,
      insert: 'fitted',
      sleeve: 'retained',
    });
    expect(personalProjectAway(s)).toBe(false);
    expect(ctx.model?.repaired).toBe(true);
  });
});
