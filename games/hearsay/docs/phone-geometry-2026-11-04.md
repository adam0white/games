# Selected-person geometry — 2026-11-04

Remaining: Luz's F-2265 request to keep the selected person and Who?/What? choices next to the people grid needs a player comparison. Player rounds remain paused; recheck 2026-11-10. This check does not accept the placement or close that preference.

The existing browser control starts fourteen days with new local people, pauses, selects Ece, opens “Talk about someone else”, and selects Osman and Honesty. Chromium ran at 360×690 and 1280×800. At both sizes, the selected person and both selects can each be scrolled fully into the viewport. They have no ancestor clipping, header intersection, blocked center hit or horizontal overflow. The existing reply controls also pass: four tests in one file, 1.80 seconds reported by Vitest, 2.739448 seconds for the controller. The normal frozen install and lane passed before this run. The lane's 489 existing lint warnings remain; no UI, simulation or replay behavior changed.

The structured measurements preserve the separation. On the phone, the selected panel is 981.84375 pixels tall and the grid begins 107.1875 pixels below its bottom. Ece and the selects were verified after separate scrolls. This is accessibility evidence, not simultaneous visibility or a promise that the controls feel close enough.

The focused command uses the ordinary suite lock and existing 60-second case limit:

```sh
pnpm test test/garden-answers-ui.test.ts --reporter=verbose
```

An earlier root command placed the filter after an extra `--`. Vitest stored it outside positional filters, so a broader suite started. Root stopped its exact owned pnpm process; the controller returned failure after 184.130670 seconds. All 67 observed process identities ended, sources were unchanged and the suite lock was absent. That interrupted run is not a passing full suite. The corrected focused run passed, and all 13 observed identities were absent afterward, including zombies. This records observed process identities; it does not claim universal descendant discovery.

The original tester sessions stopped on a tool selector failure and did not establish clipping. Later reports narrowed the concern but did not test this exact phone state. See the current Deferred entry and the original F-2265 words; the test does not replace the requested player judgment. No game change or deployment follows this test and documentation change.
