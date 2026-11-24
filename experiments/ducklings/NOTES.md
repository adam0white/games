# Follow Me

Steer a mother duck with one thumb and bring her flock to the nest. Each duckling replays the exact positions she swam through, so a crossing has to stay safe until the tail gets through.

The original inspiration was the archived “What the Child Saw,” a game about a small one copying what it saw a grown-up do. Follow Me makes the copied action a route through water.

## Campaign and rules

| Chapter | Levels | Main lessons |
| --- | --- | --- |
| Pond | 1–4 | Hold and move, rescue, turn a corner, collect across the pond |
| Road | 5–8 | Cross between cars, stop on an island, collect on the other side |
| Garden | 9–15 | Slip around a sleeping cat, keep the line out of sticky water |
| River | 16–24 | Folding leaves, fast water, a timed dash, and combinations |

- Each level requires a displayed number of ducklings home. The dash also has a 7.5-second clock. Level clocks and hazards wait for the first steering input.
- A clear earns at least one star. Two stars require everybody home or all but one above the minimum. Three require everybody home with no hits or scares. An unlocked level can be replayed directly from the map.
- Mother speed is 0.28 pond widths per second. A tap sets a destination in pond coordinates. Dragging changes it. Lifting the finger keeps the destination while the camera scrolls. A 60 Hz simulation records the trail, and followers index that trail by delay. Brave, curious, tiny and loud ducklings have 0.42-second gaps. Eager and sleepy gaps are 0.85 and 1.18 times that gap.
- Quack briefly pulls the line together. It uses 35% gaps for 1.4 seconds and recharges in 6 seconds. The Quack button, a second finger, a double tap and Q or Space all work. A hit costs a heart. An initial scare sends a duckling back to wait for a rescue. A second scare hides it for the run.

| Element | Effect on the line |
| --- | --- |
| Cars | Headlights warn before moving across a lane. A car that clears the mother can arrive while her followers cross. |
| Sleeping cat | Approaching wakes it. The circle warns for 1.05 seconds before the pounce, so followers can enter it after the mother has left. |
| Sticky water | The mother can swim through the weed, but any follower entering it scatters. |
| Folding leaves | Contact with the mother starts a 1.55-second warning. The patch folds for the rest of the level and scatters followers. Go around or Quack during the rustle. |
| Current | Adds 0.29 pond widths per second upstream and may push sideways. The line copies the resulting motion. Exit early when the current leads into weeds. |

## Endless tuning

Start with 37 sunlight. Drain starts at one unit per second and increases after 18 seconds by one unit per second for every 36 seconds elapsed. Pads appear every two rows. A pad adds 1, 2, 4, 7, 13, 16 or 19 sunlight for 0 through 6 ducklings. Each scare since the last pad subtracts 4 from that refill, down to a minimum of 1. This gives a reason to time a crossing for the tail even if each scattered duckling can be rescued later. Row speed continues to rise with distance.

The competent bot plans 4.5 seconds ahead for the whole line and quacks when doing so makes the crossing safer. The average bot looks 1.05 seconds ahead for the mother, replans less often and only goes after ducklings within 0.16 pond widths side to side. Each uses the same full simulation and sunlight rules.

| Seed | Competent seconds | Competent points | Average seconds | Average points |
| --- | ---: | ---: | ---: | ---: |
| 101 | 62.9 | 1720 | 50.4 | 550 |
| 202 | 71.0 | 3720 | 41.4 | 290 |
| 303 | 73.8 | 3750 | 50.4 | 700 |
| 404 | 83.1 | 4420 | 41.4 | 210 |
| 505 | 83.1 | 4990 | 59.8 | 1540 |
| 606 | 68.5 | 3170 | 39.5 | 370 |
| 707 | 60.2 | 1600 | 35.7 | 100 |
| 808 | 90.7 | 6330 | 36.3 | 220 |
| 909 | 72.2 | 3560 | 43.2 | 410 |
| 1010 | 66.4 | 3710 | 56.9 | 1460 |
| 1111 | 76.5 | 3740 | 52.0 | 610 |
| 1212 | 65.1 | 1960 | 37.6 | 200 |

| Elapsed seconds | Sunlight drain | Competent alive / 12 | Average alive / 12 |
| ---: | ---: | ---: | ---: |
| 25 | 1.19× | 12 | 12 |
| 50 | 1.89× | 12 | 5 |
| 75 | 2.58× | 4 | 0 |
| 100 | 3.28× | 0 | 0 |

