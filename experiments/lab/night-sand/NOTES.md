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
