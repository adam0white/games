# Face Shift

Built 2026-11-24. Local experiment at `/lab/wild2-face-shift/`.

## What it tests

Can stretching a rubber face to copy a portrait make a precision task funny enough to show someone? The main bet is the visible expression change and the camera payoff. No person has tested that claim. This is ready for a play verdict, not a claim that it is fun.

The completed deliverable is one working, locally checked game in this folder. The owner accepts the play experience. No publication, telemetry, board, registry change or shared-file edit is included.

## Rules and controls

- Drag anywhere on the canvas. The initial touch is the origin. Horizontal travel stretches the head; vertical travel opens the eyes and mouth. 85 px means one coordinate unit. The kit captures the pointer; releasing resets the camera hold.
- Match the small portrait. The ring turns lime when both coordinate errors are inside the tolerance. Hold until the ring fills and the camera snaps. Each portrait takes at least 3 seconds; the ring displays that minimum as well as the uninterrupted hold.
- A photo takes 0.65 seconds. The round timer stops during it. A thumb pressed during the flash still works when the next portrait appears.
- Four rounds contain 3, 4, 5 and 6 portraits. A full perfect run is 65.7 seconds before extra aiming time. The upper bound on active play and photo transitions is about 128 seconds. Pauses do not count. A failed first round can end after 20 seconds.
- Each photo earns 100 points. Best possible score is 1800. Stars reward faster rounds: 3 before 70% of the time limit, 2 before 90%, otherwise 1. Best stars per round persist.
- Arrow keys adjust the face. Hold Space to keep the pose. P or Escape pauses. Buttons retain normal keyboard activation. Mouse uses the same drag as touch.
- The seeded default sequence is 17. `?seed=<integer>` selects another sequence. A round reuses the earlier poses and adds a pose, while narrowing tolerance. This deliberately lets the player practice a sequence; it is not a daily mode.

| Round | Portraits | Time limit | Coordinate tolerance | Continuous hold |
| --- | ---: | ---: | ---: | ---: |
| 1 | 3 | 20 s | 0.38 | 0.70 s |
| 2 | 4 | 26 s | 0.25 | 0.85 s |
| 3 | 5 | 32 s | 0.16 | 1.00 s |
| 4 | 6 | 38 s | 0.10 | 1.10 s |

## Implementation decisions

The control is the kit's floating stick applied to facial coordinates, rather than a new gesture implementation. The target stays above the face so a thumb does not cover it. The first portrait is wide with a small mouth, so the needed horizontal and vertical change is visible. Coral, lilac, green and gold distinguish rounds. The end card shows one actual captured portrait from each reached round.

All rule transitions, seeded targets, scoring and star thresholds are in `sim.js`. The page uses fixed 60 Hz steps. Rules have no clock or unseeded randomness. UI interpolation, flashes, confetti and synthesized sound do not decide matches. No dependencies, assets or build step.

Kit modules: save, sound, pause/onLeave, screens, stick, noZoom and the beginner stick hint. The notes script is loaded normally. A page-local override enlarges its tester-only link to 48 px. Lab pages do not use `lab.js`.

Save contract: `wild2-face-shift:save` is `{v:1,best,runs,stars:[0,0,0,0],sound:true}`. `wild2-face-shift:hint` is the independent kit hint key. No other storage keys are written by this game.

## Bot evidence

`node experiments/lab/wild2-face-shift/bots.mjs` passes on Node 26.12.0. 200 seeds per level per policy: 1,600 runs.

| Round | Careful wins | Clumsy wins | Clumsy success | Careful wall time |
| --- | ---: | ---: | ---: | ---: |
| 1 | 200 / 200 | 199 / 200 | 99.5% | 10.95 s |
| 2 | 200 / 200 | 167 / 200 | 83.5% | 14.60 s |
| 3 | 200 / 200 | 34 / 200 | 17% | 18.25 s |
| 4 | 200 / 200 | 0 / 200 | 0% | 21.90 s |