All 24 campaign routes earned three stars, with simulated clear times of 3.3–13.5 seconds. The complete bot suite, including the independent double-log route check and determinism, passed in a measured 4.16 seconds.

## Compatibility and checks

- The `ducklings-save` key and its JSON fields are unchanged. Previous unlocks, stars, scores, sound, home totals, album and tutorial status still load. Old scores and stars stay at their original numbers. The replacement levels and the revised endless economy change what new scores measure.
- The kit hint keeps `hold-and-move` and its existing key. The game keeps `#play`, `#pause`, `#pauseMenu`, and `window.ducklingsState()` with its screen and pause fields. Lab outcomes remain `nest`, `lost-all` and `left`. Insufficient arrivals use the new summary reason `short`. A level preview via `?level=` lets you play that level without unlocking the map.
- `bots.mjs` drives independent waypoints through the fixed-tick simulation. It compares the authored routes against straight steering and idle. Direct steering earns three stars on 7 of 24 levels. Idle rescues none. The suite also checks the folding-leaf crossing with and without a quack, the follower-only weed collision and a dash with its current removed.
- `check.mjs` uses touch PointerEvents in WebKit iPhone 13, Chromium Pixel 7, Chromium 390×664 and Chromium 360×640. It clears the first two levels and a dash, tests a lost dash, opens and replays the map, checks pause and blur, quack, sound, the old save, the shared hint, and lab messages against a local stub. All four profiles passed. The screenshot passes cover opening, active play and the result card. Two review passes improved the route map, restored the opening pond colors, clarified the current badge and showed a car on the first road before steering.
- The shared kit runner has a Ducklings entry and a hint entry. Their selectors and save seed still apply. Add a map assertion to the shared entry to cover the new chapter and level controls. The standalone check exercises both. The shared command passed both Ducklings entries in WebKit and Chromium after the sibling experiment registry caught up.

## Not verified

Real-phone touch and audio, real-phone performance and safe areas, first-time human comprehension, replay appeal, production deployment, and storing records at the live lab endpoint.

## Builder

- A clean-flock star gives players a reason to test a safer route after a clear. Clear cards show the arriving ducklings as a drawn family portrait alongside their names.
- Roll call and the quack echo give different birds distinct peeps and movements. A rescue lights the peep ring, lifts the line in a ripple and plays a rising cheer.
- Endless checkpoints have a visible pad and a dashed crossing line. The sun meter shows when its drain accelerates.
- A future playtest could measure whether a first-time player chooses to detour around the folding leaves or discovers the fast quack crossing.

## Kit candidates

A phone screenshot helper that waits for a rendered frame and writes at CSS-pixel resolution. A negative-frame-delta regression applies to games whose input handler resets the animation clock.


## Cold play audit — 2026-11-24

Two fresh sessions cleared stages 1–8 with native touch input chosen from screenshots. One used WebKit with the iPhone 13 profile. The other used Chromium at 360×640. The cold sessions used the normal map, without level previews, accelerated clocks, game functions or state inspection. Each action has a screenshot. Extra frames show what happened after a finger lifted or a timer expired.

Paths below are relative to the requested screenshot folder, `scratchpad/shots/audit-ducklings/`. The numbered images are player evidence. The `final/` directory contains screenshots from the final game checks, including diagnostic frames from timed-out attempts.

