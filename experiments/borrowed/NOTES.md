# Borrowed Time

## What it is

You have forgotten who you were. A run is one life in three chapters (the child, the grown-up and the old one), each on its own island, all lit by one candle. You walk for free, but every ability you use burns years from the candle, and the years left carry into the next chapter. In each chapter you name who you were from six drawn portraits. At the end the three selves stand side by side as one life.

## Where the idea comes from

The idea comes from tester t1, note #107, a request for a game where you have abilities, uncover a forgotten identity, and every use of an ability shortens your lifespan. It is not a rebuild of an archived game. Nothing was copied, ported or imported from `archive/`.

## Round 2: the three-chapter run

Round 1 measured 1 to 2 spending decisions a run on a single island and recommended chapters. Round 2 builds them.

| Chapter | Island | What is different |
| --- | --- | --- |
| 1. Child | no mirror; free, Push, Leap and Light memories | Any two faces differ in at least two kinds (`apart: 2`), so the free memory and one more usually settle it. |
| 2. Grown-up | every lock, including the mirror (two kinds) | Two faces may differ in one kind only. |
| 3. Old | no free memory | Every clue costs years, and the candle burns 1.5 times as fast. |

- The three island templates are dealt to the three chapters in a random order (drawn from the seed), and each is mirrored at random. Each chapter has its own seed (`chapterSeed`), so a chapter is the same whatever happened before it.
- One candle: 150 years at the start. Nothing refills it.
- **A wrong name costs 15 years (`WRONG`) and the chapter, not the run.** The true self is shown, the chapter is marked red, and the next chapter starts. I did not compare this rule against ending the run; the bots ran only this rule. Under it, guessing between the last two faces scores 429 against the careful bot's 1125, and guessing at once scores about 57, so the gamble is clearly worse than paying for a memory. Ending the run on a wrong name would also cut the life payoff short.
- **Score.** 100 points for each self named right. When all three are right, each year left adds 10 points. So a run with one wrong name scores 200, whatever years are left. This makes a wrong name cost more than its 15 years. It also stops the instant guesser from scoring well: an earlier draft added the years left to every run, and the instant guesser then scored 875 against the careful bot's 825.
- **Outcomes for the whole run** (sent to the lab):
  - `remembered`: all three named right.
  - `mistaken`: all three named, at least one wrong.
  - `faded`: the candle went out, in any chapter, including by a wrong name.
  - `left`: Menu on the pause card.
- Per-chapter results are recorded in two places:
  - a `chapter` event at the end of each chapter: chapter, id, right, years spent, uses, found, seconds, years left;
  - `summary.chapters` in the run record. The summary also has `right` and `reached`.
- **Between chapters** a chapter card shows:
  - the selves named so far, with "?" cards for the chapters still to come;
  - the next chapter's name and one line about what changes;
  - the years left;
  - a "Go on" button (Enter or Space on a keyboard).

  The candle does not burn on the card. Each island opens with its name ("Grown-up · 2 of 3") shown briefly over the map. Three pips under the memory slots show the chapters: gold for right, red for wrong, a ring for the current one.
- **The payoff.** The end card shows three portraits on one thread: the child (short body), the grown-up, and the old one (white hair and brows, a walking stick), each in its own place with its pet. A self named right gets a gold frame. A self named wrong is dimmed, with a red frame and a red cross. A chapter the candle never reached shows a "?" card. Under the portraits are the three role names, the count of wrong names, and the score. There is no paragraph.
- **The gallery still keeps the 16 roles.** Each self named right adds its role. This keeps v1 saves readable unchanged. The save is still `{v: 1, sound, best, runs, gallery: {roleId: count}, daily, taught}`. `runs` counts whole runs. `best` is now on the chapter scale: a round-1 best (at most about 750) stays and is easy to beat.

### Telling apart faces that differ in one kind (360 × 640)

I looked at the grown-up and old portraits at 360 × 640 (`small-5-lineup-grown.png`, `small-6-lineup-old.png`).

