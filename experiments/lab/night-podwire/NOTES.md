# Podwire

## 2026-11-24 — first playable version

Pull the copper winding down and let go. The string rebounds and strikes a seed pod from below. An off-centre pull sends the tallest reflected crest to the opposite side. The split husk stays on the branch as the seeds scatter.

**Bet.** The illustrated finger can teach the first pluck without words. The far-side strike can then make a player choose where to grip the wire. Test with three first-time phone players, sound off, without instruction. The first-minute bet fails if any player needs words or takes 60 seconds to open the first pod. The second bet fails if fewer than two of the three can deliberately repeat the far-side strike after seeing it once. Human results are pending.

### Rules and presentation

- Six botanical plates open directly into play. Poppy teaches the release, Honesty places the pod outside the playable winding, and Flax lets one crest open two pods. Milkweed, Love-in-a-mist and Columbine offer several grip positions. A missed pluck costs no progress.
- A string has 53 nodes, including two fixed ends. The grip forms the static triangular deflection of a taut string under a point load. Release integrates transverse acceleration from the two adjacent nodes at 240 Hz. Wave speed is 67 node spacings per second. A pod opens on geometric contact with the interpolated string. Maximum pull is 86 board units.
- A seed varies pod position by up to 3 units horizontally and 1.5 vertically. Each plate uses a stable seed on replay. Six species have distinct illustrations. Herbarium is the default paper print. Append `?look=blueprint` for the dark print. Both use the same simulation.
- An in-world finger demonstrates the pull at the actual copper winding. Its travel is 44 units on the first plate and 84 on later plates. Copying the cue opens at least one pod on each of the six campaign seeds. If no pods have opened, the cue returns 2.8 seconds after a miss. The shared tap hint points to the next-plate control after a completed first plate. Reduced motion gives a still gesture and suppresses flying seeds.
- The page uses kit save, audio, pause, zoom, screens and hint, plus the private notes button. `night-podwire:progress` stores `{v:1,next,sound,complete}`. It resumes the highest reached plate. A blocked write leaves the game playable and shows a session-only notice. The kit uses `night-podwire:next-hint`. No play telemetry, account, upload or external asset.
- Serve the experiments tree and open `/lab/night-podwire/`. The folder check serves this page, the real shared kit and the real tester notes script locally.

### Simulation results

Each plate ran against 32 seeds. The aiming bot targeted the mirror position of the next unopened pod, constrained by the available winding. Times measure simulated motion from release, without finger movement or decision time.

| Plate | Pods | Solves | Plucks | Seconds |
| --- | ---: | ---: | ---: | ---: |
| Poppy | 1 | 32/32 | 1 | 0.500–0.517 |
| Honesty | 1 | 32/32 | 1 | 0.642–0.654 |
| Flax | 2 | 32/32 | 1 | 0.596–0.613 |
| Milkweed | 2 | 32/32 | 2 | 1.929–1.946 |
| Love-in-a-mist | 3 | 32/32 | 2–3 | 1.938–3.158 |
| Columbine | 4 | 32/32 | 3 | 3.167–3.196 |

Accurate aim cleared 192/192 within eight plucks. A consistent 15-unit aim error, alternating direction by seed and constrained to the winding, cleared 133/192. A 10-unit pull missed on plate I. Sixty simulated idle seconds opened zero pods. The cancelled 60-unit pull restored the original shape and counted zero plucks. Equal seeds and actions reproduced the same final state.

The mutation erases momentum after every physics tick. At 186 ticks the reflected crest fails to reach the required height at the opposite end of the playable board. The normal bot suite exits 0. The same suite with `--mutate` exits 1 at that physical assertion.

Run locally from this folder:

```sh
fnm exec --using=26.12.0 node bots.mjs
fnm exec --using=26.12.0 node bots.mjs --mutate
fnm exec --using=26.12.0 node check.mjs
```

The browser check accepts `PLAYWRIGHT` pointing to the directory containing the installed package. Screenshots go to `/private/tmp/night-r3-wild/`.

### Wordless first play

A separate first-time synthetic tester opened the page on the Chromium Pixel 7 profile with all DOM text hidden. It had access to screenshots and pointer input only. It followed the hand and downward arrow, touched the middle of the string, pulled down 53 CSS pixels and released. The pod opened on the first attempt within 56 seconds of the first screenshot, including tool delays. It then tapped the newly visible button and reached the second specimen. The pull direction was clear to this tester. It hesitated over when to release. The tester's standalone server served only the experiments tree. The separate integration check also serves the real notes script.

