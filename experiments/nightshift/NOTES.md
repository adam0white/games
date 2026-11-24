# Tiptoe Museum

You have one torch and a museum full of exhibits that try to leave before sunrise. Drag the light across the floor to freeze the runaways and hold it until they shuffle back onto their plinths.

The premise comes from the Nightshift brief. Alibi and Borrowed supplied references for the cards, first-run cues and kit wiring. The characters, museum, campaign and rules are original to this experiment. The static build planner picks up the folder at `/nightshift/`.

## Rules and tuning

The fuse and Long Night seed rules below were changed on 2026-11-24. See "Middle and late game audit".

A tap or stationary press aims at the contact point. A moving touch aims 42 floor units above the thumb. The light circle has a 58-unit radius on a 390 × 660 floor. The beam travels up to 530 units per second. Lifting the thumb leaves the beam where it is. Mouse movement and arrow keys also aim. The moon-to-sun clock tracks dawn and the three door markers track losses. A third escape ends the run, including when several exhibits cross on the same simulation tick.

Normal exhibits stop when the light intersects their body. Hold for 0.82–1.83 seconds to send one home. Uninterrupted darkness gives a regular exhibit roughly 9–13 seconds to reach a door, depending on the wing, seed and route. The return follows the same route backward. Lessons start with the featured mechanic and a ghost finger. A completed catch or fuse lesson makes the first mixed group arrive sooner. The kit supplies separate idle guidance for first-time players.

| Wing | Nights | Dawn | Ordered encounters |
| --- | --- | ---: | --- |
| Marble | 1–6 | 60 s | Follow, hold, portrait, twins, three exhibits, twins in a crowd |
| Portrait | 7–12 | 63 s | Mirror, shy mask, cat, mirror and mask, cat and twins, faster waves at the mirror |
| Natural | 13–18 | 66 s | Fuse, upstairs gallery, fuse and stairs, linked twins and mask, mirror and fuse, full museum |

- The portrait dancer steps out of its frame. The twins move when both are dark. The lit twin can stop its partner even from its plinth.
- The mirror moves a reflected pool in the opposite direction from the torch. An exhibit behind the glass accepts reflected light. Direct light can reach it after it leaves the case.
- The shy mask advances in light and stays put in darkness. The cat crosses independently, makes a different sound and never counts as a return or escape.
- The fuse flickers until the beam is left on the box for 0.56 seconds. The upstairs exhibit starts on the balcony and descends through the visible stairs.
- The campaign has a fixed default seed. `?seed=` selects another unsigned seed for campaign or Long Night. `?level=` opens a campaign night for inspection. Seeds set plinth offsets, routes, speeds and which exhibits wake in each wave.
- Long Night ramps concurrency, wave frequency and movement pressure with no dawn. The save keeps its best survival time.
- Daily uses the UTC date and cycles across nights 12–18 with a date-specific seed. One clear per date counts. A missed date resets the streak once the next win is recorded. The share image names the game and labels the date, escapes and streak. The share sheet is used when file sharing is available, with a PNG download fallback.
- `nightshift-save` holds campaign progress, sound, Long Night best and Daily streak. The kit owns its one-shot hint flag and shared recording keys. Lab outcomes are `dawn`, `escaped` and `left`. The start record contains mode, night, seed and the date in Daily. Events count returns, escapes and fuse repair.

## Bots

The following table records the original single-door build. Twelve seeds per campaign night. The blind sweep follows the same path throughout. The listening policy chooses the nearest recent footstep and uses the visible position to follow that exhibit. The average policy has delayed decisions, imperfect aim and occasional trips after the cat. The competent policy prioritizes threatened exits, commits to a catch and repairs the fuse.

| Wing | Trials per policy | Idle wins | Sweep wins | Listener wins | Average wins | Competent wins | Competent max escapes | Furthest progress |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Marble | 72 | 0 | 33 | 72 | 72 | 72 | 0 | 31.5% |
| Portrait | 72 | 0 | 0 | 72 | 51 | 72 | 0 | 80.4% |
| Natural | 72 | 0 | 0 | 69 | 35 | 72 | 0 | 78.9% |