- **Hat, pet and place.** Pairs that differ only in one of these read apart at a glance in the seed 11 portraits.
- **Held thing.** At first it was about 12 px, too small to tell apart at a glance. Portraits now draw it 1.6 times larger and further from the head (`toolSize`). The check shoots seed 2's old chapter, where two faces differ only by key against flower (`small-8-key-flower.png`). After the change the two read apart at a glance; before it, the flower hid behind the hat brim.
- **Chapter 1** keeps `apart: 2`, as the brief allowed.

## 2026-11-23: a rainy night, and a request for puzzles (tester t1, note #115)

The note, in short: the tester wants a mystery game in which you solve puzzles to work out pieces of your life, not one where you walk up to pictures and remember. They also want it darker and gloomier: a rainy night with dead flowers around. The rest was left to the lab.

### Done: the rainy night

| Part | What changed |
| --- | --- |
| Sky | Near black, with low clouds that drift. No stars. |
| Rain | Slanting streaks over the whole screen, the menu included, and small rings where drops land on the island. A faint far flash of lightning every 17 seconds. |
| The dark | Darkness closes in round the player, with a warm pool of candle light at the player. The HUD and the ability bar stay bright. |
| Ground | Dark wet grass and darker water. Flowers are dead: a bent stem, the head hanging down, a few dull petals, more fallen on the ground; some tiles have a dry tuft. |
| Trees and rocks | Darker. About three in ten trees on the island's edge are dead and bare. Trees inside the island keep their crowns, so every wall still reads as a wall. |

- `?gloom=0` shows the old look, to compare. `GLOOM` and its branches are the whole change; remove them to go back.
- Found on the way: the page's `hash` gives values from -0.5 to 1, not 0 to 1. A negative value picked no colour, so some tree crowns were drawn in the trunk's brown. In the rainy night the crown colour uses the absolute value. The old look and `hash` itself are unchanged, because whether a wall draws as a rock or a tree depends on it.
- No rule, save or sound changed. There is no rain sound: a looping noise would be the second copy of the rain loop in `lab/ant-nest`, and the kit rule says to move it to the kit first.

Checks: `check.mjs` passes on Chromium (Pixel 7, 360 × 640 and desktop). On WebKit it fails at "the next chapter starts" with or without this change: it failed twice on clean `main` on the lab Mac on 2026-11-23. Unresolved. A first version drew a splash ring with a negative radius (`IndexSizeError`), which the check caught; fixed. Phone-sized screenshots of the menu and the first island were compared with `?gloom=0`.

Not checked: a real phone; the frame rate on an older phone (about 70 rain streaks and up to 4 rings a tile each frame).

### Left as a proposal (2026-11-23, note #115): puzzles that uncover your life

The tester's main ask. It changes what the game is, so it is recorded for the next working session; a question went to the tester about which kind of puzzle. Ideas, not yet built or measured:

- **Memories as locked puzzles.** A memory opens only when a small puzzle on its tile is solved: put torn photo pieces back together, set a music box's three dials to a tune heard earlier, or match footprints to a pet. The answer names one feature (the hat, the pet, the place).
- **Clues that point, not show.** A memory gives a riddle or a half-burnt letter ("I never went anywhere without my flute") instead of a picture of the feature. The player has to read it against the six faces.
- **Contradictions.** Two memories disagree; a third tells which one lied. Deduction replaces lookup.
- **Years stay the cost.** Solving is free; a hint, or skipping a puzzle, burns years, so the candle still matters.

## Rules

- **Who you were.** A person has four kinds of feature:
  - hat: crown, straw hat, cone hat, beret
  - tool: brush, flute, key, flower
  - pet: cat, bird, frog, snail
  - place: sea, forest, city, peaks

  Hat and tool together give a role name (16 roles, for example Spell Painter or Busker).
