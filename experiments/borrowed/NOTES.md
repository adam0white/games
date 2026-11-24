# Borrowed Time

## 2026-11-24 · Second cold play

A first-time player who cannot read English, played by touch before reading any source: WebKit with the iPhone 13 profile and Chromium at 360 × 640, locale tr-TR, an empty save, a screenshot after every tap. Evidence filenames are relative to `scratchpad/shots/cold2-borrowed/` in this pass's task directory (`w` WebKit, `c` Chromium). Played: three free lives and one Daily in WebKit (one won with 51 years left and 810 points, one with a reload mid-chapter and two deliberate wrong names, one lost by letting the candle run out), one life in Chromium (lost the same way), and every menu, pause, the language button, the album, the share card and the role gallery.

### Findings, ranked by harm to a first-time player

1. **A wrong photo tap put the gold check on the tapped photo** (`w051`, `c006`, and in practice `w006`). The check meant "this photo is true, so it is not the lie", but a cold player reads a gold check as "right!", next to a −12 that looks like a fee. Fixed.
2. **The practice did not say what to do.** It had no words: a clue (a cat), two photos (a bird and a cat) and, after 3 s, a hand on the bird. A player who matches pictures taps the cat, the one that agrees with the clue (`w004` to `w006`). Fixed.
3. **No price felt real.** Careful lives ended with 51 and 55 of 150 years (`w048`, `w152`). Both losses needed four to six minutes of standing still (`w105` to `w108`, `c019` to `c021`). Rewind was a 20-year lock that opened one more torn photo (`w101`, `w102`), and the bots agree it was rarely worth it (11% of careful runs). Fixed (below).
4. **The picker's buttons let the island's "Kim?" button show through "Bu benim!"** (`c011`). Fixed.
5. **The chapter card's preview icons were not understood**: a candle with "×1,5" and two crossed seals (`w027`), cut paper and a cat → cat check (`w017`). Known (audit item 11); left.
6. **The seal badges in the Old chapter** (`w030`, `w031`, `w032`, `w039`) were not understood until the second signed photo; "Bir ipucu hâlâ eksik" said what was wrong but not where to look. Left; it is the chapter's lesson and the signed practice teaches it.
7. **The torn edge** reads only when looked at closely (`w094`, `w102`). The shapes differ (audit item 10, measured); left.
8. **Tapping Rewind away from the mirror** showed the crossed icon and "0" (`w061`): understood as "not here", which is right.
9. **The key in a photo and the staff in a portrait** were hard to match the first time (`w008`); the "stick" is a flute, learned only from a role name. Left (art).
10. **Islands repeat across lives**: Old in life 1 was Child in life 3 (`w076`). Seven templates, three a life: expected, and consecutive lives repeat a chapter's island 6.7% of the time (checked). Left.
11. **The gallery circles look about 32 px** (`w115`); the hit area is the whole cell (known). The privacy text has a gap before its last line (`w055`, kit, known). The album shows a dashed "0" for a chapter named wrong (`w110`, known). Left.
12. **A memory that adds nothing new still costs its full price** (`w132`). That is a decision the player makes; kept.

No English on a Turkish screen. No console errors or page errors in either browser. Pause, resume, the language button, the reload mid-chapter ("Devam et" restored the life at the same years, `w054` to `w056`), Daily, album and share card worked.

### Why the pressure went, and what restored it

The tester's idea is that every ability costs years of your life. Three rounds moved the careful bots' margin from thin to wide:

| Round | Careful min / mean | Slow min | Rewind used |
| --- | --- | --- | --- |
| Before puzzles | 37.6 / 82.0 | 14.1 | 97% |
| Old Push also holds the mirror's kind (no puzzles) | 47.3 / 89.2 | 29.2 | 41% |
| Memories that lie (puzzles) | 55.2 / 92.1 | 38.2 | 21% |
| Linked photographs | 49.7 / 85.3 | about 24 | about 70% |
| Two-kind entry memory | 64.6 / 91.5 | 40.7 | 11% |

Ablations on the code before this pass (one bots run each):
- **The Old Push extra kind** no longer matters with puzzles: each memory's kinds come from its puzzle. Removing the line changes nothing (Rewind 10%, all checks pass).
- **The two-kind entry** is the cause of the Rewind collapse. The old mirror showed `first` and `other`, and `other` is the entry's second kind, so after the entry Rewind added only what Leap adds, for 4 more years. Going back to a one-kind entry in Grown-up and Old gives Rewind 70% and slow min 22.3, but fails two existing assertions (the entry must need a deduction; the ramp must get harder chapter by chapter). It also moves the slow mean by only 2 years (69.4 against 71.4): the earlier "pressure" was a thin tail, not a thin margin.

