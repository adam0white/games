# Night Flock

## 2026-11-24 — first playable evening

The page opens on the hillside, with the dog downhill of twelve sheep. The player can look around for as long as they like. The first touch starts the evening. Holding and moving one finger sets the dog's position target. A slow drive up the centre leads the first flock through the lit gate. The introductory gesture is drawn on the actual pasture.

Ten evenings introduce lambs, a ram, split flocks and a wolf. The wool, horns, running gait and direction of travel distinguish animals during play. The woods and stream follow the same boundary functions used by the simulation. The two print palettes are pine (default) and heather (`?look=heather`).

“Count them home” is available from the pause card's field chooser on a fresh device. Each successful wave carries its home count to the next flock. An arrival updates the personal best immediately. A new count starts at zero. The campaign awards points for each arrival and adds a bonus when a stray returns.

### Acceptance

- A single slow upward drive brings all twelve sheep home on evening 1 in under a minute. An untouched screen leaves the clock still. Starting the clock and leaving the dog idle cannot complete the evening.
- Flocking depends on local separation, cohesion, alignment and pressure from the dog. The dog can gather a group, split it and return for a separated sheep. A sheep can enter the fold only through the opening.
- A known-bad simulation fails the same bot assertions used for the ordinary run.
- Phone checks use the rendered field and ordinary controls. They cover the opening drive, pointer ownership, pause, retry, progression and the device-only endless best.

### Data and controls

The simulation has no browser dependencies. The page uses the shared kit for save, audio, pause, zoom, screens and the first-use hold-and-move hint. Absolute movement in field coordinates is local to the game. The page loads the shared private feedback button at `/notes/button.js`.

`night-flock:save` stores `{v:1, unlocked, best, sound, played}`. The shared hint uses `night-flock:hint`. A reload opens the highest unlocked evening. Each endless run draws a fresh seed. There is no recorder or leaderboard.

### Simulation and scoring

Rules advance at 60 ticks per simulated second. Sheep use neighbours within 67 world units to align their velocities and cohere. Close neighbours repel one another. Lambs first appear on evening 2. From evening 3 onward there is exactly one ram per flock. It allows the dog within 57 units before yielding; a ewe responds at 82. The wolf first visits on evening 4. Its eyes give 2.3 seconds of warning. A dog within 43 units drives off a running wolf.

A sheep can spend up to 1.15 consecutive seconds beyond either bank before it is lost. The dog can run 25 units past the bank to turn a stray inland. Losing one sheep ends the evening. Every sheep must reach the gate to advance. Each arrival earns 25 points. A marked stray earns another 2,500 on arrival, more than the 2,475 points for 99 ordinary arrivals. Evening 5 starts with one separated animal.

### Bot measurements

Run `fnm exec --using=26.12.0 node experiments/lab/night-flock/bots.mjs`. The careful policy drives behind the rearmost group and intercepts the wolf. The bulk policy drives the largest unmarked group.

| Evening | Sheep | Careful clears | Completion range (s) |
| ---: | ---: | ---: | ---: |
| 1 | 12 | 4/4 | 9.2–9.3 |
| 2 | 16 | 5/5 | 14.3–16.5 |
| 3 | 20 | 5/5 | 15.8–17.8 |
| 4 | 24 | 5/5 | 15.3–17.5 |
| 5 | 28 | 5/5 | 20.6–22.4 |
| 6 | 34 | 5/5 | 19.3–21.3 |
| 7 | 40 | 5/5 | 20.5–29.0 |
| 8 | 46 | 5/5 | 17.4–20.1 |
| 9 | 52 | 5/5 | 20.6–22.8 |
| 10 | 60 | 5/5 | 23.2–29.5 |

The 49 campaign runs include the ten seeds used by the page. On evening 5, retrieving the stray brought all 28 home for 3,200 points. The bulk policy brought 25 home for 625 points. All 20 sampled endless runs cleared, four seeds each on waves 1, 2, 5, 8 and 30. Those flocks contained 32, 36, 48, 60 and 60 sheep respectively.

