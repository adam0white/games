# Lab experiments log

Wildcard experiments on the two focus games, Lantern and Ant Promotion. Each experiment is a static directory `prototypes/lab/<name>/`, served at `/proto/lab/<name>/`, and tests one idea the main lines would not try. Nothing here changes `prototypes/lantern/` or `prototypes/ant-promotion/`.

Rules for this directory:

- An experiment imports the main game's `sim.js` or `art.js` by relative path when it only changes the look, so graduating it is a small change. An experiment that changes rules keeps its own copy of the rules.
- Each experiment gets one row below: what was tried, what the checks showed, and a verdict (graduate, keep testing, or drop).
- At most one question per experiment goes to the tester's notes page.

| Date | Experiment | Idea tested | Checked | Verdict |
| --- | --- | --- | --- | --- |
