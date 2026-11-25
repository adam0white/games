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

## Open items from the middle and late audit — 2026-11-24

### What changed, and the check that covers each

- **Ducklings that seemed to vanish in Endless.** A search over 30 to 60 Endless seeds with four bots logged every removal from the line (441 on the old code). None lacked an event, none happened off screen, and none happened under the HUD or the Quack button. But 70 of 441 scattered birds (16%) waited within 0.03 pond widths of another waiting bird, so two birds read as one. That matches the audit shots: one bird with two "!" marks after a cyclist (`chromium/163`) and two birds scared by one turtle (`webkit/364`). A scattered bird now waits at the nearest safe spot at least `WAIT_APART` (0.07) from every other waiting bird (`fleeSpot` in sim.js). Check: `bots.mjs` `removals()` runs 24 Endless seeds with two bots and asserts 0 removals without an event and 0 stacked waits (the old code gives 52 stacked). The 12-seed Endless table did not move. The row generator was not touched. With the new bank band (below) a 40-seed search found 0 of 574 removals off screen or under the band; 13 of 574 scattered birds flee to a waiting spot below the bottom edge (7 of 574 with the old camera), but the scatter itself is always on screen.
- **Logs hiding trailing ducklings.** No change was needed. The frame already draws hazards first, then waiting birds and the line. A follower's centre inside a log counts as a hit, so a bird can never sit under a log. In `chromium/151`–`152` the log reached the last bird and scattered it, which looked like hiding. Nothing pins the draw order.
- **Endless first look.** The first time each of log, pike, turtle, cyclist, heron and gust is wholly in view, it gets a dashed ring and a small looping picture in the lower right: the warning, the thing itself, then a duckling jumping clear (for the gust, the mother pushed sideways). Play does not pause or slow. The picture is drawn under the birds, so it never covers the line. Seen kinds are saved as `met` under the same save key, and only once something is seen. Check: `check.mjs` waits for `intro === 'log'` (the first Endless row is always a log), asserts time keeps running and `met.log` is saved, and asserts a second run does not show the log again. The first assertion fails on the old code.
- **HUD over the pond in Endless.** The counts, score and sunlight now sit on one row. The pond is framed below a bank band as deep as the lowest of the HUD, hearts and pause (`playTop`), so nothing playable is drawn under them. The pad cue and the warning peeks use the same edge. Check: `check.mjs` asserts each of `#flockHud`, `#heartState` and `#pause` ends at or above `playTop`, that the mother is below it, and that canvas pixels just above that edge are bank colour, not water. On the old code the HUD ended at 79 px over open water at 360x640.
- **Refill chip.** The sunlight from a pad now shows on the canvas above the mother: a sun and a large "+N", plus a scared duckling and a minus when scares cut it. `#padReward` stays as screen-reader text. Seen by touch (`c360-play-endless-pad`). Check: `check.mjs` swims a second Endless run over a pad, asserts the state reports the gain on the pond, and asserts `#padReward` takes no visible space; on the old code the chip shows at 43 to 81 px wide. The chip's old visual CSS was removed so the screen-reader rule applies. The pixels of the pill itself are not asserted.
- **Stage 16 folding leaves.** Every folding patch shows a ring that empties during the rustle (`leafLeft` in feedback.js). On the lesson stage, a green stretch marks the quack window (`LEAF_QUACK`, 0.12–0.62 s; measured 3★ window 0.05–0.75 s). The route to the nest stays drawn, and the finger on Quack and a green glow show only inside the window. Check: `bots.mjs` steers straight at the nest and quacks on the first tick and on the last tick of the cue; both give 3★. It also asserts the countdown values.
- **Current zones.** The marks in the water now move at exactly the current's velocity, on wall time, so they move before the first touch. A slanted current tilts them, and a stronger one draws longer streaks (`driftMarks` in feedback.js, drawn by `art.current`). The old chevrons moved at a fixed 0.24 per second against a drift of 0.29. Check: `bots.mjs` asserts that each mark on stages 18–21, 23 and 24 moves by (dx, dy)·Δt and stays in the zone.
- **Album and end pictures.** The menu has an album button, and so do the chapter and final cards. The album shows all 16 names as pictures with counts; unmet names are grey shapes with a question mark. A chapter's last nest gets bunting and the chapter badge. The final nest gets a sunset and one duckling for each name met. The album and the final card choose each name's look by its index, not by the real traits of the birds brought home. The `#album` line and its label are unchanged. Check: `check.mjs` asserts `postcard` is `chapter` on stage 4 and `final` on stage 24, opens the album from the chapter card and from the menu, and checks its label and the way back. Each fails on the old code.
- **Same-feel stages.** Holding straight for the nest, or following the opening ghost and then the nest, earned 3★ on 9, 13, 14, 18 and 23. Each now has a waiting duckling off the default line. 14 and 23 also need one more bird home: 14 needs 4 of 5 and 23 needs 4 of 5. Stage 14's waiting bird sits at (.30, 1.55). Their authored routes in `ROUTES` were updated. Stages 7, 11, 22 and 24 already gave naive play 0★. Check: `bots.mjs` asserts that no stage in `SAME_FEEL` gives 2★ or more to holding straight, the ghost-then-nest bot, or a tapper bot. The old levels fail it. It also asserts that every authored route still gives 3★ and that the search planner clears 9, 14, 18 and 23 at 3★.
- `index.html` loads `sim.js?v=5`, `art.js?v=5` and `feedback.js?v=5`. New words in English and Turkish: `album`, `back`, `albumLabel`, `introLabel`.