### Phone check design

The check completes all six plates through the board and buttons. It uses native touch on Chromium and native mouse drags on the WebKit phone viewport. WebKit pointer cancellation uses a dispatched cancel event. Other checks cover holding without releasing, a shallow pluck, cancelling, pausing, leaving the page, restarting, continuing, replay, muted sound persistence, corrupt JSON and a blocked save. The harness rejects unapproved requests and browser errors.

An early screenshot on WebKit returned a black board. The check now samples the captured board and rejects blank captures. A repeat run under load also missed a moving wire between measuring its height and sending a pointer event. For successive campaign pulls, the check now waits for oscillation to decay before grabbing the next winding. The sixty-second first-plate limit and the physical contact and grip thresholds stayed fixed.

The focused shared kit self-test passed on WebKit and Chromium before implementation and after the final changes. An intermediate repeat failed the WebKit assertion about when an idle hint appears. The same assertion passed on rerun. The full shared catalogue suite was not run.

The final first-sleeve demonstration opens 1, 1, 2, 1, 1 and 1 pods on plates I–VI. A full 86-unit pull from that same point opens 1, 1, 2, 1, 2 and 2. The cue is deliberately short on the forgiving first plate. Later plates reward choosing another winding or using the final few units of travel.

Outstanding evidence is first-time human play, physical thumb input, audible sound quality and sustained frame rate on a real phone. The local checks do not verify deployment.

### Final browser measurements

| Profile | First opening, wall seconds | Plucks on plates I–VI | Browser errors | Unexpected requests |
| --- | ---: | --- | ---: | ---: |
| WebKit, iPhone 13 | 13.371 | 1, 1, 1, 2, 3, 3 | 0 | 0 |
| Chromium, Pixel 7 | 31.668 | 1, 1, 1, 2, 3, 3 | 0 | 0 |

The combined run exited 0. The opening clock started before navigation and included the opening and held-wire screenshot captures. Ten final phone screenshots were visually inspected, five per profile, covering the untouched first plate, held wire, first opening, second plate in blueprint and final collection.

## 2026-11-24 — phone review

- Landscape puts the controls beside the illustration. The check requires the board to use all but 24 CSS pixels of the short viewport's height. Rotation while holding the wire cancels the grip. Lifting the original finger leaves the attempt at 0 plucks and 0 open pods. A fresh landscape pull opens the remote pod on plate II.
- A tap on a ringing wire used to release a new pluck if the wire was already deflected down. At 10.7535 board units below rest, a tap moved the counter from 1 to 2 and replaced the previous wave. Release now requires at least 5 board units of downward finger travel and 5 units of deflection. The same tap leaves the counter at 1 and restores the previous wave exactly.
- A sound tap on a stale tab could overwrite a completed collection. The check opens a fresh plate I, writes a newer completed plate VI save and toggles sound from the stale page. The new write retains plate VI and completion and flips the stored sound preference in `night-podwire:progress`.

The browser check uses the illustrated 44-unit pull on plate I. It exercises pause, resume, restart, navigation away and back, a held grip during rotation, landscape play, and a reload after opening 1 of 2 pods on plate IV. The reload retains plate IV and starts the attempt with 0 pods open and 0 plucks. All six plates are played through the canvas and buttons. The first opening has a 60-second wall-clock limit. The checks save captures to `/private/tmp/night-r4-review/podwire/`.

The ordinary bots exited 0 with 192/192 clears over the original 32 seeds per plate. The 15-unit aim offset cleared 133/192. The momentum mutation exited 1 at the reflected-crest assertion.

| Profile | First win (wall s) | Plucks on plates I–VI | Board width, portrait / landscape (CSS px) | Browser errors / unexpected requests |
| --- | ---: | --- | ---: | ---: |
| WebKit, iPhone 13 | 24.442 | 1, 1, 1, 2, 3, 3 | 346.00 / 312.63 | 0 / 0 |
| Chromium, Pixel 7 | 46.351 | 1, 1, 1, 2, 3, 3 | 368.00 / 329.67 | 0 / 0 |

The combined run exited 0. The opening sample runs through the first result capture. The later sample starts at the plate IV reload and ends at the collection capture.

