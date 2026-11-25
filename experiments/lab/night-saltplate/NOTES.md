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