The careful policy waits 0.25 seconds and aims exactly. The clumsy policy waits 0.5 seconds, uses a normally distributed per-pose bias (sigma 0.10 per axis), and adds small continuous wobble. Its policy is identical across all levels. Both policies know the target: these measurements establish tolerance sensitivity, not human recognition, learnability or fun. Clumsy bias does not self-correct. Successful runs reach the 3-second minimum; that does not establish how quickly a person will play.

Independent behavioral assertions cover an opposite face, no input, release while matched, minimum exposure, inclusive and exclusive boundaries, interrupted holds, clamp limits, star thresholds, input immutability, photo clock suspension and deterministic replay through 2,400 input steps.

`node experiments/lab/wild2-face-shift/bots.mjs --mutate` exits 1 as required. The explicit mutation ignores coordinate error. The independent opposite-face example then incorrectly captures a photo and fails. Normal page code never enables this option.

## Browser evidence

`PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/lab/wild2-face-shift/check.mjs` serves `experiments/` itself and uses unaccelerated rules. WebKit iPhone 13 and Chromium Pixel 7 each complete all 4 rounds / 18 photos with browser-generated pointer drags. These are trusted mouse PointerEvents on the emulated phone profiles. Separate touch PointerEvents verify stick coordinates and cancellation. No rule state is set by the check; its exported snapshot is a copy.

The check covers menu, idle finger hint, wrong face, audio creation only after Play, pause time freeze, all portraits, 1800 points, persistent stars/best/runs, one-tap restart, blur pause, reload, 360×640 layout, minimum 48 px buttons, touch cancellation, timeout/failure recovery, desktop keyboard capture and Space activating Resume. Page, console and HTTP errors must all be zero.

Screenshots: `/private/tmp/night-wild2/`, with menu, hint, mid-play, end, small menu/play/loss and desktop keyboard captures. Menu, mid-play, end, 360×640 play and the small-screen failure card were visually inspected. No overlapping or clipped game controls were observed.

The notes script is stubbed in the browser test, following the reference checks. Its live authenticated flow is not verified. The page-local target-size override is statically checked against the current notes script.

## Review and remaining limits

Two independent reviewers examined the rules/evidence and UI. Fixed: Space interception on native buttons, ignored pointerdown during the photo phase, and the notes link's 34 px target. Card contents allow vertical scrolling on short screens. The rules reviewer confirmed the mutation catches the fault and identified the oracle-policy limitation above. A new transition regression initially sampled the exact photo-to-play tick before input was applied; it now waits for the observable coordinate change, with the original coordinate assertion retained. The targeted regression passes.

The shared kit phone suite was started before implementation. It exited 1 with a Chromium WebGL2 startup timeout and a post-resume hint timeout for the unrelated `lab/lantern-3d` page; no shared code was changed to address it. The post-change targeted kit self-test (`phone.mjs kit`) passes on both engines. This game's local check is the acceptance evidence for this folder.

Not verified: real hardware, audible quality or silent-switch behavior, actual notch insets, older-phone performance, a human completing the last round, or whether the result is surprising or funny. The canvas game is not screen-reader playable. `step` is used at fixed DT; arbitrary large timestep equivalence is not promised.

## Ideas left open

- A target that deliberately crosses its eyes, or an asymmetric mouth, would add expression dimensions but needs a control experiment before adding complexity.
- The last round may demand too much facial discrimination. The bot result cannot answer that. The owner's specific play verdict is whether matching the last portrait feels legible or arbitrary.
- If the photo payoff works, let a player choose a favorite contact sheet locally. Do not add upload or sharing automatically.
- A future look choice could compare this warm paper booth with a dark arcade booth. No alternate theme is built here.

Final verification: the complete `check.mjs` command exited 0 after the fixes. Both profiles captured 18 photos across four rounds, with zero page, console and HTTP errors. The desktop keyboard, shutter-transition input and Space-to-Resume regressions passed. All task-owned browser instances and local test servers closed. Final bot run exited 0; final mutation run exited 1 at the opposite-face assertion.

## Independent interaction review — 2026-11-24