Before the cold play audit, the competent policy lasted 93.0–108.5 seconds in twelve Long Nights. Rules checks cover the twin link, reflected light, dark shy mask, independent cat, fuse repair, upstairs route, simultaneous escape limit, same-seed replay and 31 daily nights.

## Browser checks

`check.mjs` serves the static route and kit through a free loopback port. It drives touch pointer events on WebKit at 390 × 664, Chromium with the larger phone profile, and Chromium at 360 × 640. It checks menu, idle hint, pause freeze and resume, a touch-driven dawn, three idle escapes, next night, sound and progress after reload, Daily seed and streak, share preview, Long Night best, and mocked lab outcomes. The smallest profile also checks the PNG download. The notes script is stubbed.

Screenshot review began with the large and small default layouts. Three revisions uncovered the torch dock and moved the mirror away from the dinosaur, lowered floor contrast and separated the balcony and plinth silhouettes, then softened the torch and shadows and added visible footprints. Intermediate and final captures live in the supplied scratch directory.

## Not verified

Physical phone touch, speaker playback and stereo localization, native sharing, first-time comprehension and human difficulty are unverified. Browser audio checks observe the scheduled nodes. The listener is a policy with access to simulated footstep locations and rendered positions. The average policy models specific delays and distractions, so its rates describe that policy.

Production deploy, live feedback button and remote recording acceptance are unverified. The local recording allowlist already contains `nightshift`. The original shared phone check stopped at catalogue discovery. See the dated rerun below. The experiment-specific checks do not require the listing.

## Builder

- Added a heron so the opening floor has shapes with distinct heights, faces and outlines.
- Set the beam ahead of the finger and gave the torch a visible dock. Footprints convey moving exhibits without sound. The glass case has a separate mint reflection and the clock changes with the sky at dawn.
- The cat distracts with movement and sound. Shining on it triggers a comic chirp and uses the player's attention. The score counts only exhibits.
- An unaided first-phone playthrough would test whether the mirrored case and lit-only mask are understood quickly. A separate scored penalty for the cat was considered. The attention cost is the only consequence implemented.

## Kit candidates

A two-axis absolute drag helper could serve another overhead game. A panning option on the kit audio API would let games use stock footsteps without constructing their own Web Audio panner. The optional ring hint currently dereferences its absent hand element in the shared kit. The default hand hint is used here.

## Cold play audit — 2026-11-24

Evidence paths below are relative to `shots/audit-nightshift/` in scratchpad run `890fd34c-c985-4ecc-b377-d6a9f77fefa4`. Each range refers to individually numbered PNGs. The cold sessions served the experiment locally, with the feedback script stubbed. Each touch used a point chosen from the rendered phone screen. Each action produced an inspected screenshot. No cold session read the simulation, called a game function or used a level override. The WebKit campaign advanced unattended waits with the browser clock. The later automated checks use the state hook and controlled clocks.