The `--mutate` run reverses the vertical component of the dog's pressure. It exits 1 on the ordinary opening-drive assertion with 0/12 home. The fast-drag probe initially penned 0/12 at both 80 and 200 world units/s. On the introductory evening the dog now stalks uphill behind sheep at up to 42 units/s. It can still cross the field at 188 units/s. Held centred sweeps at 10, 26, 80 and 200 units/s cleared 9/9 seeds at each speed. Their completion ranges were 21.5–21.7, 9.2–9.3, 6.2–6.4 and 6.2–6.4 seconds respectively.

The introductory guide keeps pointing uphill while a player waits. The shared kit supplies a static cue with reduced motion and a general hold-and-move cue for a first visit directly to endless. A held contact beyond the dog shows its direction of travel.

In the paired wolf crossing, the two ewes ended 29.01 units apart at 3.30 seconds of active pursuit. With the wolf removed they ended 11.29 units apart. The difference was 17.72 units, above the original 15-unit acceptance threshold. The test samples during the crossing, when the pair has time to diverge. At 0.90 seconds the difference was 8.81. Intercepting the wolf made it retreat while the unreached wolf in the control was still running at 3.95 seconds.

With wolf flight pressure disabled in an independent probe, the spread was 11.68 units, only 0.39 above the control. This fails the same 15-unit threshold.

### Phone checks

Set `PLAYWRIGHT` to the directory containing the Playwright package. Run `fnm exec --using=26.12.0 node experiments/lab/night-flock/check.mjs`. The check serves the page, kit and feedback button from this checkout. The default screenshot directory is `/private/tmp/night-r3-new2/`.

A separate Chromium probe on a 320 × 568 viewport confirmed that denied storage reports session-only progress after a touch, a window blur pauses the game, and the field chooser and resume control work. A malformed save opened evening 1. A stale open page retained a newer device count of 61 and an unlock through evening 9 when saving a sound preference.

The shared kit self-check passed on both profiles before work and after the final game changes. An intermediate concurrent WebKit run failed two hint-timing assertions. The final rerun used the unchanged shared check. The run here covers the kit self-check and this experiment's own page. Other games were outside this check.

The phone test uses trusted touch drags in Chromium and a trusted mouse drag on the WebKit phone viewport. Both profiles use touch taps for menus. Chromium sends an actual second touch through the browser protocol. WebKit dispatches its secondary pointer event. A seeded endless draw makes the two-wave replay reproducible. The late-evening screenshot uses a progressed save. The browser checks unlock evening 2 through actual play. They also check that a lift stops the dog and that pause cancels steering and freezes the simulation.

The opening drive must finish within 60 seconds of wall time. The endless test initially sampled only the first arrival. Its final 150-second wall-time allowance covers an entire 32-sheep wave, followed by a separate 50-second allowance for the first arrivals of wave 2. The simulation clocks and win conditions stay the same. The screenshot check rejects a flat or transparent capture and restores the exact viewport after waking a stalled WebKit display.

| Final profile | Evening 1 home / lost | Evening 1 simulated / wall (s) | Wave 1 cleared | Wave 1 time (s) | Wave 2 size | Best after reload | Evening 10 eyes sampled at (s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| WebKit, iPhone 13 | 12 / 0 | 9.567 / 12.171 | 32/32 | 17.950 | 36 | 47 | 9.050 |
| Chromium, Pixel 7 | 12 / 0 | 9.717 / 18.274 | 32/32 | 19.150 | 36 | 50 | 8.867 |

Both profile runs exited 0. Both earned 300 points on evening 1. They reported zero browser errors, external requests and telemetry requests. Wave seeds were 1 and 2654435762. The two saved counts differ because sheep continued to arrive between the first wave-2 sample and the pause tap.

The fourteen phone captures were opened and inspected, seven per profile. They cover the wordless opening, first result, pause, field chooser, endless field, first endless result and late-evening wolf eyes. The final illustrations ground the fold on the hill, show the animal's heading and keep the gate lamps visible as the light changes. The separate tutorial detail shows the held finger and sheep in motion.

### Open play questions

The remaining acceptance question is whether a stranger starts behind the sheep, keeps contact and brings all twelve home within a minute without reading. The automated opening drive supplies the gesture. Real thumbs, device performance, sound by ear and human enjoyment still need a playtest. The live deployment was outside this folder-only change.