| Rank | What happened in cold play | Change and replay evidence |
| --- | --- | --- |
| 1 | The opening hand suggested touching the nest. A tap or short swipe barely moved the mother. Holding directly on a duckling could take her past it. The old driver added the exact hidden 70 px offset on every move. See `webkit/002.png`, `webkit/004.png`, `chromium/023-third-duck.png`, `chromium/025-aim-below-duck.png`. | A tap selects the pond location under the finger and draws a ripple there. Dragging selects another location. Stage 1 teaches this on the nest and stage 2 on a waiting duckling. One tap cleared stage 1. A second-stage rescue stopped at the duckling after the camera scrolled. An offscreen nest then had a visible direction. See `webkit/103.png`, `webkit/105.png`, `webkit/112.png`, `webkit/114.png`. |
| 2 | The duck counter looked like a completion fraction. Stage 4 showed 3/3 beside a stranded duckling, then awarded one star for three of four. Stage 6 started at 3/2. See `webkit/032.png`, `webkit/034.png`, `webkit/040.png`. | The HUD names the birds following, waiting or arriving and distinguishes the minimum from the whole flock. The postcard explains the unmet three-star conditions. The same three-of-four rescue now explains the fourth duckling. See `webkit/135.png`, `webkit/137.png`, `final/webkit-iphone13-goal-6.png`. |
| 3 | Stage 4 pointed into empty water while the first rescue was on the left. Stage 5 reused the hand without teaching the crossing. The mother got through while her followers scattered. Quack gave feedback when pressed, but its purpose was unclear beforehand. See `webkit/028.png`, `chromium/030-road-one.png`, `chromium/032-cross-and-advance.png`, `chromium/034-waiting-on-road.png`, `webkit/058.png`. | Stage 4 points at the duckling. Stage 5 guides the player to the curb, then teaches waiting for a car to pass and allowing time for the tail. Quack now says “Call closer”. See `webkit/130.png`, `chromium/113-fixed-first-road-teaching.png`, `chromium/114-fixed-curb-teaching.png`, `chromium/095-fixed-quack.png`. |
| 4 | The full-width HUD gradient washed out birds and nests near the upper edge. On replay, rescuing the stage 2 bird left the nest entirely above the screen. See `chromium/020-scout-ahead.png`, `chromium/044-second-crossing-six.png`, `webkit/109.png`. | Only the labels have a solid background. Once the flock meets its minimum, an offscreen nest gets a directional marker at its horizontal position. See `webkit/114.png`, `webkit/116.png`, `webkit/135.png`. |
| 5 | Endless opened on a sun icon and a number. Its downward arrow did not say how to refill the meter. The loss card reported metres despite showing no distance during play. The code used pond coordinates for that number. See `webkit/056.png`, `webkit/060.png`, `webkit/061.png`. | The HUD names the sun pads and changes to a low-light warning. The postcard counts pads crossed and birds still following. See `webkit/139.png`, `webkit/148.png`, `chromium/123-fixed-endless-result-card.png`. The first Chromium replay exposed a second issue: the warning wrapped over the meter at 360 px (`chromium/121-fixed-endless-rescue.png`). The HUD now reserves its content width. The shorter “Low light! Cross a pad” leaves the full meter visible in `chromium/140-meter-wait-two.png`. Both touch replays finished with zero pads. |
| 6 | Pause offered “Menu” without saying the swim would end. A locked chapter offered “Continue” without naming the chapter it would actually launch. A four-stage map left its fourth button alone on a second row. See `webkit/007.png`, `webkit/055.png`, `chromium/001-first.png`. | “Leave swim” returns to the map. The play button names the destination when viewing a locked chapter. Four-stage chapters use one row. See `webkit/121.png`, `webkit/122.png`, `webkit/102.png`, `webkit/110.png`. |
| 7 | The privacy link was hard to read and measured 43.3 × 14 CSS px in Chromium. The pause checkbox looked small, but its associated label already provided a 44 px target. The map said “1 ducklings home”, and the postcard’s Next button sat right of center. See `webkit/001.png`, `webkit/007.png`, `webkit/016.png`, `webkit/012.png`. | The notice has stronger contrast. Privacy has a separate 60 × 44 px target. The tally uses the singular at one. The Next button is centered. See `webkit/110.png`, `webkit/105.png`, `webkit/106.png`. The browser check includes links and the checkbox label as well as buttons. |
| 8 | The waiting duckling’s ring and bill moved independently of its peep. A nearby caller could be offscreen. The simulation could also sound a warning for a hazard outside the viewport. These timing findings came from the source after cold play. See the original waiting bird in `webkit/017.png` and the warning area in `chromium/044-second-crossing-six.png`. | The same event now sounds the peep and shows “Peep!” at the bird or screen edge. Offscreen hazards stay quiet. See `webkit/120.png` and `webkit/132.png`. The viewport predicate has upstream, downstream and visible regression cases. A screenshot cannot establish audible silence. |

### Coverage and remaining questions

