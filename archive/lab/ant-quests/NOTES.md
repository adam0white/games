# Ant Promotion: Meadow Folk

A standalone lab experiment at `/lab/ant-quests/`. No build, dependency, recording, account or external asset. All new files are inside this directory. The page imports the shared kit and Ant Promotion's read-only creature drawing module.

## Rules and decisions

- Drag anywhere to move a floating stick. Arrows/WASD and a held mouse also work. Follow the drawn path. Tasks begin by walking within 30 meadow units of a resident. All collection, delivery and conversation is automatic.
- Befriend Beetle, Snail, Spider and Frog before the 180-second nightfall. Each has three tasks and three hearts. A careful run takes about two minutes; an unfinished run lasts three. Pause, the secret book and losing focus freeze simulation time.
- Beetle: fetch seeds, hunt aphids, race. Snail: fetch dew, escort, hide. Spider: hunt, race, fetch crumbs. Frog: race, hide, escort. Fetch/hunt tasks require returning to the giver. A lost ant follows nearby. A race ends on the marked pebble. Hide means carrying the offered pebble into the marked leaf cover and waiting there while the bird passes. The pebble wording matches the endpoint's allowed target vocabulary.
- First-heart tasks have generous deadlines. Later tasks require more objects or less time. A missed task can be offered again after a short cooldown. It has a new quest ID. Hunter contact briefly slows the ant and removes one second from its task timer; it never kills the ant.
- Every beetle heart moves and shrinks the boulder and improves the rocky path's speed. Every snail heart increases the trail's speed bonus. Every spider heart widens the functional bridge. Every frog heart removes another hunter. Hunters pursue nearby ants in the central meadow.
- Run hearts reset each run. The best hearts earned with each resident persist as friendship marks in the book. Completed visits and failed promises persist. Returning residents greet the player differently; a failed resident is cross until a task succeeds. This keeps the twelve-task run repeatable while retaining relationship history.
- The book saves a secret per resident/heart. Offline lines are authored tables; a resident's fallback secret repeats across its hearts. Model-generated secrets may differ. The device also saves its best total hearts and sound preference.
- No purchases or paid assets. No `lab.js` and no play recording. The only game request is the named quest endpoint. The tester notes button is loaded as required.

## Dialogue contract

The page starts a request when the ant approaches within 100 units, before the 30-unit conversation radius. The offer uses built-in dialogue immediately while the request is pending. A valid response can update the same active offer, including its later thanks, scold or secret. A response received after the offer closes can enter the cache for a future visit. Each quest ID is requested at most once, with at most eight requests per run. Each request aborts after 12 seconds. The game keeps moving throughout the request. Malformed, failed and aborted responses leave the built-in lines available.

Only the documented giver, kind, target, count, mood and variant are sent. All five response fields must be nonempty strings. Each is clamped to 70 UTF-16 code units. Text enters speech bubbles and the book with `textContent`. Long names ellipsize; the map resizes to remain above a tall speech bubble. Successful response text is not treated as a new rule or a command.

Keys use the `ant-quests` prefix. `ant-quests-save` (v1: best, runs, sound, memory, secrets) stores player progress. `ant-quests:dialogue` caches successful responses by UTC date, giver, task kind, target and count. Matching tasks can reuse lines after a reload. `ant-quests:hint` tracks first stick use. The shared stick hint appears only during uncovered play for an unplayed device. Sound uses the shared synthesized audio helper, including its touch unlock and pause handling. Cards, storage, leaving the page and zoom prevention use their kit modules.

## Bot acceptance

Run `node experiments/lab/ant-quests/bots.mjs`.

| Check | Result |
| --- | --- |
| Careful bot, seeds 1–40 | 40/40 full wins, 12/12 hearts, no first-offer failures |
| Careful run length | 120.17–123.98 simulation seconds |
| Task coverage | fetch, hunt, escort, race, hide all completed |
| Clumsy opening | 40/40 completed |
| Clumsy full run | 0/40 full wins |
| Clumsy first-heart task trials | 151/160 = 94.4% |
| Clumsy second-heart task trials | 120/160 = 75.0% |
| Clumsy third-heart task trials | 100/160 = 62.5% |
| Determinism | 40 complete input replays equal, including RNG and events |
| Deadline | 180 seconds asserted directly; idle run ends with zero hearts |
| Recovery | timeout marks a failed promise; retry changes ID; success clears failure |
| Rewards | each beetle/snail/spider heart changes measured movement; frog progress reduces hunter count |

