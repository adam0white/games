# Borrowed Time

## 2026-11-24 · Cold play audit

Each evidence filename below is relative to `scratchpad/shots/audit-borrowed/` in this audit's task directory. The cold passes used fresh local browser sessions, touch coordinates chosen from screenshots, and a screenshot inspected after each action. Source and state-hook inspection started after the cold observations. The game has three chapters. Eight chapter entries on each profile required multiple lives across story and Daily. Repeated entries are not eight distinct levels.

| Rank | What happened in cold play | Change and replay evidence |
| --- | --- | --- |
| 1 | Reload after a correct Child name or during Grown-up returned to a title offering only Play. Only the gallery had survived. `c-018.png`, `c-019.png`, `w-015-pause.png`, `w-016-reload-grown.png`. | Continue restores that tab's chapter, seed, candle, revealed facts and open puzzle. A fresh start and explicit exit clear it. The permanent save still uses its original key and format. Daily before reload, its Continue button, and the restored puzzle are in `r-003-opening-puzzle.png`, `r-004-interrupted-daily.png` and `r-005-restored-daily.png`. A restored chapter boundary is in `r-016-continue-grown-up.png`. |
| 2 | Practice rewarded tapping the lying bird with a check and crossed out the true cat. The real puzzle used the opposite marks. The hand continued to prompt after an answer. Signed practice offered a crossed seal without explaining what to compare. `m-w-004-first-puzzle.png`, `m-w-005-practice-bird.png`, `m-w-007-sea-lie.png`, `w-040-witness-photo.png`, `w-041-false-witness.png`. | Each practice form gives one comparison to make. True and False label the evidence consistently. The practice hand waits before offering help and drops away on resolution. The live comparison states the mistake cost. See `after-photo-02.png`, `after-photo-03.png`, `after-photo-04.png`, `after-photo-05.png`, `after-photo-15.png`, `after-photo-16.png`, `after-photo-26.png`, `after-photo-27.png`. |
| 3 | The photo screen eliminated five faces. Who restored all six to equal prominence. A contradicted choice could spend 30 years and permanently end the chapter without stating either consequence. `w-025-reject-flute.png`, `w-026-who-again.png`, `w-034-seaside-key.png`, `w-035-guess-grown.png`. | Who retains the exclusions, blocks contradicted choices by touch and keyboard, and states the chapter consequence and the mode's actual wrong-name price before confirmation. `m-after-w-007-who.png`, `m-after-w-008-excluded-tap.png`, `m-after-w-009-possible-tap.png`. |
| 4 | The small tutorial hand pointed at the free memory. The shared idle hint then directed the player toward a tree. `m-c-002-daily.png`, `m-c-005-resume-hint.png`. | Both hands now indicate the same free memory. The shared hint remains in place. `w-080-post-daily-tutorial.png`, `w-081-post-kit-hint.png`. |
| 5 | An unavailable power flashed “Not here.” Push gave no way to find the right rock, and Child offered Rewind on an island with no mirror. `w-020-push.png`, `c-010.png`. | A failed attempt shows its target or the reason the power has no remaining use, above the buttons. It costs no years. `w-053-post-no-mirror.png`, `w-054-post-cracked-rock.png`. |
| 6 | Paying for the answer said “You found the lie!” Tapping a previously checked photo played a rejection sound with no new visual cue. `w-042-old-clue.png`, `w-043-show-me.png`. The repeat cue was identified in the subsequent source audit. | Paid help says “Answer revealed.” A repeated tap says “Already checked · no cost.” `after-photo-06.png`, `after-repeat-04.png`, `after-repeat-05.png`. |
| 7 | Zero correct and one correct both gave “A life, mostly remembered.” Correctly finishing two chapters had the very same title. `m-w-059-lost.png`, `m-w-034-daily-result.png`, `w-047-result.png`. | The result and saved album caption count the recovered names. `w-070-post-zero-result.png`, `w-073-post-zero-album.png`, `r-026-mistaken-result.png`, `r-030-album.png`. |
| 8 | No share card appeared on a perfect Daily, an ordinary finish, or candle exhaustion. The album always reserved room for five prints even in rows with one or two. `c-073.png`, `w-047-result.png`, `m-c-029-burnout.png`, `w-048-album.png`. | Finished lives can export a PNG showing the three ages and score, with the date for Daily. Saving produces a local image. Album rows size the prints to their actual count. `r-027-share-preview.png`, `r-028-save-image.png`, `r-daily-share.png`, `w-074-post-album-photos.png`. |
| 9 | The 16 question marks on the opening screen had no visible label. The Privacy text had a roughly 14 px high tap target on WebKit. `w-001-open.png`, `w-075-post-privacy-before.png`. | The title identifies the role gallery, counts unlocked roles on the first visit, and directs the first tap toward a glowing memory. Privacy has a minimum 52 × 44 CSS px target. `w-079-post-pristine-title.png`, `w-078-post-privacy-fit.png`. The recording checkbox uses its entire 44 px label. The gallery symbols and album prints are illustrations, not controls. |

