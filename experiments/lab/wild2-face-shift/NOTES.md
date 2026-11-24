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