Five input/state defects and two first-load rendering defects were fixed. A second finger previously replaced the first finger: a held face at `(0.5, -0.5)` jumped to `(-0.5882352941, 0.3529411765)` when the second finger moved. The existing kit stick now accepts a new pointer only while no pointer is held. The first finger remains at `(0.5, -0.5)` through the second finger's down, move and up, then still moves to `(0.55, -0.5)`. No shared kit file changed.

`?seed=0` previously selected seed 17. It now selects seed 0. Missing, blank and non-finite seeds retain the default 17. Pausing now clears an unfinished continuous hold immediately; previously the paused snapshot retained the accumulated hold. Resume still requires a new gesture. The round clock remains frozen throughout pause. No scoring, tolerance, timer or existing acceptance threshold changed. The new restart regression initially required its post-tap snapshot within 0.1 seconds; tool scheduling exceeded that bound. It now requires elapsed time to be lower than the interrupted run, alongside zero score, photos, index and held time. This tests reset state without assuming a command-return deadline. The new second-finger regression also now waits up to 1.5 seconds for the exact `(0.55, -0.5)` coordinate instead of sampling after 0.1 seconds: its first photo can legitimately freeze coordinate application for 0.65 seconds. The exact coordinate assertion remains unchanged.

Loss of the owning pointer capture now drops the kit stick; a different pointer losing capture does not. Trusted mouse capture id 1 was acquired and released through the browser on each profile, while a non-owner event for id 1001 preserved the drag. Restart now clears flash, shake and particles as well as rules and input. The live-photo reset regression observed WebKit effects `(0.9545, 4.74, 26)` and Chromium effects `(0.94155, 4.666, 26)` become exactly `(0, 0, 0)` after Pause then Restart. Those extra lifecycle screenshots were visually inspected.

Both served-copy fault checks exit 1: `review.mjs --chromium --lifecycle --mutate-capture` leaves the owning drag active, and `review.mjs --chromium --lifecycle --mutate-effects` leaves flash 0.9419, shake 4.668 and 26 particles after retry. The flags alter only the local test server response; normal game code has no lifecycle fault switch.

Added `review.mjs`: independent first-encounter controls, two fingers, an active hold interrupted by pause, resume, restart and reload, with ten staged screenshots per engine. The original check retains every assertion, runs phone profiles sequentially, and accepts `--chromium` or `--webkit` to isolate rendering failures. Screenshots now stay within this folder in ignored `.review-artifacts/`. Review captures bring the page forward and wait for two animation frames before capture.

Final verification: `fnm exec --using=26.12.0 node bots.mjs` exits 0 after 1,600 runs. Careful wins remain 200/200 in each round; clumsy wins remain 199, 167, 34 and 0 out of 200. `bots.mjs --mutate` exits 1 at the independent opposite-face assertion (1 photo instead of 0). The independent interaction suite passed on WebKit iPhone 13 and Chromium Pixel 7. The final complete `check.mjs` command exits 0 on both WebKit iPhone 13 and Chromium Pixel 7, followed by the desktop checks: 18 photos, four rounds, 1800 points, all four saved star ratings, one saved run, and zero page, console or HTTP errors. The 360×640 checks include loss, retry, 48 px targets and cancellation.

The Chromium menu, first play, matching, second finger, pause, resume, retry, reload, win and 360×640 loss/menu/play screenshots were visually inspected. The menu needs only “Make that face” and Play. The target remains above the interaction area. No overlapping or clipped controls were seen. The visual difference between nearby poses is subtle; completing the later precision rounds with target-aware drags does not establish human learnability.

Code audit: fixed-step accumulation is capped to 0.1 seconds per rendered frame; each accumulator loop is bounded by that cap. Rule input clamps non-finite coordinates to zero and rejects non-finite/negative timestep values. Photo transitions stop the round clock. Restart recreates the round, score and photos; pause drops pointers and keys. The four short victory tones are mode-gated and finish within 0.3 seconds; no growing timer collection was found. No further state, NaN or unbounded-loop defect was established.

