import { expect } from 'vitest';
import { getView } from '../../src/game/engine';
import type { GameState } from '../../src/game/types';
import { positiveAction, waitForPublicAttendance } from './public-attendance';
import { nextSchoolAction, opening } from './school-route';

function has(s: GameState, id: string): boolean {
  return getView(s).actions.some((action) => action.id === id);
}
function waitFor(s: GameState, id: string): GameState {
  for (let n = 0; n < 80 && !has(s, id); n++)
    s = positiveAction(s, has(s, 'wait-person') ? 'wait-person' : 'next-day');
  expect(has(s, id), `Reachable opportunity ${id}`).toBe(true);
  return s;
}
function arrange(s: GameState): GameState {
  for (let n = 0; n < 80; n++) {
    if (has(s, 'arrange-learning')) s = positiveAction(s, 'arrange-learning');
    if (
      s.apprentice?.arranged &&
      s.now < s.apprentice.visitUntil &&
      s.people.sam?.activity?.action === 'learn'
    )
      return s;
    s = positiveAction(s, has(s, 'wait-person') ? 'wait-person' : 'next-day');
  }
  throw Error('No actual watching agreement reached');
}

export function earnedHandoff(eagerSchoolRoute = false, seed = 42): GameState {
  let s = opening(seed);
  for (let n = 0; n < 150 && !s.campaign?.graduated; n++)
    s = positiveAction(s, nextSchoolAction(s, eagerSchoolRoute));
  expect(s.campaign?.graduated).toBe(true);
  expect(s.unlocked).not.toContain('story:observer-invite');
  s = waitFor(s, 'observer-invite');
  expect(getView(s).actions.find((a) => a.id === 'observer-invite')?.kind).toBe('primary');
  s = positiveAction(s, 'observer-invite');
  s = arrange(s);
  for (let lesson = 0; lesson < 2; lesson++) {
    for (let n = 0; n < 30 && !has(s, 'learning-light'); n++)
      s = has(s, 'arrange-learning')
        ? positiveAction(s, 'arrange-learning')
        : positiveAction(s, has(s, 'wait-person') ? 'wait-person' : 'next-day');
    if (s.people.sam?.activity?.action !== 'learn' || (s.apprentice?.visitUntil ?? 0) - s.now < 80)
      s = arrange(s);
    s = positiveAction(s, 'learning-light');
    for (const id of ['inspect', 'test-battery']) {
      s = positiveAction(s, id);
      if (has(s, 'explain-step')) s = positiveAction(s, 'explain-step');
    }
    const tired = getView(s).focus?.observations.some((text) =>
      text.includes('old battery is tired'),
    );
    s = positiveAction(s, tired ? 'replace-battery' : 'clean-contact');
    s = positiveAction(s, 'explain-step');
    s = positiveAction(s, 'verify');
    if (has(s, 'explain-step')) s = positiveAction(s, 'explain-step');
    for (let waits = 0; waits < 80 && has(s, 'wait-check'); waits++) {
      s = positiveAction(s, 'wait-check');
      if (has(s, 'explain-step')) s = positiveAction(s, 'explain-step');
    }
    for (const id of ['check-result', 'return']) {
      s = positiveAction(s, id);
      if (has(s, 'explain-step')) s = positiveAction(s, 'explain-step');
    }
  }
  s = arrange(s);
  for (let n = 0; n < 80 && !has(s, 'supervised-intake'); n++)
    s = has(s, 'arrange-learning')
      ? positiveAction(s, 'arrange-learning')
      : positiveAction(s, has(s, 'wait-person') ? 'wait-person' : 'next-day');
  expect(has(s, 'supervised-intake'), 'Reachable supervised intake after an actual agreement').toBe(
    true,
  );
  s = positiveAction(s, 'supervised-intake');
  for (let n = 0; n < 80 && s.apprentice?.jobId; n++) {
    if (has(s, 'watch-sam')) s = positiveAction(s, 'watch-sam');
    else if (has(s, 'arrange-learning')) s = arrange(s);
    else s = waitForPublicAttendance(s);
  }
  expect(s.apprentice?.supervisedCompleted).toBe(true);
  s = positiveAction(waitFor(arrange(s), 'independent-intake'), 'independent-intake');
  for (let n = 0; n < 80 && s.apprentice?.jobId; n++) {
    if (has(s, 'watch-sam')) s = positiveAction(s, 'watch-sam');
    else if (has(s, 'arrange-learning')) s = arrange(s);
    else s = waitForPublicAttendance(s);
  }
  expect(s.apprentice?.completedJobIds).toEqual(['independent-light']);
  expect(s.objects.find((o) => o.id === 'independent-light')?.location).toBe('returned');
  expect(Math.floor((s.now - (s.people.player?.life.bornAt ?? s.now)) / (365 * 1440))).toBe(18);
  expect(s.objects.find((o) => o.id === 'family')?.verified).toBe(true);
  expect(s.people.sam?.methods?.rules.length).toBeGreaterThan(5);
  expect(has(s, 'service-begin')).toBe(true);
  return s;
}
