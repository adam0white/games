# Playable first: how to take a game from basic to deep

This is the process that took Cinderhill from "too slow and still too basic" to the owner's "it's rivaling my original idea" in one thread of about twenty hours (2026-11-27). It was traced twice from the raw record, by two different models that did not see each other's work, and one trace was checked by a third. The two traces agreed on the first three causes in the same order. Use it when a game works but the owner finds it thin, or when a new direction is starting.

## What the evidence supports, and what it does not

Shown by the record:

1. **A playable build drew out the real target.** Two days of spec work with at least eighteen reviews and twelve answered taste calls missed it. Eighty-two minutes after a new playable build went live, the owner named the target as six plain nouns (missions, worthwhile base building, strategy, variety, progression and tech tree, meaningful decision branch) and said graphics were not the point.
2. **One contested situation was built before the campaign.** Three reviewers on three models, told not to cut scope, all said to prove one mission where the player can lose to something that plays by the player's rules. The owner's praise names difficulty and enemies. The owner's recorded play before the praise was that first mission only: four losses, one win and about a dozen short restarts.
3. **Bots that use the player's own orders measured whether choices were real.** They set the default difficulty, proved one room placement turns ten losses in ten into none, and exposed three advertised choices as fake.

Not shown:

- That the later breadth (missions 2 to 8, the tree, the home hill) is good. The owner had not played it when the praise was written.
- That any outside player agrees. None has played.
- How much came from the builder model, its advisor, the two days of inherited work, or the owner's own strong picture of the genre. These changed at the same time as the process.
- The interface. The owner's praise came with a list of faults (the nest as a pop-up, inconsistent controls, no tutorial, unclear costs and progress). Reviewers had flagged several of these hours earlier and the build moved on to new features. The gates below exist to stop that.

Bots find defects and measure balance. They do not vote on fun (AGENTS.md).

## Entry

- A playable build that records play, or a brief for one. If recording fails, fix it first and read one stored record back.
- Standing approval to merge and deploy the game's own folder.
- The owner's target in the owner's words. If you only have adjectives ("ambitious", "more fun"), go to step 1.
- Reviewers on at least two other model families.
- A notes file for the game (`experiments/<slug>/NOTES.md`) with a "tried and dropped" section.

## The loop

**1. Get the target as things the player does.** Ship the smallest playable build that shows your reading of the brief, even a rough one, and ask what is missing. Write the answer down verbatim. Turn each word into a row: what the player decides, what the game must do for that decision to matter, what the current build does. That table is the first section of the design and the rubric for every later review. The first Cinderhill thread also had playable builds and owner play and still got "too basic"; what differed in the rebuild was that the owner's words became decision rows and a rubric, and the builder was allowed to exceed the spec. So treat a reviewed spec as background, never as the ceiling.

**2. Read the actual play.** Before designing, read the owner's and any outside records: short exits, long sessions, a loss, a win. Say what happened before saying why.

**3. Write the design in an hour, then ask what to build first.** Send it to three reviewers on different models with the owner's words and one instruction: do not recommend cutting scope; say which choices are fake and what must be proven first. Take the point they agree on. Correct your plan where you announced it.

**4. Build one complete situation.** An opening action, feedback, a choice with a cost, pressure, and an outcome the player can lose. Name two plans that should each win somewhere. If the game has an opponent, the opponent issues the same inputs a player can. If it has none, write a scripted player with adjustable skill, or a solver, that drives the same inputs. Keep the old build reachable.

**5. Slice.** Each slice adds to the weakest row of the target table and nothing else. For each slice:

- build and run the game's tests;
- measure (step 6);
- send the diff to one adversarial code reviewer with a named list of failure classes, and the build or screenshots to one reviewer who has not seen your intent;
- fix, merge, confirm the change on the live page by fetching the live file;
- write the numbers, the decision and anything dropped to the notes file;
- post one short status line that says what no person has played.

Cinderhill's slices took a median of thirteen minutes from pull request to merge, and forty-four merged in twenty hours.

**6. Measure each choice against doing neither.** Run option A, option B and neither on the same seeds, in both seats, to a fixed tick. Record intermediate state (stock, population, time to first payoff), not only who won. A choice is real when changing the action changes an outcome or a material intermediate state, and the player can see the difference. Then prove the measurement can fail: switch the effect off, or use a known bad layout, and check the number moves. Read one odd run end to end. If the bot never issued the order the choice needs, fix the bot before tuning the game.