| Rank | Cold observation and evidence | Change and replay evidence |
| --- | --- | --- |
| 1 | One tap above the old exit earned three stars on every night from 1 through 8. The torch could also guard Long Night for 1:30 without another input. Chasing exhibits earned fewer stars. `campaign-002.png` through `campaign-019.png`, `wk-034.png` through `wk-041.png`, `chr-027.png` through `chr-036.png`. | Two doors split the routes. A returned exhibit tries the other door on its next outing. Within each seeded wave, exhibits with fewer outings take priority. Parking the torch at the former choke point lost the shift. Active touch guarding earned three stars. `campaign-fixed-004.png` through `campaign-fixed-006.png`, `campaign-fixed-008.png` through `campaign-fixed-015.png`. |
| 2 | The hand pointed from the torch to a statue. It was unclear whether to tap the hand, drag the torch, or touch an exhibit. An untouched lesson could end in a loss. Tapping an exhibit aimed above it. The beam was still in transit after the finger lifted. `wk-002.png` through `wk-004.png`, `wk-044.png`, `wk-050.png` and `wk-051.png`, `chr-drag-004.png` through `chr-drag-007.png`. | The menu gives the goal. The first story shift on a fresh save waits with the upper-left statue visible until the first aim. A tap or stationary press aims directly. A drag keeps the light clear of the finger. The floor labels the night, returns and escapes. The pause menu repeats the controls and the loss condition. `after-wk-002.png` through `after-wk-005.png`, `chr-after-003.png` through `chr-after-007.png`. |
| 3 | The mirror guide continued to point at the mirror while its bear crossed out of the case. The reflection lit empty glass. The green mask was highlighted like a target even though light made it advance. Daily started with glass, stairs, mirror and fuse without explaining what the box did. `chr-047.png` through `chr-050.png`, `chr-057.png` through `chr-061.png`, `wk-019.png` through `wk-022.png`. | The illustrated drag now aims the reflection at the bear inside the case, then guides the player directly to the bear outside. The floor explains the mask, twins and fuse at their introductions. Pause lists the special rules present in the room. A center tap repaired the fuse. `chr-after-reduce-014.png` through `chr-after-reduce-016.png`, `after-wk-007.png` and `after-wk-008.png`. |
| 4 | The bear covered the bust and the dinosaur covered the knight while both crossed occupied plinths. At the old exit, several figures became one overlapping group. `chr-027.png` through `chr-035.png`, `chr-041.png`, `wk-021.png`. | Lower runners use an aisle to clear occupied plinths. The split exits reduce crowding. Rechecked side clearance after the dinosaur's tail touched the frame during replay. `campaign-fixed-014.png`, `campaign-fixed-018.png`, `campaign-fixed-019.png`, `campaign-fixed-022.png`. The final route and tail clearance are visible in `campaign-fixed-025.png`, `campaign-fixed-028.png` and `campaign-fixed-029.png`. Moving exhibits can still cross near a shared door or on the same aisle. |
| 5 | A finger held on the floor could accidentally dismiss the result. The loss card appeared under the finger; releasing it selected Menu. Discovered during sustained-press replay. `final-touch-17.png` through `final-touch-19.png`. | The floor consumes the compatibility click from touches that started there. A separate touch still operates the result buttons. The Chromium regression holds a real contact across a loss. The result remained open on release, then a fresh tap selected Menu in `final-touch-23.png` through `final-touch-25.png`. |
| 6 | Reload during Long Night discarded the current survival record. Two identical times on the loss screen were unlabeled. Campaign reload retained the unlocked night and restarted its clock. `chr-mode-017.png`, `chr-mode-018.png`, `chr-mode-021.png`, `wk-016.png`, `wk-018.png`, `chr-061.png` through `chr-063.png`. | A normal page exit writes a new Long Night best. The result labels survival and best separately. Reload still starts at the menu. The original WebKit save loaded in the revised game with night 2 and its 1:30 best intact. `chr-after-018.png`, `chr-after-019.png`, `result-replay-11.png`, `wk-052.png`, `wk-053.png`. A fresh record went from 0:00 to 0:01 across a mid-round reload in `chr-after-reduce-017.png` through `chr-after-reduce-020.png`. |
| 7 | Dawn looked identical across early nights. The tiny progress diamond was the only night indicator on the floor. Three door marks and a row of stars never explained why chasing earned one star. The escaped cat covered the bear's face in the loss illustration. `wk-015.png`, `wk-016.png`, `chr-036.png`, `wk-022.png`. | The HUD counts escapes and returns. Results name the night or mode and show escapes beside the star count. The poster separates the cat and bear. `after-wk-004.png`, `result-replay-04.png`, `result-replay-11.png`. |
| 8 | The Daily card displayed a date and two unlabeled symbols. The PNG download left no visible acknowledgement. `wk-023.png`, `wk-024.png`, `chr-mode-007.png`, `chr-mode-008.png`. | Both preview and exported pixels include the game, date, escapes and streak. The fallback button reads “Download PNG” and confirms when the download starts. Inspected the downloaded image separately. `result-replay-05.png`, `result-replay-06.png`, `result-replay-export.png`. |
| 9 | The rendered Privacy link measured 42.47 × 15 CSS px at 360 × 640. The sound button met 44 px. The recording checkbox had a small visible square. `chr-drag-002.png`, `wk-006.png`. | Privacy measured 60 × 44 CSS px on replay. The full recording label has a minimum 44 px height. The pause and menu controls fit both requested sizes. `chr-after-002.png`, `after-wk-005.png`. |
| 10 | The sound review found that reduced motion suppressed the footprint while footsteps still played. Repair stars appeared above the fuse. The cold Daily screenshots show the small box and how hard its state was to read. `wk-019.png`, `wk-020.png`. These two causes were identified after source access. | Reduced motion now shows stationary footprints. Repair stars surround the box and its face turns green. `chr-after-reduce-004.png`, `chr-after-reduce-015.png` and `chr-after-reduce-016.png`. |