- **The six faces.** Each chapter deals 6 portraits (`makeFaces`). For each kind, one pattern is drawn and its values are dealt to the faces in a random order:
  - chapters 2 and 3 draw from `GROUPS`: 4+2, 4+2, 3+3, 4+2;
  - the child draws from `CHILD_GROUPS`: 4+2, 3+3, 2+2+2, because two-kind separation is rarely reached with the 4+2 patterns.

  Every value on the board is shared by at least two faces, so no single memory names anyone. The faces are built without reference to the answer, and the answer is then drawn uniformly from the six. This is why guessing at once lands at chance.
- **Memories.** Each memory shows which kinds it holds before you open it. A kind you already know shows dimmed.
  - **Free:** one kind, next to the start. Chapters 1 and 2 only.
  - **Push** (13 years): a boulder blocks one memory.
  - **Leap** (16 years): one memory sits beyond water. Leap from the blue-ringed pad. The memory raises a stepping-stone bridge back.
  - **Light** (10 years): one memory sits in a dark patch. Come within 2.3 tiles and light it.
  - **Rewind** (20 years): a broken mirror that shows two kinds. Chapters 2 and 3 only.
- **Life.**
  - The candle burns 0.15 years a second while an island is in play, 0.225 when old.
  - It does not burn on the portraits, the chapter card or the pause card.
  - Walking is free.
  - A tap on an ability with nothing to use it on costs nothing and says "Not here".
- **Naming.** "Who?" opens the six portraits. Pick one and press "That's me!", or tap it twice.
- **Seeds.** `?seed=<n>` fixes every run's seed. The Daily button seeds from the local date (`dailySeed`), so everyone gets the same three chapters on a date.

## Input

- Tap or hold on the island to walk there by the shortest path. A held finger that slides changes the goal tile.
- The bar at the bottom: Light, Push, Leap, Rewind, Who?.
  - A button lights up only when that ability would open something where you stand.
  - Each button shows its price in years. A price that would kill you shows red.
  - The price of a ready ability is also striped in red on the HUD candle.
- Keyboard:
  - Arrows or WASD walk one tile. 1 to 4 use abilities.
  - Enter or Space opens the portraits. In the portraits, arrows choose a face, Enter names it, and Backspace goes back.
  - Enter or Space goes on from a chapter card.
  - P or Escape pauses.
- Teaching by doing: on a first run a ghost finger points at the free memory. In the first three runs a finger points at each ability button the first time it becomes ready.
- First-time hint: the shared kit hint (`../kit/hint.js`, kind `tap`, key `borrowed:hint`) shows after 3 s of idle play to a player with no save. It goes on the nearest tile above the player, in the island's middle column, with no memory or player on it or on the two tiles below (`clearSpot`, passed as `bottom`); plain ground is preferred, so on some islands it sits over a rock or water. While it shows, the ghost finger waits; any touch or key ends it for good. `check.mjs` asserts that `?hint=hand` shows it after idle play and that a tap removes it.

## Tuning numbers (`sim.js`)

| Constant | Value |
| --- | --- |
| `LIFE` | 150 years for the whole run |
| `BURN` | 0.15 years a second (× 1.5 when old) |
| `WRONG` | 15 years |
| `SELF_POINTS` | 100; years × 10 added only when all three are right |
| `SPEED` | 3.2 tiles a second |
| Costs | Light 10, Push 13, Leap 16, Rewind 20 |
| `GLOW_R` / `NEAR` | 2.3 / 1.5 tiles |
| `FACES` | 6 |
| `CHAPTERS[k].apart` | 2, 1, 1 |
| Island | 7 × 16 tiles, 3 templates, dealt in a random order, mirrored |
| Tick | fixed 60 Hz, frame dt capped at 0.25 s, drawing interpolated |

These values were tried before the ones above:

| Setting | Result |
| --- | --- |
| `LIFE` 120 | The careful bot's minimum was 7.6 years. Eight slow-bot runs faded. |
| `LIFE` 135 | One slow-bot run ended at 0. |
| `LIFE` 150 | Kept. The spender still fades on every run. |

