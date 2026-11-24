# Good Match

Built 2026-11-23. A plain-module experiment at `/matchmaker/`. All implementation is in this directory. No packages, build step, external art, fonts, purchases, commits or deployment.

## Rules and controls

Each street has one specialist for each household need. The six pictured needs are a baby, a plant, a cooking pot, a weight, a dog and a heart (patience). Every helper has exactly one of the street's specialties. Every home needs one specialty. There is exactly one perfect permutation.

- Drag a helper card to a door. A tap never places anyone. Dragging an assigned helper to an occupied door swaps them. Dropping outside the doors returns the helper to the bench.
- Tap an unobserved helper for a two-second try-out. This reveals one positive eye badge and spends one clock segment. An already eye-observed helper costs nothing. No wall-clock deadline: slow reactions are safe.
- Eye evidence is exact. Heard evidence is exact for a helper with an earned reputation star. Other hearsay can be wrong. Eye evidence crosses out conflicting weaker badges. Starred hearsay crosses out conflicting speech.
- Honest speech is exact. Boastful helpers can claim skills they lack, but do not falsely deny skills. Shy helpers can deny skills they possess, but do not falsely claim skills. Puffed chests and hands held to cheeks distinguish the two biased temperaments.
- One reliable helper anchors every street. With `u` unresolved specialists, `u−1` try-outs suffice: the final specialty follows by elimination. No hidden answer is needed to choose whom to inspect.
- Filling every door starts the household animations. Perfect placement earns three stars; at least half correct earns two; any correct earns one; none earns zero. Restart takes one tap.

Street 1 shows all three eye badges and an animated drag using only visible evidence. Streets 1–7 have three helpers, 8–13 have four, 14–20 have five. Misleading hearsay becomes more frequent at each level. There is no reading during play. The menu has one short line and the kit's required recording notice.

Keyboard: Left/Right chooses a helper; Enter tries them out. Hold Space, choose a door with Left/Right, release Space to place. P/Escape pauses. Mouse supports the same tap/drag distinction as touch.

One new street may bring back one correctly placed familiar helper. That helper has an earned star and reliable heard evidence instead of a starting eye badge. Other helpers are new identities. Replaying a completed street retains its earned reputations. A helper's specialty and drawing stay fixed for its identity.

The default look is Peach street. Evening street is a second selectable look in Pause. Both use drawn characters, icons, soft shadows, particles, drag feedback, try-out animation, household reveal, synthesized sound and win stars. The character art changes pose and stretches during the try-out/celebration.

## Daily and saves

Today's street uses the UTC date hashed by FNV-1a, street 20, and no campaign reputation. Everyone on the same UTC date receives the same puzzle. The run captures its date before play so crossing midnight does not award the wrong day's puzzle. A perfect daily completion extends the saved consecutive-day streak; repeating a date cannot increment it.

`matchmaker-save` stores `{v:1, stars:[20 numbers], best, sound, reputation:[IDs], daily:{UTC-date:stars}, streak, bestStreak, palette}`. `matchmaker:hint` is the kit's first-input flag. Storage goes through `save.js`. Existing formats must be retained. Best score is the highest total campaign stars (maximum 60).

## Verification

Commands, run from the repository root:

```
node experiments/matchmaker/bots.mjs
node experiments/matchmaker/bots.mjs --mutate
PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/matchmaker/check.mjs
```

The normal bot run exits 0. The mutation run is required to exit nonzero.

### Bots: final results

500 seeds at each of 20 levels:

| Street | Helpers | Careful perfect | Clumsy perfect | Says-only perfect |
| --- | --- | --- | --- | --- |
| 1 | 3 | 500/500 | 500/500 | 0/500 |
| 2 | 3 | 500/500 | 477/500 | 0/500 |
| 3 | 3 | 500/500 | 457/500 | 0/500 |
| 4 | 3 | 500/500 | 436/500 | 0/500 |
| 5 | 3 | 500/500 | 418/500 | 0/500 |
| 6 | 3 | 500/500 | 393/500 | 0/500 |
| 7 | 3 | 500/500 | 372/500 | 0/500 |
| 8 | 4 | 500/500 | 325/500 | 0/500 |
| 9 | 4 | 500/500 | 299/500 | 0/500 |
| 10 | 4 | 500/500 | 269/500 | 0/500 |
| 11 | 4 | 500/500 | 249/500 | 0/500 |
| 12 | 4 | 500/500 | 217/500 | 0/500 |
| 13 | 4 | 500/500 | 201/500 | 0/500 |
| 14 | 5 | 500/500 | 165/500 | 0/500 |
| 15 | 5 | 500/500 | 147/500 | 0/500 |
| 16 | 5 | 500/500 | 116/500 | 0/500 |
| 17 | 5 | 500/500 | 89/500 | 0/500 |
| 18 | 5 | 500/500 | 68/500 | 0/500 |
| 19 | 5 | 500/500 | 48/500 | 0/500 |
| 20 | 5 | 500/500 | 22/500 | 0/500 |

The clumsy policy trusts unstarred hearsay, occasionally spends a try-out on a random helper, and chooses a best-fitting visible assignment with seeded tie-breaking. It carries only reputation actually earned in its preceding streets. It cannot read level, hidden truth or generation seed. Success strictly declines at all 19 transitions, from 100% to 4.4%. Reaction speed does not affect these turn-based rules.

- Careful solver: **10,000/10,000 perfect**. Its observation policy receives no truth or try-out-answer fields; attempted access throws.
- Independent hidden-truth scoring enumerates every permutation: **10,000/10,000 unique perfect optima**.
- Initially ambiguous: **9,500/10,000**. Maximum try-outs used: **3**.
- Every hidden world consistent with starting reliable evidence on 60 selected streets: **640/640 solved**. This checks policy reachability beyond the truth the generator happened to select.
- Replaying fully reputed streets saves **300 try-outs across 100 level-20 streets**.
- Actual UI-seed, saved perfect campaign: **20/20 perfect**, **18 returning appearances**. All **13 streets from 8–20 retain uncertainty** and require two or three try-outs despite reputation.
- Deterministic full action replay, including events, checked at levels 1, 7, 14 and 20. Daily seed equality/different-date inequality checked.
- Invalid placements, outside indices, occupied-door swaps, duplicate/known/exhausted try-outs, partial stars, terminal action rejection and idempotent finish checked.

Mutation: `--mutate` removes one segment from every nontrivial street (`u−2` instead of `u−1`). The same assertions fail: **10,172 failed assertions**, careful **500/10,000**, compatible worlds **0/640**, sequential campaign **1/20**. Exit **1**, as required. No assertion is disabled or reversed in mutation mode.

### Browser checks

Final game check: **exit 0**, WebKit iPhone 13 and Chromium Pixel 7 both pass with **0 page errors, 0 console errors and 0 failed requests**. The 360×640 profile and 1280×800 keyboard profile also pass. Menu, mid-play, five-helper play, comic mishaps and end-card screenshots were saved for both phones. I opened and inspected the menu, play, small-screen, mishap and end images. Screenshots and transient logs live only in `/private/tmp/night-matchmaker/`.

The server roots at `experiments/`, with a local stub for the feedback button. Both phone profiles perform full successful drags through Playwright's browser pointer API; taps use the touch API. No state mutation completes a puzzle. Checks cover first street, five-helper street, all required try-outs, pause during a try-out, wrong assignments, one-tap restart, occupied-door swaps, blur/P pause, save reload, shared daily seed, daily win/streak, and agent-tagged lab records intercepted locally. A 360×640 viewport checks all five cards and pause-card fit. Desktop checks keyboard placement and visible canvas focus.

### Shared kit check

Ran `PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/kit/check/phone.mjs` before and after. The before run exited 1: Chromium Lantern 3D navigation/hint timeouts and several existing hint timing assertions failed. The after run also failed in the untouched WebKit Lantern 3D hint case, with shader compilation/link errors. After recording that failure and completing the game-specific checks, I stopped the remaining shared suite. Its full run is **not green**. No kit or other game files were changed. Matchmaker is not yet listed in that suite; its own check above is the direct evidence for this game.

## Review and operational lessons

Two independent reviewers checked rules/evidence and UI/input. Fixed their material findings:

1. Six permanent identities made the entire saved campaign trivial after reputation accumulated. New streets now use one familiar anchor among new identities. The sequential campaign regression would detect this original failure.
2. Injected PointerEvents bypassed browser hit-testing. Successful phone drags now use browser pointer input.
3. Keyboard actions worked without showing the selected helper. Play now focuses the canvas, and the check asserts focus.

The requested Brain decision-log path was absent on this host; no findings from it were used. No claim depends on it.

## Integration outside this directory

The builder was authorized to write only this directory. The coordinator still needs to add `matchmaker` to HF `LAB_PROTOTYPES` and add its save/hint seed and exercise to the shared kit phone check. Neither file was changed. Lab notice, toggle, start/event/end are wired; production ingestion is not verified and may reject the unregistered slug. Local lab checks intercept the endpoint rather than storing real records.

## Not verified

- A real phone, notch/home-indicator safe-area values, or audio audibility/silent-switch behavior on an actual iPhone. Emulated devices do not prove these.
- Human comprehension of the source hierarchy, the temperament poses, or the one-specialist constraint without words.
- Human run duration of 1–4 minutes. The tutorial is deliberately shorter; there is no time limit. Synthetic success rates are evidence about defects/difficulty, not fun or duration.
- Production feedback button, production lab ingestion, integration registry, CI or deployment. None was attempted.
- Longitudinal daily streak across actual calendar days; the daily-win storage path is checked locally.

## Ideas left open

- Human play should decide whether the ear symbol reads immediately and whether a very short first-mishap demonstration would teach temperament faster.
- An animated household occupant could strengthen the reveal. Current mishaps use cooking splashes, a dog leash, baby tears, scattered leaves, a bouncing weight and drifting patience hearts.
- Do not add more streets until a person has tested these 20. The current generator varies layouts and gossip, not the one-specialist constraint.

## 2026-11-24 — landscape, try-outs and street completion

Acceptance: streets 1, 8 and 14 must expose every door and every helper in landscape. A try-out must leave the doors visible. A zero-budget street must have neither the try-out clock nor the faded eye/question prompt. Correct helpers must enter homes before a short celebration and an explicit three-position star summary. Existing rules, save keys and save formats stay unchanged.

Changes:

- Landscape now puts all 3, 4 or 5 helpers in one row below the street. The evidence legend moves into the header. At 800×360, five-helper cards measure 145.6×154.4 px; at 844×390 they measure 154.4×178.1 px. Both leave 46 px between door bottoms and card tops. The old five-helper layout at 800×360 started cards at y=48 over doors at y=96–202; the new cards start at y=189.6 below doors ending at y=143.6.
- A try-out uses a 190×116 px panel over the selected helper's row. It no longer depends on the gap below the doors. Rotation recomputes its bounds without restarting the try-out. The rotation regression waits for the canvas resize handler, then checks actual geometry. It pauses through the public control so screenshot latency cannot legitimately spend a try-out between budget comparisons; its images capture the rendered canvas beneath the pause card. The initial zero-budget clock and faded eye/question prompt are hidden; evidence eyes remain visible.
- Each correct helper takes 0.65 game seconds to walk into the doorway and disappear. Incorrect helpers stay outside with their existing mishaps. The street celebrates once after the ordered arrivals, then holds for 1.35 seconds before the summary. Pause freezes both progress and rendering. Screenshot review caught a floating-point fade value of about −2.22e−16 at full arrival: browsers reject that opacity write and retain the previous value. The fade now clamps to zero, and the browser check records and rejects every nonfinite or out-of-range canvas opacity write without changing rendering. Reduced motion skips the new walking translation, stepping, confetti and star animation.
- The summary always contains three star positions, distinct earned/unearned stars, an explicit `N / 3 stars` count and `N of 3 stars` accessible text. Perfect and partial scores use `finish()` directly. The landscape summary uses two columns.
- Browser regressions now check card/door/legend separation, 48 px targets, try-out bounds, rotation during try-out, three landscape pointer wins per engine, frozen arrival frames under pause and the displayed 2-star/3-star summaries. The old incidental `card.y >= 270` assertion became viewport bounds plus separation from the actual doors and legend. This strengthens the layout requirement across orientations; the 48 px threshold and the explicit 5/10/12-second game-progress deadlines are unchanged. Browser API action/screenshot deadlines increase from 30 to 90 seconds because repeated screenshots and fully hit-tested clicks timed out on the saturated host (load average 331.62), including untouched pages. This does not relax geometry, scoring, error, rendered-frame or game-progress assertions. The zero-clock raster sample follows the actual clock position and excludes background decorations. Summary screenshots wait for all awarded stars to finish appearing.
- Screenshots use `/private/tmp/night-r2-matchmaker/` to avoid another checkout overwriting the evidence. Test logs use `/private/tmp/night-r2-matchmaker-*.log`. `check.mjs chromium` and `check.mjs webkit` select one engine for an isolated retry; an optional second argument selects `core`, `touch`, `layouts`, `small` or `keyboard`. No arguments still run every profile on both engines. Each independent profile now closes its test browser before the next profile starts, avoiding a second context in a reused browser. `MATCHMAKER_HEADED=1` uses a visible test browser with the same emulation and assertions.