**Campaign and menu coverage.** Night 1 introduced aiming. Night 2 repeated the same gesture and added hold time. Night 3 brought the dancer out of its frame. Night 4 added a second dotted line between the purple twins. Nights 5 and 6 crowded the upper plinths. Night 7 introduced the mirror. Night 8 introduced the mask. All eight gave perfect results from the parked beam on WebKit. Chromium also reached night 8 by touch, tried the exhibits and obstacles, and reloaded during that night. Pause, resume, sound, recording toggle, return to menu, next night, retry, Daily, Long Night, loss, card, export and back were exercised across the two sessions. The Daily share and Long Night sequences are in `chr-mode-001.png` through `chr-mode-021.png`. The WebKit menu and pause sequence begins at `wk-001.png`; `wk-039.png` through `wk-042.png` cover the recording and sound controls.

**Sound cues.** Enabling sound changes the button. The start cue opens the room. Touch shows a contact ring. Footsteps mark their source on the floor. A catch fills an arc and shows a sparkle. Returning exhibits move back and increase the count. An escape flashes at its door and consumes a life. The cat changes its eyes and color. A fuse repair changes the box and draws stars. Dawn and loss display different result art. Source inspection established the event pairings. The browser checks observe scheduled audio nodes and rendered cue geometry. Physical sound and stereo localization remain untested.

**Regression evidence.** The original floor failed the stationary-beam check. The revised simulation checks both doors, the old door and nearby aim heights on nights 1–8 and Long Night. Removing the outing priority caused the six-exhibit rotation test to fail. Route sampling caught the plinth crossing and the side clearance failure. The original browser failed the fresh-save wait, direct touch, Privacy size, pause rules and three lesson text checks. The mirror, reduced-motion footprint and fuse-star assertions each failed before the cue changes. A sustained press on the fuse failed before the stationary-press fix. Separate result checks failed on the original loss text, card captions, preview description, download feedback, mid-run record, time labels and portrait overlap.

**Replay correction.** On the 360 px phone, the new instruction strip covered the bottom of the kit hand. Its drawn bounds extended to y=612 while the strip began at y=586.25. Positioned the existing hint relative to the caption height and checked the animated fingertip at twelve points. Compare `replay-hint-clipped.png` with `iphone13-390-idle-hint.png` and `pixel7-idle-hint.png`. A real stationary press repaired the fuse before the finger lifted in `final-touch-11.png` through `final-touch-14.png`. These targeted replay shots used the built-in night selector.

**Simulation rerun.** Each wing contributes 72 trials per policy. The competent guard completed all 216 campaign trials with zero escapes; idle completed none. The competent Long Night runs lasted 74.3–100.9 seconds. The final touch replay cleared night 2 with zero escapes in `campaign-fixed-030.png`.

