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
