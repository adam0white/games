# Night Sand

## 2026-11-24 — first sand beds

Night Sand opens on the first dune. A brass handle breaks the surface. A moving ring shows where to dig and where to drop the sand. Grabbing the exposed handle also sinks the scoop into the sand beneath it. A stray tap in the sky leaves the lamp buried and the gesture cue returns. The result sits below the lamp so the player can see what they uncovered.

The ten beds use a 120 × 160 cellular simulation with a fixed 60 Hz tick. Each occupied cell carries one grain and its shade. Grains fall into empty cells and slip diagonally when the adjacent cell is free. Removing a scoop wakes the pile. Released grains pour back from the drop point. The sim accounts for grains on the bed, in the scoop, waiting to pour, and lost through an hourglass drain.

| Bed | Objective | Starting grains | Built-in seed, ticks to clear |
| ---: | --- | ---: | ---: |
| 1 | Uncover the lamp by its handle | 6,481 | 44 |
| 2 | Slide the board clear and fill the lower bulb to the line | 2,717 | 123 |
| 3 | Pour mixed sand onto the screen and collect both colours | 4,017 | 244 |
| 4 | Cover the seed with 6–14 cells of sand | 4,479 | 563 |
| 5 | Uncover a deeper lamp on the right | 6,925 | 44 |
| 6 | Set the board under the stream to fill the right-hand bulb | 2,599 | 650 |
| 7 | Cover the seed on the left with 13–18 cells | 4,534 | 119 |
| 8 | Sift a mix with fewer fine grains into both receivers | 4,017 | 580 |
| 9 | Direct the stream into the left-hand bulb before the charge runs out | 2,588 | 940 |
| 10 | Excavate the deepest lamp on the left | 6,571 | 298 |

The sieve lets the fine turquoise sand through and carries the coarse ochre sand down its face. Fine grains can run up to six cells across an open ledge before dropping. Both receivers count grains that have encountered the mesh. An hourglass scores held sand reaching the etched line in three columns while some of the upper charge remains. A seed takes root after its cover stays inside the marked depth band for 18 quiet ticks.

The endless garden opens from Pause or after bed 10. Its three-tine rake lifts grains and cuts grooves into a bed of 11,872 grains. Matching grooves across the centreline raises the symmetry score. Smoothing the bed starts a fresh pattern. The garden record, completed beds, selected campaign bed, sound, and ink use the device-local `night-sand:save` key. The first-use hint uses `night-sand:hint`. The two inks are Basalt and Plum. The page uses the shared kit and private notes button. There is no play recorder or score service.

The illustration uses a cached engraved landscape and a live raster for the sand. A filtered noise loop follows the measured number of moving grains. The same smoothed flow controls its gain and cutoff. A settled bed falls quiet.

### Physics checks

Run `fnm exec --using=26.12.0 node experiments/lab/night-sand/bots.mjs`. The bot cleared all ten built-in opening states and **60/60** additional runs using six seeds. Its five opening offsets each took **44 ticks (0.73 s)**. All **15/15** strokes starting near the visible handle uncovered the lamp. An untouched bed stayed covered for **3,600 ticks**. An empty-sky stroke also left the lamp buried.

| Independent fixture | Measurement |
| --- | --- |
| Drop 800 coarse grains, then 800 fine grains into the same empty tray | Coarse pile 56 cells wide × 27 high. Fine pile 118 wide × 12 high, limited by the tray walls. |
| Cut the settled coarse pile | Peak avalanche of 120 grain moves in one tick. All 800 grains accounted for after release. |
| Drop equal charges on a horizontal mesh | 300/300 fine grains passed. 0/300 coarse grains passed. |
| Start bed 2 and leave the board centred | Lost at tick 1,308 with 2,292 grains drained. |
| Open the board too late | Lost at tick 1,281 with zero grains left above the outlet. This fixture caught a win awarded on the emptying tick. |
| Remove sand from an overburied seed and replant | Recovered from 24 cells of cover to 15.8. |
| Rake a curve, then rake its reflection | Score rose from 0 to 100. A straight reflection one cell off scored 90. Two cells off scored 0. |
| Replay a stroke with the same seed | Every state field matched. An adjacent seed produced different cells. |

With `--mutate`, the bot runs the same assertions with coarse grains allowed through the mesh. It exits **1** at the independent mesh fixture because all **300** coarse grains leaked. No existing test threshold changed.

