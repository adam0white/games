# Border Tournament (Cinderhill lab toy)

A lab toy for one Cinderhill rule (docs/design/colony/02-spec.md, section 6.7): two colonies settle a border by display, not by fighting. Served at `/lab/cinderhill-tournament/`.

## Where it lives, and why

- `experiments/lab/<name>/` is the repo's place for experiments that test one idea. It is served at `/lab/<name>/` and imports `../../kit/`.
- It is unlisted: it is not in `kit/games.json`, not in the `LIST` in `experiments/lab/index.html`, and not in `labMoved`. `kit/check/phone.mjs` exempts `lab/` from the games.json rule.
- It is not in `experiments/cinderhill/`. That folder is the game itself, built in parallel by another agent. This toy keeps its own copy of the rules so it can be thrown away.
- The phone check entry is in `kit/check/lab-pages.mjs`, like the other lab pages.

## Files

| File | What it holds |
| --- | --- |
| `sim.js` | The rules. Pure, integer, seeded (mulberry32). `play(seed, pacerA, pacerB)` runs a whole contest. Every command is logged, so a contest replays from its log. |
| `pacers.js` | Rule-based minds: `allIn`, `careful`, `patient`, `mirror`, `idle`. The three neighbours use them. |
| `bots.mjs` | `node bots.mjs [seeds] [--mutate=fresh\|cap]`. Prints a win matrix and asserts the claims below; exits 1 on a failed claim. |
| `sim.test.mjs` | `node --test experiments/lab/cinderhill-tournament/` (11 tests). |
| `main.js`, `index.html`, `words.js` | The page: Canvas 2D, procedural side-on ants, English and Turkish. |

## Rules in numbers

- 10 ticks a second. A contest is 900 ticks (90 s). The spec says 60 s; 90 s gave the pacing more room in the bots and on a phone. Open question for the game.
- At most 30 ants a side in the ring. A wave is 10.
- Stamina 0..1000. In the ring an ant loses 4 a tick (about 25 s to empty). Waiting at the edge it loses 1 every 4 ticks. Walking costs 1 a tick. At home it gains 5 to 7 a tick, depending on how well fed the colony is.
- Posture (how tall an ant stands): 40 when spent (stamina under 250), otherwise 40 + 60 x stamina/1000, plus 15 for its first 3 s in the ring.
- How big a side looks = count part (ants x worker size) + freshness part (posture above a base of 70). The tug moves by the difference and leaks back toward the middle. The HUD shows both parts.
- A side breaks when the tug passes the break line. The breaking side is chased and loses at most 6 of its spent ants. Otherwise no ant dies. At time-out the tug decides: won, lost, or drawn inside a dead zone.
- Why 60 ants is about enough when paced well (rough arithmetic, not measured): an ant empties in about 25 s in the ring, needs about 15 to 20 s at home to refill, and walks about 2.5 s each way. One full cycle is about 45 s, half of it in the ring, so 60 ants can just keep 30 in the ring, and only if they rotate before they crouch. A pacer that sends everything fills the ring with crouching ants that pull for the other side, and ants waiting at the edge tire without showing.

## Bot results (300 seeds a pairing, each pairing on both sides; 2026-11-25)

| Pairing | Wins | Losses | Draws |
| --- | --- | --- | --- |
| careful 60 v all-in 120 (the headline claim) | 82% | 13% | 4% |
| all-in 60 v all-in 120 | 1% | 99% | 0% |
| careful 120 v careful 60 | 75% | 20% | 4% |
| careful 60 v careful 60 (side bias) | 48% | 49% | 3% |
| all-in 90 v all-in 90 (side bias) | 41% | 46% | 13% |
| careful 60 v Jar-keepers 90 | 67% | 27% | 5% |
| careful 60 v Leafstitchers 80 | 18% | 76% | 6% |
| patient 60 v all-in 120 | 90% | 8% | 2% |

The Thornbacks are all-in with 120 ants, so the first row is also the Thornbacks row.

Mutation checks (the claims must fail when the rule they depend on is removed):

- `--mutate=fresh` (posture no longer depends on stamina): careful 60 v all-in 120 falls to 45% / 41% / 15%, and careful 120 v careful 60 to 46%. Two claims fail.
- `--mutate=cap` (ring cap 1000 instead of 30): careful 60 wins 0%. Three claims fail.

## Not verified

- A real phone, and a person playing it. Whether a human can beat the Leafstitchers (the careful bot wins 18%) is unknown.
- The Turkish was written by an AI and not read by a native speaker.
- CI runs only the phone check for this page. It does not run `node --test` or `bots.mjs` here; run them by hand after a rules change.
- lab.js records are refused (HTTP 400) until the slug `cinderhill-tournament` is added to `LAB_PROTOTYPES` in the human-framework repo and deployed.
- `kit/rig.js` is not used; the ants are drawn side-on in `main.js`.