### Coverage and remaining limits

- Chromium at 360 × 640 reached eleven chapter entries. It played the Daily's three chapters, revisited a Daily, finished a three-error life, exhausted a candle, visited the pause menu, result and album, and reloaded during progress. WebKit with the iPhone 13 profile played free and Daily chapters, named all three ages, opened pause and album controls, reloaded an active Grown-up, and finished a zero-correct life. See `c-000.png` through `c-073.png`, `w-001-open.png` through `w-050-menu.png`, and the `m-c-` and `m-w-` sequences.
- A player can guess with no clues. Memorizing the day's answers made a perfect replay possible without engaging the puzzles (`c-073.png`). Left the early guess and best-of-day scoring in place. The identity warning now makes its risk visible. There is no endless mode or stage beyond Old. The audit added no fourth chapter.
- The pause card gives a per-name score formula, while the result gives a combined, rounded year bonus. This took arithmetic to reconcile at `w-015-pause.png` and `c-036.png`. Two ages can also earn the same role and produce duplicate names in the result text (`w-047-result.png`). These presentation issues remain. The score and the role awards were correct in those examples.
- The compact result preview can still show small details when a row contains many prints. The album has more vertical room. The island stays dark and the Old chapter still burns years faster; the chapter card states this. There was no independent human verdict on the pacing, difficulty, theme or replay value.
- Movement, spent years, powers, low candle, selection, correct and incorrect answers, and chapter transitions each have visible feedback. The sound-only repeat rejection was corrected. Playwright exercised sound initialization and mute controls. Physical audio, exact sound/picture synchronization, real thumb occlusion and hardware safe areas were not verified.
- Continue is scoped to an ordinary reload in the same tab with session storage available. Crash recovery and cross-device recovery were not tested. A continued recording starts a new segment. The restored game retains its chapter history. The checks use a local recording stub. Live lab receipt and continuous recorder identity across reload were not verified.
- The exported 720 × 650 PNG was downloaded and inspected locally. Delivery to a recipient, the native OS share sheet, external Privacy navigation, production deployment and outside playtests were not exercised.

### Regression evidence

- The original UI failed the new checks for the missing reload route, practice instructions and truth marks, repeated-tap feedback, paid-reveal credit, lineup exclusions and stakes, gallery label, power advice, result captions and missing export. The corrections have both screenshot evidence and assertions in `check.mjs`. Transient canvas feedback is observed from before the input, so a late screenshot cannot hide a wrong mark.
- The original idle hint missed the memory by more than half a tile. The regression compares the rendered knob with the free memory and then taps it. The Privacy link measured about 14 px high before the change. The suite now requires at least 44 px in both dimensions.
- A sampled area past the first album row's midpoint contained eight colors before the fix and 620 on replay of the same album. The regression checks that this part of the row contains picture detail. The full five-print case still fits.
- `bots.mjs` passed. Its careful policy named all three ages in 1,080 of 1,080 runs. The browser changes preserve the existing deals, costs and scoring rules.
- The full game check passed on WebKit iPhone 13. The shared phone check passed its Borrowed and hint cases on both WebKit and Chromium. Some earlier WebKit runs timed out opening the menu or dispatching Play. The host was running many simultaneous suites. The specific cause of those timeouts is unresolved.
- The full Chromium rerun exited 0 on Pixel 7, 360 × 640, 390 × 844 and desktop 1280 × 800 in the same run. An earlier run finished the 360 × 640 gameplay but failed the clean-console assertion on an audio-renderer error. The isolated 360 × 640 retry and full rerun both passed with that assertion intact. The renderer error remains unexplained. Final suite screenshots are in `suite-final-w/` and `suite-final-c-retry/` under the audit screenshot directory.

## What it is

You have forgotten who you were. A run is one life in three chapters (the child, the grown-up and the old one), each on its own island, all lit by one candle. You walk for free, but every ability you use burns years from the candle, and the years left carry into the next chapter. In each chapter you name who you were from six drawn portraits. At the end the three selves stand side by side as one life.

## Where the idea comes from

The idea comes from tester t1, note #107, a request for a game where you have abilities, uncover a forgotten identity, and every use of an ability shortens your lifespan. It is not a rebuild of an archived game. Nothing was copied, ported or imported from `archive/`.

## 2026-11-24: linked photographs and keepsakes

A life still unfolds through three rainy islands, six possible faces at each age and one candle. The player can now bring evidence from an earlier photograph to a later one, match torn prints and keep the parts of each life they recovered.

| Chapter | New form | Evidence |
| --- | --- | --- |
| Child | Compare photographs | The free photograph supplies one fact. Compare later prints with that fact and the six faces. |
| Grown-up | Match torn halves | Put the matching half under the fixed edge. Push reveals a fact the free print cannot supply. That fact lets you reject the lie at Light. |
| Old | Signed photographs | Push supplies the entry fact. Leap and Light carry the same false witness's seal. Exposing the first puts the crossed-out seal above the second pair. |

