# Saltplate

## 2026-11-24 — six resonance prints

**Bet.** Tuning by eye can be satisfying because the grains reveal a change of pitch before they settle. Plate one marks its pitch with a copper notch and a silent, animated fingertip. The other five show only the engraving. The first-time test is an unaided player opening the page with the sound off and clearing Twin Fans within 60 seconds, without reading the instruction. Five such trials would be enough to reject the opening if fewer than four people clear it. If most stop after the guided print or need the target frequency to complete the second plate, the unmarked tuning game also needs another pass.

The page opens on the instrument. Tapping the tuning rail sets the pitch and sliding it sustains and changes the tone. Lifting the finger leaves the plate vibrating. The pitch runs from 110 to 440 Hz. It controls the blend of two neighboring standing-wave modes and the pitch of the synthesized note. The printed frequencies belong to this instrument. The simulation does not predict the resonances of a particular material or plate thickness.

At 60 ticks per second, 460 seeded grains move down the local amplitude gradient toward stationary nodal lines. The impression meter measures the grain distribution against the engraving. It checks both how close the grains are and how much of the figure they cover. Filling only the diagonal of a branched figure cannot earn a print. The steel-blue and oxide finishes use the same rules.

Progress, finish and sound preferences use `night-saltplate:save`. The kit stores the dismissed first-use hint in `night-saltplate:hint`. Reload opens the next uncleared plate. After all six it opens plate one with all six clears retained. The page uses the private notes button and has no play recorder.

### Reproduce

From the repository root:

```sh
fnm exec --using=26.12.0 node experiments/lab/night-saltplate/bots.mjs
fnm exec --using=26.12.0 node experiments/lab/night-saltplate/bots.mjs --mutate
fnm exec --using=26.12.0 node experiments/lab/night-saltplate/check.mjs
```

The mutation should exit 1. The browser check starts a loopback server and resolves Playwright from `$PLAYWRIGHT` or `~/code/human-framework/node_modules`. Its default screenshot directory is `/private/tmp/night-r6-wild/`.

### Simulation results

The opening design changed after inspecting the first capture. Diagonal produced a single line. Twin Fans produces two curved branches as well as a diagonal, so it now opens the set. Moving it from fourth to first changed its in-game match requirement from 0.89 for 0.85 s to 0.83 for 0.65 s. The first plate uses a spatial tolerance of 0.021 plate widths and the later five use 0.016. The wider opening tolerance accepts imprecise taps. Quartic blending broadens each resonance so the player can find it with a thumb. Diagonal keeps its 0.85 requirement and now holds for 0.70 s instead of 0.65 s. Four Petals and Lattice exchange the last two slots and take those slots’ requirements. No bot acceptance threshold was relaxed.

| Plate | Required match | Hold (s) | Meter-only search (s) |
| --- | ---: | ---: | ---: |
| Twin Fans | 0.83 | 0.65 | 15.07 |
| Diagonal | 0.85 | 0.70 | 4.05 |
| Cross | 0.85 | 0.75 | 8.33 |
| Saltire | 0.88 | 0.80 | 11.40 |
| Four Petals | 0.91 | 0.90 | 25.42 |
| Lattice | 0.92 | 0.95 | 21.17 |

The meter-only search starts at 110 Hz, tries 37 evenly spaced pitches and waits longer when the impression meter reaches 72%. It uses no target frequencies. All six plates cleared. Across 12 seeds for each plate, the bot that tries a wrong pitch then retunes with jitter cleared **72/72**, the slowest at **2.20 s**. The direct opening notch took **0.95 s**. All **12/12** off-center, noisy opening attempts cleared within **0.98 s**.

Two bugs appeared during play checks. Under proximity-only scoring, a wrong pitch could fill one branch and score above 0.99. Scoring now takes the lower of grain fit and spatial coverage on an 18 × 18 grid. Cross also exposed a grid-edge case where exact axis alignment left no cells to score. Sampling slightly across cell boundaries restored the cross. All **30/30** wrong campaign pitch pairs failed to clear after 2.5 s, then recovered within **1.68 s** after retuning. All **12/12** continuous sweeps cleared within **1.57 s** of reaching their target. A substantial pitch change gives the grains a seeded velocity impulse with friction and wall reflection so settled lines can break apart.

