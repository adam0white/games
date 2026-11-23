import {
  type Game,
  type Input,
  type Practice,
  practices,
  teacherAvailable,
  teachers,
} from "./model.ts";

const purposes: Record<number, Record<Practice, string>> = {
  3: {
    count: "keep an evening jar for home",
    look: "check the way to the neighbour’s house",
    wait: "learn when a grown-up’s help is worth waiting for",
    refuse: "keep the evening water when someone asks again",
  },
  6: {
    count: "plan smaller loads for the walk home",
    look: "check a path before carrying water alone",
    wait: "see who can help at the well",
    refuse: "keep the jar at home instead of taking it out",
  },
  10: {
    count: "make room for each household in the queue",
    look: "check another entrance to the crowded well",
    wait: "see who can settle a quarrel over turns",
    refuse: "hold a place when the older children push past",
  },
  14: {
    count: "work out shares before the winter store is divided",
    look: "check what is stored beyond the upper path",
    wait: "see who is on duty before the winter sharing",
    refuse: "keep a share back for families who arrive late",
  },
  18: {
    count: "plan water for every waiting household",
    look: "check the upper spring before taking charge",
    wait: "see who can help organise the day’s carrying",
    refuse: "hold the queue when neighbours ask for more",
  },
};
const methods: Record<Practice, string> = {
  count: "counting with Maryam",
  look: "looking first with Yusuf",
  wait: "waiting with Danyal",
  refuse: "saying no with your help",
};
const costs: Record<Practice, string> = {
  count: "Maryam leaves meal work undone.",
  look: "Yusuf leaves field work undone.",
  wait: "Work on the well rope is delayed.",
  refuse: "Staying home uses food stores.",
};
const fieldPurposes: Record<number, string> = {
  3: "Put food by before her first errand.",
  6: "Stock the household before she carries water home.",
  10: "Feed the household while she faces the queue.",
  14: "Add food before the winter sharing.",
  18: "Put food by for the household while she prepares to take charge.",
};

// Presentation only: a recorded demonstration is not a promise of mastery or success.
export function preparationChoices(game: Game): {
  title: string;
  detail: string;
  input: Input;
}[] {
  const choices = practices
    .filter((practice) => teacherAvailable(game, practice))
    .map((practice) => ({
      title:
        practice === "refuse"
          ? "Stay home with you"
          : `Go with ${teachers[practice]}`,
      detail: `${game.rememberedLessons[practice] ? "Practise" : "Try"} ${methods[practice]}${game.rememberedLessons[practice] ? " again" : ""} to ${purposes[game.age]?.[practice]}. ${costs[practice]}`,
      input: { type: "teach", practice } as Input,
    }));
  const lastLesson = game.inputs.findLast(
    (input) => input.type === "teach" || input.type === "arrange",
  );
  const teacher =
    lastLesson && "practice" in lastLesson
      ? lastLesson.practice === "refuse"
        ? "you"
        : teachers[lastLesson.practice]
      : null;
  choices.push({
    title: "Work in the field",
    detail: `${fieldPurposes[game.age]} You add food to the stores and mend the well rope. The stores may still be low afterward. Elif stays home${teacher ? ` after watching ${teacher}` : ""}; no adult shows her a new way today.`,
    input: { type: "work" },
  });
  return choices;
}

export function foodStatus(food: number): string {
  return food === 0
    ? "The food stores are empty."
    : food <= 3
      ? "The food stores are nearly empty."
      : food <= 7
        ? "The food stores are running low."
        : "There is food for the household.";
}

export function preparationProgress(preparations: number): string {
  return `Afternoon ${preparations} of 3 is finished.`;
}
