# Ant Promotion: The Swarm

A lab experiment at `/lab/ant-swarm/`. Draw from the nest toward food. The colony follows scent, not a controlled leader. The page records no play.

## Rules and implementation

- `sim.js` is pure, seeded, fixed-step (30 Hz), and uses typed arrays for up to 1,500 ants and three 50 × 75 fields. Foragers deposit nest scent; carriers deposit food scent. Both diffuse and evaporate. Three forward sensors compare field strengths. Carriers also have an innate nest bearing; this is stated because the simulation is not a claim about ant biology.
- Drawing lays temporary attracting ink and a local direction along the stroke. Its half-life is about one second; the visible residue lasts a few seconds. Ant-generated scent persists longer. The player moves one thumb from the nest to food, lifts, and refreshes the route. Mouse dragging works. Arrow keys move the scent cursor; Space paints.
- Eight short meadows introduce a nearby berry, a longer route, a puddle, a beetle, a web, rain, a bird, and a second harvest. A beetle releases food when enough ants gather together. A thin column slows inside a web; a thick column breaks it. Rain washes all scent in a moving band. Painting under the bird scatters ants and loses carried food. Lifting lets them hide.
- Deliveries grow the physical population. Next meadow carries that population forward. Quotas scale with the initial available population, with compensation for offspring headroom at the low and high caps. Growth during a meadow helps rather than increasing its quota. Adaptation can lower a quota but never raises a promised quota on recovery. Restart preserves the meadow's initial population. New runs start with 600 ants.
- After meadow eight, the daily endless meadow uses the UTC date as its seed and starts with 600 ants. Completing a quota relocates food, removes the old food and painted scent, and starts another delivery deadline. Wave food positions use a separate seeded stream so device ant counts do not change them.
- `render.js` uploads the scent grid as an RGBA8 texture to a WebGL2 fragment shader. Ants use one GPU point batch with body, legs, shadow, and carried-food shapes. Canvas2D provides the fallback. Both looks use generated ground, shrinking berries, shadows, particles, and synthesized kit audio. Six sustained WebGL frames over 35 ms, or a rolling frame mean above 22 ms with CPU work above 8 ms, select Canvas2D. A separate rolling frame/CPU measurement adjusts the active ant ceiling from 300 to 1,500. It keeps the population available for recovery.
- Three selectable looks live on the pause card: Moss (default), Dusk, and Clay. The controls and rules stay the same. These are variants for the owner to choose among.

## Saves and board

`ant-swarm:save` is a version-1 JSON object with `best`, `level`, `runs`, `stars`, `sound`, `look`, `daily`, `name`, `sharing`, `removePending`, and `id`. The separate `ant-swarm:hint` is the kit path hint's `'1'` after the first gameplay input. All storage goes through the kit. Unknown/malformed save values use defaults. No existing game's keys or formats changed.

The device best is the largest number of deliveries in one meadow, including daily endless. The board shares that best; campaign deliveries therefore also qualify. Opening Board performs `GET /lab-api/board/ant-swarm`. Nothing is posted before Share. Share posts `{id,n,s}` with a random ID, a sanitized name of at most 16 characters, and the integer best capped at 1,000,000. Successful opt-in permits later best-score updates. Stop sharing posts `{id,remove:true}`. Failed posts do not claim success. Stop sharing withdraws consent for future score updates immediately. A failed removal retains the ID and a pending-removal flag for retry. No account, recording ID, location, fingerprint, or other personal data is sent. Offline/404 responses leave the local score and the game usable. The worker was not edited.

## Verification

Final commands ran under the pinned Node 26.12.0. Normal bots exit 0 (37.3 s). The delivery mutation exits 1, as required. The full phone check exits 0. Logs are `/private/tmp/night-ant-swarm/bots.log`, `mutation.log`, and `phone.log`.

The careful painter moves at 90 meadow units/s, alternates parallel strokes 3 units apart to build a column, and lifts for a bird warning. The clumsy painter uses the same policy and seeded ability distribution at every level: 45–70 units/s, a 1–5 s initial reaction, 0.5–3 s rest between strokes, 3–14 units of targeting jitter, and a late response to the bird. These are synthetic thumb models, not measured human behavior.

| Meadow | New challenge | Deadline, s | Careful wins / 8 | Clumsy wins / 8 | Careful median, s |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | First scent | 40 | 8 | 8 | 15.03 |
| 2 | Longer route | 21 | 8 | 6 | 16.03 |
| 3 | Puddle | 29 | 8 | 4 | 18.43 |
| 4 | Beetle | 31 | 8 | 4 | 28.93 |
| 5 | Web | 32 | 8 | 4 | 29.27 |
| 6 | Rain | 35 | 8 | 3 | 30.00 |
| 7 | Bird | 40 | 8 | 2 | 35.90 |
| 8 | Second harvest | 44 | 8 | 1 | 36.70 |

**Acceptance gap:** clumsy success is non-increasing and has six distinct steps, but levels 3–5 plateau. The brief's strict drop at every adjacent level is unmet. `bots.mjs` prints this limitation explicitly. The suite checks the weaker non-increasing curve and at least four distinct rates; its exit 0 does not mean the strict criterion passed. Whole-second deadlines were retained instead of selecting narrow thresholds between individual ant arrivals.

Other headless results:

- All 64 careful level/seed trials win. A fixed seed-9 reference also wins all eight levels at a 300-ant cap and all eight at a 1,500-ant cap (16/16). High-cap levels 7 and 8 also win on held-out seeds 1, 9, and 271. Endless at these two capacity extremes was not checked.
- A campaign using seed `20261123 + level × 997` carries the earned colony through all eight meadows: 8/8 wins, 213.57 s, 11,713 deliveries, and 1,500 final ants. This fixed regression uses the original task date. The separate `--campaign --day=20261124` check also wins 8/8 in 206.93 s, with 11,685 deliveries and 1,500 final ants; its log is `/private/tmp/night-ant-swarm/campaign-20261124.log`.
- With no painting, mean first time-to-food is 15.07 s and repeat time-to-food is 3.97 s (1,938 repeat finds). Clearing the food field each step reduces 45 s deliveries from 2,269 to 1,243. Nest navigation remains unchanged in this ablation.
- A drawn route delivers 590 crumbs in 32 s, versus 37 with no input, at a fixed 600-ant ceiling.
- Seeded state/field/metric digests match (`1677a969257eed7d` prefix). A single carried crumb delivers exactly once. `--mutate` disables that transition and the same assertion fails immediately.
- A thin web column moves 0.048 units/tick; a thick column breaks the web and moves 0.400. Beetles reject a crowd one below the threshold and yield at the threshold. Rain reduces both player and ant scent in-band. Holding under the bird scatters all 300 placed carriers; lifting preserves all 300.
- The daily endless reference advances to wave 2 and delivers 1,965 crumbs before ending at 70.7 s. New wave food coordinates use a separate stream from ant motion.

Phone results from the full final run:

| Profile | Renderer | Level 1 result | Frame mean / p95, ms | CPU mean, ms | Independent rAF mean / p95, ms |
| --- | --- | --- | --- | ---: | --- |
| WebKit, iPhone 13 | WebGL2 | 801/800 in 22.43 s | 13.88 / 16.00 | 0.66 | 14.08 / 16.00 |
| Chromium, Pixel 7 | Automatic Canvas2D | 802/800 in 22.50 s | 16.67 / 16.70 | 2.57 | 16.67 / 16.80 |

Both have zero normal-flow page and console errors. Next carries 1,040 → 1,040 and 1,056 → 1,056 initial ants respectively; normalized next goals are 1,124 and 1,138. Both start the current UTC daily seed `20261124` with 600 ants, reproduce its first route after restart, and send no score before consent. Deliberate 404/offline/500 cases generate only expected network-console messages; they produce no unhandled page errors. Sharing and removal retries preserve their IDs, and Stop sharing withdraws future-update consent immediately even if removal fails.

At 360 × 640, forced Canvas2D frame mean / p95 is 13.93 / 16.00 ms on WebKit and 16.67 / 16.70 ms on Chromium. Injecting a 30 ms delay into rAF reduces the active ceiling from 900 to 540, with 540 active ants (41.93 / 49.10 ms mean / p95 under that deliberate delay). The normal phone check gates CPU mean below 20 ms and independent rAF mean / p95 at most 35 / 60 ms. These are emulator checks, not proof of 60 fps on physical phones.

Menu, mid-play, end, board, small-screen fallback, and all three palette screenshots were opened and inspected. Controls fit without overlap; the palette captures show the same paused ant positions in distinct colors. The kit's own `kit` phone section passed before and after on both engines. The shared suite's inventory was not edited because the brief restricts writes to this directory; this page's own check covers its hint and save.

Commands (Node 26.12.0):

```
node experiments/lab/ant-swarm/bots.mjs
node experiments/lab/ant-swarm/bots.mjs --mutate
PLAYWRIGHT=/Users/abdul/code/human-framework/node_modules node experiments/lab/ant-swarm/check.mjs
```

The mutation disables only the nest delivery transition. It leaves movement, pickup, and scent intact. The same one-crumb nest-delivery assertion fails with a nonzero exit. It is a test-only option passed to the pure simulation, not a changed source file.

The phone server serves `experiments/`, supplies an empty notes-button script, and mocks the board. Screenshots go to `/private/tmp/night-ant-swarm/`. Natural pointer gestures complete the first meadow. The check also exercises pause/blur, hint persistence, restart, minimum 48 px targets, storage reload, keyboard control, Canvas2D at 360 × 640, explicit sharing, failed POST retry, removal retry, offline/404 recovery, and ant-count adaptation under injected slow frame scheduling.

Two independent reviews found and led to fixes for action-sound throttling after restart, false board success, loss of the removal ID on failure, missing eighth-meadow behavior, colony size resetting between meadows, and missing performance/hazard evidence. The simulation builder and browser-check builder worked on separate files. No root, kit, worker, or sibling experiment file was edited. No commit or deployment was made.

## Not verified

- Physical phone frame rate, battery cost, thermal behavior, browser edge gestures, safe areas on physical hardware, or thumb feel. Emulated phone profiles do not establish these.
- Sound heard on a real iPhone, silent-switch behavior, or subjective audio quality. The kit unlock and retry wiring is present.
- A real player's learning, enjoyment, or difficulty. Synthetic policies find defects and measure rules; they do not vote on fun.
- The deployed board endpoint, production notes button, deployment, or CI. Board success and failure paths use controlled HTTP responses. Deliberate 404/offline/500 tests may produce expected browser network-console messages; these are separate from the zero-error normal runs.

## Open ideas

- A device-independent competition score could normalize colony capacity or use a fixed-cap daily mode. Current quotas scale with capacity, but raw deliveries can still favor a faster device. The UI accurately calls the local result a device best.
- The palette choice remains open. Moss is the initial look; Dusk and Clay can be selected without restarting.
- A future field model could replace the carriers' innate nest bearing with obstacle-aware home navigation. Current field ablation tests specifically isolate successful food-trail reinforcement rather than claiming every part of navigation emerges from pheromones.