- The eight WebKit result cards are `webkit/012.png`, `019.png`, `026.png`, `034.png`, `038.png`, `042.png`, `047.png` and `053.png`. Chromium’s road loss and retry are `chromium/034-waiting-on-road.png` and `chromium/035-retry-road-5.png`. Its eighth clear is `chromium/063-eight-complete.png`.
- The cold sessions visited all four chapter tabs, locked and unlocked nodes, campaign and Endless pause, sound, recording toggle, resume, retry, map, next stage, next chapter, and win and loss postcards. See `chromium/064-map-after-eight.png` through `chromium/087-pause-menu-exit.png`. Reloading during stage 9 returned to the map with the chapter unlocked. A mid-swim checkpoint would change the save contract. The existing behavior remains.
- The game has no daily mode or share action. The result postcard is drawn locally. The external privacy page and system share sheets were outside the game audit.
- The road stages repeat crossings. The island, far-bank rescue and second lane each changed the route. This playthrough established no reason to replace those levels. Stage 5 still shows a preview car before input. The car can disappear briefly as the first real traffic cycle starts. See `chromium/113-fixed-first-road-teaching.png` and `chromium/114-fixed-curb-teaching.png`. Traffic timing was retained for the authored routes. A scattered follower still needs the player to infer that its calling marker means it can be rescued again.
- Source inspection paired steering with the ripple, roll call with hops, rescue with sparks, scatter with feathers, hits with hearts, Quack with a speech bubble and cooldown, hazard warnings with hazard art, arrivals with the nest animation, checkpoints with refill text, and results with the postcard and stars. Water wash is ambience. Physical speaker output, volume, mute behavior by ear, and audiovisual timing on hardware remain unverified.

### Verification

| Check | Result |
| --- | --- |
| Simulation bots | All 24 campaign routes earned three stars. All twelve Endless seeds, comparison routes and determinism checks passed. |
| Game browser check | Passed WebKit iPhone 13, Chromium Pixel 7, Chromium 390×664 and Chromium 360×640. The WebKit and Pixel 7 runs timed out on the busy host and passed on individual reruns. Includes native single-tap rescue, camera motion, rendered guide and water pixels, 44 px targets, pause, old save, kit hint and lab outcomes against a local stub. |
| Shared phone check | Both the game and hint passed on WebKit and Chromium before and after the changes. A concurrent post-change run timed out clicking Play in WebKit. The isolated rerun passed both entries on both engines. |
| Cold-style replay | Both requested browsers used touch and screenshots again. All screenshots came from the local game. No physical handset, independent human player or live lab endpoint was tested. Campaign stages 10–24 have bot coverage. Their complete routes were outside the cold playthrough. |

The added regressions exercised the original failures before the fixes. Examples include a direct rescue tap that stopped 0.51 pond widths from the duckling, the 14 px privacy target, a missing road instruction, and a 3/2 flock display. The direct rescue ended within 0.004 pond widths of its target in both replay profiles. Positive sun-pad counts on a human-driven result card, enjoyment on repeat play, and production deployment remain unverified.

## Words and pictures — 2026-11-24

| Copy removed from the screen | What shows the rule now |
| --- | --- |
| “Lead the ducklings home.” “Tap the nest. Drag to steer.” | The menu shows the mother and her trail. The first swim puts the hand and tap ring on the actual nest, then shows a drag along the trail. The original kit hint still appears after its idle delay. |
| “Tap the calling duckling, then the nest.” “Peep!” “+1 duckling” “Back together!” | The hand and trail mark the waiting duckling. A sound-wave badge appears with its call and points toward the bird if it is offscreen. Sparks and hops mark the rescue, the following count increases, and the trail or offscreen marker points to the nest. |
| “Tap the ring to wait at the curb.” “After a car passes, tap the far bank. Allow time for the last duckling.” | The ring and hand mark the curb. Pause bars appear beside the moving car, then the hand and an arrow show the far bank while the remaining traffic gap fits the tail. A ring follows the last duckling until it clears the road. |
| “Call closer” and the “Quack!” bubble | Small ducklings bunch together on the button. The mother's bill emits waves when the actual line bunches, and the ring and countdown show when the button is ready again. |
| “Following,” “waiting,” “arriving,” “Bring … home,” and “Nest ↑” | The HUD shows duckling and nest counts, a flag and ≥ for the minimum, and a check once enough ducklings reach the nest. An offscreen nest gets a nest icon and an arrow once the flock is large enough. |
| “Cross sun pads for light,” the low-light warning, and the refill caption | The HUD shows a pad pointing to the sun beside the light bar. It highlights the next pad or points up to it when light is low. A positive number and sun show the refill. A scattered duckling with a down arrow shows a reduced refill. |
| “Oh no!” “Ouch!” “Hiding in the reeds…” and the name captions | Feathers and running ducklings show a scatter. A spent heart shows a hit. A duckling that hides runs off the bank and fades, and the postcard counts hidden ducklings beside reeds. Hops, peeps, and the drawn flock remain as the roll call and portrait. |
| “For three stars …,” home and pad tallies on results | The result shows the nest fraction or pads crossed. Three-star conditions have separate pictures for all ducklings home, hits, and scares. The card shows only the conditions missed. |