For each later chapter, the generator chooses a rival who agrees with the entry fact. At least two faces share each value, and every face has a distinct combination of the four values. The rival therefore differs on another kind. The dependent pair uses that kind so the rival can make the opposite photograph look true until the new fact arrives. Its true print also contributes a fresh kind. Rewind can supply the same distinguishing fact through an alternate route. Paying or guessing can open a memory early.

Wrong photo taps still cost 12 years, Show me costs 5, and naming the wrong face costs 30 in the puzzle game. With `?lies=0`, the original 15-year naming cost, memory contents, island and face deals remain. The album and first-run practice use `album` and `practice` in the existing `borrowed-save` blob. Missing fields default to an empty album and unseen practice. The original teaching bits, sound, scores, daily results and role gallery still load. Practice uses independent drawings, takes no years, and marks no live clues or attempts. Only paid Show me points at a real answer.

**Builder** · The end card prints the recovered life. The Album button reopens the latest 12 pages, including unfinished lives. Only recovered prints and correctly named portraits enter the album. The album uses local storage and stays out of lab payloads.

**Builder** · The signed pair shows the exposed seal separately from the photographs so the player can recognize the witness again. The tear profiles have the same scale on all three pieces, and the selected piece slides into place on success.

### Verification

Proofs cover 400 seeds × six answer positions, all three chapters. The dependent Light photo must be ambiguous with the entry facts alone and decidable after the parent. The audit also checks the recurring witness, exactly one false photograph, puzzle-form progression, a deliberately broken entry and the closure over every memory. A route test walks the six island orders and opens every lock. The balance test uses the same 1,080 forced-answer runs for careful play and early guessing. The careful policy favors an available deduction and counts the cost of unlocking each memory.

| Chapter | Careful years spent, min / mean / max | Mean abilities | Mean puzzles |
| --- | --- | --- | --- |
| Child | 11 / 14 / 27 | 1.13 | 2.13 |
| Grown-up | 14 / 20 / 31 | 1.34 | 2.33 |
| Old | 17 / 30 / 45 | 1.89 | 1.89 |

| Bot | Mean score | All three correct | Wrong photo taps per run |
| --- | --- | --- | --- |
| Careful | 1158 | 100% | 0 |
| Gambler | 823 | 31% | 0 |
| Random photo taps | 792 | 99% | 3.10 |
| First photo first | 776 | 99% | 3.23 |
| Always buy help | 848 | 100% | 0 |
| Spender | 200 | 0% | 0 |

The restored assertions pass. The gambler scores 71.1% of careful, and careful averages 4.36 abilities per run and spends nothing on hints. Careful finishes with 49.7 years minimum and 85.3 years on average. Without old-chapter Rewind, 540 of 540 careful runs still finish. The final rule and balance run finished in 9.4 seconds elapsed and 8.6 seconds of CPU. During overlapping browser and builder work, the same checks took 83.9 seconds elapsed and 10.2 seconds of CPU.

The browser suite passed on WebKit iPhone 13, Chromium Pixel 7, Chromium at 360 × 640 and 390 × 844, and Chromium desktop. Coverage includes practice, torn halves, both signed memories, Later and reopening, paid help, wrong taps, lethal spending, chapter and pause exits, the notes recording stub, the kit hint, desktop keys, album paging, save reload and old save defaults. First visual pass tightened the practice layout and added paper corners and room for all five grown-up prints. The second added a separate practice lineup, clarified the witness label and tightened the album page height.

### Known weaknesses

- Some faces can be identified before the whole trail is explored. Rewind or paying can bypass the first witness, and the album only shows the evidence the player collected.
- A policy willing to purchase an answer early can save an ability. The hasty buyer averaged 1209 points and 90.5 years left, versus the deduction-first bot's 1158 points and 85.3 years. Buying every answer on the same route scores 848.
- The torn print is a visual matching task. Its edge alone is sufficient.
- The album retains the latest 12 lives. Clearing browser storage clears the album.
- The browser checks use device emulation and a local lab endpoint stub. Human comprehension, real phones and audio, live lab delivery and the deployed page were not verified.

The shared Borrowed Time and tap-hint cases passed on both browser engines. A later exact-command run stopped at the shared registry preflight because the sibling experiment `alibi` was unlisted. The Borrowed Time cases still passed when the in-memory preflight was scoped to Borrowed Time. No kit file changed.

### Kit candidates

None. The existing save, pause, audio, screens, recording and tap hint are sufficient.

## 2026-11-24: memories that lie (tester t1, notes #137 and #140, built)

Notes #137 and #140 are built. Every memory is now won by a puzzle: two (or three) photographs of the memory disagree, and you tap the one that lies. `?lies=0` plays the game as it was before; the bots check that it deals the same islands, faces and answers.

### The puzzle