So neither cause was reverted. Two changes instead. The mirror change on its own makes the game easier (at 150 years: slow min 50.1, careful mean 92.5, spending decisions 4.09), because one Rewind replaces Leap and Light; all the added pressure comes from the shorter candle.
- **The Old mirror now shows the two kinds the entry does not (`first` and `next`).** One Rewind (20 years) stands in for Leap and Light (26 years) plus the walk to the leap stone, so it is a real choice: the careful bot takes it on 36% of runs and Leap on 68%. Grown-up stays as it was: the same change there added only 3 points of Rewind use and raised the worst Grown-up spend from 31 to 41.
- **The candle is 135 years, not 150.** Chosen with a new bot, the first-timer: the slow bot (half speed, 8 s still before each choice) that also taps one true photo in the first puzzle of every chapter. In this pass a person spent about 20 years more than the slow bot; one wrong tap a chapter is 36. At 150 the first-timer's median was 38 years left; at 140, 27; at 135, 22 with 2 of 540 runs fading in the Old chapter; at 130, 17 with 7 fading. 135 is the lowest that keeps it at 99% or better. The first chapter is unchanged: a first-timer spends 29 years there on average and never fades before the Old chapter.

Aims: a first-timer finishes almost always (at least 99%) with a median of 30 years or less, never fades in the first two chapters, and the careful bot uses Rewind on at least a quarter of runs, without forcing it (the bot without old-chapter Rewind still names all three, 540 of 540).

Bot tables (`node bots.mjs`), before → after:

| | Before | After |
| --- | --- | --- |
| Careful years left min / mean | 64.6 / 91.5 | 56.0 / 77.5 |
| Careful score | 1220 | 1080 |
| Slow years left min / mean | 40.7 / 71.4 | 35.1 / 57.7 |
| Careful person (3 s thought) min | 63.9 | 49.3 |
| First-timer: named all three / median / 10th percentile / min | 540 of 540 / 38.4 / 24.9 / 4.7 (measured on the old code with the new bot) | 538 of 540 / 22.2 / 11.7 / 0.0 |
| Careful uses: Light / Push / Leap / Rewind | 93 / 100 / 93 / 11% | 91 / 100 / 68 / 36% |
| Spending decisions a run | 4.29 (3: 9%, 4: 57%, 5: 30%, 6: 4%) | 4.09 (3: 7%, 4: 77%, 5: 16%) |
| Years spent Child / Grown-up / Old, careful min/mean/max | 10/11/31, 14/16/31, 16/32/45 | 10/11/31, 14/16/31, 16/31/41 |
| Without old-chapter Rewind | 540/540, min 64.6 | 540/540, min 49.6 |
| Random tapper / first-picture / always-pay score | 844 / 834 / 912 | 733 / 717 / 786 (careful 1080) |
| Gambler score, all three right | 716, 13% | 671, 17% |
| Spender | faded 100% | faded 100% |
| Hasty stuck: pay / blind tap, years left | 98.6 / 96.1 | 83.6 / 81.1 |

No existing bot threshold moved. Spending decisions (4.09) are close to the asserted floor of 4: more runs now use Rewind in place of Leap and Light. Scores fall by about 140 for the same play, so a best score set before this pass is harder to beat, and today's Daily scores mix both candles. A saved life from before resumes with its old years; the candle drawing is clamped so a life above 135 stays in its frame.

### What changed, and the assertion for each

| Change | Assertion | Against the old code |
| --- | --- | --- |
| A tapped photo that is not the lie is dimmed and wears a red badge with a white cross (`wrongMark`), never the gold check. Live puzzles and the practice; torn pieces keep their small cross. | `check.mjs` `assertWrongBadge`, after the wrong tap in the live dark puzzle and the wrong practice tap: no gold circle in the tapped photo's corner, and the red one there. | Failed (badge reverted to the gold check): "practice: a tapped true photo shows no gold check". |
| The practice shows "Find the lie" / "Match the edge" in the page language beside its free candle. | `check.mjs` `finishPractice`: the practice paints its title in English or Turkish. | Failed on the code before this pass, and with only the title reverted: "the lie practice says what to do (Find the lie)". |
| The practice hand shows after 1.2 s, not 3 s (`HAND_AFTER`); the state hook gains `puzzle.hand`. | `check.mjs` `finishPractice`: `puzzle.hand` is true within 1.5 s of the practice settling. | Failed with the hand back at 3 s: "timed out waiting for: the practice hand shows within 1.5 s". |
| The Old mirror shows `first` and `next`; the candle is 135 years. | `bots.mjs` section 9: a first-timer names all three on at least 99% of runs and never fades before the Old chapter; its median years left is at most 30; the careful bot uses Rewind on at least 25% of runs. | Failed: median 38.4, Rewind 11%. |
| The picker's two buttons get an opaque base. | None: a drawing fix, confirmed in screenshots. | – |
| The candle drawing is clamped at full, so a life saved under the 150-year candle draws inside its frame. | None: not seen on screen (no old checkpoint was loaded). | – |

### Replayed by touch after the changes

