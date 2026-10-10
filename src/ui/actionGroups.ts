import type { ActionView } from '../game/types';

export interface ChoiceGroup {
  id: string;
  label: string;
  actions: ActionView[];
}

/** Scene navigation stays reachable even when its optional project is folded. */
export function splitNavigation(actions: ActionView[]): {
  navigation: ActionView[];
  choices: ActionView[];
} {
  const navigationIds = new Set(['workshop-cabinet-close']);
  return {
    navigation: actions.filter((action) => navigationIds.has(action.id)),
    choices: actions.filter((action) => !navigationIds.has(action.id)),
  };
}

/** A choice can have several semantic tags but must have one visible home. */
export function uniqueChoiceGroups(groups: ChoiceGroup[]): ChoiceGroup[] {
  const seen = new Set<string>();
  return groups.map((group) => ({
    ...group,
    actions: group.actions.filter((action) => {
      if (seen.has(action.id)) return false;
      seen.add(action.id);
      return true;
    }),
  }));
}