**109 checks passed.** Removing the force toward nodes made `--mutate` exit **1**. Mean perpendicular distance from the known diagonal then measured **0.2311** plate widths against a limit of **0.015**.

### Phone results

| Headless phone profile | Campaign clears | Opening notch to result, wall (s) | Opening simulation (s) | Held sweep on opening replay, simulation (s) |
| --- | ---: | ---: | ---: | ---: |
| WebKit iPhone 13 | 6/6 | 1.107 | 0.967 | 1.667 |
| Chromium Pixel 7 | 6/6 | 2.506 | 0.967 | 1.283 |

Both profiles tapped the visible notch through trusted touchscreen input. The later five taps used known target pitches. The separate held sweep used a trusted mouse drag in WebKit and a trusted touchscreen drag in Chromium. Lifting after the result appeared left the result open on both. Idle, active pause, resume, reset, alternate finish, mute, partial and full save reload, final wrap and landscape control bounds passed. The first-clear wall times start with the tuning gesture.

The final default phone check exited 0 with zero browser errors, external requests, telemetry requests or telemetry storage writes. The shared kit self-test also passed on both profiles before and after the page changes. The six screenshots from each engine were inspected, including both finishes, the landscape layout and the two completed prints. During development an early screenshot put the hint in the middle of the rail. The fingertip now points to the opening pitch even after rotation. Faceted crystal clusters give the deposited salt enough width to distinguish it from the etched line.

**Unverified.** No unaided first-time player has tried the opening. Listening quality, finger feel and sustained frame rate on physical phones are unmeasured. The checks served the files locally.

## Play recording (2026-11-24)

Records under `night-saltplate` (`kit/lab.js`). One run for each plate: it starts at the first touch on the tuner, ends `won` when the plate prints (event `plate-printed`), and ends `quit` on Reset plate, Reprint or any other new plate. Summary: level, match percent, grains, plates cleared. The notice is under the title (this page has no menu card), on screen from the first look. To keep the tuner on screen the short-phone rule now reserves 312 px instead of 247 px and lets the page get narrower (232 px minimum): the plate is a little smaller on phones under 700 px tall. At 320x568 the page now scrolls about 60 px (13 px before). The page sends nothing typed, no names and no room codes. The recording notice and off switch are the kit's own (`kit/lab.js`); the switch is on the pause card. `check.mjs` answers the lab endpoint itself, loads the page with `?labRunSource=agent`, and asserts that a played run sends a run record under the slug with recording on and nothing with the switch off. Not verified: the live endpoint (it refuses these names until the human-framework change lands and deploys). Changed on purpose: the check's "no lab storage" assertion now allows the player id and this page's session id (`hf-lab-player`, `hf-lab-session:night-saltplate`); any other lab key or write still fails, and the block on `/kit/lab.js` is gone. Bots: unchanged outcome. `check.mjs`: exit 0 on both profiles.

## 2026-11-24 — eighteen plates, the instrument, the daily figure

The owner played this page on a phone and said "saltplate but improve and extend". This pass does both.

### Before: the five weakest things (played at 390 x 844 and 320 x 568 before any change)

1. The header (title, instruction, recording notice) took about 40% of a short phone. At 320 x 568 the page scrolled 59 px and the plate was 226 px wide.
2. The first seconds were still. Plate 1 was solved by tapping the copper mark in about 1 s, with nothing to watch first.
3. The print was two quiet sine tones and a line of text.
4. A pure sine at 110 to 200 Hz is close to silent on a phone speaker. The plate itself made no sound.
5. Six square plates, all played the same way (sweep the tuner). No daily figure, no free play, nothing to show anyone.

### What was built

- **Layout.** One column that is exactly the screen's height. The title shares its row with the pause button. The recording notice is 10 px. The plate's box is a CSS size container, and the plate is `min(100cqw, 100cqh)`, so it takes all the height the other rows leave. The print card covers the tuner's place instead of pushing the page down. Landscape keeps the two-column layout.

  | Screen | Scroll before | Scroll after | Plate before | Plate after |
  | --- | ---: | ---: | ---: | ---: |
  | 320 x 568 | 59 px | 0 | 226 px | 261 to 265 px |
  | 375 x 667 | 7 px | 0 | 320.5 px | 351 px |
  | 390 x 844 | 0 | 0 | 354 px | 365 px |