| Wing | Blind sweep wins | Footstep listener wins | Average policy wins | Competent wins |
| --- | ---: | ---: | ---: | ---: |
| Marble | 11 | 72 | 72 | 72 |
| Portrait | 0 | 72 | 33 | 72 |
| Natural | 0 | 66 | 23 | 72 |

**Final checks.**

| Check | Result |
| --- | --- |
| `check.mjs`, WebKit iPhone 13, 390 × 664 | Passed |
| `check.mjs`, Chromium Pixel 7, 412 × 839 | Passed |
| `check.mjs`, Chromium, 360 × 640 | Passed, including actual PNG download and touch release across a loss |
| Shared phone check for `nightshift` | Passed on WebKit and Chromium before and after the changes |
| `bots.mjs` | Passed campaign, 81 parked-beam cases, mechanics, seed replay and 31 Daily dates |

The full three-profile run exited successfully. Earlier WebKit attempts timed out waiting for menu interaction during host contention. The final run used the normal assertions and timeouts.

**Limits.** The tests sample fixed positions and seeds. They do not prove every stationary strategy loses. Brief overlap between moving runners remains possible. Campaign and Daily reload restart the attempt at the menu. There is no mid-round checkpoint format. Browser runs cover normal page exit, not an abrupt process kill. No physical handset, native share sheet, outside player, live feedback submission, production deploy or remote lab receipt was verified. The notes script was stubbed and lab outcomes were checked against a mocked endpoint.

## Words and pictures — 2026-11-24

| Previous words | Picture or feedback in play |
| --- | --- |
| Menu goal and reminders to guard both doors until dawn | The menu and pause show both doors, sunrise and a torch stopping a runner. The floor points to both real exits at the start. The night clock already shows the moon giving way to the sun. |
| Tap the upper-left statue, tap a runner, drag below it and hold until the arc fills | The first shift still waits. An arrow, ring and finger identify the real statue. The finger presses and a ring fills. The first shift shows the offset drag on the next runner after the first return if the player has only tapped. Night 2 repeats the offset demonstration. The kit's idle hint still appears on schedule. |
| Catch the dancer, stop either twin, aim at the mirror and tap the bear once it leaves the glass | The hand follows the dancer out of the frame. The twins share a dotted link and both fill their catch arcs. The mirror lesson shows an offset drag and the reflected path into the case. The hand switches to a direct tap when the bear comes out. |
| Keep the mask dark, let the cat pass, hold the light on the fuse and watch the stairs | A crossed-out beam marks the mask and cat. Lighting the mask adds an arrow away from it. The fuse stays outlined until repaired and the finger reappears after flicker. The stairs have a ring and downward arrow at their introduction and when an upstairs runner enters. |
| Caught, heading back to the plinth | Sparks, a returning runner and a flash on the return counter. The exit flashes and its counter changes when a runner escapes. |
| Night, escape and return captions, and pause rules | Door, exit and return icons sit beside the counts. Pause shows a set of illustrated rules for the current room, including three exits followed by a cross to show the loss condition. |

Visible words name the game, modes, choices, outcome and records. The infinity symbol marks endless play. The result keeps short escape and star counts so players can relate the two. Long Night labels elapsed time and best time because both values use the same format. The share card keeps its title, date and two short count labels so the PNG makes sense on its own. It also keeps download and retry feedback. The lab notice, privacy link and recording choice need words. Screen-reader descriptions name the controls, counters and current lesson. The kit still shows one localized verb with its static reduced-motion hint.

The English and Turkish strings live in `words.js`. The language button updates the card immediately. After a manual switch, the address drops its language override so a reload uses the kit's remembered choice. The share date uses the selected locale and the Daily seed still uses the UTC date. The save format, simulation, levels and lab outcome names are unchanged.

