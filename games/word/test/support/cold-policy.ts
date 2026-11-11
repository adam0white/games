/** This policy receives the same text and choices as a player. It cannot inspect
 * GameState, seeds, agreement fields, commands, or replay exports. */
export type Screen = {
  text: string;
  choices: { id: string; text: string }[];
};

export function coldPolicy(approach: 'ask-first' | 'repair-refusal' = 'ask-first') {
  const asked = new Set<string>();
  let attemptedFull = false;
  let refused = false;
  let fetched = false;
  let interviewsDone = false;
  return (screen: Screen): string => {
    const choices = screen.choices;
    const find = (pattern: RegExp) => choices.find((c) => pattern.test(c.text));
    const take = (pattern: RegExp) => {
      const c = find(pattern);
      if (!c) throw new Error(`No visible choice matches ${pattern}: ${screen.text}`);
      return c.id;
    };
    if (find(/Put the notebook/)) return take(/Put the notebook/);
    const questions = choices.filter((c) => /^Ask .+ about/.test(c.text));
    if (questions.length) {
      const question = questions.find((c) => !asked.has(c.text));
      if (question) {
        asked.add(question.text);
        return question.id;
      }
      interviewsDone = true;
      return take(/Return to the table/);
    }
    if (find(/next person to sign|Wait for Rıza/)) {
      if (/refuses:/.test(screen.text)) refused = true;
      if (refused) return take(/Hear what/);
      return take(/next person to sign|Wait for Rıza/);
    }
    if (find(/Full shop lease/)) {
      if (approach === 'repair-refusal' && !attemptedFull) {
        attemptedFull = true;
        return take(/^Morning work.*Full shop lease/);
      }
      // Match the conditions the conversations state, using offer labels only.
      return take(
        /smaller late service.*trial lease/i.test(choices.map((c) => c.text).join('\n')) && fetched
          ? /smaller late service.*trial lease/i
          : /^Morning work.*Smaller service and trial lease/,
      );
    }
    if (approach === 'repair-refusal' && !attemptedFull) return take(/Write an agreement/);
    if (!interviewsDone) return take(/Hear what/);
    const minutes = Number(/(\d+) minutes before Osman leaves/.exec(screen.text)?.[1] ?? 0);
    if (!fetched && asked.size === 4 && minutes >= 12 && find(/Fetch Nuri/)) {
      fetched = true;
      return take(/Fetch Nuri/);
    }
    refused = false;
    return take(/Write an agreement/);
  };
}