### Phone checks

Run `fnm exec --using=26.12.0 node experiments/lab/night-sand/check.mjs`. The check launches headless WebKit and Chromium. It resolves Playwright from `$PLAYWRIGHT` or `~/code/human-framework/node_modules`. Screenshots go to `/private/tmp/night-r6-new6/`.

Both profiles started with a fresh save, tapped empty sky, then uncovered the lamp. They cleared the hourglass, sieve and seed through the visible controls. Each checked pause during a held drag, unlocks, ink, mute across reload and touch, and the garden record. After a garden reload, each returned to campaign bed 5. Both produced zero browser errors and zero unexpected requests. Continuous strokes used touch in Chromium and mouse in WebKit. Both used touch for buttons.

| Measurement | WebKit, iPhone 13 profile | Chromium, Pixel 7 profile |
| --- | ---: | ---: |
| Wall time to the opening result, including an empty-sky tap | 8.35 s | 10.31 s |
| Garden score before and after mirroring a curved stroke | 0 → 97% | 0 → 100% |
| Pour frame interval, median / 95th percentile, 90 intervals | 14 / 33 ms | 16.7 / 16.8 ms |
| Simulation and drawing work during moving frames, median / 95th percentile | 0 / 1 ms | 0.2 / 0.3 ms |
| Peak grain moves in one pour tick | 597 | 625 |
| Highest measured grain-loop gain | 0.12746 | 0.13318 |

WebKit rounded some work samples to zero. The work measurement ends when the game returns from drawing and excludes subsequent browser compositing. The display interval includes missed frames. These measurements came from emulation on the test host.

A separate fresh Chromium touch run cleared **all ten beds** in order, entered the garden from the last result and opened the completed level book in landscape. Its winning simulation ticks were **119, 124, 269, 297, 56, 650, 126, 543, 940, 84**. The 12 portrait screenshots and the landscape screenshot were inspected. The first result now leaves the lamp visible. Lower contrast in the garden surface and a shaded lip on each furrow make the curved strokes visible in both palettes.

### Tuning and limits

The lamp requires at least 80% of its central 11 × 11 cells to stay clear for **30 ticks** after release. The first implementation used 3 ticks, which could reward a short-lived hole in a collapsing dune. Garden scoring gives partial credit for a reflected mark within one cell so touch sampling can shift a groove by a pixel without discarding it. The phone check requires at least 75% for a mirrored curve and a higher score than the single stroke.

A first-time human, audio through a phone speaker, sustained physical-phone frame rate, battery use and heat remain unverified. All play and checks here used a local server.

The shared kit self-test passed on both engines. The post-change shared phone suite ran 182 registered checks. It passed 180 on the first run. A focused Chromium rerun passed the Lantern FP startup and hint checks and the Lantern 3D game check. The Lantern 3D first-hint timing assertion still failed because the hint was already visible at its early sample. That page and the shared harness are outside this experiment. Night Sand is covered by its own two-profile check.

## Play recording (2026-11-24)

Records under `night-sand` (`kit/lab.js`). One run for each bed: it starts at the first press on the sand, ends `won` or `lost` when the bed ends (event `bed-cleared` with level and kind), and ends `quit` on Start over, Choose a bed or any new bed. The endless garden records its score in the summary. Summary: level, kind, progress percent, score, beds completed. The notice is under the sand table, on screen from the first look. The table width formula now reserves 232 px instead of 172 px for it; in landscape the notice sits above the title. The page sends nothing typed, no names and no room codes. The recording notice and off switch are the kit's own (`kit/lab.js`); the switch is on the pause card. `check.mjs` answers the lab endpoint itself, loads the page with `?labRunSource=agent`, and asserts that a played run sends a run record under the slug with recording on and nothing with the switch off. Not verified: the live endpoint (it refuses these names until the human-framework change lands and deploys). Changed on purpose: the check's "no hf-lab keys" assertion now allows `hf-lab-player`; the block on `/kit/lab.js` is gone. Bots: unchanged outcome (same-seed replay matches). `check.mjs`: exit 0 on both profiles.

## Improve pass (2026-11-24): what a cold play found first

The owner's words: "sand needs a lot of improvements". Before any change, a cold play at 390 × 844 (Chromium Pixel 7 and WebKit iPhone 13, cleared save) and measurements on the unchanged page:

| Measure (before) | WebKit | Chromium |
| --- | ---: | ---: |
| Touch to first moved grain, hint stroke on bed 1 | 5 ms | 132 ms |
| Touch to the result card, one hint stroke | 1.85 s | 2.00 s |
| Page work per frame, mean over the stroke (≈120 frames) | 0.14 ms | 0.16 ms |

The 8–10 s in the earlier NOTES counted the check's own sky tap and its repeated strokes; one good stroke reaches the card in about 2 s. Latency was not the problem. A random first touch on bed 1 moves sand only 43% of the time (1,944 of 4,524 grid points), because two thirds of the field is sky.

A clumsy bot (random plausible drags, no knowledge of the answer, 15 runs per bed, three simulated minutes at most) on the unchanged rules:

| Bed | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Won / median | 15/15, 10.6 s | 15/15, 2.0 s | 15/15, 87 s | 12/15, 63 s | 15/15, 6.0 s | 0/15 | 13/15, 71 s | 2/15 | 0/15 | 15/15, 22 s |

The five weakest things, in order:

1. **The sand does not pour.** A press lifts a disc of up to 680 grains at once into a hidden scoop, drawn as a small brass coin; on release they reappear as a heap at the release point. Nothing streams from the finger. It is a cut-and-paste of pixels, not a handful of sand.
2. **Most first touches do nothing**, and the moving hint points into the sky (a toss gesture), so a player who copies it near the top of the dune lifts a few grains and sees no change.
3. **Four ideas spread over ten beds.** Beds 1, 5, 10 are the same lamp; 2, 6, 9 the same hourglass; 3, 8 the same sieve; 4, 7 the same seed. Bed 2 is won by any nudge of the board (2 s). On beds 5 and 10 the lamp is fully buried and nothing shows where it is.
4. **The endless garden is hidden** behind Pause or after bed 10, and gives nothing to keep or show.
5. **Thin feel.** One noise loop follows the flow; there is no sound for picking up or pouring, no light response, and the page is English only.

## Improve pass (2026-11-24): what changed

**The verb.** The finger now takes sand in hand and lets it run. A press gathers the grains under a finger-sized disc (radius 5 cells); a press just above the surface reaches down to it. Dragging gathers more along the path, up to a handful (600 grains on lamp beds, 420 elsewhere). The held grains are drawn under the finger as real grains. Over open air the hand trickles: slowly while it moves fast, freely while it hovers still. On lift the rest streams out of a narrow spout. Sand the hand has just poured is not taken back for 40 ticks. Mass is conserved (field + hand + pouring batches + waste) on every bot run. The falling-sand rules themselves (`fall`, the mesh, runout) are unchanged.

**Ten beds, one idea each.** Level numbers stay 1–10, so `unlocked`, `completed` and `level` in old saves keep their meaning (the hub reads `completed`).

| Bed | Idea | Goal |
| --- | --- | --- |
| 1 | Dig and throw aside | Uncover the lamp at the top of a dune |
| 2 | Pour a measured amount | Cover the seed between two marks; too much is not a win |
| 3 | Open, then shut in time | Slide the board open, then back before the sand passes the upper (pink) mark |
| 4 | The mesh sorts | Pour mixed sand on the sieve; blue falls through, ochre slides off |
| 5 | A deep hole must be wide | The lamp is deep (a faint glow marks it); a narrow hole fills itself |
| 6 | Bend the stream | Set the board under the stream so it lands in an offset bulb |
| 7 | Pile it high | Heap sand under a star; a tall pile needs a wide foot |
| 8 | Order matters | Ochre in the jar to the lower mark, then blue on top |
| 9 | Fill by hand | No charge in the glass; carry sand up from the dunes and pour it in |
| 10 | Shut the source first | A hopper keeps burying the lamp until its board is slid shut |

Replaced: the old bed 2 (an hourglass any nudge won), beds 5 and 10 (the same lamp, hidden), bed 8 (a second sieve) and the old bed 7 (a second seed). A "skim the blue off the top" bed was built and dropped: strokes always took ochre with it.

