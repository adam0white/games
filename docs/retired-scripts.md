# Retired scripts

The following files were removed after the monorepo migration. Their last versions remain in commit `fbdc1eb38699b839fd66341573193679804366c2`:

- `games/warren/scripts/capture-legacy.ts` generated the historical 0.2.0 fixture and wrote checkpoints to a machine-specific scratch path. It has no callers. The existing fixture remains.
- `games/pass/scripts/suite-lock.ts` and `games/pass/test/suite-lock.test.ts` were an unused lock helper and its test. Pass's package scripts invoke Vitest directly; no production script called the helper.

Retrieve any file with `git show fbdc1eb38699b839fd66341573193679804366c2:<path>`.