## Bot results (`bots.mjs`, about 9 s)

`fnm exec --using=26.12.0 node experiments/borrowed/bots.mjs` exits non-zero on any failed check. The careful bot ran on 240 seeds × 6 forced answer triples, cycling all 6 island orders (1440 runs). The slow bot is the careful bot at half walking speed, still for 8 s before every choice (720 runs).

| Chapter | Careful: years spent min / mean / max | Careful: ability uses | Careful: memories | Slow: seconds | Spender: years spent |
| --- | --- | --- | --- | --- | --- |
| Child | 11 / 14 / 27 | 1.09 | 2.05 | 44 | 41 |
| Grown-up | 11 / 23 / 51 | 1.50 | 2.47 | 49 | 61 |
| Old | 21 / 32 / 52 | 1.87 | 1.87 | 43 | 49 (dies here) |

- **Careful bot.** It names all three selves on every run. Years left: min 37.6, mean 82.0. Score 1125.
- **Run length in spending decisions.** The careful bot averages 4.45 ability uses a run:

  | Uses in a run | Share of runs |
  | --- | --- |
  | 3 | 11% |
  | 4 | 44% |
  | 5 | 36% |
  | 6 | 9% |
  | 7 | 1% |

  The bot asserts a mean of 4 to 6.
- **Run length in time.** The slow bot plays 136 s a run on average (min 101, max 176). This does not count time on the portraits and chapter cards. The bot asserts a mean of 90 to 180 s. Its years left: min 14.1, mean 62.7. It names all three on every run.
- **Every ability matters.** The careful bot uses Light on 88% of runs, Push 72%, Leap 46%, Rewind 97%.
- **The spender** opens every lock it meets. It fades on 100% of runs, in the old chapter, and scores 200 against 1125.
- **The gambler** names a face as soon as two are left. It scores 429 and names all three on 23% of runs. The bot asserts under 80% of careful.
- **Guessing at once** is at chance in every chapter (4000 seeds, asserted within 3 standard errors of 16.7%):

  | Rule | Names right | Score |
  | --- | --- | --- |
  | First face | 16.6% | about 57 |
  | Most typical face | 17.0% | about 57 |
  | Least typical face | 16.9% | about 57 |

  Taking the free memory (where there is one) and then guessing among the faces that fit: 31.2% of names right, score 142.
- **Other checks.**
  - Determinism holds.
  - The face rules (`apart` per chapter, shared values, every kind findable) hold on 1000 seeds × 3 chapters.
  - All 256 people and 16 roles are answers in every chapter on seeds 1 to 6000.
  - The do-nothing bot fades after 1000 s.

## What the browser check covers (`check.mjs`)

`fnm exec --using=26.12.0 node experiments/borrowed/check.mjs [webkit|chromium]` serves `experiments/` and answers `/notes/button.js` with an empty script. It intercepts the lab endpoint. It fails on any page error, console error or 4xx/5xx response. The answers of seed 7's three chapters are computed in Node; the page does not expose the current answer.

**WebKit iPhone 13 and Chromium Pixel 7** (touch PointerEvents):
- The house rules of `kit/check/phone.mjs`:
  - no zoom;
  - no audio context before a touch, and one after Play;
  - Play, `#pause`, `#toMenu` sends exactly one `left` run and one events record.
- **Run 1, chapter 1.** The child island has no mirror. The test then:
  - walks to the free memory;
  - pauses mid-walk (time and position frozen);
  - uses Light (−10) and collects the lit memory;
  - taps a useless ability, which costs nothing;
  - names the right face.

  The chapter card follows, and Go on starts chapter 2 with the years carried over exactly.