Fresh saves, tr-TR, the same touch controller (`rw` WebKit iPhone 13, `rc` Chromium 360 × 640).
- The practice now reads "Yalanı bul 0" with the hand already on the bird (`rw004`, `rc003`); a tap on the cat dims it under a red badge, and the hand stays on the bird (`rw005`, `rc004`).
- A wrong live tap dims the true photo under the red badge, −12 on the candle (`rw007`, `rc006`).
- The candle starts at 135 (`rw002`, `rc001`). In the Old chapter the mirror's sign shows a hat and a hand, Rewind opened a torn pair of hat and held thing, and with the entry it named the face (`rw024`, `rw026`, `rw027`, `rw030`). That life had one wrong tap and one blind wrong name and ended with 46 years and 506 points (`rw032`).
- A careful Chromium life (`kc` prefix) with no wrong tap and no blind name: about 121 years left after the Child chapter (read on screen, shot not kept), 104 after the Grown-up chapter (`kc026`), then in Old Push (13) for the entry, Rewind (20) at the mirror and a torn pair matched by its edge (`kc039`, `kc040`), ending with 56 years and 860 points (`kc043`). These are on-screen readings. Old cost about 48 of the 104. The end margin is close to the careful bot's minimum (56.0) and under its mean (77.5): a person who reads every puzzle right still ends with about two fifths of the candle, so the thin margin belongs to players who err, not to careful ones. After the entry, three faces were left that differed in two kinds, and the mirror's torn pair settled both, so Rewind bought something the entry had not.
- The torn practice says "Parçayı eşleştir 0" (`rw026`).
- The picker shows no "Kim?" through "Bu benim!" in either browser (`rw010`, `rc009`).

### Final runs (each alone)

- `node bots.mjs`: all checks passed (6.6 s).
- `node check.mjs`: all nine passes ok. An earlier run in this pass failed once on WebKit with "short album rows use the available width for photos": the album canvas was blank in the screenshot (not even its paper). A WebKit-only rerun passed, and so did the final run. Not reproduced; recorded as a possible WebKit paint-timing flake in `drawAlbum`, unresolved.
- `node experiments/kit/check/phone.mjs borrowed`: ok on WebKit and Chromium, hint ok on both.

### Not verified

- Real people: the first-timer bot stands in for a person who errs once a chapter. Whether 135 years feels tight but fair to a real first-time player is a guess from one cold player.
- A real phone and a real thumb; colour-vision simulation of the red badge.
- The live-puzzle badge assertion was not seen failing on its own: the mutation stopped at the practice badge, which uses the same drawing.
- The practice-hand assertion waits 1.5 s of wall clock for a hand that appears after 1.2 s of game ticks; a heavily loaded browser could make it flake.
- The Grown-up mirror still shows the entry's second kind, so Rewind there buys what Push buys for 7 more years. Left: changing it raised the worst Grown-up spend from 31 to 41 and added only 3 points of Rewind use.
- Against the targets the caller cited, the slow bot's minimum (35.1) is above the earlier 24 and Rewind (36%) is below the earlier 70%. The thin margin is measured on the first-timer instead, which rests on one cold player's two lives.
- Turkish wording of the practice title is the existing live-puzzle string, not reviewed by a native speaker.

## 2026-11-24 · Open items from the audit (flake, islands, entry memory, tears, gallery, Daily, role names)

This pass works through the audit's open items 7, 8, 10, 11 (gallery part), 12 and 14 below, and one check flake. Evidence filenames are relative to `scratchpad/shots/open-borrowed/` in this pass's task directory. Each new assertion was run against a copy of the previous commit (`e5994dd3`) and failed there; the failure is quoted with each one.

### What changed, and the assertion for each