- **Pictures, not sentences.** Each photograph is a small drawn scene with two features of a person. The place, when it is one of them, fills the photograph (sea, forest, city, peaks). The other features stand in it on pale halos: a head with its hat, the held thing, the pet. A photograph with no place is an indoor room by a lamp.
- **One lies, the rest are true.** Exactly one photograph is false. Tapping it tears it in two and the memory is won: you learn the kinds of the true photographs, as before. The bots check that exactly one fragment lies on 400 seeds × 6 answers.
- **The lie is a deduction.** It always follows from what you already hold (the clues in the top bar) or from the six faces. `solveLie` names a liar only when every face still in the running, and not ruled out by a wrong tap, points at the same photograph. It is sound: the true answer is always among those faces.
- **Four forms**, introduced one at a time:

  | Form | Where | How you find the lie |
  | --- | --- | --- |
  | `nobody` | The free memory (chapters 1 and 2); Push in the old chapter, which has no free memory | The lie shows a pair of features none of the six faces has. |
  | `clue` | Push, Leap and Light | One of the two features is one you already hold. The photograph that disagrees with it lies. |
  | `pair` | The grown-up's mirror (Rewind) | The lie fits no face that is still in the running, so the faces you crossed out are what find it. |
  | `three` | The old one's mirror | Three photographs over the pairs of three kinds. Two disagree; the six faces tell which of the two lies. |

- **Chained clues.** In chapter 1 every clue hangs on a kind already known when the puzzles are built (mostly the free memory's). From chapter 2 on, the second and later clue locks hang on a kind only the lock before them teaches, when that lock teaches a new kind. A chain a player meets is a clue that the entry memory (the free memory, or the old one's Push) and the faces cannot settle. The bots count it: child 13% of chapters, grown-up 24%, old 33%. So most chapters still have no chain a player must follow; see Known weaknesses.
- **Order.** Every memory can be settled in some order the island allows. The bots prove this for every chapter of 400 seeds × 6 answers with a bot that uses only known facts.
- **The free memory's second kind** is the one that leaves the most faces in the running. Without this the free memory gave about two kinds for nothing, and buying every answer scored almost as well as thinking (first balance: buyer 1104 against careful 1349).

### Costs

| Action | Cost | Notes |
| --- | --- | --- |
| A wrong tap (`PICK`) | 12 years | The tapped photograph is true: it glows gold with a tick, the title says "That one is true!", the card shakes, and −12 rises above it. The candle drips. Tapping it again is free. |
| Show me (`SHOW`) | 5 years | A ghost finger points at the lie, then it tears. Show me is cheaper than half a wrong tap, so a blind 50/50 tap never beats paying. |
| Later | free | You leave the memory; its orb gets a cracked "?" mark. Walking onto its tile, or tapping your own tile while on it, opens it again. |

- The candle does not burn while a puzzle is open. The candle stays the only resource; abilities still decide which memories you can reach.
- The price row under the question shows a crossed-out photograph, a flame and −12, so the cost of a wrong tap is shown before the first tap.
- A wrong tap or Show me that takes the last years fades the run, as a lethal ability does.
- The Leap memory raises its stepping stones when you reach it, not when you win it, so leaving it for later cannot strand you.

### Teaching

- No paragraph. On a first run, the first puzzle of each form teaches itself. The game highlights each photograph in turn. A held clue in it is ringed gold when it agrees and red when it disagrees, on the photograph and in the top bar. The faces it fits glow; when none fit, a red box goes round the faces. After 0.6 s a ghost finger points at the lie.
- What was taught is kept in the existing `taught` field of the save, now a bit mask: bit 1 is the old first-memory finger, and bits 2, 4, 8 and 16 are the four forms. A save with `taught: 1` still skips the old finger. The save key and format do not change.
- The kit idle hint (kind `tap`) still shows after 3 s of idle play on the island. The puzzle screen does not show it, and the ghost finger on the island still waits for it.
- Keys on a puzzle: 1 to 3 tap a photograph, S or ? is Show me, Backspace or Escape is Later. P pauses.

### Bot results with the puzzles (`bots.mjs`, 7 to 28 s here, slower while other checks ran)

The careful bot decides with `solveLie`. When it cannot settle a memory yet, it pays to be shown only if that memory is its target; a memory it passes on the way it leaves for later. 180 seeds × 6 forced answers = 1080 runs, every island order.

| Chapter | Careful: years spent min / mean / max | Ability uses | Puzzles won | Paid to be shown | Slow bot: seconds | Spender: years spent |
| --- | --- | --- | --- | --- | --- | --- |
| Child | 0 / 11 / 30 | 0.75 | 1.75 | 0.02 | 36 | 42 |
| Grown-up | 0 / 20 / 37 | 1.26 | 2.25 | 0.03 | 43 | 63 |
| Old | 14 / 27 / 42 | 1.77 | 1.77 | 0.17 | 43 | 45 (fades here) |

