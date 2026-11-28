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
- The interface. The owner's praise came with a list of faults (the nest as a pop-up, inconsistent controls, no tutorial, unclear costs and progress). Reviewers had flagged several of these hours earlier and the build moved on to new features. Step 9 exists to catch that sooner, without stopping the build.

Bots find defects and measure balance. They do not vote on fun (AGENTS.md).

## Second run: Sky Kitchen (2026-11-28)

The process was run a second time on a game with no opponent and almost no spec, as a light rebuild: one timed shift with several guests seated at once, then the game's existing eleven wheel actions given one effect and one printed price each, then a stop-adding pass and a second kind of shift. Three slices merged in a day. No person had played any of them when this was written, so this run says nothing yet about whether the result is good. What it showed about the process:

- Reading recorded play first (step 2) paid at once: 42 runs showed one action taken thirty times, the others almost never, and no guest ever lost. The design started from those two facts, not from the feature list.
- The scripted player's model of time was wrong by a factor of 1.7 until ten dishes were timed in the real client. Star targets set from the first model would have been far too low. This is now in step 6.
- A tray that never moved earned three stars in the real client while the model said it could not. Only a do-nothing run through the real page found it. This is now in step 6.
- Several hand-written triggers for an action did worse than using it at random. The action was fine and the trigger was wrong. One action looked strong everywhere until the script was made to pay its time cost as the page does. Both are now in step 6.
- The edge run through the real client found a fault no test, bot or reviewer had: on a small phone the tap that opened a sheet also pressed the button that appeared under the finger. This is now in step 5.
- The reviewers' own gate (an adaptive rule that beats every fixed plan) was not met in either slice. The notes and the reports say so. The process has no step that forces that gate to be met or dropped; step 7 is where it should be decided.
- In the third slice a pass line was written before a trial. Four ideas failed and were removed within the hour (extra seats with a crowd bonus, a big-dish night, and two forms of a critics' night). The one night that shipped also missed its line: it was meant to pay most for some player, and it pays more a minute and less a shift for every player. It was kept as variety with that trade stated in the notes. So the line did its job on removals and was bent once on a keep; a missed line that ships must say so where the result is reported. Writing the line first is now in step 6.
- One of those failures came from the scripted player, not the game: its beginner cooked far worse than recorded people do, so a night that rewards good cooking measured as a real test when for people it was close to double pay. Reading the recorded dishes settled it. This is now in step 6.
- A new mode sampled at three middle ranks looked balanced and was dominant at the two lowest ranks where it opens. This is now in step 6.
- The brief reached a thread that already existed, and it took a round trip to settle which thread owned the game. The launch prompt now names the owner thread.

## Entry

- A playable build that records play, or a brief for one. If recording fails, fix it first and read one stored record back.
- Standing approval to merge and deploy the game's own folder.
- The owner's target in the owner's words. If you only have adjectives ("ambitious", "more fun"), go to step 1.
- Reviewers on at least two other model families.
- The strongest available model on the hard core of the game. It may build directly or hand parts to subagents; say which model built what, so the next trace can tell process from model.
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
- for anything that opens over live play (a sheet, a menu, a mini-game), run the edges through the real client at the smallest phone size and in the longest language: pause while it is open, the round ending while it is open, its target leaving while it is open, and the opening tap itself;
- fix, merge, confirm the change on the live page by fetching the live file;
- write the numbers, the decision and anything dropped to the notes file;
- post one short status line that says what no person has played.

Cinderhill's slices took a median of thirteen minutes from pull request to merge, and forty-four merged in twenty hours.

**6. Measure each choice against doing neither.** Run option A, option B and neither on the same seeds, in both seats, to a fixed tick. Record intermediate state (stock, population, time to first payoff), not only who won. A choice is real when changing the action changes an outcome or a material intermediate state, and the player can see the difference. Then prove the measurement can fail: switch the effect off, or use a known bad layout, and check the number moves. Read one odd run end to end. If the bot never issued the order the choice needs, fix the bot before tuning the game.

Six checks on the bot itself, each of which caught a wrong number on Sky Kitchen:

- Before setting any target from a scripted player, time the same actions in the real client and compare. Fix the model until they agree.
- Run a player that does nothing, and one that does one thing and stops, through the real client. Do it at every rank or difficulty, not a sample: on Sky Kitchen a still tray took nothing at the three ranks tried and earned a star at the top four. The first must lose and the second must earn no reward. (On Sky Kitchen the second still earns one star of three; that is recorded as open, not fixed.)
- Before calling an action flat or strong, compare the scripted trigger with using the action at random. If random does better, the trigger is wrong.
- Make the script pay what the client makes a person pay: the seconds an action takes, and anything that keeps running while a menu is open.
- Check each skill number of the scripted player that a new rule leans on (speed, accuracy, quality) against recorded play before trusting a result that depends on it.
- Measure a new mode or option at the lowest rank where it opens and at the highest, not only in the middle.

Write the pass line before running a trial: which player should gain, which should not, and by how much. A trial that misses its line gets the one retune of the stop rules and is then removed, or is kept with the miss written next to the result. Run the checks above on every new mode too, not only on the first one: on Sky Kitchen the second night shipped to review before a parked tray and the wheel had been measured on it.

**7. Every third or fourth slice, stop adding.** List every choice the game advertises. Measure each. Fix or remove any that one side always wins before adding another.

**8. Taste choices are settings.** A look, a pace, a control scheme, a difficulty: ship it through `experiments/kit/settings.js` with a recorded default. Ask the owner only for structure choices, as two to four options with a recommendation, and keep building on the recommendation.

**9. Cold first play, alongside the build.** Capture the real first screen, first input, a refused input, first success, the first real choice and the end screen at phone size. Give them to a reviewer with no context and ask what they would do, what each cost is, and what just happened. Then run the same first situation through the real client by hand or by browser script. This check does not block new features (owner, 2026-11-28). Run it after the first complete situation and again every few slices; put each control, cost and progress finding in the notes file with a date, and fix the oldest ones in the next stop-adding pass (step 7), rechecking on the same screen. On Cinderhill such findings were flagged and then left for a day, and they became the owner's complaint list.

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

> You are the one thread that owns **[game]**; say so in your first report. Own it until **[named person or audience]** shows **[acceptance behaviour, in numbers]**. Read **[current build, notes file, play records, earlier decisions]** first. Keep **[what players already value]**. The owner's target, in the owner's words: **[verbatim]**. The current spec is background, not a ceiling. Keep the existing build reachable while you test a different direction.
>
> Follow `docs/playable-first.md`. Start with one complete situation in which **[decision]** changes **[outcome]**, playable from first input to result, with pressure that can beat the player. Send the first link as soon as that situation can be judged, and ask one specific question.
>
> You may merge and deploy **[folder]** without asking. Ship taste choices as settings with a recorded default. Decide technical questions yourself. Ask the owner only for structure choices, as two to four options with your recommendation, and keep building on it.
>
> After every slice: measure the choice against its alternative and against doing neither; get one adversarial code review and one outside read from models other than your own; write numbers and dropped ideas to the notes file. Every few slices stop adding and measure what is already there. Run the cold first-play check alongside the build; it does not block features, but its findings get fixed in the next stop-adding pass. In every report, separate what was built, what bots measured, what the owner played and what an outside person played. Correct disproved claims where you made them.

## Follow-ups this process asks for

- A `measure.mjs` per game with one shape: `node experiments/<slug>/measure.mjs <question> [seeds]`, printing per-side intermediate state at a fixed tick and wins, with a `--off` switch that disables the effect under test. Cinderhill kept 134 throwaway measuring scripts outside the repo before one entered it.
- A shared first-minute capture script in `experiments/kit/check/` that writes the contact sheet for step 9.
