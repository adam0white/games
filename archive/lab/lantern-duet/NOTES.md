# Lantern Duet (2026-11-24)

Done means three playable nights in a phone browser, with a passing `node bots.mjs`. Whether it is fun is the player's call.

Two boats, one thumb each, joined by a rope of light. The rope collects embers it sweeps over. A rock that passes between the boats snags the rope; after 0.5 s it costs a shared heart.

## Rules (sim.js)

- Night 1 opens with the original teaching pattern until y=20 (about 30 s): a wide ember line, then a lone rock in the middle, repeated. Items before y=20 are byte-identical to the first version (checked for seeds 1-30).
- After that, each stretch is an ember feature followed by a hazard, and the hazard follows more closely as the night goes on.
  - Ember features: lines of varying width and offset, arcs, and short lines set toward one bank.
  - Hazards: a lone rock, a big rock toward one bank, a pair of rocks with a gap to thread together, and narrow reaches where the rope must be short.
- Rope length follows the river's usual width, so a wide rope in a narrow reach hits the bank. The pair is then squeezed inside the banks.
- Warning lead-in: `s.danger` is set when a rock lies between the boats within 1 s ahead. It fires a `warn` event once per rock. `s.tight` and a `narrow` event do the same for a narrow reach the rope is too wide for.
- Top speed is 0.99 on night 1, against 1.24 in the main game, so 1.2 s of river fits on a phone screen. Nights 2 and 3 run 8% and 16% faster and grow variety sooner. Night 3 has the main game's stage-5 waterfall; nothing is placed in or just after it.
- Ember light is 0.055 and fade is 0.046 to 0.076 per second. These were tuned so "together" starves after the teaching part too.

## Page (page.js)

- The camera centres on the middle of both banks' extent over the visible stretch. It zooms so at least 1.35 s of river shows above the boats, below the HUD.
- Darkness is drawn at half resolution with a hole at each lantern. Bank edges, rock rims and embers are drawn above the dark, so they stay readable up the whole screen.
- The save is `lantern-duet:v1`, holding `{best: {night, pct}, unlocked, sound}`. The hint key is `lantern-duet:hint`.
- Test hooks: `lanternState`, `lanternSim`, `lanternStart(night, seed)`, `lanternAim(l, r)`, `lanternProject(x, y)`.

## Evidence

Run `node bots.mjs`. Browser checks live outside the repo in the session scratchpad (`duet/check.mjs`); they cover WebKit iPhone 13 and Chromium Pixel 7, plus 390x844 and 412x915.

## Weaknesses and open items

- The bots have perfect reflexes and read 1 s ahead. Human difficulty with two thumbs is untested.
- A player who never spreads the rope loses the flame at about 18% of night 1.
- Audio was not heard; it was only exercised without errors.