- **Careful bot.** Names all three on 1080 of 1080 runs. Years left min 55.2, mean 92.1. Score 1226 (1197 before the puzzles).
- **Spending decisions a run.** Ability uses: mean 3.79 (2: 7%, 3: 28%, 4: 45%, 5: 19%, 6: 1%). Puzzles: mean 5.77 (4: 7%, 5: 29%, 6: 45%, 7: 18%, 8: 1%). It reaches a memory it cannot settle yet 0.22 times a run, pays to be shown 0.22 times a run, and never taps wrong. Uses fell from 4.42 because the free memory and the old chapter's Push now give two kinds each.
- **Ability use.** Light 23%, Push 100%, Leap 87%, Rewind 21% of runs.
- **Run length.** These add assumed seconds for reading a puzzle and the portraits; the bots do not measure those.

  | Player | Island clock | Assumed extra | Whole run |
  | --- | --- | --- | --- |
  | Careful bot (never stops) | 14 s | none | 14 s |
  | Careful person (bot thinks 3 s before each choice) | 49 s | 8 s a puzzle, 8 s a line-up | about 119 s (93 to 150) |
  | Slow bot (half speed, 8 s before each choice) | 121 s (93 to 157) | 12 s a puzzle, 10 s a line-up | about 220 s (max 283) |

  The target was 2 to 4 minutes for a careful person. The careful-person estimate has a mean of 119 s, just under 2 minutes, with a range of 93 to 150 s; the slow bot's estimate is about 3.7 minutes. Both rest on the assumed seconds, so the target is not confirmed. The slow bot names all three on every run, years left min 38.2.
- **Puzzle bots**, which play like the careful bot on the island but decide puzzles differently:

  | Bot | Score | Wrong taps a run | Years on puzzles a run | Taps that hit the lie |
  | --- | --- | --- | --- | --- |
  | Careful | 1226 | 0 | about 1 | 100% |
  | Taps at random | 874 | 3.00 | 36 | 67% |
  | Always taps the first photograph | 884 | 2.92 | 35 | 68% |
  | Always pays to be shown | 946 | 0 | 29 | - |

  Taps that hit the lie is lies found over all taps. On a two-photograph puzzle a random tapper needs 1.5 taps on average, so 67% is what chance gives. The three bots remember all three on 99% to 100% of runs: the puzzles cost years, not the run.
- **A hasty bot that is stuck** (it plans without counting Show me): paying leaves 83.0 years (score 1135); a blind tap among the photographs that could lie leaves 81.1 (score 1117). Paying is better, as `SHOW < PICK / 2` intends.
- **Spender.** Opens every lock, taps the lie when it can, else pays. Fades on 100% of runs, score 200.
- **Gambler** (names a face when two are left): score 1053 against 1226, names all three on 32% of runs. Before the puzzles it scored 835 (23% all three right). The assert was relaxed from "under 0.8 of careful" to "under 0.9 of careful and under 50% all three right". See the decisions below.
- **Guessing at once** stays at chance: 16.6%, 17.0%, 16.9% (chance 16.7%), scores 257 to 264. Taking the free memory and then guessing among the faces that fit: 41.3% right, score 666 (31.2% and 496 before the puzzles, measured on the same day; the free memory now tells more).
- **Without old-chapter Rewind**: 540 of 540 remembered, min 55.2 years.
- **How each memory is settled** (400 seeds × 6 answers), share settled by the six faces alone, with no clue held:

  | Memory | Child | Grown-up | Old |
  | --- | --- | --- | --- |
  | Free (`nobody`) | 100% | 100% | none |
  | Push | 1% (`clue`) | 9% (`clue`) | 100% (`nobody`) |
  | Leap | 0% | 8% | 9% |
  | Light | 1% | 9% | 9% |
  | Mirror | none | 8% (`pair`) | 100% (`three`) |

  Rounds of the closure (memories settled in waves; more rounds mean longer chains): child 2 rounds 2083, 3 rounds 317; grown-up 1 round 1, 2 rounds 1764, 3 rounds 635; old 1 round 23, 2 rounds 2377.
- **Checks in `bots.mjs`.** Lies off and lies on deal the same game (900 of 900). Exactly one fragment lies. A puzzle settled from the faces is settled the right way. No chapter gets stuck. Mutation: a free-memory lie altered to fit a face is caught by the check. Uses must be 3 to 6 (was 4 to 6), at least 5 puzzles a run, Show me under 0.5 a run, no wrong taps by the careful bot, slow bot island clock 90 to 240 s (was 90 to 180), the tapping bots under 0.8 of careful.

### What the browser check covers now (`check.mjs`)

Added to the earlier coverage (below):