The simulation bots passed mechanics, seeded replay and 31 Daily dates. The game browser check passed on Chromium at 360×640 and 412×839, and on WebKit at 390×664 and 390×844. The shared phone check passed on both engines. The game checks drive seeded runs, inspect cue geometry and capture both languages. They exercise the actual feedback button with a local test key and mock lab receipt. A Turkish-speaking player has yet to review the wording or learn from the cues in a cold play session. Physical phones, screen-reader speech, the native share sheet, live feedback and production lab receipt remain unverified.

## Middle and late game audit — 2026-11-24

A returning player played nights 9 to 18, Daily and Long Night in Turkish, by touch only. Chromium at 360×640 played nights 9 to 18 by reading each screenshot. Nights 2 to 8 were skipped on the cold play audit's evidence: the game-written save from a touch clear of night 1 had its progress raised. WebKit on the iPhone 13 profile received a copy of the Chromium save after night 18 was cleared. On WebKit, only night 18, three Daily runs and three Long Night runs were played, all with a fixed two-door loop. Nights 9 to 17 were not played on WebKit. On Chromium, Long Night runs 2 and 3 and Daily runs 1 to 3 also used that loop.

### Findings, ranked by how likely each is to make a player quit

1. **A blind two-door patrol beat the late game.** Swapping the beam between the two doorways every 2.3 seconds, without looking, did these things:
   - cleared night 18 on WebKit;
   - cleared the Daily on Chromium;
   - outlasted careful play in Long Night (1:25 against 1:10).

   Measured on the simulation over 12 seeds, the same patrol won:

   | Night | 15 | 16 | 17 | 18 |
   | --- | --- | --- | --- | --- |
   | Patrol wins | 11 | 12 | 8 | 12 |

   On night 16 most of those wins had three stars. Exhibits can only leave by a door, so watching the doors made every new rule optional.
2. **Nights 9 to 18 play the same.** Every night brings the same six exhibits and the same pile-up at the doors, and each night takes 25 to 37 catches. The only differences are the size of each wave and how often waves come. Night 13 was lost on the first try to the crowd, not to its new rule.
3. **The fuse is solved once per night.** It is fixed with one hold at the start and never fails again, so it is never a decision.
4. **Long Night is the same every run.** It always used the default seed. Two Chromium runs with the same inputs both ended at 1:25 with 41 returns. Two WebKit runs both ended at 1:14 with 20 returns.
5. **Rewards are flat.**
   - Every result shows the same "Gün doğdu" poster.
   - Finishing a wing or the whole museum looks like any other night, and night 18 ends with only "Tekrar oyna".
   - Run 2 set a new Long Night best, and the result screen did not mark it.
6. **The shy mask and the cat rarely matter.**
   - The mask moves only when lit, so a player who never lights it never sees it move.
   - Lighting the cat only plays a sound.
7. **Exhibits pile up at the balcony and the right door.** The balcony bust overlaps the knight and twins on nights 14 to 18, and three or four figures stack into one clump.
8. **The mirror bounce was not reproduced by touch on night 12.** The taps were likely outside the mirror's 37-unit radius, and the bots show the bounce works. The bear also walks out of the case and is then caught directly, so the mirror is easy to ignore.
9. **Checked and not a bug:**
   - The night clock is linear. The windows glow for the last 8 seconds.
   - The return counter increments only when an exhibit turns back.
   - A hold arc is drawn under a caught exhibit, although it is easy to miss under the beam.

No English or clipped Turkish was seen on the menu, HUD, pause rules or result screens.

### Fixed