The initial WebKit captures exposed two real rendering defects. After foregrounding and two animation frames, the hero canvas was still blank and the game occupied only the upper-left quarter. The main canvas had a 780×1328 backing surface, a 390×664 CSS rectangle and a reported 2× transform, yet its bottom-right pixel was transparent `[0,0,0,0]`. Restoring the transform at every draw changed that pixel to `[17,48,56,255]` and restored the full board. Drawing the hero on the first animation frame restored its portraits. New independent pixel assertions require alpha 255 at the hero center and main canvas edge. The repaired WebKit menu and first-play screenshots were visually inspected: portraits are present, the game fills its surface, and the hint is beside the face. The precise browser initialization cause remains unresolved; this was not only a screenshot-composition issue. Real hardware, actual notch insets, audible quality and the authenticated notes flow remain unverified.

Final browser closeout: the default `review.mjs` and default `check.mjs` commands both exited 0 after the capture-loss and effect-reset changes. No browser assertion or existing timeout was removed or relaxed. The final acceptance run produced 15 screenshots (seven per phone profile plus desktop); those and the four capture-loss/flash-retry screenshots were visually inspected. Earlier concurrent attempts timed out in tap stability or round progression while host load reached 203.59; the exact failure cause was not established. The final serialized run passed. All task-owned browsers and local servers closed.

## Play recording (2026-11-24)

Records under `wild2-face-shift` (`kit/lab.js`). One run for each go through the four rounds: it starts at Play or Play again or Restart, ends `won` on the last cleared round or `lost` on a lost round (event `round-cleared` with round and stars), and `quit` on Menu or Restart. Summary: rounds cleared, score, photos, best, stars. The seed in the start data is the page's test seed (17 by default). The notice is on the menu card; on a phone held sideways the card scrolls and the notice is below the fold. The page sends nothing typed, no names and no room codes. The recording notice and off switch are the kit's own (`kit/lab.js`); the switch is on the pause card. `check.mjs` answers the lab endpoint itself, loads the page with `?labRunSource=agent`, and asserts that a played run sends a run record under the slug with recording on and nothing with the switch off. Not verified: the live endpoint (it refuses these names until the human-framework change lands and deploys). Bots: unchanged outcome (1,600 seeded runs pass). `check.mjs`: exit 0 on both profiles (also the desktop keyboard run).

## The booth: parts, situations and a photo strip (2026-11-24)

The owner asked for more variety and gameplay. Play now opens the booth. The old four rounds are unchanged behind Classic on the menu.

**Before.** One situation: match a two-number pose (width, mouth) with one drag from anywhere and hold. Later rounds only tighten the tolerance. Five weak points: every round started from the same pose and reused poses; the face was not grabbed where touched; the ring was all-or-nothing, with no closeness meter; a forced 3 s minimum per portrait was dead waiting; every win scored a flat 1800, a timeout ended the run, and the bottom third of the screen was empty. Clumsy bot clear rates by round: 99.5, 83.5, 17, 0% (a cliff).

**After.** `booth.js` holds the rules (pure, seeded, 60 Hz). The face has seven parts: head width, mouth open, brows, smile, lids, nose and ears. The part you press is the part that stretches. Fifteen rungs, one new situation each: stretch, open, both, brows, smile/frown, lids, nose, ears, memory (the portrait turns face down), moving (the portrait drifts), mirror (every drag goes the other way), spoon (the portrait is upside down and squashed), twins (two faces at once), quick (short patience), make them laugh (wiggle until they laugh). Faces include expressions and animals (23 in all). The Daily face is five sitters, the same for everyone on a UTC day, with memory, moving, spoon and mirror mixed in.

Gameplay: a likeness meter with the photo line at 2/3; points from likeness and speed, times a streak bonus; a camera flash; a photo strip that fills across the bottom and a contact sheet of the best eight at the end; a sitter who loses patience fidgets, then leaves (the run goes on; that photo is missed). After 2.5 s without a match a ring and arrow point at the part that is furthest off. The head numbers point at the cheek: the first build pointed at the face centre and chin, which belong to the nose and mouth once those open, so pressing where the ring pointed moved the wrong part. A bot example now requires `partAt` of every cue spot to be the part that moves that number (it fails with the old centre spot). Funny: squash and stretch on springs, pupils follow the finger, a squeak pitched by stretch, a boing on release, a "hmph" when a sitter leaves. Reduced motion turns the wobble off.