Verification:

- `fnm exec --using=26.12.0 node experiments/matchmaker/bots.mjs`: exit 0; 0 failures; careful solver 10,000/10,000 perfect; unique true optimum 10,000/10,000; compatible worlds 640/640; sequential campaign 20/20 perfect with 18 returning appearances. Rules and scoring were not changed.
- `fnm exec --using=26.12.0 node experiments/matchmaker/bots.mjs --mutate`: exit 1; 10,172 failed assertions; careful solver 500/10,000; compatible worlds 0/640; sequential campaign 1/20. No check was disabled.
- Final Chromium Pixel 7 game run: `PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules fnm exec --using=26.12.0 node experiments/matchmaker/check.mjs chromium`, exit 0, **5/5 profiles passed**. Includes core play, second finger, landscape, 360×640 and 1280×800 keyboard play. Core play has **0 page errors, 0 console errors and 0 failed requests**; opacity writes remain in range.
- Final WebKit iPhone 13 game run: `MATCHMAKER_HEADED=1 PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules fnm exec --using=26.12.0 node experiments/matchmaker/check.mjs webkit`, exit 0, **3/3 profiles passed in one uninterrupted run**, with **0 page errors, 0 console errors, 0 failed requests and 0 invalid opacity writes** in core play. The visible test browser uses the same device emulation and assertions. Before this successful fresh-browser run, the core profile passed but the next profile timed out in a reused browser; isolated touch and layout retries also passed.
- Together the final Chromium and WebKit runs pass **8/8 profiles**, including **12 landscape layouts and 6 landscape pointer wins**, **46 px door/card separation**, **4 paused try-out rotation round trips**, frozen arrival frames and visible 2-star/3-star summaries. Chromium's complete log is `/private/tmp/night-r2-matchmaker-chromium-final2.log`; WebKit's is `/private/tmp/night-r2-matchmaker-webkit-complete.log`. This does not claim an uninterrupted headless WebKit pass on this host.
- I opened the current menu, zero-budget street, portrait/landscape try-out, five-helper play, entry, celebration, partial-score and perfect-score screenshots. Current WebKit and Chromium arrival images show helpers gone after entry; the landscape summary shows all three earned stars and `3 / 3 stars` without scrolling.
- Earlier attempts hit headless WebKit screenshot timeouts at 30 and 90 seconds. A separate Chromium attempt reported an AudioContext device/renderer console error; the next Chromium run passed the unchanged zero-error assertion. Those failures were retained as failures, rather than filtered from the checks.
- The before shared phone-suite run passed kit, ant-promotion, grapevine and ducklings on WebKit, then hit timeouts in untouched games, including Lantern, Fixit, Borrowed and two ant lab pages. It was stopped with its test-owned children. The after `phone.mjs kit` run passed Chromium; WebKit exceeded the unchanged 150-second whole-check timeout. The host load average measured 331.62 during these runs. The full shared suite is not green; no shared files were edited.

Independent source reviews checked geometry/input and completion/scoring. Review found a clipped landscape evidence legend; moving it into the header fixed it. Review also found the pre-existing wall-clock animation during pause; drawing now uses the paused game clock.

Still unverified: real hardware, audio audibility, production lab ingestion, deployment and human judgment of the completion sequence. Reduced-motion suppression was reviewed in source but has no dedicated browser run. No commits or publishing actions were made.
