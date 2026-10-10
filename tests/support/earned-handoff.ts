import { expect } from 'vitest';
import { getView } from '../../src/game/engine';
import type { GameState } from '../../src/game/types';
import { choose, nextSchoolAction, opening } from './school-route';

function has(s: GameState, id: string): boolean {
  return getView(s).actions.some((action) => action.id === id);
}
function waitFor(s: GameState, id: string): GameState {
  for (let n = 0; n < 80 && !has(s, id); n++)
    s = choose(s, has(s, 'wait-person') ? 'wait-person' : 'next-day');
  expect(has(s, id), `Reachable opportunity ${id}`).toBe(true);
  return s;
}
function arrange(s: GameState): GameState {
  return choose(waitFor(s, 'arrange-learning'), 'arrange-learning');
}

export function earnedHandoff(eagerSchoolRoute = false, seed = 42): GameState {
  let s = opening(seed);
  for (let n = 0; n < 150 && !s.campaign?.graduated; n++)
    s = choose(s, nextSchoolAction(s, eagerSchoolRoute));
  expect(s.campaign?.graduated).toBe(true);
  expect(s.unlocked).not.toContain('story:observer-invite');
  s = waitFor(s, 'observer-invite');
  expect(getView(s).actions.find((a) => a.id === 'observer-invite')?.kind).toBe('primary');
  s = choose(s, 'observer-invite');
  s = arrange(s);
  for (let lesson = 0; lesson < 2; lesson++) {
    for (let n = 0; n < 30 && !has(s, 'learning-light'); n++)
      s = has(s, 'arrange-learning')
        ? choose(s, 'arrange-learning')
        : choose(s, has(s, 'wait-person') ? 'wait-person' : 'next-day');
    s = choose(s, 'learning-light');
    for (const id of ['inspect', 'test-battery']) {
      s = choose(s, id);
      if (has(s, 'explain-step')) s = choose(s, 'explain-step');
    }
    const tired = getView(s).focus?.observations.some((text) =>
      text.includes('old battery is tired'),
    );
    s = choose(s, tired ? 'replace-battery' : 'clean-contact');
    s = choose(s, 'explain-step');
    s = choose(s, 'verify');
    if (has(s, 'explain-step')) s = choose(s, 'explain-step');
    while (has(s, 'wait-check')) {
      s = choose(s, 'wait-check');
      if (has(s, 'explain-step')) s = choose(s, 'explain-step');
    }
    for (const id of ['check-result', 'return']) {
      s = choose(s, id);
      if (has(s, 'explain-step')) s = choose(s, 'explain-step');
    }
  }
  s = choose(arrange(s), 'supervised-intake');
  for (let n = 0; n < 20 && s.apprentice?.jobId; n++) s = choose(s, 'watch-sam');
  expect(s.apprentice?.supervisedCompleted).toBe(true);
  s = choose(waitFor(arrange(s), 'independent-intake'), 'independent-intake');
  for (let n = 0; n < 20 && s.apprentice?.jobId; n++) s = choose(s, 'watch-sam');
  expect(s.apprentice?.completedJobIds).toEqual(['independent-light']);
  expect(s.objects.find((o) => o.id === 'independent-light')?.location).toBe('returned');
  expect(Math.floor((s.now - (s.people.player?.life.bornAt ?? s.now)) / (365 * 1440))).toBe(18);
  expect(s.objects.find((o) => o.id === 'family')?.verified).toBe(true);
  expect(s.people.sam?.methods?.rules.length).toBeGreaterThan(5);
  expect(has(s, 'service-begin')).toBe(true);
  return s;
}