The clumsy controller uses 46% stick strength, 0.55–1.2-second reactions, target error and a 12% chance of hesitation. Heart difficulty trials start from the same real offered states generated by careful runs; this avoids confusing later-heart success with failure to reach those tasks.

Run `node experiments/lab/ant-quests/bots.mjs --mutate`. The mutation doubles the real completion requirement, leaving fewer fetch objects than required. It exits **1** at the careful-win assertion (`night` instead of `won`). A normal run exits **0**. Bot output and the mutation failure are saved in `/private/tmp/night-ant-quests/`.

## Original browser verification

Run:

```sh
PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/lab/ant-quests/check.mjs
```

The test serves `experiments/` itself, stubs only the notes-button script, and intercepts the quest endpoint. Movement uses touch PointerEvents through the real kit stick on animation frames; it never teleports or edits rule state. Each profile plays two full twelve-quest runs: a real four-second request cancellation and immediate model responses containing markup and overlong secrets. WebKit uses iPhone 13; Chromium uses Pixel 7. Each full run must win, cover all five kinds, respect the eight-request cap and have zero page and console errors. Screenshots include menu, play, end and book for each scenario.


Final dedicated check: **exit 0**. All four full runs won 12/12 hearts with all five task kinds, eight calls per run, zero page errors and zero console errors.

| Browser profile | Endpoint case | Run seconds | Calls | Page / console errors |
| --- | --- | --- | --- | --- |
| webkit | timeout | 122.55 | 8 | 0 / 0 |
| webkit | odd | 122.82 | 8 | 0 / 0 |
| chromium | timeout | 122.68 | 8 | 0 / 0 |
| chromium | odd | 122.60 | 8 | 0 / 0 |

Both profiles also passed all seven short dialogue cases (fourteen total), plus the small-layout and mouse/keyboard checks. All test-owned browsers and the local server were closed.

Additional checks exercise 404, 429 and 503 Response doubles, malformed JSON shape, a successful response arriving after the bubble is shown, 70-character unbroken names/asks, a saved cross greeting, returning greetings, secret clamping, save reload, pause/resume, blur/P, audio gesture unlock, touch targets at least 48 pixels, a 360×640 layout, mouse and keyboard movement. The HTTP-status cases use Response doubles to avoid browser-generated HTTP resource diagnostics; the timeout cases use actual fetch cancellation. `--contracts` runs the shorter cases without the full runs.

Screenshots and machine-readable reports are under `/private/tmp/night-ant-quests/`. Menu, play, end, book and 360×640 screenshots were opened and inspected. The final run's exact times and request counts are in `phone-results.json`; `check.log` contains the complete result.

The shared `experiments/kit/check/phone.mjs` was also run before and after. Its first run failed on Chromium `lab/lantern-3d` (150-second whole-check timeout), `hint lantern` (hint appeared before expected delay), and `hint lab/lantern-3d` (Play selector timeout). The final after-run exited **1** on Chromium `hint lab/lantern-3d`: “hint: not before the delay” (`true !== false`). All other cases in that after-run passed. These are outside this directory and were not edited. The after-run log is `/private/tmp/night-ant-quests/kit-after.log`. The new page cannot be registered in the central kit check under this assignment's directory-only rule; its dedicated check covers the required kit wiring.

## Review

Two read-only delegated reviews covered rules/bot evidence and UI/network/persistence. They found no material simulation defect. Fixes exposed lasting friendship marks, made memory fields consistent, aligned hide wording with its pebble request, pinned the deadline acceptance to 180 seconds, and expanded reward checks to each heart and frog hunter removal.

## Not verified

- A real phone, physical notch/home-bar insets or audible sound on iOS hardware. These are device emulations; audio context unlock was checked, hearing it was not.
- The deployed model endpoint. All endpoint behavior here is mocked or cancelled. Whether generated prose gives useful directions remains unverified.
- Production routing, deployment, or the deployed notes button. No root/worker/registry changes were authorized, and no deployment or commit was made.
- Whether people understand all tasks without reading, find them fun, or want a second run. Bots establish completion and difficulty under their defined handicaps; they do not establish human difficulty or preference.

