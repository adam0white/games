import { expect, it } from 'vitest';
import {
  catalogueItem,
  catalogueRequest,
  PERSONAL_PROJECT,
  REPAIR_CATALOGUE,
} from '../src/game/catalogue';
import { itemStory, optionalStoryChoices } from '../src/game/story';

it('ends after eight distinct requests instead of cycling another light', () => {
  expect(REPAIR_CATALOGUE).toHaveLength(8);
  expect(new Set(REPAIR_CATALOGUE.map((item) => item.id)).size).toBe(8);
  expect(REPAIR_CATALOGUE.map((_item, index) => catalogueRequest(index))).toEqual(REPAIR_CATALOGUE);
  for (const index of [-1, 8, 100, 1.5, Number.NaN])
    expect(catalogueRequest(index)).toBeUndefined();
});

it('changes repair families during school and keeps the final teaching pair supported', () => {
  expect(REPAIR_CATALOGUE.slice(2, 6).map((item) => item.fault)).toEqual([
    'jam',
    'striker',
    'hinge',
    'spring',
  ]);
  expect(REPAIR_CATALOGUE.slice(6).map((item) => [item.form, item.fault])).toEqual([
    ['lamp', 'battery'],
    ['lamp', 'contact'],
  ]);
  expect(REPAIR_CATALOGUE[5]?.requiredPart).toBe('springs');
  expect(catalogueRequest(8)).toBeUndefined();
  expect(PERSONAL_PROJECT.requiredPart).toBe('gears');
  expect(REPAIR_CATALOGUE).not.toContain(PERSONAL_PROJECT);
  expect(catalogueItem('paper-street')).toBe(PERSONAL_PROJECT);
});

it('uses specific object histories and single-use optional voices rather than owner light defaults', () => {
  const holder = catalogueItem('friend-5');
  expect(itemStory('friend-5', 'Sam')).toBe(holder?.story);
  const context = {
    chapter: 'friends' as const,
    focusId: 'friend-5',
    focusOwner: 'Sam',
    unlocked: [],
    holiday: 3,
  };
  const offered = optionalStoryChoices(context);
  expect(offered.some((choice) => choice.id === 'sam-school-next')).toBe(true);
  expect(offered.some((choice) => choice.id === 'ask-sam-string')).toBe(false);
  expect(
    optionalStoryChoices({ ...context, unlocked: ['story:sam-school-next'] }).some(
      (choice) => choice.id === 'sam-school-next',
    ),
  ).toBe(false);
});
