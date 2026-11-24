# Night Flock II

A no-build game at `/lab/night-flock-2/`. The original hillside, dog, boids, fold, wolf and endless count came from [Night Flock](../night-flock/NOTES.md). Its measurements belong to that version.

## 2026-11-24 — Twenty evenings in the valley

Start on Low Beck with twelve sheep. Drag uphill behind them. Evening 2 introduces the drafting gate. Bring sheep to the gate, then hold still to lie the dog down. When sheep graze in the opening with the dog watching, the gate opens. On evening 3, flick sideways toward the bellwether's grazing patch. The dog runs a wide arc and whistles the bellwether off the verge. Drag again to drive the gathered flock. Each new gesture has its own kit hint and saved setting.

Low Beck has evenings 1–6, Fellside has 7–13 and High Tarn has 14–20. Tap a numbered stop on the hand-drawn map to revisit an unlocked evening. Family fleece marks identify a lamb's ewe. The bellwether wears a brass bell. Rushing through sheep and a running wolf can start a panic that spreads between neighbours. The calm meter follows the whole flock. A lying dog eases nearby sheep out of flight.

The bridge and stone lane constrain sheep to their openings. Soft ground slows sheep and dog. Mist reduces flocking sight from 67 to 42 world units. The windsock and arrow show which side will hear the flank whistle farther away. Stars record bringing every sheep home, keeping calm at or above 78%, and finishing within the evening's par. A lost sheep ends the evening. Stars earned on separate clears accumulate. A daily uses the UTC date for its seed and rotates among evenings 2–20, including fields still locked in the campaign. The endless count remains available from the map.

State is local to this version. The keys under `night-flock-2:` are `save` for unlocks, endless best and preferences, `stars` for campaign awards, `daily` for the latest daily result, and `hint-drag`, `hint-hold`, `hint-outrun` for the gesture lessons. There is no play recorder.

### Reproduce

From the repository root, with `PLAYWRIGHT` set to the directory containing the Playwright package:

```sh
fnm exec --using=26.12.0 node experiments/lab/night-flock-2/bots.mjs
fnm exec --using=26.12.0 node experiments/lab/night-flock-2/bots.mjs --mutate
fnm exec --using=26.12.0 node experiments/lab/night-flock-2/check.mjs
```

The mutation reverses uphill dog pressure. It should exit 1. The phone check serves the field, kit and feedback button from the checkout. Its screenshot directory defaults to `/private/tmp/night-r5-flock2/`. Chromium uses touch drags. WebKit uses a mouse for sustained gestures on the phone viewport and touch taps on menus.

### Simulation results

The ordinary suite exited 0. Reversing dog pressure exited 1 with 0/12 home in the opening drive. The original opening, rescue, hazard, wolf and endless checks keep their numerical thresholds.

| Policy or probe | Result |
| --- | --- |
| Full commands, campaign | 99/99 clears across all 20 evenings |
| Endless | 20/20 clears across waves 1, 2, 5, 8 and 30 |
| Opening drag | 36/36 clears at 10, 26, 80 and 200 world units/s |
| Disable outrun | 0/30 clears on evenings 3, 8, 12, 15, 18 and 20 |
| Disable lie-down | 0/30 clears on evenings 2, 7, 11, 14, 17 and 20 |
| Drive the exposed bellwether first with no whistle | 0/6 clears |
| Park a standing dog outside its usual pressure radius | 0/6 drafting gates opened |
| One correctly directed flick | 90/90 gathers across six fields, five seeds and three contact durations |
| Initial placement | 340/340 layouts started clear of collision geometry |
| Consecutive daily evenings, 24 November–12 December 2026 UTC | 19/19 clears |

Median clear time increased from 19.52 s to 30.20 s to 33.53 s across the three farms. The largest adjacent evening rise in median clear time was 15.03 s. The least daylight remaining on a sampled clear was 53.5%. Evening 20 took 42.3–48.7 s with 80/80 home. Of 99 campaign clears, 62 earned calm, 69 beat par and 45 earned both. A single pass through the 20 fixed campaign seeds took the bot 580.77 simulated seconds, excluding menus and retries.

