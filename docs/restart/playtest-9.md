# Focused first-visitor playtest

Stable source-unread play ran **03:54:20.919–03:58:48.584 UTC on 2026-10-15**, lasting **4 minutes 27.665 seconds**. Before that context, two harness attempts reset after module import/export and selector failures. Those attempts exposed opening Carry and cover controls. They are setup contamination, not game bugs or part of the stable duration.

The tester read no source. The initial diagnosis was guided by design, not an unprompted blind deduction. The [unchanged UI export](evidence/focused-first-visit-2026-10-15.json) contains **48 inputs**, engine 4, HF 2.2.1 and game alpha.4. The tester reported exact UI replay. SHA256: `704e7183edc26a0e7dd34c0f773f83f17667d3ac1922ddfea6464d59240cba6b`. UI preferences are separate from world save v4; the UI revision must be identified by its actual source commit.

## Observed play

The guided Mum repair progressed through battery and switch measurements, replacement, a passing Carry check and return. The tester then repaired Nora's and Evan's objects as the player. It understood the physical switch and probe placement. Sam appeared only when the tester deliberately opened People after two returns; repair responsibility appeared after three.

The tester found the opening focused. Duplicate terminal and part targets were manageable. People remained dense but belonged on a separate screen. It stopped at real uncertainty on the keepsake, leaving that puzzle unfinished.

Three confusions remain: Work on part retained Contact while the guide discussed Switch; Nora's Carry control actually used load; intact mechanical surfaces and unsuccessful drum interventions left the keepsake cause uncertain. The unfinished puzzle is not itself a confirmed defect. UI corrections after this run have not been played by this tester.

Screenshots: `/tmp/smallworks-focused-first-player-{opening,inside,repaired,returned,next-work,three-returns,mechanical,final}.png`. The original packet remains unchanged.

## Review before final integration

Astra's independent UX review found an instruction pointing at the inactive handle; root changed the cue to Try carrying it. It also found the exterior too large during meter work; compaction was pending at this review. Independent source review found missing advanced use checks; restoration was pending at this review. Root corrected a bench-only guide path to require the owner's condition. Legacy lesson-end disclosure relocking received a red-to-green six-test regression using durable inputs and actual HF commitments.

The earlier unit phase passed 237 tests. Six focused guide tests and two physical tests pass. At that point full integration, fresh checks and public verification remained required. Final results follow below.

## Final mobile play and public delivery

The source-unread mobile tester used isolated **390 × 844** UI play from **04:08:22.874–04:11:23.248 UTC on 2026-10-15**, approximately **3 minutes**, including about 68 seconds of locator delays. Carry was obvious. It initially chose Contact, followed battery and switch prompts, replaced the switch, achieved 96% movement output and returned on time at 10:50. It accepted Nora's work, saw 53% loaded output and measured battery voltage at 5.91 V. Tools remained available.

Switch Off disabled voltage testing; On restored it. There was no horizontal overflow: viewport and scroll width were both 390. Meter scrolling and small SVG terminals remained awkward, but named controls worked. The tester did not yet understand the electrical reason for measuring across the switch. Guidance supplied the measurement pairs; independent diagnosis is unproven.

The [unchanged mobile packet](evidence/focused-mobile-2026-10-15.json) records **14 inputs** and exact UI replay. SHA256: `c1be17ee166a653eed6a8a578cf1ab56afe124a6abb3e9ddb61a40269447dfd6`. [The mobile meter screenshot](evidence/ui/focused-mobile-meter.png) preserves the tested layout.

Final source `39793cd92dcea494a3bf64df8098aeb19cf0a6b9` is privately pushed on main and deployed clean. Deployment repeated the 241-test check and build. CI 38679966443 passed; Cloudflare version is `cdf74c5d-0a25-49e1-9b31-07756effb16f`. The exact live manifest and candidate asset hashes were verified. Public desktop replayed the original 48-input visitor packet exactly and checked keyboard tabs using End for Notes and Home for Object. Public width-390 checks found no overflow and verified actual switch Off/On. No runtime errors were recorded. The earlier mentor 48-input packet also replays exactly. Adam has not accepted feel.