**Garden and share.** Once bed 1 is cleared a garden button sits in the mast on every bed. In the garden that slot is a share button: it draws the raked bed at 4× with the score under it and hands a PNG to the phone's share sheet (`navigator.share` with files). Where that is missing it saves the picture instead. The kit has no image share helper (`room.js` `shareLink` takes a URL only), so this lives in `main.js`; if a second game needs it, it belongs in the kit. Shares are recorded as `garden-shared` / `garden-saved` events in the garden run.

**Feel.** A short crunch through `kit/audio.js` when grains are taken, scaled by how many; the existing hiss still follows grains in motion; a second chime and a warm light wash on a win; a buried glow and glint over a covered lamp.

**Words.** Every string is in `words.js` (`kit/i18n.js`), English and Turkish, with a language switch on the pause card. The Turkish has not been read by a native speaker. The kit's recording notice and switch stay English (kit text, not this page's).

### After, measured

| Measure | Before | After |
| --- | --- | --- |
| Clumsy bot, bed 1 (15 runs, frozen seeds) | 15/15, median 10.6 s | 15/15, median 8.5 s |
| Touch to grains in the hand (check, page clock) | first grain moved 5 ms WebKit / 132 ms Chromium | same event, 0–0.2 ms; drawn on the next frame |
| Random first touch that takes sand (bed 1 grid) | 43% | 45% |
| Page work per frame, p95, bed full (garden, about 12,000 grains) | — | 1 ms WebKit, 0.3 ms Chromium |
| `check.mjs` first bed, start to result card | 6.4 s / 9.9 s | 10.6 s / 11.7 s (four strokes now, each waits for the sand to settle) |

Clumsy bot after, all beds: 1: 15/15 8.5 s · 2: 1/15 · 3: 5/15 · 4: 0/15 · 5: 15/15 38.1 s · 6: 0/15 · 7: 0/15 · 8: 2/15 · 9: 9/15 102.5 s · 10: 0/15. Beds 2–10 are meant to need intent, so random drags failing them is expected. The before numbers show bed 1 already met the 45 s target; the owner's complaint was the feel, not the time.

Informed bot (follows the live hint), six seeds per bed: all ten beds won; ticks after the first touch: 446, 80–95, 177, 249–267, 1652, 649–655, 984, 986, 1197, 1786. The beds are nearly seed-independent (the seed only varies grain colour), so six seeds is closer to one run than six.

### Checks changed on purpose

The old rules cannot hold "exactly as on main": the verb changed. Kept unchanged: the mesh fixture, the coarse and fine pile shapes, the mound avalanche, the garden mirror scores, the curved mirrored strokes, the shifted-stroke scores and same-seed replay. Changed in `bots.mjs`:

- The empty tray is built from bed 4 (no board), not bed 3: a bed with a board now waits for the first touch.
- The per-bed informed play follows the live hint (`aim()`), not a fixed stroke plus offsets.
- Removed: the bail-grip claims (bed 1 no longer has a grab handle), the old bed 2 closed-gate and late-gate losses (that bed is gone), bed 9 straight-miss (bed 9 has no board), the bed 7 overburied seed (seed is bed 2 now).
- Added: first press holds a handful and a still hand pours it; a press above the surface reaches down; a sky stroke takes nothing; the clumsy bot clears bed 1 in a median under 45 s; bed 3 waits for a touch and a board left open is lost (`overfill`); bed 6 straight stream misses; bed 2 overburied is not a win.
- `--mutate` still breaks the mesh; `--mutate=hand` loses poured grains (fails the mass claim); `--mutate=trickle` stops the hand pouring before lift (fails the trickle claim). All three exit 1.

In `check.mjs`: beds 1–4 are lamp, seed, stop-glass and sieve, played by following the live hint and waiting for the sand to settle; bed 3 is opened then shut. Added: touch-to-grains under 300 ms; the garden button hidden before bed 1 and shown after; the Turkish switch; the garden reached from the mast; the share hands over a PNG with the score in its caption and is recorded; page work p95 under 8 ms with the bed full; an old-format save loads with every field.

### Not verified

- A real phone: thumb feel of the reach (5 cells), the trickle rates, and whether the held handful reads under a finger.
- Sound by ear: the crunch and win chime were checked only as gain on a node.
- Colours in daylight: not measured; the dark sky behind ochre sand is high contrast, the plum look less so.
- The real share sheet: checked with a stand-in `navigator.share`; the download fallback was not exercised.
- Turkish wording.