| Profile and sample | Work p95 / max (ms) | Work over 16.7 ms | Interval p95 / max (ms) | Interval over 16.7 ms |
| --- | ---: | ---: | ---: | ---: |
| WebKit, opening | 1.0 / 12.0 | 0 / 1,123 | 52.0 / 1,155.0 | 389 / 1,122 |
| WebKit, after reload | 1.0 / 14.0 | 0 / 3,821 | 34.0 / 178.0 | 859 / 3,820 |
| Chromium, opening | 0.2 / 17.5 | 1 / 1,764 | 16.7 / 19,999.2 | 503 / 1,763 |
| Chromium, after reload | 0.3 / 7.5 | 0 / 4,659 | 16.7 / 50.1 | 1,476 / 4,658 |

Work measures synchronous script and canvas calls. Intervals report callback delivery and include gaps during screen capture and scheduling on the shared host. The largest Chromium opening gap occurred in a run with host load above 170. Physical-device frame pacing remains unverified.

All 34 phone captures were inspected, 17 per profile. They show the untouched cue, held wire, first opening, pause card, landscape before and after a pluck, the partially completed plate IV, and each later plate before and after its pods opened. Physical touch, audible sound and first-time human play remain unverified.

## Play recording (2026-11-24)

The page sends play records to the lab under the name `night-podwire` through `kit/lab.js` (the name is in human-framework `LAB_PROTOTYPES` once its pull request lands; until then every send is refused). This page has no start card, so the recording notice sits in the footer under the plate from the first moment, and the off switch is on the pause sheet. A run is one plate, from the first pluck of the wire to all pods open (`won`), or a restart or the next plate (`quit`). Opening the page and not plucking records nothing. Event: `plate-complete`. The check allows `/kit/lab.js` and answers the lab address itself.

`check.mjs` answers the lab address itself (no check reaches the real one), loads the page with `?labRunSource=agent`, and asserts: the notice is on the page before play, a played run sends one run record under `night-podwire` with its events record, and after the switch is turned off a further run sends nothing and the player id is removed. Not verified: delivery to the real lab (the Worker does not accept this name yet), a real phone.

## 2026-11-24 — eighteen plates, today's plate, the string's own sound

The owner's note: "podwire good but improve/extend". Plates I–VI keep their shipped rules exactly. Twelve new plates each add one effect from real string physics. There is a plate of the day with a par, and the sound now comes from the string.

### Five weakest things before the change, and what became of each

Written down after playing main on both phone profiles and before any edit (captures in `/tmp/claude-improve-night-podwire/before/`).

1. **The wave was not the star.** The wire was a thin, low-contrast line, and the board used about 45% of the phone height. Now the wire is drawn with a paper halo and a heavier ink line, with a crest glint and a short wake of earlier shapes. The side gutter is 16 px. Unchanged: the board's share of the height. The plate heading still takes the top third.
2. **The drawn finger was ambiguous.** The hand had the winding's colour, the release was not shown, and the arrow did not say how far to pull. Now the finger runs a timeline: approach, tug, hold, then a let-go flick. A dashed drop line, an arrowhead and a target dot mark where to pull to. Fret taps are drawn on the brass peg. Two-pluck and rhythm plates show each pull at the spacing that works.
3. **Six plates on one idea.** Plates IV–VI repeated II–III with more pods, and play ran out after about two minutes. Now there are eighteen plates, and plates VII–XVIII each add one new effect (table below).
4. **The sound did not come from the string.** Pitch followed the grip index (132 + 1.8·i Hz), and pods popped on a fixed scale. Now the pitch follows f = √(T/μ)/2L: shorter spans (a clamped fret), tighter plates and heavier wire change it. The plucked harmonics are weighted by sin(nπp)/n², where p is the grip position. Pods pop on harmonics of the open string; a tuned pod pops on its own harmonic. Through `kit/audio.js`.
5. **No score and English only.** A plate ended with only "Next plate". Now a result line shows plucks against par. A mark is drawn taller when the best is at or under par. Today's plate has a shareable result line. English and Turkish come through `kit/i18n.js` (`words.js`).

### The twelve new plates and their ideas

The par is the look-ahead player's pluck count on the plate's stable seed (`level * 417`).