### Played by touch (Playwright touchscreen taps, tr-TR)

- Chromium 360x640 and WebKit iPhone 13: stages 9, 13, 14, 18 and 23 after the retune, all at 3★. Stage 16 won at 3★ by swimming on and tapping Quack when the green cue showed. Stage 4 at 3★ with the chapter card and the album opened from it. Stage 24 at 3★ with the final card. Stage 14 was replayed at 3★ on both devices after its waiting spot moved to (.30, 1.55). Endless runs showed the refill pill on both devices; the log, pike and cyclist pictures in Chromium, and the log, pike, cyclist and heron pictures in WebKit. Screenshots are in the session scratch folder, under `shots/open-ducklings/`.

### Still open

- The planner in `bots.mjs` cannot clear the weed stages 12, 13 and 15, even on the old levels: it backs off to the start bank. For those stages, 3★ is shown by the authored routes and by touch, not by the planner.
- The turtle and gust pictures, and the refill pill with a scare, were rendered from a scratch copy with a forcing hook and inspected in screenshots, not met in a touch run. Reeds, which slow her, have no picture.
- The refill pill, the leaf ring and the drift marks have no pixel assertion; their logic is asserted, their drawing was read in screenshots.

### Not verified

- Real phones: all touch was emulated by Playwright.
- The Turkish wording has not been checked by a native speaker.
- Whether players read the green stretch on the leaf ring as "quack now" without the finger is unknown.
- `levels.js` and `words.js` are imported without a version query, as before. A phone holding an old cached copy could see the old stage 14 and 23 until the cache clears.
- During one full `check.mjs` run with other browsers running alongside, chromium-pixel7 timed out at "late gap does not advertise a crossing" (stage 5, unchanged). It passed when run alone.

## Second cold play — 2026-11-24

A first-time player who reads no English played in Turkish (tr-TR) with touch only: WebKit with the iPhone 13 profile and Chromium at 360×640. The run started from an empty save and covered stages 1–11, the menus, the language button, pause, a reload mid-level, Endless runs, the album and several losses. The game has no Daily mode and no share card. Screenshot names refer to the session's `shots/cold2-ducklings/` folder, which is outside the repository.