| Change | Why | Assertion (check or bot) | Against the old code |
| --- | --- | --- | --- |
| **A tap in the first 24 ticks of an open puzzle selects nothing.** `selectPhoto` and `puzzleAct` return until `pz.age` reaches `SETTLE` (24 ticks, 0.4 s). The age restarts when practice turns into the live puzzle. A checkpoint without `age` counts as settled. The state hook gains `puzzle.settled`. | The seed-28 puzzle tour failed at 360 × 640 with "a wrong tap costs 12 years". Cause, confirmed by a forced repro: the check's walk to the dark memory leaves the player on the tile, Light opens the puzzle on the next tick, and a second tap meant for the tile lands on the first photo card (the tile spans about y 146 to 162, the cards start at about 162). That photo is picked before the player has seen it and costs 12 years; the check's own wrong tap then hits an already tried photo and costs 0. A real thumb can do the same: a double tap on a memory opens it and picks a photo. CPU throttling at rate 6 (4 runs) did not reproduce the flake, so the timing was the check's, but the game took the tap. | `check.mjs` puzzle tour: "a tap in the instant the photos appear picks nothing" (pointer events dispatched from `requestAnimationFrame` the moment `screen === 'puzzle'`), and the candle falls by Light's 10 only. | Failed: `tried [true, false]`, `wrong 1`, 12 more years gone. |
| **"The years carry over" is now exact.** It compares `borrowedSim().chapterStart.life` with the raw life read on the chapter card, and checks the shown life is within 5 years below it. | The old assertion compared two rounded reads with the candle burning 0.15 years a second between them (once `127 !== 128`). The game was right; the check raced the candle. This is a stronger check, not a weaker one. | `check.mjs` run 1, chapter 2. | Not a behaviour change. |
| **Seven island templates, not three.** `ISLANDS` has four new layouts (T3 to T6) with the same locks in new places: dark top left or right or middle, leaps across a lake vertically or horizontally, the rock pocket in four positions, the mirror in four places. `newRun` deals three different templates of seven from the same random stream, so faces and answers are unchanged; only the islands change. Past Dailies change their islands; today's and future Dailies stay one deal per date. | Audit item 7: by the second life the islands repeated. | `bots.mjs` section 1b: "every island is proven" (42 of 42: 7 islands × both mirrors × each chapter's drop), with a structural proof per island: wall all round, one of each lock, S reaches F, D, M and `>` on foot but not P, L or j; B sits beside P with a tile within `NEAR`; breaking the rock opens P and not L; the island past j is closed and the raised stones reach L; D has dark ground. A mutation check ("the island proof catches a memory reached without its ability") confirms the proof fails on a broken island. Repeat rate on consecutive seeds 1 to 3001: the same chapter island 6.7% (limit 10%), the same three shapes 3.1% (limit 10%). | Repeat rate failed: 16.5% and 100%. |
| **The first memory of each chapter asks for one deduction.** `entryOf` picks two kinds; the lie shows a pair of values that each appear on some face but never together on one face, so it is caught by comparing with the portraits. Child takes the pair that leaves the fewest faces, Old the most, Grown-up the median. The later memories keep the old relations around the new anchor pair. | Audit item 8: the entry lie showed a value no portrait had, which needed no thought. | `bots.mjs`: "the first memory is always settled from the portraits and never names anyone"; "the first memory's lie shows only values some face has" at least 88% (Child 89.9%, Grown-up 93.5%, Old 93.2%); and the ramp, an exact uniform guess among the faces that fit after the first memory: Child 49.1% > Grown-up 45.1% > Old 42.7% (each step at least 1 point). | 0% for the lie check; ramp 42.8% > 33.6% > 33.5% fails the 1-point step. |
| **Tear edges differ by shape.** Four 13-point edge classes (valley, hill, step up, step down, each with small teeth) replace the old profiles, and the tear is twice as deep (`TEAR_INSET` 14, was 7). The edge stays the same colour; only its outline tells the pieces apart, so it reads without colour vision. | Audit item 10: the profiles differed by about 4 px at 360 px. | `check.mjs` (top level): the smallest mean vertical gap between any two edges, over 101 points, is at least 8 px (now 10.5). | Old edges: 4.2 px. |
| **Gallery circles can be tapped.** A tap on a found role rings it in gold, puts its name where the count line was, and shows a button that is the keepsake itself: the portrait from the last album page that kept the role. The button opens the album at that page. A second tap on the same circle closes it. No new strings: the button's label is the existing "Keepsake album" (aria). The state hook gains `galleryCells`, `galleryPick` and `albumPage`. | Audit item 11 (gallery part). | `check.mjs` language tour, both languages: three found circles; a touch on one shows its role name in the page language and hides the count line; the leak and overflow checks pass on that menu; the keepsake button opens the album page that holds the role. | Failed: no gallery cells. |
| **A Daily marker during play.** A small calendar page with today's day sits after the chapter dots in the top strip, on the island, the puzzles and the portraits, only in a Daily. The state hook gains `dailyMark`. | Audit item 12. | `check.mjs` language tour: a Daily shows today's day; the calendar covers neither `#pause` nor the notes button and stays in the top strip; it stays on the live puzzle; a free life shows none. | Failed: "a Daily life shows today on a calendar while playing". |
| **Role names stay whole on the end card.** Each name is a `white-space: nowrap` span; a line breaks only between names. | Audit item 14 ("Bitki / büyücüsü"). | `check.mjs` language tour on every end card: no role name's text range covers two line boxes. | Failed: "Door Wizard" split in English at 360 × 640. |

Three existing assertions changed: "the years carry over" (now exact), "a useless ability tap costs nothing" (below), and the route proof's fixed count of 78 memories, which assumed three islands. The route proof now walks every template in every chapter position, doubled for the mirror, and expects 13 memories a run (`reached === routeRuns * 13`). The lab field `islands` (template numbers, 1 to 7) stays one digit each.

**"A useless ability tap costs nothing" failed once** on Chromium Pixel 7 while another game's check ran on the same machine. The check compared the shown years (a ceiling) before and after the tap while the candle burned at 0.15 years a second; a slow tap crossed a whole year. Forced repro: a 7 s wait before the tap fails the old assertion with no ability used (`used.glow 1`, others 0, `spent` 10, the Light from earlier). The check now waits for the player to stand still, compares `spent` and the use counts exactly, and asserts the "what this needs" tip appeared, so the tap was heard. With the same 7 s wait the new check passes; with a mutation that charges 1 year for a useless tap it fails (`spent: 11` against 10). Not a game bug. The "wrong name costs WRONG years" check still allows only one year of burn between its reads; it has not failed.

### Decisions