| Plate | Plant | Idea | Par |
| --- | --- | --- | ---: |
| VII | Bladder campion | Grip position and harmonics. A pluck at the exact middle has no even harmonics, so a pod tuned to the second harmonic stays shut; a pluck a quarter along opens it. | 1 |
| VIII | Sweet pea | Free end. A ring on a stem holds the wire's right end, so the end follows the finger and the crest comes back the same way up. | 1 |
| IX | Spanish broom | Two-crest pods. A pod cracks on one crest and opens only on a second crest within 1.2 s. Pluck twice in rhythm. | 2 |
| X | Squirting cucumber | Standing waves from repeated plucks. Pulls in time with the wire's period (1.6 s) build up; pulls out of time cancel. A ring under the winding swells as the wire swings to its lowest point: letting go then adds to the swing. | 3 |
| XI | Hop | Heavy section. A heavier stretch carries the wave more slowly, so the crest no longer lands at the mirror point. | 1 |
| XII | Rattlebox | Harmonics again. A pluck a third along has no third harmonic. | 1 |
| XIII | Job's tears | Heavy bead. A point mass sends part of the wave back early and passes the rest on. | 1 |
| XIV | Lupin | Two wires coupled by a bridge. A sprung bridge throws much of the wave back and drives the far span through it. | 1 |
| XV | Cotton | Damped section. Felt soaks up a crest that reaches it. | 1 |
| XVI | Quaking grass | Moving pod. The pod swings, so the crest must arrive as it passes. | 1 |
| XVII | Wallflower | Fret with a second finger. Tapping the brass peg clamps the wire: the short span rings an octave higher and the far side stays still. | 2 |
| XVIII | Peony | Everything at once: fret, tuned pod and swinging pod. | 1 |

Reflections invert on every fixed-end plate (I–VII, IX–XVIII): the finger pulls the wire down, and the crest that returns from the far end stands up. That has been the game's core since plate II. A bot claim names it now. The order of VII–XVIII was set by the clumsy player's clear rate (below), not by the list in the brief.

Physics notes for later sessions:
- Pods hang above the wire. A pod below the wire was tried and dropped. In the discrete sim, the far side's downward excursion never exceeds the finger's static triangle, so such a pod tests the static shape, not the wave.
- Live plates (IX, X): the wire keeps ringing under the finger, and a pull adds its triangle on release. The look-ahead player holds each pull for 0.25 s on these plates, so it cannot stack instant pulls (it did, before that change).

### Plates I–VI keep main's wave physics

`sim.js` keeps the shipped code path for plates I–VI (`plain`). Since the lead's review, plates IV–VI have lower pods (below); their physics is unchanged. The new effects run on a separate path (`rich`). `bots.mjs` carries a frozen copy of main's rules. It drives both copies with the same random fingers (grabs anywhere, pulls, cancels, releases) on plates I–VI with 12 seeds each: 288,707 ticks and 117 plucks. Wire, velocities, time, plucks, pods and wins are identical at every 60th tick. The frozen copy reads the current plate data, so the check covers the wave physics, not the plate layouts (288,701 ticks now). `--mutate=parity` changes one velocity by 0.1% and fails.

Saves: `night-podwire:progress` keeps its shipped format and meaning (`{v:1,next 1–6,complete,sound}`). A save from main loads; a finished one continues at plate VII. New state uses new keys:
- `night-podwire:book`: `{v:1,reached 1–18,done,best}`
- `night-podwire:daily`: `{v:1,days:{date:{plucks,par}}}`, keeping the last 40 days

Each write merges with what another tab wrote first. The small games' home reads both keys and counts out of 18 (`experiments/small/marks.js`; main moved the hub from `hub-a` while this branch was open). Its catalogue entry (`experiments/small/catalog.js`) now has `tr: true`.

### The owner's point in numbers: the clumsy player

The look-ahead player (`solve.js`) tries every grip, fret setting and release time. It simulates 2.6 s ahead and keeps the pluck that opens the most pods, or comes closest. The clumsy player plays the same plan with noise: aim ±E world units, a pull short by up to D, and release time off by up to ±T s. It is limited to 8 plucks.

Before. Main's rules with main's mirror bot, 32 seeds per plate (aim ±E, pull short by up to D):

| Noise | I | II | III | IV | V | VI |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ±8 / 10 | 32 | 32 | 32 | 32 | 32 | 23 |
| ±16 / 20 | 32 | 32 | 32 | 32 | 30 | 13 |
| ±24 / 30 | 32 | 32 | 32 | 27 | 13 | 4 |

After. 16 seeds per plate, clears at three noise levels (`node bots.mjs --report`), after the lead's review (below).