Paired simulations isolated four effects. Changing the assigned ewe displaced a lamb by 4.31 world units after 1 s. Changing the bellwether displaced a follower by 2.24 units after 1 s. Reversing the wind changed a sheep's response to the same whistle by 0.69 units in 0.3 s. The same 0.6 s drive left a sheep 8.39 units farther behind on bog than on grass. Other assertions cover panic across two neighbour links, mist sight, settling on open grass, and blocked versus open crossings.

Independent play exposed two bypasses. A standing dog could wait out the drafting gate. A dog could drive the uncalled bellwether straight off its grazing patch. The gate now needs both a visibly lying dog and settled sheep. The uncalled bellwether returns to its patch. Ending an outrun stands the dog up. A separate one-flick check covers a case where the dog missed the moving bellwether and the original bot silently retried.

### Phone checks and visual review

The phone check uses normal controls for the opening, a second 10-unit/s drive after par, both command lessons, an entire daily, the next UTC daily, an endless wave and the first arrivals of the next wave. The map and late campaign checks use seeded unlocks. Replaying the slower opening earns two stars and retains the previously earned third star on the map. During testing, a stationary pointer laid the dog down with 19/20 sheep home on evening 3. The phone driver now lifts and starts a fresh drive if the dog lies down while it is still trying to move sheep. Three reduced-motion lessons were also opened and inspected on the Chromium phone profile.

The complete opening HUD fits 390 × 664 and 320 × 568 CSS pixels. A deliberate slow drag had previously triggered a hold. Coherent small movement now resets the hold timer, and a delayed frame contributes at most 50 ms of stationary time. A still contact needs 430 ms. A flick travels at least 28 world units horizontally in at most 300 ms.

One WebKit capture lost the landscape while the HUD and animals continued painting. The screenshot check now samples tonal contrast across the mountain ridge as well as contrast across the whole image. The static landscape requests a CPU-backed canvas and rebuilds on context restoration. Each frame replaces the previous one. Thirteen separate WebKit openings showed the hillside. In a diagnostic session, erasing the cache and dispatching a restoration event recovered the original sampled sky pixel. The cause of the first missing landscape remains unresolved.

In a separate run on each profile, trusted pointer gestures cleared the entire final evening. Both runs gathered the bellwether, opened the drafting gate under a hold and brought 80/80 home. Timing covered the actual animation callback including simulation, canvas drawing and HUD updates. WebKit recorded 3,042 callbacks, with p95 2 ms and maximum 4 ms over the whole clear, in 41.63 simulated seconds. Chromium recorded 2,965 callbacks, with p95 1.0 ms and maximum 16.1 ms, in 48.77 simulated seconds. The measurements run on a host browser with a phone profile. Physical-handset rendering, audible whistle quality and voluntary twenty-minute play remain unverified.

The final phone suite exited 0. Both profiles cleared the opening, drafting gate, outrun, daily and first endless wave. Both reported zero browser errors, external requests and telemetry requests. The kit self-check also passed on both profiles before and after the work.

| Profile | Opening (s) | Slow replay (s) | Hold, 16 home (s) | Outrun, 20 home (s) | Daily, 24 home (s) | First endless wave, 32 home (s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| iPhone 13 / webkit | 9.58 | 21.63 | 23.93 | 17.18 | 18.38 | 21.82 |
| Pixel 7 / chromium | 9.62 | 21.62 | 24.22 | 17.17 | 17.88 | 19.97 |

Four short bursts per profile measured all 80 sheep still in the field. Two bursts included a flank command. Each burst had to advance the simulation. The check enforces a maximum callback cost below 16.7 ms. Browser callback intervals are measured separately.

| Profile | Frames | Callback p95 / maximum (ms) | Interval p95 / maximum (ms) |
| --- | ---: | ---: | ---: |
| iPhone 13 / webkit | 80 | 1.0 / 2.0 | 15.0 / 17.0 |
| Pixel 7 / chromium | 83 | 1.6 / 1.8 | 16.7 / 16.8 |