### Findings, ranked by harm to a first-time player

1. **Touching the nest ended the level.** Once the minimum was reached, any touch of the nest ended the level. This happened even when the mother only swam through the nest on her way to a waiting duckling. Each time it cost two stars, and the player could not tell why. Examples: stage 4 at 3/4 (`chromium-20-s4e`), stage 8 at 3/4 (`chromium-68-a`), and stage 9 at 2/3, where the route ran through the nest (`chromium-71-strip`, `chromium-72-a`).
2. **A level that could no longer be won kept going.** On stage 8 the ducklings hid in the reeds, which left 1 following and 1 waiting against a need of 3. The level ran on until the hearts were gone and then said "Can kalmadı" (`chromium-59-s8l`, `chromium-62-s8o`).
3. **Brushing past a waiting duckling does not pick it up.** In Endless, passing about 35 px from one did nothing (`chromium-105-strip`). Stopping on it worked (`chromium-106-strip`).
4. **The speaker bubble over a waiting duckling read as "press Quack".** Pressing Quack did nothing (`chromium-54-s8g`, `chromium-55-s8h`). This was already known.
5. **The Endless sun number did not read as a countdown** until the "Güneş battı" card appeared. The refill pill "☀ +1 − 🐥" was unclear (`chromium-111-strip`). This was partly known.
6. **The reeds icon on the loss card was not understood** (`chromium-62-s8o`). Reeds also slowed the mother hard in Endless, with no first look (`chromium-e-12-strip`, `chromium-e-13-strip`). This was already known.
7. **Overlaps.** A waiting duckling sat under the hearts and the HUD on stages 7 and 8 (`chromium-40-s7`, `chromium-66-a`). The nest sign, speaker sign and "!" sign stacked on top of each other (`chromium-66-strip`). Minor.
8. **The album chose each name's look by its index** (`chromium-81-album`). This was already known.

Confirmed fine:
- Steering by thumb is accurate. Holding at (60,330) ended with the mother there (`chromium-86-strip`), and WebKit taps landed where tapped. The earlier 70 px offset stays fixed.
- The language button works on the menu and in pause.
- Pause stops the clock.
- A reload mid-level returns to the map with progress kept (`chromium-47-reload`).
- No English was seen on a Turkish screen.
- The third star animates in about 1.5 s after the card opens, so an early screenshot shows two stars. This is not a bug.

Endless first looks:
- **Log.** The picture shows the log hitting a duckling (`chromium-84-strip`). It shows the threat but not the escape. The log still cost a duckling.
- **Pike.** The ring and picture appeared when the mother was already inside the ring (`chromium-112-strip`).
- **Turtle, cyclist, heron and gust** were not reached by touch in this pass. The runs ended at sunset before row 8.

### What was fixed

| Finding | Change | Assertion (each failed on the old code) |
| --- | --- | --- |
| 1. Nest ends the level on touch | **Builder.** The nest is a drop-off. Each duckling that swims into the nest stays home, and the mother may leave to fetch more. While she sits in the nest with her whole line home, the minimum met and birds still waiting, an orange ring fills around the nest for `SETTLE` (1.4 s). When it is full the level ends. Leaving the nest cancels it. With no birds left waiting the level ends at once, as before. The HUD shows a nest count once anyone is home. The arrow to the nest counts home plus following birds. | `bots.mjs` `nestDropOff()`: stage 4 leaves 3 at the nest, fetches the last one and gets 3★ 4/4; parking ends the level 1.4 s ± 0.05 s after the line is home |
| 1a. Banked birds (found while fixing 1) | Once the nest stopped ending the level on touch, a player could leave it with the minimum home and then run out of time or hearts, and that lost the whole level. Birds at the nest now count as banked: if the clock or the hearts run out with the minimum home, the level ends as `nest` and is scored on the birds that are home. | `bots.mjs` `nestDropOff()`: on stage 4, 3 birds are home and one is still waiting; she leaves, a 3 s clock runs out, and the level must end as `nest` with 1★. This failed (`dusk`) when the banking was switched off. |
| 2. Lost level keeps going | **Builder.** When home plus following plus waiting falls below the need, the level ends at once with the existing reason `short`. | `bots.mjs` `nestDropOff()`: stage 8 ends as `short` |
| 8. Album looks by index | Each arriving bird saves its trait under `looks[name]`. This is a new field with a default under the same save key. The album and the final card draw each name with that look. Names met before this change fall back to the old look by index. | `check.mjs` after the stage 4 win: every arrived bird's `albumLooks[i]` equals its trait. On the old album rule it failed with "curious" against "sleepy". |

