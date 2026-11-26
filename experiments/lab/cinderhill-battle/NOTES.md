# Cinderhill battle toy

Two colonies fight across open ash, a two-cell rock gap and a one-cell tunnel mouth at `/lab/cinderhill-battle/`. The [colony spec](../../../docs/design/colony/02-spec.md) sets the scent controls and terrain rules in §§6.4–6.5. The earlier [tournament toy](../cinderhill-tournament/NOTES.md) tested §6.7. The owner called it “just a difficult, precisely timed puzzle. Not much fun to it.” This round asks whether drawing a route and choosing where to fight makes a head-on colony battle fun on a phone.

## Where it lives

- Unlisted at `experiments/lab/cinderhill-battle/`. The rules and assets are local to this experiment. The page uses the experiment kit for words, sound, pause, saves, first-gesture help and recording.
- `sim.js` runs at 10 integer ticks per second. The seed varies the openings, ground texture and wounded-ant outcomes. The ordered command log includes both colonies. `replay(seed, log, ticks, options)` runs without a clock, browser or pacer. Custom armies and arena runs need the original options.
- `pacers.js` holds the three rivals and two benchmark policies. `bots.mjs` prints win rates. `sim.test.mjs` tests the rules. The Canvas page is `index.html`, `main.js`, `field.js` and `words.js`.

## Variants

| Query | Trail | Alarm | Recall |
| --- | --- | --- | --- |
| `?v=hold` (default) | Drag a route or tap two points. | Hold a spot. Release to stop recruiting. Guards keep going for another 4.8 s. | Clear both marks and call the field force home. |
| `?v=flag` | Same trail. | Tap or hold a spot to plant a rally flag. It keeps calling guards while you draw another trail. Tap Rally flag again to stop recruiting. | Same recall. |

Both variants use the same map generator, armies and victory rules. Set `?seed=42` and choose the same rival for a direct comparison. Set `?lang=tr` for Turkish. The owner playtest question is **Which Alarm control makes you want to play another round?**

## Rules in numbers

- Cinderhill starts with 48 minors and 16 majors. Trail sends 10 available ants every 1.8 s. Alarm calls 8 every 2.6 s, majors first, from home or the field. Recall and changing orders work at any time. A pin holds an ant in place while opponents remain in contact. Ants go around rock using cached shortest paths. A dashed amber line marks the route from the nest to the selected destination.
- Minors have 144 health, bite for 1, and move a cell every 4 ticks. Majors have 432 health, bite for 2, and move a cell every 7 ticks. A front forms when opposing ants share a cell or occupy linked neighboring cells. Open-front ants within four rows join in pairs, with extras distributed among the opposing ants. Each engaged ant bites once per 3 ticks and rotates targets inside its grapple. At the gap lip or in the passage, only two pairs bite. The tunnel admits one pair. Majors get priority among ants in contact when entering a narrow grapple.
- The arithmetic follows Lanchester's contact-rate distinction. Open damage per side scales with all engaged ants. For equal health and evenly spread damage, the continuous approximation conserves a weighted difference of squared counts. For this mixed-caste check the weight is bite × health, so majors have a 6× per-ant advantage and the 3× headcount brings a 9× square-law advantage for the minors. In a narrow passage the damage rate is bounded by the number of pairs. The same 6× per-ant advantage then outweighs 3× as many minors. Discrete pins, arrivals and healing shift the exact results.
- At one third health or below, an ant falls with a seeded 1-in-5 chance, or after its third wound. Otherwise it limps home at half speed, rests 27 s, and can rejoin. Each base retains eight chamber guards outside the trail and Alarm pools. The strength bars show deployed bite power in each area. A cross on the front shows a grapple or a group of grapples with its count.
- Queen chambers open at 2:00 elapsed. To take a chamber, keep four attackers next to it or inside it and clear nearby defenders for 12 continuous seconds. A side breaks after fighting strength stays at or below one quarter of its original headcount for 18 s. Both conditions can accrue during the first two minutes. If both qualify together, the earlier qualifying condition wins and an exact tie draws. At 3:00 the average remaining health fraction across the starting army decides, with a draw inside three percentage points.

## Bot results

`node experiments/lab/cinderhill-battle/bots.mjs 24` runs 24 seeds in both orientations, 48 rounds per pairing. Percentages are rounded independently. The isolated arenas use the same movement, damage, recovery and scoring rules with chamber capture and breaks disabled so the front can be measured for the full three minutes.

| Pairing | A wins | A loses | Draws | Median seconds |
| --- | ---: | ---: | ---: | ---: |
| 20 majors v 60 minors, open | 0.0% | 100.0% | 0.0% | 180 |
| 20 majors v 60 minors, two-cell gap | 66.7% | 10.4% | 22.9% | 180 |
| 20 majors v 60 minors, tunnel | 45.8% | 4.2% | 50.0% | 180 |
| Open rush v Thornbacks | 35.4% | 64.6% | 0.0% | 146.5 |
| Reads front v Thornbacks | 14.6% | 83.3% | 2.1% | 120 |
| Open rush v Jar-keepers | 100.0% | 0.0% | 0.0% | 120 |
| Reads front v Jar-keepers | 0.0% | 100.0% | 0.0% | 180 |
| Open rush v Leafstitchers | 33.3% | 66.7% | 0.0% | 120 |
| Reads front v Leafstitchers | 54.2% | 43.8% | 2.1% | 132.9 |

Thornbacks rush the open lane with 50 minors and 10 majors. Jar-keepers post 43 minors and 21 majors at the rock gap and then advance. Leafstitchers take 52 minors and 14 majors through the tunnel and then turn into the open. The tested route choice swings the Jar-keepers matchup from a sweep to a shutout. That makes this rival suitable for testing whether players notice the alternative lane.

## Checks and open questions

- Run `node --test experiments/lab/cinderhill-battle/` and `npm test`. Nine rules tests and 79 repository tests passed. Removing the frontage cap in a temporary copy made both the pin-count and terrain-result assertions fail. A Node smoke check with stub DOM and Canvas exercised drag, both Alarm variants, Recall, pause and the end card.
- The [phone check](../../kit/check/lab-pages.mjs) has a saved-state, drag, held Alarm, Recall, pause, and hint entry. This workstation denied localhost listen with `EPERM` and denied headless browser launch. Phone readability, sound, Turkish wording and whether a person finds the battle fun remain open.
- The page sends under `cinderhill-battle` through `kit/lab.js`. The separate Human Framework checkout's `apps/site/src/lab/games.ts` lacked that slug when checked. Live receipt needs the slug registered and deployed there.