**7. Every third or fourth slice, stop adding.** List every choice the game advertises. Measure each. Fix or remove any that one side always wins before adding another.

**8. Taste choices are settings.** A look, a pace, a control scheme, a difficulty: ship it through `experiments/kit/settings.js` with a recorded default. Ask the owner only for structure choices, as two to four options with a recommendation, and keep building on the recommendation.

**9. Cold first play, before more breadth.** Capture the real first screen, first input, a refused input, first success, the first real choice and the end screen at phone size. Give them to a reviewer with no context and ask what they would do, what each cost is, and what just happened. Then run the same first situation through the real client by hand or by browser script. Every finding about controls, costs or progress is fixed and rechecked on the same screen before the next feature slice. This gate was missing on Cinderhill.

**10. A person plays.** Agents cannot pass this gate. State the human gate in numbers before asking (Cinderhill's own roadmap had one: four of five fresh phone players finish the first chapter without help, each giving at least five orders, and finishing by waiting does not count). Until a person has played, every report says so.

## Stop rules

- A mechanic that measures flat gets one bounded retune. If it is still flat, remove it and record the numbers and the diff's location.
- Three failed trials on one question parks it until a person's game can be read.
- When reviewers repeat themselves on one row, move to the next weakest row.
- When a bot result and a person disagree, check they played the same situation, then believe the person.
- A claim that later measures false is corrected in the notes and in the message where it was made.

## Review prompts that worked

Keep reviewers blind by leaving things out, not by asking them to ignore things. Give each a role, an exact word limit, numbered questions, "no praise", and "only read files".

- **Blind design.** A neutral premise, the constraints and anonymised play evidence in an empty folder. No spec, no repo, no conclusions. "Give the whole design as your final message."
- **Contact sheet.** Nine frames of the first minute, by day and by night if the look changes. "Say what you think the game is and what you would do first. Then list, most damaging first, the ten things that make it look like a prototype, each with a concrete fix."
- **Depth.** The design and the owner's words. "Earlier reviews narrowed the design too far, so do not recommend cutting scope. Which choices are fake: dominated options, forks where one side is obviously better, building decisions with one right answer, dilemmas with no real cost? Name each and propose a fix."
- **Score.** The code, the notes and the owner's words verbatim. "Score the current build 0 to 10 on each item. For the lowest two, say what the player would have to be able to do for the score to rise by three."
- **Adversarial code.** The changed files. "Hunt for real bugs only: determinism breaks, save and load mismatches, states the player cannot leave, exploits. At most twelve findings ranked by severity, each with file, line, the failing scenario and a fix."
- **Blind fork.** A text brief that states a design question in neutral words, with no files and without the builder's preference, sent to two models at once.

Check each finding against the code or the build before acting on it. Do not commit raw reviewer output; record what was found and what changed.

## Launch prompt

Fill the brackets and hand this to the thread that will own the game.

> Own **[game]** until **[named person or audience]** shows **[acceptance behaviour, in numbers]**. Read **[current build, notes file, play records, earlier decisions]** first. Keep **[what players already value]**. The owner's target, in the owner's words: **[verbatim]**. The current spec is background, not a ceiling. Keep the existing build reachable while you test a different direction.
>
> Follow `docs/playable-first.md`. Start with one complete situation in which **[decision]** changes **[outcome]**, playable from first input to result, with pressure that can beat the player. Send the first link as soon as that situation can be judged, and ask one specific question.
>
> You may merge and deploy **[folder]** without asking. Ship taste choices as settings with a recorded default. Decide technical questions yourself. Ask the owner only for structure choices, as two to four options with your recommendation, and keep building on it.
>
> After every slice: measure the choice against its alternative and against doing neither; get one adversarial code review and one outside read from models other than your own; write numbers and dropped ideas to the notes file. Every few slices stop adding and measure what is already there. Before adding breadth, pass the cold first-play check and fix what it finds. In every report, separate what was built, what bots measured, what the owner played and what an outside person played. Correct disproved claims where you made them.

## Follow-ups this process asks for

- A `measure.mjs` per game with one shape: `node experiments/<slug>/measure.mjs <question> [seeds]`, printing per-side intermediate state at a fixed tick and wins, with a `--off` switch that disables the effect under test. Cinderhill kept 134 throwaway measuring scripts outside the repo before one entered it.
- A shared first-minute capture script in `experiments/kit/check/` that writes the contact sheet for step 9.