Saves: `wild2-face-shift:save` keeps its key and format. The booth never changes its numbers; the sound switch still writes its `sound` field, as before. New keys: `wild2-face-shift:booth` `{v, best, runs, bestStreak, photos}` and `wild2-face-shift:daily` `{v, day, best}`. Words: `words.js` (English and Turkish through `kit/i18n.js`); the language button is on the menu and the pause card. The Turkish has not been read by a native speaker.

Recording: booth and daily runs start with `{mode, seed or day, rung}`, send `rung-cleared` events, and end `won` with summary `mode, rungs, score, photos, missed, bestStreak, best`, or `quit` on Menu or Restart. Classic records exactly as before, with `mode: 'classic'` added to its start data.

**Bots** (`bots.mjs`, 200 seeds each; careful photographs 100% on every rung). Clumsy photo rate per rung:

| stretch | open | both | brow | mouth | lids | nose | ears | memory | moving | mirror | spoon | twins | quick | laugh |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 100 | 100 | 100 | 100 | 99.8 | 99.8 | 98 | 98.3 | 90.3 | 94.8 | 91.5 | 81.8 | 90.8 | 86.9 | 100 |

No adjacent drop is above 15 points; the lowest is 81.8% (spoon). Difficulty rises through rung 14; laugh (rung 15) is an easy finale by design, so the curve is not monotonic at the end. Clumsy reaches the twelfth situation at a median of 119 s (worst seed 141 s), inside the five-minute target. Clumsy first photo: at most 1.7 s. Mean score: clumsy 3294, careful 4726. Daily: careful clears 60 of 60 days 5/5; clumsy 94.7%. Claims are asserted. `--mutate` (classic) still exits 1 at the opposite-face assertion. New `--mutate-part` turns every grab into a head grab and exits 1 at "brow up moves b only". The clumsy bot knows the target numbers plus noise; it does not model reading a squashed or upside-down portrait, so the spoon and memory rates are an upper bound for people.

**Classic parity.** `sim.js` has no diff against main. Classic bot outcomes are unchanged: careful 200/200 each round, clumsy 199, 167, 34 and 0 of 200; `--mutate` still exits 1 at the opposite-face assertion. `review.mjs` (exact-coordinate, two-finger, pause, restart and reload assertions) passes on both phones through the Classic button.

**Checks changed on purpose.** `check.mjs` and `review.mjs` start the old four-round flows with `#classic` instead of `#play`, because Play now opens the booth; their assertions are unchanged. `check.mjs` adds a booth run on both phone profiles with real pointer drags (`drive.mjs`, test-only, not loaded by the page): first photo under 10 s from one sideways drag, pause freezes the clock, the whole ladder (at least 28 of 31 photos), the classic save untouched, a run record with 15 `rung-cleared` events, brow-only, mirror and twins drags, the daily equals `createBooth({mode:'daily'})` for that day and its best is saved, Turkish shows "Oyna", and zero page, console or HTTP errors. The booth part runs at 390x844 on both engines. WebKit plays the whole ladder; Chromium plays the last three rungs and plays the daily through, so the default command stays under 10 minutes (565 s on a loaded host; 578 s before that split). The four-round classic flows are most of that time. `check.mjs --booth` runs only the booth part (about 2 minutes). The end card must fit the screen width: the first daily end card overflowed at 390 px because the streak sentence reused the no-wrap star style; with the fix removed, the check fails at that assertion. The lab-pages entry now also seeds `wild2-face-shift:booth` and today's `wild2-face-shift:daily` and requires both to load (and the menu line "Today: best 412"); its drag lands on the head in rung 1 and still moves `state.x`. Run it with `node kit/check/phone.mjs lab/wild2-face-shift` (running `lab-pages.mjs` alone only registers the entry and exits 0 without checking anything). It passes on both phones, with its hint check. CI runs `phone.mjs`, not this page's `check.mjs`.