- **Run 1, chapter 2.** The grown-up has the mirror. A wrong name by double tap costs exactly 15 years, and the run goes on.
- **Run 1, chapter 3.** The old island has no free memory. A right name ends the run `mistaken` with 200 points, the end card says "1 wrong name", and there is still one audio context.
- **Run 2.** All three named right gives `remembered`. The score is above 300.
- **Run 3.** The candle is set near zero, which gives `faded`.
- **Run 4.** Blur pauses and P resumes. Menu gives `left`.
- **Reload.** best, gallery (distinct roles), runs = 3 and `v: 1` persist.
- **Round-1 save** (360 × 640 context). A seeded round-1 blob loads: best 530, two roles, 4 runs, sound off. Play starts.
- **Run 5.** Chapter 1 is named, then Push, Leap and Rewind are used on the grown-up's island, with the candle topped up between them. Each costs its price and its memory is collected. Then `left`.
- **Lab.** Five runs carry all four outcomes. The `mistaken` run has `summary.chapters` = right, wrong, right and three `chapter` events. Every run has fewer than 300 events.

**Chromium 360 × 640:**
- no sideways scroll;
- the island, the bar, all six portraits and the lineup buttons are on screen;
- one full run with a portrait screenshot in every chapter, the chapter card, and an end card that fits;
- Daily uses the date's seed.

**Chromium desktop 1280 × 800:** keys and mouse walk. Enter, arrows and Enter name a face. Enter goes on from the chapter cards. All three chapters end `remembered`, and the end card fits.

The pause card's Menu button id is still `#toMenu`.

## Not verified

- A real phone. All checks ran in Playwright's WebKit and Chromium with emulated devices.
- Audio on a real phone.
- A person playing:
  - how long a person really takes (the 136 s is the slow bot's, without the time spent on the portraits);
  - whether the chapter twists feel harder rather than only different;
  - whether a person reads the old chapter's faster burn without a visible cue on the candle;
- Safe-area insets on a notched phone (only checked at zero).

## Known weaknesses

- **Rewind button in chapter 1.** The child chapter shows the Rewind button although there is no mirror. A tap says "Not here" and costs nothing.
- **Old chapter burn.** The faster burn is told only on the chapter card. The candle itself looks the same.
- **Score scale.** The score has two scales. A run with a wrong name scores at most 200. A perfect run scores 300 plus the years left × 10 (about 1100 for a careful player). This is deliberate, but the jump is large.
- **Rewind is close to forced when old.** The careful bot uses Rewind on 97% of runs. With no free memory, the mirror's two kinds are nearly always worth 20 years in chapter 3, so some of the 4.45 uses are not real choices.
- **Nowhere to leave on some screens.** There is no pause button and no Menu on the reveal or the chapter card. The candle is frozen there, but a player cannot leave from those screens.
- **Lineup title and pause button.** On the portraits the title sits next to the pause button. A longer title would run under the button, so the title stays "Who were you?" in every chapter. The portraits' age (short body, white hair and stick) shows which chapter it is.

## Ideas of the builder

- Dim the abilities a chapter's island cannot use. In chapter 1 that is Rewind.
- **Score alternative (not run).** Use one scale: always count the years left, and make a wrong name cost more, for example about 45 years. That estimate is not measured. Then years matter after a wrong name too.
- Give the old chapter a visible cue: a taller flame, or a faster drip on the candle.
- An optional cross-out on a portrait (a long press) for players who eliminate by hand.
- A "lives" page in the gallery that shows whole runs (three selves) as well as roles.

## Kit candidates

- A `pauseCard` helper: Resume / Menu / Sound plus the `#pause` round button and the blur pause.
- A `safeArea()` reader (the hidden probe element that reads `env(safe-area-inset-*)`).
- A fixed-tick loop helper (`acc`, capped dt, interpolation alpha, freeze while paused).

## For the lead

- Add `borrowed` to `LAB_PROTOTYPES` in human-framework `apps/site/src/lab/games.ts`.
- Add `borrowed: page => started(page, 'borrowed', 'borrowedState', '#toMenu'),` to `experiments/kit/check/phone.mjs`.
- Lab readers: the run's start record now has `islands` (the order, for example "231") in place of round 1's `island`. The run outcome is for the whole life. Per-chapter results are in `chapter` events and `summary.chapters`.
