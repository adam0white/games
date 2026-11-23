# Lab experiments log

Wildcard experiments on the two focus games, Lantern and Ant Promotion. Each experiment is a static directory `prototypes/lab/<name>/`, served at `/proto/lab/<name>/`, and tests one idea the main lines would not try. Nothing here changes `prototypes/lantern/` or `prototypes/ant-promotion/`.

Rules for this directory:

- An experiment imports the main game's `sim.js` or `art.js` by relative path when it only changes the look, so graduating it is a small change. An experiment that changes rules keeps its own copy of the rules.
- Each experiment gets one row below: what was tried, what the checks showed, and a verdict (graduate, keep testing, or drop).
- At most one question per experiment goes to the tester's notes page.

| Date | Experiment | Idea tested | Checked | Verdict |
| --- | --- | --- | --- | --- |
| 2026-11-22 | `lantern-3d` | Lantern drawn in 3D (WebGL2) on the unchanged `../../lantern/sim.js`: point light, shaded water, modelled boat, reeds, reflections | WebKit iPhone 13 profile and desktop Chromium: steering identical to 2D (drag ratio and re-anchor measured), pause, end card, dawn, no-WebGL2 message, no script errors. Rocks ahead draw about 20% smaller than in 2D. Not checked: a real phone (frame rate, heat, sound) | Keep testing. Candidates for the 2D game now: pickup reflections on the water, lit reeds, the dawn flood, the shield glow |
| 2026-11-22 | `ant-wilds` | Animals hunt animals 2 or more levels weaker, prey flee, a kill leaves leftovers worth 1 bar point, eaters are busy for 3 s, weak animals herd | `node bots.mjs`: contact rule equal to the main game on all 6,050 pairs, deterministic, prey never runs out, careful bot reaches level 15/15/18 (main 14/15/18), reckless 11/11/12 (main 6/8/9). A chase or eater is on screen about 40% of the time. WebKit iPhone 13 profile: chase, kill, leftovers, scavenge, death, promotion, no script errors. Not checked: sound, a real phone, whether a person finds it more fun | Keep testing. First piece to graduate: animals that chase and flee from each other, with the dashed red hunt line. Leftovers need a bigger reward first |