`index.html` loads `sim.js?v=6`. The state hook gains `albumLooks` and `arrivedLooks`; `.screen` and `.paused` are unchanged. No new words were added, so `words.js` is unchanged.

Difficulty: stars, the straight-bot table, the naive table and the Endless tables are unchanged. The campaign clear-time column rose by 0.1 s on 17 of 24 stages and is unchanged on stages 5, 6, 8, 9, 13, 17 and 18. The column is rounded to 0.1 s. The cause: a duckling now arrives only within `NEST_R - 0.02` of the nest centre, the same radius that counts the mother as home. Before, it arrived within `NEST_R`. Clear time does not feed the score, which counts arrivals, joins, the line bonus and hearts. No threshold moved.

### Replayed by touch after the fixes

- **`short` early end.** In both browsers, stage 8 was played into two car hits: the first scattered the line, and the second sent two ducklings into the reeds. The level ended at once with "Yeterince yavru gelmedi" while a heart was still left. The card shows 0/4, the minimum with a cross, and the reeds count (`chromium-q-08-strip`, `webkit-q-11-strip`). Before the fix, the same play ran on until the hearts were gone (`chromium-62-s8o`).
- **Chromium.** Stage 4: the mother swam through the nest, the three birds stayed home, she fetched the fourth, came back, and got 3★ 4/4 (`chromium-p3-15`, `chromium-p3-16`, `chromium-p3-17`). Parking in the nest showed the settle ring filling and then ended the level at 3/4 (`chromium-p3-09-strip`). The album shows the saved looks (`chromium-p3-18`).
- **WebKit.** Same stage 4 drop-off: three home while she fetched the fourth (`webkit-p3-dropoff-strip`), then 3★ 4/4 (`webkit-p3-19`). Album (`webkit-p3-20`). No console errors in either browser.

### Left, and why

- **3. Brush pickup.** Raising `TOUCH` changes difficulty across every stage and Endless. It needs its own tuning pass.
- **6. Reeds.** Reeds still have no first look, and the reeds icon on the loss card is still unexplained. A first look needs a new picture in `introScene` and an Endless drive that reliably reaches the first reeds row, so that it can be asserted.
- **4, 5 and 7.** These are known or minor and were left for a layout pass.
- **Settle time.** Whether 1.4 s is long enough for a player who taps (not holds) to decide to leave the nest is unknown. My own attempts in WebKit ended while I was still looking at a screenshot, so they do not answer it.

### Not verified

- **The turtle, cyclist, heron and gust first looks were not met by touch in this pass.** Three Chromium Endless runs never got past the opening log and reed rows, which come before row 4. Two runs ended at sunset after one pad (`chromium-e-13-strip`). One was stopped at one heart after logs hit the mother twice (`chromium-f-11-strip`). The driver pauses the game between moves, but each move is still a fixed hold planned from a still screenshot. A still screenshot does not show which way a log is moving, so the logs kept arriving where the hold was aimed. This says more about the driver than about the game; the earlier pass met the cyclist and the heron by touch.
- No real phone was used.
- The Turkish was not checked by a native speaker.
- Whether a first-time player reads the orange settle ring as "staying here ends the level" is untested.
