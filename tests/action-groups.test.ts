import { describe, expect, it } from 'vitest';
import type { ActionView } from '../src/game/types';
import { splitNavigation, uniqueChoiceGroups } from '../src/ui/actionGroups';

const action = (id: string): ActionView => ({ id, label: id, kind: 'primary' });

describe('visible choice ownership', () => {
  it('keeps the route back from the cabinet outside optional project choices', () => {
    const close = action('workshop-cabinet-close');
    const measure = action('workshop-cabinet-measure');
    const result = splitNavigation([measure, close]);
    expect(result.navigation).toEqual([close]);
    expect(result.choices).toEqual([measure]);
    expect([...result.navigation, ...result.choices]).toHaveLength(2);
  });
  it('gives overlapping topical choices exactly one visible home', () => {
    const shared = action('neighbourhood-case-return');
    const groups = uniqueChoiceGroups([
      { id: 'here', label: '', actions: [shared] },
      { id: 'case', label: 'Case', actions: [shared, action('case-question')] },
    ]);
    expect(groups.flatMap((group) => group.actions.map((item) => item.id))).toEqual([
      'neighbourhood-case-return',
      'case-question',
    ]);
  });
});