- **Same random stream for faces.** The island deal draws from the same `r` after the faces, so seeds keep their people and answers. Only the islands of past seeds changed.
- **The ramp is measured by guessing, not solving.** "Hardest to guess" means an exact uniform guess among the faces that fit after the first memory. Child leaves the fewest faces, so a guess after it is most often right; Old leaves the most.
- **The calendar sits after the chapter dots, not under the pause button.** Under the pause button it covered the notes button (seen in `new/words/chromium-torn.png` before the move).
- **The gallery pick replaces the count line,** so the menu grows by one row (about 24 px) only while a role is picked. All language-tour menus still have no overflow.

### What is still open

- **Late chapters can still be too easy (audit item 9).** Not improved. The two-kind entry gives more information than the old one-kind entry, so the game got easier in years left: careful bot minimum 64.6 years (was 49.3 to 49.7), slow bot minimum 40.7 (was 23.6 to 25.0), Rewind used on 11% of runs (was 70%), spending decisions 4.29 a run. A guess after the first memory is right 42 to 49% of the time (was about 34% in Grown-up and Old). Harder Old chapters need retuning against the bots' margins.
- **The practice still teaches a one-kind lie.** `PRACTICE.lie` compares one clue with the portraits. The live first memory now needs a two-kind comparison. In touch play the two-kind memory was solvable without a new lesson, but a cold player was not tested.
- **Chapter preview and the dashed "0" (audit item 11, other parts) and the privacy gap (13)** are untouched.
- **Gallery tap target.** Each circle is about 41 CSS px at 360 px, a little under 44. The hit test uses the whole cell, not only the circle.

### Played by touch after the changes

Playwright touchscreen taps at coordinates read from each screenshot, locale tr-TR, a fresh save. Screenshots in `touch/` (`c-` Chromium 360 × 640, `w-` WebKit iPhone 13).
- **Chromium:** the Daily of 2026-11-24 won, 1,010 points, 71 years left (`c-002` to `c-042`), including the cat practice, three two-kind first memories, the new torn practice and a live torn puzzle read by tear shape (`c-036`, `c-037`), Show on an undecidable dark memory, Rewind in Old. Then the gallery: a tap named Çilingir and its keepsake opened the album page (`c-044`, `c-045`). Then a free life won, 1,120 points, 82 years left (`c-047` to `c-087`), on different islands, with no calendar.
- **WebKit:** a free life won, 1,160 points, 86 years left (`w-002` to `w-043`), including the torn practice and live torn puzzle (`w-021`, `w-023`), and the signed puzzle. The end card kept "Bitki büyücüsü" and "Sarayın anahtar bekçisi" whole. The gallery tap named Bitki büyücüsü with its keepsake (`w-045`). Then the same Daily won, 1,100 points, 80 years left, with the calendar visible (`w-046` to `w-084`); it dealt the same islands and memories as in Chromium.
- No page errors or console warnings in either browser.

### Not verified

- A real phone, a real thumb, and colour-blind players: the tear edges were measured and looked at in screenshots, not tested with people or a colour-vision simulation.
- Whether players find the two-kind first memory fair without a lesson.
- The gallery tap with a screen reader: the canvas circles are not focusable; the picked name and the keepsake button are.
- The calendar's day on a device whose date changes during a Daily: it shows the Daily's date (`dayKey`), not the clock's.

## 2026-11-24 · Middle and late game audit

Evidence filenames are relative to `scratchpad/shots/deep-borrowed/` in this audit's task directory: `c-` is Chromium at 360 × 640 and `w-` is WebKit with the iPhone 13 profile. Both used locale tr-TR and touch taps at coordinates read from screenshots, with a screenshot after each action. The game has three chapters, not numbered levels, so "the middle and late game" here means the Grown-up and Old chapters, replayed lives, and Daily.

Played by touch before the fixes:
- Chromium: two full free lives (510 and 760 points), then three Dailies (640 honest, 1,790 from remembered answers, and 993 with one deliberate wrong name).
- WebKit: one full free life from a fresh save (1,240 points), one Daily from remembered answers (1,780), and the pause menu.

### Findings, ranked by how likely each is to make a player quit

