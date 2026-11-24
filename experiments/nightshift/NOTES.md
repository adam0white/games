# Tiptoe Museum

You have one torch and a museum full of exhibits that try to leave before sunrise. Drag the light across the floor to freeze the runaways and hold it until they shuffle back onto their plinths.

The premise comes from the Nightshift brief. Alibi and Borrowed supplied references for the cards, first-run cues and kit wiring. The characters, museum, campaign and rules are original to this experiment. The static build planner picks up the folder at `/nightshift/`.

## Rules and tuning

The torch aims 42 floor units above the thumb. The light circle has a 58-unit radius on a 390 × 660 floor. The beam travels up to 530 units per second. Lifting the thumb leaves the beam where it is. Mouse movement and arrow keys also aim. The moon-to-sun clock tracks dawn and the three door markers track losses. A third escape ends the run, including when several exhibits cross on the same simulation tick.

Normal exhibits stop when the light intersects their body. Hold for 0.82–1.83 seconds to send one home. Uninterrupted darkness gives a regular exhibit roughly 9–13 seconds to reach the exit, depending on the wing, seed and route. The return follows the same route backward. Lessons start with the featured mechanic and a ghost finger. A completed catch or fuse lesson makes the first mixed group arrive sooner. The kit supplies separate idle guidance for first-time players.

| Wing | Nights | Dawn | Ordered encounters |
| --- | --- | ---: | --- |
| Marble | 1–6 | 60 s | Follow, hold, portrait, twins, three exhibits, twins in a crowd |
| Portrait | 7–12 | 63 s | Mirror, shy mask, cat, mirror and mask, cat and twins, faster waves at the mirror |
| Natural | 13–18 | 66 s | Fuse, upstairs gallery, fuse and stairs, linked twins and mask, mirror and fuse, full museum |

- The portrait dancer steps out of its frame. The twins move when both are dark. The lit twin can stop its partner even from its plinth.
- The mirror moves a reflected pool in the opposite direction from the torch. An exhibit behind the glass accepts reflected light. Direct light can reach it after it leaves the case.
- The shy mask advances in light and stays put in darkness. The cat crosses independently, makes a different sound and never counts as a return or escape.
- The fuse flickers until the beam is left on the box for 0.56 seconds. The upstairs exhibit starts on the balcony and descends through the visible stairs.
- The campaign has a fixed default seed. `?seed=` selects another unsigned seed for campaign or Long Night. `?level=` opens a campaign night for inspection. Seeds set plinth offsets, routes, speeds and which exhibits wake in each wave.
- Long Night ramps concurrency, wave frequency and movement pressure with no dawn. The save keeps its best survival time.
- Daily uses the UTC date and cycles across nights 12–18 with a date-specific seed. One clear per date counts. A missed date resets the streak once the next win is recorded. The share image contains the date, escape marks and streak. The share sheet is used when file sharing is available, with a PNG download fallback.
- `nightshift-save` holds campaign progress, sound, Long Night best and Daily streak. The kit owns its one-shot hint flag and shared recording keys. Lab outcomes are `dawn`, `escaped` and `left`. The start record contains mode, night, seed and the date in Daily. Events count returns, escapes and fuse repair.

## Bots

Twelve seeds per campaign night. The blind sweep follows the same path throughout. The listening policy chooses the nearest recent footstep and uses the visible position to follow that exhibit. The average policy has delayed decisions, imperfect aim and occasional trips after the cat. The competent policy prioritizes threatened exits, commits to a catch and repairs the fuse.

| Wing | Trials per policy | Idle wins | Sweep wins | Listener wins | Average wins | Competent wins | Competent max escapes | Furthest progress |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Marble | 72 | 0 | 33 | 72 | 72 | 72 | 0 | 31.5% |
| Portrait | 72 | 0 | 0 | 72 | 51 | 72 | 0 | 80.4% |
| Natural | 72 | 0 | 0 | 69 | 35 | 72 | 0 | 78.9% |

The competent policy lasted 93.0–108.5 seconds in twelve Long Nights. Rules checks cover the twin link, reflected light, dark shy mask, independent cat, fuse repair, upstairs route, simultaneous escape limit, same-seed replay and 31 daily nights.

## Browser checks

`check.mjs` serves the static route and kit through a free loopback port. It drives touch pointer events on WebKit at 390 × 664, Chromium with the larger phone profile, and Chromium at 360 × 640. It checks menu, idle hint, pause freeze and resume, a touch-driven dawn, three idle escapes, next night, sound and progress after reload, Daily seed and streak, share preview, Long Night best, and mocked lab outcomes. The smallest profile also checks the PNG download. The notes script is stubbed.

Screenshot review began with the large and small default layouts. Three revisions uncovered the torch dock and moved the mirror away from the dinosaur, lowered floor contrast and separated the balcony and plinth silhouettes, then softened the torch and shadows and added visible footprints. Intermediate and final captures live in the supplied scratch directory.

## Not verified

Physical phone touch, speaker playback and stereo localization, native sharing, first-time comprehension and human difficulty are unverified. Browser audio checks observe the scheduled nodes. The listener is a policy with access to simulated footstep locations and rendered positions. The average policy models specific delays and distractions, so its rates describe that policy.

Production deploy, live feedback button and remote recording acceptance are unverified. The local recording allowlist already contains `nightshift`. The shared phone suite requires a `kit/games.json` listing and stops before running profiles until that catalogue entry is present. The experiment-specific checks do not require the listing.

## Builder

- Added a heron so the opening floor has shapes with distinct heights, faces and outlines.
- Set the beam ahead of the finger and gave the torch a visible dock. Footprints convey moving exhibits without sound. The glass case has a separate mint reflection and the clock changes with the sky at dawn.
- The cat distracts with movement and sound. Shining on it triggers a comic chirp and uses the player's attention. The score counts only exhibits.
- An unaided first-phone playthrough would test whether the mirrored case and lit-only mask are understood quickly. A separate scored penalty for the cat was considered. The attention cost is the only consequence implemented.

## Kit candidates

A two-axis absolute drag helper could serve another overhead game. A panning option on the kit audio API would let games use stock footsteps without constructing their own Web Audio panner. The optional ring hint currently dereferences its absent hand element in the shared kit. The default hand hint is used here.
