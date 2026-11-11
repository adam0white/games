import type { Screen } from './cold-policy';

/** Uninformed but goal-seeking: drafts and signs without interviewing anyone.
 * If refused, tries another visible agreement. Never voluntarily ends a run. */
export function carelessPolicy(seed: number) {
  let random = seed >>> 0;
  let refused = false;
  return (screen: Screen): string => {
    const find = (pattern: RegExp) => screen.choices.find((c) => pattern.test(c.text));
    const take = (pattern: RegExp) => {
      const c = find(pattern);
      if (!c) throw new Error(`No careless choice matches ${pattern}`);
      return c.id;
    };
    if (find(/Put the notebook/)) return take(/Put the notebook/);
    if (find(/next person to sign|Wait for Rıza/)) {
      if (/refuses:/.test(screen.text)) refused = true;
      return take(refused ? /Change the agreement/ : /next person to sign|Wait for Rıza/);
    }
    if (find(/Full shop lease/)) {
      refused = false;
      const offers = screen.choices.filter((c) => /\(2 minutes\)/.test(c.text));
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const offer = offers[random % offers.length];
      if (!offer) throw new Error('No careless offer');
      return offer.id;
    }
    return take(/Write an agreement/);
  };
}