The title, map and level names, actions, result headings, and score labels remain in words so players can identify destinations and outcomes. The privacy notice, link, and recording toggle retain text because icons cannot convey recording scope, retention, or the off switch. The shared hint keeps a short reduced-motion label. Screen-reader equivalents come from the same English and Turkish table. The canvas uses locale-formatted arrival numbers. The postcard image contains no text, and the game has no share action.

Language choice uses the kit's shared preference. A URL language applies on entry. Using the globe removes `lang` from that address so reloading follows the newer choice. Game save fields and lab outcome names retain their existing formats.

All 24 campaign bot routes earned three stars. The standalone phone check passed WebKit iPhone 13 and Chromium Pixel 7, 390×664, and 360×640. Both-language screenshots and layout checks passed at 360×640 and the WebKit iPhone 13 profile, with a second WebKit pass at 390×844. Checks cover matching translation keys and placeholders, English leakage in Turkish, live language switching, persistence, viewport bounds, and the road cue's wait, cross, and tail phases. The shared game and hint checks passed on WebKit and Chromium.

A keyboard run crossed the first sun pad in both browser engines and showed a positive refill in Turkish. A Turkish-speaking player has not reviewed the copy or played the new cues. Physical touch, safe-area behavior, audible feedback, and storage at the live lab endpoint remain unverified. The phone checks use emulated touch and a local lab stub.

## Middle and late game audit — 2026-11-24

A returning player played stages 9–24 and Endless in Turkish with touch only. WebKit used the iPhone 13 profile. Chromium ran at 360×640. Screenshot paths are relative to the session's `shots/deep-ducklings/` folder, which is outside the repository.

### Findings, ranked by quit risk

1. **Stage 20's clock is untaught, and the ghost teaches the losing input.** The ghost finger taps a near point. Each tap stops the mother, so she runs out of time. The loss card says "Süre doldu" and gives no tip. WebKit lost twice (`webkit/263`–`268`, `274`–`276`) and Chromium once (`chromium/143`–`146`). Holding a finger ahead won with three stars (`chromium/147`).
2. **A cat's reach is invisible, and the opening heading leads into it.** Stage 10 has no guide. Its default ghost points straight ahead, and continuing that heading passes inside the cat's trigger. Chromium lost a heart and all three followers (`chromium/113`, card `122`). WebKit also took two stars. Stage 9 never shows how close is too close (`webkit/164`, `165`, `171`, `172`). A quack woke the cat (`webkit/174`). A simulation of "follow the opening ghost, then keep its heading" also harms the flock on stages 13, 15 and 23.
3. **The folding leaves on stage 16 are unclear.** The quack ghost appears (`chromium/132`), but quacking while parked still scattered all three (`chromium/134`). Nothing shows that she must keep moving (`webkit/231`, `237`, `238`).
4. **The pause menu has no retry.** A stage 6 run that could no longer be won forced "Yüzüşü bırak" and a trip through the map (`webkit/031`).
5. **Rewards are flat.** Chapter and campaign cards look like ordinary clears (`webkit/015`, `162`, `230`, `312`). The final card has no next step and does not point to Endless. The album of duckling names is saved but never shown (`webkit/313`).
6. **Current zones are untaught.** The chevrons point up-river, but the push reads as ambiguous (`webkit/249`–`251`, `chromium/145`).
7. **Endless problems:**
   - It introduces objects the campaign never showed: logs (`webkit/314`), the pike inside a nearly invisible ring that then hit (`webkit/319`, `320`), the turtle (`chromium/167`, `webkit/388`), the red bubble ring (`webkit/363`) and bridges with cyclists (`webkit/354`–`357`).
   - Two birds vanished near a bridge or bubbles with no visible cause (`webkit/364`, `chromium/162`–`163`).
   - Logs hide trailing ducklings (`chromium/152`, `webkit/368`, `372`).
   - The score has no label (`webkit/318`).
   - The reduced-refill chip is hard to read (`chromium/154`, `webkit/380`).
   - The HUD covers a pad (`chromium/153`).
   - Re-rescuing your own scattered birds scores again, so scattering can be farmed. Two starting birds re-joined for +30 (`webkit/375`–`376`).
