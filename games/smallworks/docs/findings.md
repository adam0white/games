# Findings

2026-10-10, working-life review: commands in the operations, service-week and generic physical paths could mutate progress before HF accepted and completed the activity. Operations and service now gate their effects on actual attendance; the generic physical repair correction is independently cleared within its reviewed scope. Independent controls also found omitted participant consent for crate pickup and omitted short appointment alternatives, including during paid delivery. These are host integration defects, not missing HF faculties.

The first post-review full suite passed 405 tests and failed 32. Most failures exposed old fixture routes that assumed instant service-week closure; one actual owner route exceeded the default five-second test limit under parallel load. Preserve substantive outcomes and exact historical hashes while making fixtures use genuine public retries. A corrected fixture is not evidence that the underlying path is fixed; independent refusal/interruption and available controls remain required.

An actual returning-reader export from the hot development server fails current strict replay because runtime code changed during play. Retain it as feedback, not an acceptance fixture. Future native candidate playthroughs use an immutable build.

New actual attendance also exposed unbounded synchronous test wait loops: a refused wait could be immediately repeated without elapsed time. Positive routes now use bounded public waits, while refusal controls stay single-command. This does not relax repair, teaching, independent-completion or exact-history assertions.