| Rank | Finding | Evidence | Outcome |
| --- | --- | --- | --- |
| 1 | **Old chapter coin flip.** Old has no free memory. A player who opens the Leap or dark memory before Push meets two photos that nothing found so far can tell apart. The screen gave no sign of this, so the player taps a 50/50 for 12 years. | c-133, c-134, c-136, c-137; w-027 to w-032 | Fixed (cue) |
| 2 | **The same person twice.** Chapters draw answers independently, so a life can repeat a role. In the WebKit life, Child and Grown-up were both the court flute player with the same portrait, and the gallery grew by one. Before the fix, 559 of 9,000 chapters on seeds 1 to 3,000 repeated an earlier role. | w-014, w-026, w-035 | Fixed |
| 3 | **Leap after the stones are up.** Tapping Leap while standing on the landing stone pointed an arrow at the player's own tile. The button looked usable, and the candle kept burning. | c-029, c-030 (c-031 walked back) | Fixed |
| 4 | **Daily replay beats honest play.** A replayed Daily with remembered answers scored 1,790 against 640 honest on Chromium, and 1,780 against 1,240 on WebKit. Both the Daily score and the all-time Best took the replay. A record that is easy to inflate is worth nothing to a returning player. | c-145, c-146 to c-157, c-170; w-035, w-050 | Fixed |
| 5 | **Leaving from the chapter card also pressed a menu button.** The card's Menu acts on the touch itself and shows the menu at once; the click the browser sends after the touch then landed on the menu button under the finger. In the Turkish game at 360 × 640 that is the language button, so the player came back to an English menu. On other layouts it can be the sound button. Found while replaying the fixes; it predates this audit. | c2-005, c2-006 | Fixed |
| 6 | **Flat rewards between chapters.** The chapter card showed the portrait but not who the player had been, nor whether the role was new. The Daily found no new role. | c-014, c-038, c-066, c-145 | Fixed (role name and a "New" star on the card) |
| 7 | **Same maps.** Every chapter uses one of three island templates, mirrored. By the second life the islands repeat. | c-002 vs c-067, c-015 vs c-057, c-039 vs c-081, c-100; w-015 | Left |
| 8 | **Every entry memory is trivial.** The lie in the first memory of each chapter shows a thing no portrait has. | c-004, c-016, c-043, c-058, c-068, c-085, c-101, c-116; w-005, w-016, w-038 | Left |
| 9 | **Late chapters can be too easy.** Life 2 Child was solved with two memories and 134 years left. A WebKit Old chapter was solved after one memory with 94 years left. | c-064, w-033 | Left |
| 10 | **Tear matching is hard to read at phone width.** The tear profiles differ by about 9 px. | c-088, c-120, w-022 | Left |
| 11 | Gallery circles cannot be tapped and show no names. The chapter preview is the same every life. A result row with no photos shows a dashed "0". | c-098, c-099, c-114, c-170, w-050 | Left |
| 12 | Daily has no marker during play; only the menu button and the share card say "Daily". | c-100, w-037 | Left |
| 13 | The privacy notice on the menu has a blank line before its last words. | c-001, c-098, w-001, c-171 | Left |
| 14 | Long role names wrap on the result card ("Bitki / büyücüsü"). | c-097, c-145 | Left |

Corrected during the audit: the Old chapter does not charge abilities × 1.5. Only the burn of time is × 1.5, and the bigger drops seen in play included walking time.

Confirmed working: wrong-name feedback (c-165, c-166) and the pause menu (w-053). No English text appeared in the Turkish game.

### What changed

| Finding | Change | Assertion |
| --- | --- | --- |
| 1 | When the open memory cannot be settled from what the player knows (`solvePuzzle` returns -1), the line under "Find the lie" says "A clue is still missing" in place of the wrong-tap cost. The Later button glows, and the tap hand points at it. The cue is absent in practice and when the memory can be settled. The state hook's `puzzle` gains `stuck`. | `check.mjs` puzzle tour: the undecidable Grown-up dark memory has `stuck === true` (shot `p3a-missing-clue`). The same memory after Push has `stuck === false`. Before the change, the second check failed with `undefined`. |
| 2 | `answerOf(seed, k)` in `sim.js` keeps the drawn answer unless an earlier chapter's answer had its role. In that case it redraws evenly among the faces with a new role, from a separate random stream. The island, the memories and the earlier draws stay as they were, and the answer is still a function of the seed alone, so old checkpoints and fixed-seed tests need no change. `opts.answers` still forces answers. | `bots.mjs`: no repeated role when one could differ (failed with 559 of 9,000 before the change, passes with 0), and the answers spread evenly over the six places. |
| 3 | With the stones up, Leap advice points at the far end of the stones from the player. The button's look is unchanged. Without them, it still points at the nearer launch stone. The state hook gains `tip` (key and target tile). | `check.mjs` ability tour: standing on the landing stone, a Leap tap gives `tip.key === 'useBridge'` at the pad tile (shot `15a-bridge-tip`). Before the change it failed with `undefined`. |
| 4 | The first Daily run of a date to reach a reveal (a right or wrong name, or the candle going out) is the one that counts. From that reveal on it writes its score so far to `save.daily[date]`, and only it can raise `save.best` at the end. Any later Daily of the date, including a fresh start after leaving from the chapter card or the pause menu, is a replay: it sets neither score, and its end card shows "Replay · today's Daily stays N". The save format is unchanged; the checkpoint gains `counting`, which defaults to false. | `check.mjs` Daily tour: a first Daily with one wrong name sets the Daily score and Best. A second Daily with every name right scores higher but leaves both alone, shows the replay line, and fits the screen (shot `19-daily-replay`). A first Daily reloaded on its chapter card and continued still sets both scores and is not called a replay. A Daily left at the chapter card after one wrong name keeps 0, and a fresh Daily after it counts for nothing. With the old max logic restored, the tour fails at the first replay check (see "Checks"). |
| 5 | After the chapter card's Menu, the one click the browser sends for that touch is dropped (capture listener on `document`, armed for 800 ms and disarmed by the next pointerdown). | `check.mjs` Daily tour: the leave now uses a real touch (`page.touchscreen.tap`), and no click may reach a `#menu` button and the page language must not change. A scratch run of just this leave on Pixel 7 Chromium in tr-TR: before the change the click reached the language button and the page turned English; after it, no click arrives. On WebKit (iPhone 13) under Playwright no click followed the touch either before or after, so the check proves the fix on Chromium only. |
| 6 | The chapter card names the role just remembered. A role new to the gallery gets a gold star and "New: …". | Replay screenshots only (no assertion; it is not a bug). |