- **The breaker trips again.** On fuse nights, 16 seconds after the player mends it (`RETRIP` in `sim.js`), the fuse box turns back to its outline.
  - After a trip, or once a breaker has been left broken for more than 10 seconds, the beam is off for about a third of each 3.8-second cycle until the breaker is mended.
  - Night 16 now has the fuse too.
  - This also applies to Daily (nights 12 to 18) and Long Night. Long Night bests set before this change were set under easier rules.
  - The existing repair finger and the "hold the light on the fuse box" guide return when the breaker trips. A low buzz marks the trip.
  - Night 13's waves shrank from four to three, and its cadence went from 6.7 to 6.9 seconds, to smooth its spike. Night 17's cadence went from 6.7 to 7.4 seconds. Night 18's went from 7.5 to 8.
  - The blind patrol now wins 0 of 12 on nights 13, 15, 17 and 18, whether or not it mends the breaker at the start. The competent bot still wins every seed with no more than one escape.
  - Covered by two `bots.mjs` assertions:
    - "the breaker trips again after it is mended", together with the darkness check.
    - "a blind two-door patrol cannot replace reading the room". It checks the patrol both with and without mending at the start.
  - Evidence that this assertion would have failed before: the same patrol, measured on an untouched copy of the old code, won 2, 11, 8 and 12 of 12. The new assertions themselves were not run against the old tree.
- **Long Night draws a new seed each run** unless `?seed=` is given. The seed is still recorded with the lab run. Covered by the `check.mjs` assertion "each Long Night run draws a new floor".
- **Milestone results.**
  - Nights 6 and 12 now end on "Wing safe" ("Kanat güvende").
  - Night 18 now ends on "Museum safe" ("Müze güvende").
  - A Long Night run that beats the old best shows "New record! Best …" ("Yeni rekor! …").
  - Covered by the `check.mjs` assertions "clearing a wing ends on its own heading" and "a run longer than the old best is announced as a new record".

### Design changes in tests

- The `competent` bot now mends a tripped breaker when no exhibit is past 58% of its route. It does not abandon a catch to do so.
- The `check.mjs` touch driver mends the breaker on nights 13 and 15 to 18 when no exhibit is past 55% of its route. Before, it mended only at the start, and night 16 had no fuse.
- No existing assertion was weakened.

### Left, and why

- **Night 16 is still easy for the blind patrol.** The patrol wins 12 of 12 there even with the fuse. Nights 8 and 10 are also easy for it: the shy mask never wakes, so fewer exhibits roam. A real fix needs a reason to leave the doors that the patrol cannot cover, such as a third exit or exhibits that hide away from the doors. That change touches routes, art and the route-clearance assertions.
- **The fuse balance is tight.** Night 17's cadence passes the competent bot's margin rule at 7.4 seconds, but not at 7.2 or 7.5. The results move by whole escapes with small changes.
- **Not changed:**
  - the mask and cat;
  - the overlap at the balcony;
  - the mirror bounce;
  - the shared result poster art.
- **Previous nights cannot be replayed** from the menu; Play always starts the highest unlocked night. This was not changed.

### Replayed by touch after the fix (Chromium)

| What | Result | Screenshots |
| --- | --- | --- |
| Night 18 breaker | Tripped after mending; mended again by touch | `chr-627-p3-trip`, `chr-628-p3-mend` |
| Night 18, blind patrol | Lost | `chr-631`, `chr-632` |
| Night 6 | Ended on "Kanat güvende" | `chr-655-p3-n6` |
| Long Night, two idle runs with identical inputs | Ended at 0:12 and 0:19 | `chr-657`, `chr-659` |

These were not shown on screen:

- "Müze güvende";
- "Yeni rekor";
- WebKit after the change.

After the change (the `check.mjs` run before the change overlapped with the first `sim.js` edits, so it is not a clean baseline):

- `bots.mjs` passed.
- `check.mjs` passed on Chromium at 360×640 and 412×839, and on WebKit at 390×664 and 390×844.
- The shared phone check passed on both engines.

The new seed and record assertions ran on every gameplay profile. The wing heading assertion ran on 360×640 only.

Not verified:

- the new Turkish strings, as read by a Turkish speaker;
- the fuse balance, as felt by players other than the bots;
- WebKit play by touch after the change;
- a win by touch on nights 13 to 18 after the change. Whether a human can still win those nights rests on the bots alone.