## Open ideas

- Distinct fallback secrets for each heart, rather than one secret per resident.
- Different daily task orders after the resident personalities have been tried by a person.
- More legible hunter pursuit cues and a tongue animation for Frog's reward.
- Owner taste and a real phone play verdict remain deliberately unclaimed.

## Review fixes (2026-11-24)

- The bubble shows the meadow name beside a model nickname ("Beetle · Buzzy-Bug").
- The secrets book lists each friend's secrets under that friend, without duplicate lines; before, they sat below the scroll fold.

## Quest dialogue and phone playthroughs (2026-11-24)

- Raised the request deadline from 4,000 to 12,000 ms. The Worker can spend 6,000 ms on the first attempt and 3,000 ms on the retry. The client allowance includes another 3,000 ms for network and Worker overhead. The browser check releases the slow success at 9,000 ms and holds the timeout response until 13,000 ms to observe cancellation at the new deadline. Task deadlines stayed the same.
- Cached valid lines by giver and UTC day, with a separate entry for each distinct task. An in-flight response can update its own offer across midnight. Its cache entry expires with the day of the request. Restart, return to menu and the end of a run cancel pending requests.
- Exposed the ring above the leaf, added approach and hold prompts for both hide tasks, and added find and return prompts for both escorts. The existing Frog and Snail holds are 4.2 and 4.9 simulation seconds. The escort guide now switches home at 45 units and switches back at 70 units, the existing following limit. Using 45 units in both directions made the arrow and prompt repeatedly reverse when the player briefly opened the gap. Each race now shows one pebble marker and describes reaching it before time runs out. Removed the two apparent dry stream crossings so the drawing matches the movement slowdown. Clearing the toast on restart removes messages from the previous run.
- Seed Sling's check resolves the checkout's Playwright or the shared installation when `PLAYWRIGHT` is unset. Running from `experiments/sling/` passed on both phone profiles. Both completed the opening garden with one seed and each of three daily cases with nine seeds at par nine.
- The ant bots won 40/40 careful runs in 120.17–123.98 simulation seconds with zero failed first offers. Clumsy task trials passed 151/160 (94.4%), 120/160 (75.0%) and 103/160 (64.4%) at hearts one through three. The mutation exited 1 at the careful-win assertion. Sling's bots passed all 513 checks, and its mutation exited 1 at the water-loss probe. A temporary copy with only the ant client deadline reset to 4,000 ms also exited 1 because the 9,000 ms reply never reached the offer.

Run `fnm exec --using=26.12.0 node experiments/lab/ant-quests/check.mjs` from the worktree. Pass `webkit` or `chromium` to run one profile. Every full run finished all four three-task chains, in order per giver, with zero failed offers, page errors or console errors. Both escorts changed from find to return once during each run.

| Phone profile | Endpoint response | Simulation seconds | Hearts | Requests | Deadline cancellations |
| --- | --- | ---: | ---: | ---: | ---: |
| WebKit iPhone 13 | Held 13 s | 123.17 | 12/12 | 8 | 8 |
| WebKit iPhone 13 | Immediate with markup | 123.30 | 12/12 | 8 | 0 |
| Chromium Pixel 7 | Held 13 s | 123.73 | 12/12 | 8 | 8 |
| Chromium Pixel 7 | Immediate with markup | 122.62 | 12/12 | 8 | 0 |

Both profiles passed the 9,000 ms live-offer swap, same-day reload, UTC rollover and a response arriving after completion. The late response was cached without changing the completed offer's thanks or saved secret. The next task from the same giver kept a separate cache entry. The targeted shared-kit run passed all eight checks for Ant Quests, Sling and their hints. The broad before and after runs were stopped after failures in other experiments.

Screenshots and profile JSON are in `/private/tmp/night-r3-quests/`. Reviewed the 12 task stages on each profile, the hide and escort transitions, the slow reply, the menu, the win card and the book. Browser checks used local endpoint doubles. The deployed endpoint and physical phones remain unverified.