| Plate | I | II | III | IV | V | VI | VII | VIII | IX | X | XI | XII | XIII | XIV | XV | XVI | XVII | XVIII |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ±8, 10, 0.1 s | 16 | 16 | 16 | 16 | 16 | 16 | 16 | 16 | 16 | 16 | 16 | 16 | 16 | 15 | 11 | 16 | 14 | 12 |
| ±16, 20, 0.2 s | 16 | 16 | 16 | 16 | 14 | 15 | 15 | 15 | 16 | 16 | 14 | 13 | 11 | 11 | 10 | 10 | 8 | 5 |
| ±24, 30, 0.3 s | 16 | 16 | 14 | 13 | 12 | 12 | 11 | 12 | 14 | 8 | 12 | 10 | 11 | 10 | 9 | 7 | 6 | 4 |

The middle row now falls from 16 to 5 with no step larger than 3 of 16 and no plate under 5. `bots.mjs --report` asserts both. `--mutate=cliff` puts back the shipped IV–VI pods and fails.

First version of this branch, for the record (same player): IV–VI were 12, 4, 2 at the middle row, and the pump plate (then XVI) cleared 1 of 16 at the highest noise.

#### Lead's review, 2026-11-24

The lead ruled that the parity rule covers folds into a live game, not this page: plate data may change while old saves load. Three changes followed.

- **IV–VI cliff.** The pods on Milkweed, Love-in-a-mist and Columbine are lower: 56 → 47.6; 59/47/59 → 50.7/40.4/50.7; 62/48/48/62 → 53.3/41.3/41.3/53.3 (×0.85, ×0.86, ×0.86, picked from a sweep in `/tmp`). Layout and order are unchanged, so `night-podwire:progress` still maps plate for plate. Pars stay 2, 2, 2. The shipped mirror bot now clears 192/192 with a 15-unit aim error (133/192 before).
- **Pump plate.** The clumsy player's pull is short by up to 30 units at the highest noise, which wiped out a 30-unit pull. The maximum pull is now 36 and the pod sits at 72 (was 30 and 68). Par is 3 (was 4). That made the plate easier (16/16/8), so it moved from XVI to X, next to the other rhythm plate (IX). Plates X–XV moved up by one to XI–XVI. Fret and Peony stay at XVII and XVIII. These plates are new on this branch, so no save refers to them. The daily pick is by plate number, so dates that picked X–XVI now get a different plate; 1,500 days from 2026-11-24 all remain clearable (worst par 86 ms in Node).
- **The wire shows its own beat.** On the pump plate a ring under the winding swells as the wire under it swings down. `bots.mjs` checks the physics behind it: letting go each time the ring swells clears the plate at par (3 plucks), and letting go at the top of the swing never clears.
- **Titles.** A plant name stays on one line: `main.js` shrinks the type in 2 px steps to 26 px, then the CSS ellipsis takes over. `check.mjs` loads Squirting cucumber and Bladder campion in English, and Eşek hıyarı and Çıngıraklı bakla in Turkish. It asserts one line, no ellipsis and a board no shorter than on a short name. The board takes 52.3% of the viewport height on the WebKit profile (iPhone 13) and 47.8% on the Chromium profile (Pixel 7), whatever the name.

The two tables use different players. "Before" is main's mirror bot, which aims at the mirror point and has no timing. "After" is the look-ahead player with aim, pull and timing noise. Compare plates within a table, not one table's numbers against the other's.

The aiming player clears every plate on seeds 1–8 (`bots.mjs`, every run). With `--report` it clears every plate on seeds 1–16.

### Today's plate

A UTC date hash picks a plate from II–XVIII and a seed. Pods get 2.2× the usual position jitter. The pick is the same for everyone and needs no network. The page works out the par with the look-ahead player in slices of up to 4 ms inside the frame (worst case in Node: 310 ms of work over 1,500 days). Over 1,500 days from 2026-11-24, every daily plate can be cleared (`/tmp` script; `bots.mjs` checks 30 days on every run). The first result of the day is kept. The result line reads, for example, `Podwire 2026-12-04 · Sweet pea: 1 pluck, par 1 ◆ …/lab/night-podwire/?daily`. With a share sheet, `kit/room.js shareLink` sends the line and a `?daily` link. Without one, the page copies the line and the link together, because `shareLink` copies only the link. The daily score goes to no leaderboard. `?date=YYYY-MM-DD` opens another day's plate (for checks).

### The first ten seconds: does the drawn finger teach the pluck?