- Run 1, seed 7: the free memory opens as a teaching puzzle; the lie is tapped; `taught` gains the bits. The child's Light clue is opened; a wrong tap costs exactly 12 years and marks the photograph tried; a second tap on it is free; then the lie.
- The lab record of the mistaken run has `puzzle` events, a wrong and a right `pick`, and `summary.lies.wrong === 1`.
- The ability tour on the grown-up island: Push uses Show me (exactly 5 years); Leap is left for later (`waiting` lists it; the screenshot shows the "?" on its orb), then a tap on your own tile reopens it; the mirror pair is solved.
- A wrong tap and a Show me that each take the last years fade the run with no puzzle left open.
- At 360 × 640 and 390 × 844, from a fresh save, seed 28: the first puzzle with its teaching, the lie found, a wrong tap, the chained grown-up clue (Push, then the Light clue; the check proves in Node that the free memory and the faces cannot settle that Light clue and that Push's kinds can), the mirror pair bought with Show me, the old chapter's three photographs (teaching asserted), and a memory left for later. A tap on your own tile opens the mirror again; pausing on it freezes the candle and keeps the puzzle, and P resumes it. All five teaching bits are set and survive a reload. A new run then pauses on a puzzle and takes Menu: the menu shows and no puzzle stays open. The run ends remembered.
- Desktop: the key of the liar picks it. `?lies=0`: no puzzle opens, the free memory holds one kind, the memory shows on arrival.

### Screenshots

Taken at 390 × 844 and 360 × 640 and looked at after each change (`p1` to `p6` in the check's `SHOTS` folder). Changes made from them:

1. First pass: the photographs and the faces were grouped and centred; the veil behind the puzzle became opaque (the island showed through and competed with the photographs); the price row and the Show me label were spaced so the flame no longer covered the text; the ghost finger moved to the lower right of the photograph so it does not hide the features.
2. Second pass: the six faces are drawn as two rows of three when the screen has the room; the −12 of a wrong tap rises above the photograph, not over its features and the teaching rings.
3. Third pass: on a tall phone the two-photograph puzzles left a large empty band. The faces now take the height the photographs leave, up to 100 px each (about 94 px at 360 × 640, against 53 px in one row). The three-photograph puzzle at 360 × 640 keeps one row of faces, because the three photographs take the height.

What the screenshots show: hats, held things, pets and places read apart at a glance in both sizes, and a crossed-out face is plain. The smallest feature is the held thing on a face in one row (about 12 px for the key or flute at 360 × 640, three-photograph puzzle only).

### Not verified

- A person playing. Whether a person sees the deduction without words, how long a puzzle takes (the run length above assumes 8 to 12 s a puzzle), and whether the first-run teaching is understood.
- Whether a person tells all 16 features apart at photograph size on a real phone. Screenshots in emulated WebKit and Chromium only.
- A real phone, and real-phone sound.

### Known weaknesses

- **The child chapter is often settled by the free memory alone.** The careful bot's child years spent has a minimum of 0. Some child runs need no ability.
- **The gambler is closer to careful than before** (86% of the careful score). The puzzles make each clue cheaper, so guessing between the last two faces gives up less.
- **First-run teaching gives the answer** of four puzzles (the first of each form). The bots do not model this; it is once per save.
- **One tap picks**, with no confirm. A slip costs 12 years. A tried photograph does not cost again.
- **Chains are not frequent.** A player meets a clue that needs another clue first in 24% of grown-up chapters and 33% of old ones (13% of child ones). Requirement: chained clues as a later-chapter step. Raising the share needs the clue anchors chosen so the parent's fresh kind is not already known, and a new balance run.
- **Clues are seldom settled by the faces alone** (0% to 9%). Almost every clue puzzle needs a clue in hand, by design; a player who ignores the top bar has to buy or guess.
- **The three-photograph puzzle is always decidable from the six faces** (100%). That makes the old mirror an "open it first" choice. This was chosen so Rewind can come first in the old chapter.

### Ideas of the builder (Builder)

These are the builder's own, not the tester's:

- **Builder:** the lie tears in two and falls away; the true photographs glow gold. Built.
- **Builder:** the six faces are shown under every puzzle and cross themselves out live, so the faces are the puzzle's second clue source. Built.
- **Builder:** a memory left for later gets a cracked "?" on its orb, so unsolved memories are visible on the island. Built.
- **Builder:** a "torn photograph" mode: the lie is one half of a torn photograph, and the player matches halves. Not built.
- **Builder:** a liar who lies twice: in the old chapter, the same false person appears in two memories, and spotting the repeat solves both. Not built.
- **Builder:** an album page at the end of a run with the true photographs of each self, as a keepsake. Not built.

### Decisions for the lead

1. `PICK` 12 and `SHOW` 5. Show me is below half a wrong tap, so paying beats a blind 50/50. Both are free to change; the bots measure them.
2. One tap picks, with no confirm.
3. The free memory's second kind is the least telling one.
4. The gambler assert was relaxed to under 0.9 of careful and under 50% naming all three. The uses assert was widened to 3 to 6.
5. The run-length bracket (`carefulHuman.mean >= 100 && slowHuman.mean <= 240`) rests on assumed seconds per puzzle and per line-up. It needs a timed person to confirm.
6. The `taught` field is now a bit mask in the same field.
7. The Leap memory's bridge rises on reaching it, not on winning it.
8. Teaching shows the first puzzle of each form on a first run, not only the very first puzzle.
9. Chained clues and the mirror pair both arrive in chapter 2, not one chapter apart; the three photographs arrive in chapter 3.
10. Lab readers: `borrowedState().screen` can now be `puzzle`; new events `puzzle`, `pick` (with `right`), `shown`, `later`; the run summary has `lies` {found, wrong, shown, later, years} when the puzzles are on. `kit/check/phone.mjs` needs no change: it passes unedited.

## 2026-11-23: bug hunt and polish

This section replaces the older scoring and old-chapter tuning below.

- A wrong name used to remove every year point. Two right names always scored 200. Each right name now earns 100 points and one third of the years-left bonus. That bonus is years left times 10. Fractions are rounded down once. A perfect run keeps the old formula. The pause card explains the rule. The end card shows years left and year points, including after a wrong name.
- The old chapter had one kind found only in the mirror. This failed a new non-mirror coverage check on all 1000 seeds. Push now gives its usual kind and that missing kind. Light, Push and Leap can settle every face. Rewind remains a shortcut with two kinds. The chapter card explains the choice.
- The chapter card had no exit. It now has a Menu button beside Go on. Both are 54 px high. Menu uses the existing leave-run recording path. No save key or save format changed.
- A lethal Rewind emits a memory before fading. The page kept that memory overlay over the fading scene. Starting a reveal now clears the overlay. The browser check covers the lethal case.
- A found memory now shows six small portraits. Faces that disagree are dimmed and crossed out. This gives the first free memory an immediate visible effect. The existing kit sound and reduced-motion handling stay in use.
- The chapter check now waits for the actual button-ready state. The former fixed 700 ms wait could run before 0.5 seconds of game ticks on a slow browser. This is a test reliability change. Whether it explains the older WebKit failure remains unresolved.
- `PLAYWRIGHT` now resolves through the same package lookup as the kit check. It accepts the Playwright package directory or its parent directory.

Verification on Node 26.12.0:

- New wrong-name score checks failed before the rule change. The new old-chapter non-mirror coverage check also failed before the change. Both now pass.
- Careful bot: 1440 of 1440 runs remember all three selves. Mean years left rose from 82.0 to 89.2. Minimum rose from 37.6 to 47.3. Mean score is 1197.
- Slow bot: 720 of 720 complete. Mean play time is 136 seconds. Minimum years left is 29.2.
- A separate bot refuses Rewind in the old chapter. It completes all 1440 forced-answer runs, across all island orders. Minimum years left is 47.3.
- Rewind use fell from 97% to 41% of careful runs. The gambler scores 835. Immediate guesses score 257 to 264. Deduction still scores substantially better.
- All bot checks pass in 8.8 seconds. The browser checks now cover the partial score, the chapter exit, control bounds and sizes, the alternate clue coverage and lethal Rewind.
- The browser check could not start here. The sandbox denies the local server with `listen EPERM 127.0.0.1`. A direct Chromium launch also fails with a MachPort permission denial. No new phone screenshots or browser passes were obtained. The added portrait strip and control layout still need visual verification at 360 × 640 and 390 × 844.

The proposed contradiction puzzles, island art and save schema were left alone. Real-phone sound remains unverified.

### Browser verification, same day

- `node check.mjs` without `PLAYWRIGHT` failed with MODULE_NOT_FOUND. This repository has no Playwright install, and the earlier pass dropped the Human Framework fallback. The check now tries `$PLAYWRIGHT`, then Node's own lookup, then `~/code/human-framework/node_modules`.
- The end card after a wrong name put the year points on the same line as the wrong-name cost. It wrapped badly at 360 px. The year points now take their own line. The score line reads "2 of 3 right · N points" and fits on one line. A perfect run shows "N years left · N points" again, as before the earlier pass.
- On screens under 660 px tall the end art is 118 px high, the end title is smaller and end-card paragraphs sit closer. At 360x640 the mistaken end card now clears the dimmed ability bar.
- The pause card's score rule wrapped "points." onto a second line at 360 px. It now reads "Each right name: 100 + years left × 10 ÷ 3." and fits on one line.
- The chapter card's Menu worked while the card was still fading in and invisible. A stray tap could end the run. Menu now waits for the same 0.5 s as Go on.
- The small-phone block of the check now runs at 360x640 and at 390x844. Each run also pauses, shows the first memory with its portrait strip, shows the chapter 3 card and ends one run with a wrong name. It asserts that the mistaken end card fits.
- Screenshots show the chapter 2 and 3 cards with Go on and Menu side by side, 54 px high, with no overlap at 360 and 390 px. The chapter 3 text takes three lines and clears the years line. The portrait strip fits under "I remember!". Crossed-out portraits are clear.
- Results: `node bots.mjs` passes in 8.7 s. A bot that never uses Rewind in the old chapter names all three selves on 1440 of 1440 runs, minimum 47.3 years left. `node check.mjs` passes on WebKit, Chromium, Chromium 360x640, Chromium 390x844 and desktop 1280x800. Real-phone sound remains unverified.

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

## 2026-11-23: the tester picks the puzzle (tester t1, notes #137 and #140)

- **Note #137, answering #126 ("is Borrowed Time what you imagined?"):** "Every time you see and pick up one of the memories, I want there to be a puzzle to actually acquire those memories."
- **Note #140, answering #132 ("which kind of puzzle should unlock a piece of your life?"):** "Two memories disagree, find which one lies."

Together: every memory is won by solving a contradiction puzzle, not just by walking to it. This changes the core loop, so it was not built in this run. **Built on 2026-11-24**: see "memories that lie" at the top. The plan below is kept as it was written. A half-built version would change every chapter's balance without the bot measurements this game relies on (`bots.mjs`). It goes to the next working session on Borrowed Time as the plan below.

### Left as a proposal (2026-11-23, notes #137 and #140): memories that lie

How the build differs from this plan: a wrong tap costs 12 years, not 8; "Remember for me" became Show me at 5 years, not the ability price; every chapter has puzzles, not only chapter 2; the free memory is a puzzle too; chapter 3 starts from Push (its lie fits no face) and from the mirror's three photographs (decidable from the faces); the fragments are pictures, not sentences. The open question about chains was answered by building them (chapter 2 on).

- **The puzzle.** Opening a memory shows two fragments that disagree about the kind the memory holds. Example: "My cat slept by the sea" and "My frog slept in the forest". One fragment also names a kind the player already knows, or will learn elsewhere. The fragment whose second detail clashes with a known fact is the lie. Tapping the true fragment takes the memory.
- **Where the anchor comes from.** Chapters 1 and 2 have the free memory, which is never a puzzle and so anchors the first deduction. Chapter 3 has no free memory. There, one fragment pair cross-checks another memory's pair, so the player must open two memories before either settles. That is the harder chapter, as intended.
- **Cost.** A wrong pick costs years (start at 8, half of `WRONG`) and keeps the memory locked for a second try. A "Remember for me" button reveals the answer for the memory's ability price again, so the candle still decides how much thinking you buy.
- **Abilities stay.** Push, Leap, Light and Rewind still decide which memories you can reach. The mirror (Rewind) shows a pair about two kinds, a two-step puzzle.
- **What must be measured before shipping.** Rebalance `bots.mjs` with a puzzle-solving bot that only uses known facts. Check that every chapter can be solved without a forced guess, and that the instant guesser stays near chance. Measure the time per memory on a 360 × 640 screen with the six portraits.
- **Smallest testable slice.** Chapter 2 only, every memory but the free one a two-fragment puzzle, with a `?lies=0` switch to compare.
- **Open question for the tester, after the slice:** is a lie found from one known fact enough, or should some puzzles chain (a lie that only shows once two other memories are open)?

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
  - **Free:** one kind (two with the puzzles: its second kind is the least telling one), next to the start. Chapters 1 and 2 only.
  - **Push** (13 years): a boulder blocks one memory.
  - **Leap** (16 years): one memory sits beyond water. Leap from the blue-ringed pad. The memory raises a stepping-stone bridge back.
  - **Light** (10 years): one memory sits in a dark patch. Come within 2.3 tiles and light it.
  - **Rewind** (20 years): a broken mirror that shows two kinds. Chapters 2 and 3 only.
  - With the puzzles, each memory shows the kinds of all its photographs: a clue memory holds its own kind and the clue kind, and the old mirror holds three kinds.
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
- Teaching by doing: on a first run a ghost finger points at the free memory, and the first puzzle of each form teaches itself (see "memories that lie"). In the first three runs a finger points at each ability button the first time it becomes ready.
- First-time hint: the shared kit hint (`../kit/hint.js`, kind `tap`, key `borrowed:hint`) shows after 3 s of idle play to a player with no save. It goes on the nearest tile above the player, in the island's middle column, with no memory or player on it or on the two tiles below (`clearSpot`, passed as `bottom`); plain ground is preferred, so on some islands it sits over a rock or water. While it shows, the ghost finger waits; any touch or key ends it for good. `check.mjs` asserts that `?hint=hand` shows it after idle play and that a tap removes it.

## Tuning numbers (`sim.js`)

| Constant | Value |
| --- | --- |
| `LIFE` | 150 years for the whole run |
| `BURN` | 0.15 years a second (× 1.5 when old) |
| `WRONG` | 15 years |
| `PICK` | 12 years for a wrong tap on a puzzle |
| `SHOW` | 5 years for Show me |
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

These results are from before the puzzles (2026-11-23). `?lies=0` still plays that game. The current results are in "memories that lie" at the top.

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

The puzzle coverage added on 2026-11-24 is listed in "memories that lie" at the top. The free memory and every memory below are now won by a puzzle in the check.

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

- The decisions of 2026-11-24 are listed under "memories that lie" at the top.

- Add `borrowed` to `LAB_PROTOTYPES` in human-framework `apps/site/src/lab/games.ts`.
- Add `borrowed: page => started(page, 'borrowed', 'borrowedState', '#toMenu'),` to `experiments/kit/check/phone.mjs`.
- Lab readers: the run's start record now has `islands` (the order, for example "231") in place of round 1's `island`. The run outcome is for the whole life. Per-chapter results are in `chapter` events and `summary.chapters`.