New strings (English and Turkish in `words.js`): `needClue`, `dailyReplay`, `newRoleNamed`.

### Decisions and their reasons

- **Leaving a Daily after its first answer uses it up.** The chapter card shows the true self even after a wrong name, so a player who left and started again would know an answer. Leaving before any answer is shown costs nothing, since nothing is known yet. A Daily left after one answer shows its score so far on the menu button, for example "Daily · 0".
- **The role rule leaks a little.** A player who knows the earlier answers can skip faces with those roles. A guess at once that does this in chapters 2 and 3 is right 19.3% of the time, against 16.7% by chance (`bots.mjs` prints it). The other bots stay at chance. This is accepted: three different people is the story, and the gain is small.
- **The missing-clue cue tells the player something they could work out.** It never says which photo lies. It only says that nothing found so far decides the memory, which `solvePuzzle` computes from public facts.

### Left, and why

- **Map templates (7).** Three hand-made islands carry the lock layout the bots prove. New templates need new solvability proofs and are a larger design task.
- **Trivial entry memory (8).** The entry memory must be decidable with no knowledge, which needs a value no face has. A harder entry, such as a two-kind check, would show two kinds at once and collapse the later memories.
- **Late chapters too easy (9).** The years left feed the score. Making the Old chapter harder needs retuning against the bots' slow-player margin (minimum 49.7 years left).
- **Tear readability (10).** This is an art change. It needs the torn-paper profiles redrawn and the practice demo checked again.
- **Gallery names, chapter preview, Daily marker, privacy gap, role wrap (11 to 14).** These are lower in rank. The privacy notice text comes from the kit, which this audit did not edit.

### Replay after the fixes (touch)

- Chromium: a Daily replay with guesses. The chapter cards name the role (c-175 "Kır flütçüsü", c-179 "Çilingir"). The end card says the Daily stays 1.790, and Best is unchanged (c-183). That shot shows an earlier Turkish wording.
- Chromium, after the leave rule, from a fresh save: a Daily with a wrong first name (the card shows the true self, c3-004), Menu on the chapter card (the menu stays Turkish and shows "Günlük oyun · 0", c3-005), then the Daily again with the known first answer: the end card says "Tekrar · bugünkü Günlük oyun 0 kalır" on one line, and Best stays 0 (c3-017). The earlier attempt at this replay found finding 5: the same Menu tap turned the menu English (c2-005, c2-006).
- WebKit, seed 28: the Grown-up dark memory opened before any clue shows "Bir ipucu hâlâ eksik", a glowing "Sonra bak" and the hand (w-065). A decidable memory shows the normal wrong-tap cost (w-060, w-070, w-076). On the landing stone with the stones up, Leap points at the far pad (w-074). The chapter card shows "★ Yeni: Çit boyacısı" (w-081), a different role from the Child chapter's "Çiçek yetiştiricisi" (w-058).

### Checks

- Failing before, passing after: the role-repeat check in `bots.mjs` (559 of 9,000, then 0); the Leap tip in `check.mjs` (`undefined`, then `useBridge`); the missing-clue flag (`undefined`, then `true`/`false`); the Daily tour with the old max logic put back (failed with 1800 !== 1000 at the first replay check, passes with the change). The leave case was added after that run and was not run against the old logic. The reload case fails when Continue drops `counting` (0 !== 1000 on Chromium).
- `bots.mjs` also measures the Old chapter: opened before anything else, Leap or dark memories cannot be settled in 1,138 of 1,200 (seeds 1 to 600), Push in 0 of 600. This is a measurement, not a bug test.
- Final run after all changes (`check.mjs` per engine, run one after the other): `bots.mjs` passes. `check.mjs` passes on WebKit (iPhone 13, plus the en and tr tours at 390 × 664) and on Chromium (Pixel 7, 360 × 640, 390 × 844, desktop 1280 × 800, and the en and tr tours at 360 × 640). `experiments/kit/check/phone.mjs borrowed` passes on WebKit and Chromium, including the kit hint.
- Intermittent, unresolved: the puzzle tour on seed 28 (Child chapter, untouched by these changes) failed twice at 360 × 640 with "a wrong tap costs 12 years". The fail shot shows the tap landing on the right photo, so the tap and the photos' positions disagreed at that moment. It also once failed with 127 !== 128 on "the years carry over". Each passed on rerun; other checks were running on the same machine at the time. A first run of the new reload step failed on WebKit because Continue reports the card ready before the first frame draws its Menu button; the step now waits for the button.

### Not verified