Two bots copy only what is drawn:
- `solve.js followCue` replays the drawn gestures (grip, depth, release spacing, fret taps). It opens at least one pod on all 18 campaign plates (all pods on 12 of them). A pull at the middle of the first winding, which is what a player who ignores the drawing might do, opens nothing on VII, IX, XI, XV, XVI and XVIII.
- `check.mjs` adds a bot that reads only the canvas. It finds the lowest blush-red pixels under the wire (the drawn target dot), grabs the wire above it and pulls to it. On a cleared save it opened the first pod 0.7 s after navigation on both WebKit and Chromium (target found at x 180, depth ≈ 45; the drawn cue is 44).

This shows the drawing carries enough information. It does not show that a person reads it. That still needs first-time human players.

### Checks run (2026-11-24, this branch, before merging main)

- `node bots.mjs` exits 0 in about 35 s. It covers the shipped claims (192/192 mirror-bot clears; 192/192 with a 15-unit offset since the IV–VI change, 133/192 before), parity, one physical claim per new idea, the aiming player on all 18 plates, the drawn finger, `PARS` equal to the solver, 30 daily plates and the clumsy table.
- `node bots.mjs --mutate` exits 1 at the reflected-crest claim (as before). `node bots.mjs --mutations` runs 13 mutations, and each fails at its own claim: momentum, cliff (the shipped IV–VI pods), harmonic, heavy, bead, bridge, felt, moving, double, fret, pump, free, parity.
- `node check.mjs` passes on WebKit (iPhone 13) and Chromium (Pixel 7). New coverage:
  - an old finished save continuing at plate VII
  - plate VII cleared at par
  - a peg tap clamping plate XVII, with the near side ringing and the far side still (< 1 unit)
  - Turkish on the pause card and back
  - today's plate (plate VIII on 2026-12-04, par 1 computed in the page), its saved result, share and the Today ✓ button; a second go is marked as practice and leaves the first result in place
  - a recorded daily run carrying `mode: 'daily'` and `par`
  - the pixel-copying bot
  - page work per frame at 390×844 while the daily par is computed and the wire rings: p95 4 ms / max 4 ms on WebKit (its timer has a 1 ms step), and p95 0.4–4 ms / max 4.5–5 ms on Chromium over two runs. The budget is 8 ms.
- `node experiments/kit/check/phone.mjs lab/night-podwire,lab/hub-a` passes on both profiles, with no change to the shared entry. The legacy progress seed still restores plate II, one done mark and sound.
- `npm test` passes (73 tests).
- After merging main: `npm test` (73), `bots.mjs`, `--mutate` (exits 1), `--mutations` (12 of 12 fail), `check.mjs` on both browsers (page work p95 4 ms WebKit, 0.3 ms Chromium) and `phone.mjs lab/night-podwire,small` all pass again. The share check stubs the share sheet and the clipboard and asserts the exact line and link.

Intentional check changes in `check.mjs`:
- After plate VI, Next opens plate VII; it used to return to plate I. A reload keeps plate VII.
- The corrupt-save check corrupts both `progress` and `book`.
- Tests that cleared `progress` now clear all three keys (`clearSaves`).
- Captures go to `$SHOTS` when it is set.
- Added after the lead's review: long plant names stay on one line and do not shrink the board (English and Turkish). In `bots.mjs` the quarter-of-the-time clumsy check now covers every plate, not only VII–XVIII, and the per-idea claims find their plate by idea instead of by number.

No assertion was loosened.

### Not verified

- Turkish wording has not been read by a native speaker. Some plant names are uncertain: Ay otu (Honesty), Çıngıraklı bakla (Rattlebox), Gözyaşı otu (Job's tears), Titrek ot (Quaking grass), Gıvışkan otu (Bladder campion).
- Not heard on a phone: pitch, timbre and pod pops. The checks confirm only that calls reach `kit/audio.js` without errors.
- Not verified on a real phone in daylight: thumb feel, the fret peg's 24-unit reach, or whether the wave reads well.
- No first-time human players have tried the new plates.
- Frame time on a real mid-range Android phone.
- Whether rhythm plates IX and X feel fair to a person, and whether the beat ring reads as "let go now". Their windows come from the bot.
- The difficulty curve comes from bots with uniform noise. People make different errors.
- No browser check plays a live-wire plate (IX, X) through real pointer input; their page code (holding while the wire rings) is covered only by `bots.mjs` in Node.
- The daily par is checked against Node for 2 dates in the browsers, not across many dates; WebKit could round `Math.sin`/`Math.exp` differently.
- On Peony (XVIII) the fret peg sits under the winding, so a low touch may toggle the fret instead of gripping the wire.
- In Turkish, the kit's recording checkbox on the pause card is still in English (kit text, not this page's).
