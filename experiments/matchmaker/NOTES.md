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