- **Twelve new plates**, one idea each. The first six are unchanged, grain for grain: the bots compare a digest of their trajectories with main's `sim.js`.

  | Plate | Idea | What the player does |
  | --- | --- | --- |
  | 7 Spokes | a round plate: still lines are diameters (Bessel modes, free rim) | tune |
  | 8 Halo | a round plate also rings in circles | tune |
  | 9 Delta | a triangle has its own family (Lamé modes of the equilateral triangle, free edges) | tune |
  | 10 Bowing Point | a bow cannot drive a figure from that figure's own still line: two figures share the pitch, the bow picks one | drag the bow onto the rival's still line |
  | 11 Turning Star | on a round plate the bow turns the figure (a degenerate pair mixed by where it is bowed) | drag the bow round the rim |
  | 12 Violin X | a violin back; makers tune its X mode and its ring mode an octave apart | tune |
  | 13 Finger | Chladni's touch: a finger silences the figure that moves under it | touch the plate where the line should be |
  | 14 Duet | two tones at once: salt rests only where both are still (spots) | tune against a fixed drone |
  | 15 Stiff Plate | hysteresis: the stiff plate's peak bends up, so the loud branch is reached only by sliding up from below; a jump lands on the quiet branch | slide up into the pitch |
  | 16 Powder | heavy and light grains: salt runs to the still lines, fine powder to the loudest places | tune |
  | 17 Shaker | a time limit: after 5 s of ringing the salt starts to shake off, a grain at a time (the salt gauge turns red and the plate hisses once); when less is left than the print needs (about 8.5 s), the plate must be salted again | tune quickly |
  | 18 Violin Ring | the ring, its twin, and a time limit together (salt starts to go at 8 s; gone past use at about 14 s) | finger, tuner, quickly |

  The model: every mode of the shape sounds with a quartic resonance weight around its place on the tuner (the classic plates' rule). The bow multiplies each mode by its value at the bow; the finger by `exp(-14 v²)` of its value at the finger. Two tones add as `sqrt(a² + b²)`. Modes are tabulated on a 97 x 97 grid, so every shape costs the same per grain. The violin back is the square's modes warped into a violin outline: an illustration, not a solved violin plate.

- **The instrument** (free play), from the Instrument button after plate 1: any of four shapes, any pitch, the bow where the finger is, a picture to share or save. Shape choice in `night-saltplate:free` `{v:1, shape}`.
- **The daily figure**, from the Daily button after plate 1: one shape and mode chosen from the UTC date (the same for everyone at the same moment), timed from the first touch. Best time and tries in `night-saltplate:daily` `{v:1, day, best, tries}`. 28 figures in the pool; thirty days give 18 different ones. Two violin figures are left out because their salt cannot fill the print without a finger.
- **Pictures.** Night Sand's image share moved to `kit/share.js` (`shareImage`, README entry) and both pages use it. Saltplate's picture is the plate with its name and pitch (1080 x 1230). A daily picture's words carry the day and the time.
- **Plate list** from the plate number (and Plates on the pause card): cleared plates and the next one open.
- **First seconds.** The salt falls onto the plate; the copper-mark hint comes at 1.6 s instead of 3 s. On bow and finger plates a drag hint shows on the plate if the player tunes without touching it.
- **The snap.** When the figure locks in, the plate rings (five inharmonic partials, as a struck plate). At the print: the engraving glows, a light sweeps the plate, every grain hops, and a major chord on the plate's pitch plays with a hiss of salt.
- **Sound.** The tuned tone is a bowed voice: a fundamental plus eight harmonics through a soft low-pass, with slow vibrato, so a phone speaker that cannot play 110 Hz still gives the pitch through its harmonics. The duet's drone is a second voice.
- **Languages.** Every string is in `words.js`, English and Turkish (`kit/i18n.js`); a language button is on the pause card. The hub entry now has `tr: true`, a Turkish name, and counts 18 plates. The recording notice stays English (it is the kit's). The Turkish has not been read by a native speaker.
- **Recording** (`kit/lab.js`, slug `night-saltplate`) covers everything new: each plate, daily figure and instrument visit is a run (summary has `mode`, and `day` for the daily figure); events `plate-printed`, `daily-printed`, `salt-shaken-off`, `picture`; a shaken-off plate ends `lost`.

Saves: `night-saltplate:save` keeps `{v:1, cleared, look, sound}` exactly; `cleared` may now be up to 18. A save with six plates cleared opens plate 7 (checked in the browser).

### Checked

- `bots.mjs`: **166 checks passed**. New claims: classic parity digest; free edges (triangle slope across the edge 0.00000 of the steepest slope; disk 0.027, from four-place Bessel roots); every new plate's answer prints from 12 seeds; one claim per idea (bow at its start cannot print, the star a sixth of a turn round prints too, no finger fails, the drone's pitch alone fails, a jump onto the stiff pitch and a slide down from above both fail while a slide up prints, salt and powder both match on the Powder plate, a long wrong ring shakes the salt off, the Violin Ring fails without the finger); every daily figure prints; the instrument never ends.
- **Meter-only searcher** (knows only the impression meter; for bow and finger plates it sweeps the tuner with the bow or finger at each point of a 5 x 5 grid, then nudges it uphill on the meter; salts again when salt shakes off). It clears all 18. Seconds: 15.0, 4.0, 8.3, 11.4, 28.0, 23.7, 5.8, 9.0, 16.9, Bowing Point 47.3, **Turning Star 396.0**, 12.0, Finger 26.3, Duet 22.1, Stiff 18.8, Powder 19.7, Shaker 20.4 (2 resalts), Violin Ring 33.0 (2 resalts). Turning Star is long for a blind searcher because the star prints only within about 4 degrees of the right bow angle; a player sees the salt star turn as the bow moves.
- **Clumsy player** (slides in from below, wobbles 0.017 on the pitch at the old bot's rate, bow or finger 0.015 off the best place): before, six plates, **72/72**, slowest 2.20 s. After, eighteen plates, **216/216**, slowest 2.12 s (Powder). Every plate 12/12; no cliff.
- `--mutate` (salt does not drift), `--mutate=handle` (bow and finger do nothing) and `--mutate=stiff` (no bent peak) each exit 1.
- `check.mjs` on WebKit iPhone 13 and Chromium Pixel 7: all 18 plates cleared through trusted touches (a touch on the plate for the bow or finger, a touch below the pitch and the arrow keys for the stiff plate), plus the old save, the daily figure and its record, two pictures through a stubbed share sheet, the instrument and its shape save, the plate list, Turkish, no scroll at 320 x 568, 375 x 667 and 390 x 844, and recording. Exit 0 on both.
- Page work per frame (simulation and drawing, timed in the page) at 390 x 844 on the Powder plate with all 700 grains: Chromium p95 0.6 to 0.8 ms over two runs, WebKit p95 1 ms (WebKit's timer has 1 ms steps). Compositing is not in that number.
- Night Sand's `check.mjs` after the share move: exit 0, picture shared on both profiles. `phone.mjs lab/hub-a`: ok on both. `npm test`: 73 pass.
- Screenshots of the first minute, every new plate, the daily figure, the instrument, the plate list, the pause card and Turkish were looked at on both engines (under `/tmp/claude-improve-night-saltplate/`).

### Changed on purpose

- `bots.mjs`: the first checks now run over the six classic plates only (they compare plates in the classic mode series, which the new plates do not use); "campaign prints are distinct" became "classic prints are distinct" and requires exactly six. `--mutate` now breaks the drift in both the classic and the new simulation.
- `check.mjs`: plates 10, 11, 13 and 18 get one touch on the plate before the tuner; plate 15 is reached by a touch below its pitch and ten arrow presses.
- Thresholds of new plates were set from measurement: Violin Ring prints at 0.80 (its salt fills 0.83 of the print from some seeds); Bowing Point and Turning Star score salt within 0.04 and 0.05 of the line instead of 0.017, so a thumb a few pixels off still prints.

### Not verified

- Sound on a real phone speaker, and whether the bowed voice is pleasant from 110 to 440 Hz. Feel of the bow and finger under a real thumb. Frame time on real phones.
- Whether an unaided player understands plates 10 to 18 from one line of text and the engraving. Turning Star is the one most likely to be fiddly.
- The Turkish wording (no native reader here). The live lab endpoint.
