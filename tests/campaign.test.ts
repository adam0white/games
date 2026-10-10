import { expect, it } from 'vitest';
import { getView, restoreGame, serializeGame } from '../src/game/engine';
import { choose, nextSchoolAction, opening } from './support/school-route';

it('eight completed public repairs carry people, unfinished work and exact history through four school years', () => {
  for (const seed of [42, 1701]) {
    let s = opening(seed);
    const earlyLamp = structuredClone(s.objects.find((item) => item.id === 'family'));
    const bornAt = s.people.player?.life.bornAt;
    const samBornAt = s.people.sam?.life.bornAt;
    const jumps: number[] = [];
    for (let step = 0; step < 150 && !s.campaign?.graduated; step++) {
      expect(getView(s).actions.some((action) => action.id === 'workshop-priced')).toBe(false);
      const id = nextSchoolAction(s);
      const before = s.now;
      s = choose(s, id);
      if (id === 'back-to-school') jumps.push(s.now - before);
    }
    expect(s.campaign?.graduated).toBe(true);
    expect(jumps).toEqual([365 * 1440, 365 * 1440, 365 * 1440, 365 * 1440]);
    expect(s.people.player?.life.bornAt).toBe(bornAt);
    expect(s.people.sam?.life.bornAt).toBe(samBornAt);
    expect(Math.floor((s.now - (bornAt ?? s.now)) / (365 * 1440))).toBe(18);
    expect(Math.floor((s.now - (samBornAt ?? s.now)) / (365 * 1440))).toBe(19);
    for (const person of Object.values(s.people)) {
      expect(person.body.alive).toBe(true);
      expect(person.now).toBe(s.now);
    }
    expect(s.repairs).toBe(8);
    expect(s.objects.filter((item) => item.location === 'returned')).toHaveLength(8);
    expect(new Set(s.objects.map((item) => item.title)).size).toBe(s.objects.length);
    expect(new Set(s.objects.map((item) => item.form)).size).toBeGreaterThanOrEqual(5);
    expect(s.objects.find((item) => item.id === 'family')).toEqual(earlyLamp);
    expect(s.journal?.some((line) => line.text.includes('School'))).toBe(true);
    expect(restoreGame(serializeGame(s))).toEqual(s);
  }
});

it('an eager player cannot exhaust future school work and strand later graduation', () => {
  let s = opening(42);
  const requestsBySummer: number[] = [];
  for (let step = 0; step < 250 && !s.campaign?.graduated; step++) {
    const id = nextSchoolAction(s, true);
    if (id === 'back-to-school') {
      expect(s.objects.some((item) => item.awaitingCollection)).toBe(false);
      requestsBySummer.push(s.requests);
    }
    s = choose(s, id);
  }
  expect(s.campaign?.graduated).toBe(true);
  expect(requestsBySummer).toEqual([2, 4, 6, 8]);
  expect(s.repairs).toBe(10);
  expect(restoreGame(serializeGame(s))).toEqual(s);
});