**Known differences and gaps.** The classic face now draws with the new mouth curve, brows and pupils; its rules and numbers are unchanged. Arrow keys move the head only. The kit has no image-share helper (`room.js` `shareLink` shares links only), so the photo strip stays on the screen; nothing is uploaded. WebKit does not play the daily through or check its save; Chromium does. No daily run record is asserted on either engine. The kit's recording notice and the "Record this play" switch stay in English in Turkish, because `kit/lab.js` has no way to translate them. The first-photo check drags by the known target: it shows a match is reachable in under a second, not that a new player finds it without reading. Not verified on a real phone, nor how the sounds sound.

## 2026-11-25 — the way back to the small games home

Opened from `/small/` (`?from=small`), the page shows "‹ Small games" ("‹ Küçük oyunlar" in Turkish) on the menu and end cards, through `kit/home.js`; every booth or daily run and a won classic run is reported to the home as a win (the game records them as `won`). The home counts booth runs too. The recording notice and switch are now in the page's language. `check.mjs` asserts the two links in Turkish. The shared phone check pins this page's `Date` (`kit/check/clock.mjs`) for its daily line. Same keys, same records.

## 2026-11-26 — cold open: the page opens on the first sitter

**Why.** On 2026-11-26 the lab records showed Adam opening Face Shift twice on an Android phone with no run recorded. A run started only at Play on the menu, so an open that never reached Play left nothing behind. `kit/lab.js` already sends an unfinished run when the page is hidden (`visibilitychange`), so the menu tap was the only gap.

**What changed.**
- By default the page opens straight onto the booth's first sitter. A strip at the bottom shows the name, one line of how to play ("Grab the face and drag to copy the portrait.") and the lab recording notice. The strip goes away at the first photo.
- The sitter waits for you. In `booth.js`, `createBooth({ wait: true })` keeps the clock and patience at zero until the first input. After that it runs as before, even with the finger lifted. The bot claim in `bots.mjs` covers this.
- The run starts on the first touch on the face. The record is `rec.start({ mode: 'booth', seed, rung, cold: true })`, plus a new event, `first-photo` (`{ age }`).
- No sound before that touch. Nothing is sent before it.
- The menu (Daily face, Classic, language) is on the pause card as before.
- `?v=b` keeps the old menu-first opening, so the two can be compared.

**First minute, cold open with empty storage** (scripted drag; headless WebKit iPhone 13 and Chromium Pixel 7):

| | Before (main) | After |
| --- | --- | --- |
| Screen at open | menu | first sitter, in play |
| Taps before the run can start | 1 (Play) | 0 |
| When the run record starts | at the Play tap | at the first drag on the face |
| Open to a playable face | 50–105 ms (+ reading the menu) | 64–77 ms |
| First drag to first photo | 0.6–1.0 s | 0.5–0.8 s |
| Unfinished run sent when the page is hidden | yes, if Play was tapped | yes, after one drag |

**Checks.**
- `check.mjs` has a new cold-open block. It runs on iPhone 13 WebKit, Pixel 7 Chromium and 360×640.
- That block asserts:
  - the page opens in play with the notice inside the first screen, below the face;
  - the strip does not reach the pause button;
  - the clock stands at 0 for 0.9 s;
  - nothing is sent and no audio context exists before the touch;
  - the first photo comes within 0.5–0.8 s of the drag;
  - the strip goes away;
  - a page hidden mid-run sends the run with `cold: true` and `first-photo`;
  - the menu is reachable through the pause card.
- `check.mjs --cold` runs only that block.
- The older classic and booth flows in `check.mjs` and `review.mjs` load `?v=b` and are otherwise unchanged.
- The kit phone entry (`kit/check/lab-pages.mjs`, this game's block only) is now `startsOnBoard`, with the hint timed from the board. Both pass on both engines.

**Not verified.** A real phone. Whether a first-time player reads the strip or simply drags. Firefox on Android, which is what Adam uses; the checks run WebKit and Chromium only.