8. **The offscreen nest marker shows while the nest is on screen.** It overlaps the nest (`webkit/143`, `150`, `160`, `202`, `chromium/120`, `126`) and covers waiting ducklings (`webkit/159`, `225`, `289`).
9. **Some late levels feel the same or are trivially easy:**
   - Stage 7 (`webkit/147`–`152`).
   - Stage 9 (`webkit/163`–`168`, `chromium/107`–`110`).
   - Stage 11 (`webkit/185`–`191`).
   - Stages 13 and 14 (`webkit/206`–`220`).
   - Stage 18 (`webkit/249`–`254`).
   - Stage 21 (`webkit/277`–`282`).
   - Stage 23 (`webkit/294`–`300`).
   - Stages 22 and 24 reuse earlier hazards without a twist.
10. **Stage 12 scattered followers along the guide's weed edge in WebKit** (`webkit/192`–`194`, `205`). Chromium followed the same guide for three stars (`chromium/124`–`128`). This may be path variance.
11. **Endless loses the way after a rescue.** In Chromium run 3, chasing scattered birds turned the mother back down the pond. The lily-pad cue only showed at the start and in the last 10 seconds, so she swam to the starting bank and scored 0 (`chromium/205`–`213`).
12. **Turkish text:** no English leaks or clipped strings were seen. The album names are English, but they are never displayed.

Every Endless run ended at sunset, never by hearts:

| Browser | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| WebKit | 350 | 840 | 170 |
| Chromium | 590 | 830 | 0 |

Shots: WebKit `334`, `369`, `389`; Chromium `168`, `200`, `213`. The game has no daily mode.

### What was fixed

Every fix that changes behaviour has an assertion that failed before the fix and passes after it. The check.mjs assertions were shown red by running the new check.mjs against the previous files. Purely visual changes are marked "Not asserted".

| Finding | Change | Assertion |
| --- | --- | --- |
| 1. Stage 20 clock | Stage 20 gets a hold lesson: a pressed ghost finger slides ahead of her whenever she is idle, with the line "Keep your finger down ahead of her to keep swimming". A loss to the clock adds the same tip, as a picture, to the end card. | check.mjs: a `?level=20` loss ends with `why === 'dusk'` and shows `#starTip .hold`. |
| 2. Cat reach and opening headings | Stages 10, 13, 15 and 23 get opening guides that keep clear of harm. A sleeping cat now shows a dashed ring at its reach that warms as she nears it. | bots.mjs `ghostHarm`: following each stage's opening ghost, then keeping its heading for 3.5 s, causes no hits or scatters (red on 10, 13, 15, 23). |
| 3. Stage 16 folding leaves | During the bridge warning, the ghost presses the quack button and, if she is parked, draws a route and a pressed finger toward the nest. | Not asserted; visual only. |
| 4. No retry in the pause menu | The pause menu has a Retry button next to Leave. `#pauseMenu` keeps its id. | check.mjs: pause-menu retry restarts the same stage, unpaused, with the clock reset. |
| 5. Flat rewards | The Next button names the next chapter when a chapter ends ("Sıradaki: Yol"). Finishing stage 24 shows "On to the endless pond", which starts Endless. | check.mjs: the stage 4 card reads "Next: Road"; the stage 24 card shows `#endlessNext`, and tapping it starts Endless. |
| 7. Re-rescue scoring | Only a newly found duckling scores on joining. A scattered one swimming back scores nothing. | bots.mjs: Endless planner runs with at least 3 rejoins earn 0 points from them (red: 380 points). |
| 7. Pike ring nearly invisible | The pike ring is pale cream with longer dashes. | Not asserted; visual only. |
| 7. Score has no label | The Endless score shows a star before the number. | Not asserted. |
| 8. Nest marker over the nest | The marker shows only once the nest is a tenth of a pond width above it. | bots.mjs `nestMarkerShows` cases (red under the old rule). |
| 9. Late stages felt the same (21 listed; 19 retuned with it) | Stage 19 adds a duckling behind the far-bank rock; straight play now earns one star. Stage 21 adds a duckling inside the current, so she must leave the current early to miss the weed. | bots.mjs campaign: both stay 3★-solvable by the planner; holding straight for the nest now earns 1★ on stage 19 and 0★ on stage 21. |
| 11. Endless loses the way | The lily-pad cue also returns whenever she is more than half a pond width behind her furthest point. | bots.mjs `padCueShows` cases (red under the old rule). |