- The Old chapter's cue was not replayed by touch, and the browser check covers it only on a Grown-up dark memory (a lie puzzle). The Old Leap and dark memories are seal puzzles with a different layout. `bots.mjs` shows that 1,138 of 1,200 of them cannot be settled when opened first (seeds 1 to 600), so the cue will appear there, but its look on a seal puzzle is unverified.
- The Daily replay and leave rule were replayed by touch on Chromium only. A reload of the counting Daily is covered by `check.mjs` only.
- Whether real iOS Safari sends the click after the chapter card's Menu touch is unknown; Playwright's WebKit did not.
- WebKit got one free life and one Daily before the fixes, not three of each. After the fixes it got a part of one free life (Child, Grown-up and the start of Old).
- The Turkish strings have not been reviewed by a Turkish speaker.
- Whether the cue keeps players from guessing is unmeasured; no outside player has seen it.

## 2026-11-24 · Words and pictures

| Earlier wording | What the player sees |
| --- | --- |
| The menu premise and the instruction to tap a glowing memory | Three ages in sequence beside one candle. On the island, the existing hand and kit hint point at the first free memory. The kit's still hint uses a short localized instruction. |
| The practice instructions for the cat, torn paper and seal | The cat clue connects to the matching photo with a check and to the lie with a cross. A translucent paper half moves into the matching tear. The crossed seal connects to the photo bearing that seal. Practice shows a candle with zero cost. |
| Compare both photos with possible faces, match the edges, and find the seal that marked a lie | A live photo draws attention to the candidate portraits and the relevant journal slots. Matching edge profiles are outlined. A seal from an earlier lie stays crossed out above the pair. Live comparison cues draw on visible evidence. |
| Practice complete, True, False, Try the other photo, Photo mended, You found the lie, and Keep the true photo as a clue | A check marks true evidence, a cross marks a lie or an incorrect tear, and the false print drops away. A successful tear joins its edge. The recovered details fly into the journal and incompatible portraits dim. |
| Wrong photo feedback, Already checked · no cost, and Answer revealed | A wrong tap keeps its check or cross beside a candle debit. Tapping the same photo again outlines the existing mark and shows zero. Buying the answer shows a reveal icon beside the purchase price. |
| Failed ability advice and the ability bar captions | An outline and arrow identify the cracked rock, leap stone, bridge, dark patch, mirror or open memory. Offscreen targets get a small picture at the playfield edge. A slashed mirror means there is no mirror. A check means the ability's job is done. The ability buttons use their existing symbols with a candle and price. The failed action also has a localized screen-reader label. |
| Time stands still, correct and incorrect identity feedback, and the candle going out | Pause holds the view and candle still. The solved portrait gains a check, a wrong guess gains a cross and a candle debit, and exhaustion shows an extinguished candle with zero. |
| Chapter transition instructions | The preview shows the fitted tear and the clue carried between photos, then the faster candle and matching crossed seals. In the older mode, nearly identical portraits and a mirror with a count of two preview the middle chapter. The last preview shows the two-clue Push and marks Rewind as optional. |
| I remember, I knew that, No photos recovered, Unknown, and the new gallery announcement | A check or return arrow marks a new or repeated memory. An empty photo outline shows zero. Unknown ages have question marks, and a star next to the gallery count marks a new role. The star has a localized screen-reader label. |

Short words remain for control labels, chapter and role names, the gallery and result counts, and the scoring equation. The live puzzle keeps its objective and a short wrong-tap label because a bare cross also marks the lie the player should choose. The identity screen keeps the chapter-ending warning beside a wrong-name candle debit. The recording disclosure, privacy link, and recording switch retain their meaning in both languages.

The menu and pause controls use the kit's saved language. A manual switch takes precedence over the language in the opening link on reload. Checkpoint matching ignores only the language parameter. Existing save keys, chapter rules and lab outcomes remain the same. The share preview and PNG use the current language for the age captions, score, and Daily date.

The language and layout tour passed in English and Turkish on Chromium at 360 × 640 and the WebKit iPhone 13 profile at 390 × 664 CSS pixels. It compares document and canvas text against the English table in Turkish, checks key and placeholder parity, verifies the language choice after reload, and measures DOM and canvas text bounds. Both sizes also cover the alternate chapter previews, wrong-name reveal and zero-name result. The screenshots are in `scratchpad/shots/words-borrowed/`, with English captures in `english/`. The bots passed all 1,080 careful runs. The full browser check passed on WebKit iPhone 13 and Chromium Pixel 7, 360 × 640, 390 × 844, and desktop 1280 × 800. The shared phone and hint checks passed in both browsers.

A Turkish speaker has not reviewed the text. First-time comprehension of the picture cues, physical phone layout and audio, and screen-reader behavior remain unverified. Browser recording checks used a local stub. The share card was rendered and checked locally.

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
- **Seeds.** `?seed=<n>` fixes every run's seed. The Daily button seeds from the local date (`dailySeed`), so everyone gets the same three chapters on a date. Only the first Daily run of a date to show an answer counts toward the Daily score and Best.

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
- Daily uses the date's seed;
- only the first Daily of a date to show an answer sets the Daily score and Best; a replay, or a fresh start after leaving, does not.

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