One regression was introduced and caught during the work. `chapterName(chapterOf(25))` threw after stage 24, which froze the end card. The stage 24 check caught it. The Next label is now set only when there is a next stage.

New strings (`holdTip`, `nextChapterName`, `endlessNext`) have English and Turkish entries in words.js. The save key, save format, `#play`, `#pause`, `#pauseMenu`, the state hook's `.screen` and `.paused`, lab outcomes, the kit hint and kit/i18n.js usage are unchanged.

### Replayed by touch after the fixes

- WebKit: stage 21 and stage 19 after the retune, both 3★ (`webkit/391`–`402`); the nest stays clear of the marker (`395`); the stage 20 hold ghost, the loss tip and a 3★ win holding a finger (`403`–`408`); the stage 10 cat ring and guide, 3★ (`410`–`414`); pause retry (`415`, `416`); stage 24 at 3★ and the Endless button on the final card (`417`–`426`).
- Chromium: stage 21 after the retune, one loss at the weed, pause retry, then 3★ (`chromium/170`–`176`); Endless runs 2 and 3, where re-rescuing scored nothing (`189`, `190`, `206`, `208`); the lily-pad cue hidden while swimming on and shown after swimming back (`216`, `217`); the stage 16 lesson while parked on the leaves, with no page error (`225`); the opening guides on stages 13, 15, 23 and the stage 20 ghost (`232`–`237`); the Turkish clock-loss tip as a picture (`238`); stage 4 at 3★ with "Sıradaki: Yol" on the chapter card (`249`); the pale pike ring in Endless, partly under the HUD (`254`).

### Left, and why

- Endless still shows logs, the turtle, red bubbles and cyclists that the campaign never teaches. Teaching them needs new campaign stages or an Endless intro, which is a larger design change than this pass.
- Birds vanished near a bridge or bubbles with no visible cause (finding 7). The cause was not found; it is unresolved.
- Logs still hide trailing ducklings, and the HUD can cover a pad. Both need layering or layout work across every screen size.
- The reduced-refill chip is still hard to read.
- The duckling album is saved but still not shown.
- Current zones have no new teaching beyond stage 18's existing guide.
- Stage 12's WebKit scatter may be path variance; the planner and Chromium both clear it at 3★, so it was not retuned.
- Stages 7, 9, 11, 13, 14, 18 and 23 still feel close to their neighbours, and 22 and 24 still reuse earlier hazards without a twist. Only 19 and 21 were retuned, to keep the change small enough to replay by touch.
- Stage 16's lesson shows the quack and a route off the leaves at once. In a simulation, quacking at the warning and swimming on brings 2 of 3 home (enough to pass); quacking about 0.7 s later brings all 3; parking scatters all 3. The lesson therefore teaches a passing move, not the 3★ timing. By touch, swimming on without a quack brought 1 of 3 home (`chromium/225`–`227`). Unresolved whether the lesson should show the later quack.
- The cat ring, pike ring, stage 16 ghost and Endless score star have no pixel assertion.

### Verification

- `node bots.mjs`: passed, including every stage solvable at 3★ by the planner.
- `node check.mjs`: passed on webkit-iphone13, chromium-pixel7, chromium-390x664, chromium-360x640 and webkit-390x844 (both languages and layouts).
- `node experiments/kit/check/phone.mjs ducklings`: passed on WebKit and Chromium, including the kit hint.
- `index.html` now loads `sim.js?v=4`, because the scoring rule in sim.js changed; earlier scoring changes bumped this number too.
- Not verified: real phones (touch was emulated); Turkish wording by a native speaker; Chromium stages 11, 13–15, 17–19 and 22–24 played to the end by touch (WebKit played all of 9–24, and Chromium skipped ahead by raising the saved progress); the new guides on stages 13, 15 and 23 were seen on screen (`chromium/232`–`234`) but those stages were not replayed to the end. The game has no daily mode.
