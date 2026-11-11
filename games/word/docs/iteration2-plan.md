# His Word iteration 2

**Goal:** Apply the five ranked fixes in the Claude read before lab round 1.

**Architecture:** Keep Ink as a read-only projection. TypeScript owns the appointment and agreement conditions. Published HF 3.2.0 owns beliefs, testimony, source trust and relationships. No engine changes.

**Spec:** The user's iteration brief and `~/code/.lab-scratch/v3/claude-word-read.md`.

## Work

- [x] Add focused controls that fail the old design: asking enables consent; all four asks plus letter can win; careless bargaining loses; timed private assurances can pay or be caught; speech and aftermath track HF state.
- [x] Apply ranked fixes in src/game.ts and src/story.ink. Keep refusal reasons actionable, every choice cost visible, signature cost total visible, same agreement required for all signatures, and deterministic replay.
- [x] Update player-facing UI words and browser route controls. Keep the speaker first and retain the two screenshot limit.
- [x] Update docs/design.md with the actual new conditions, concessions, lie benefit and catch window. No claims of new HF capabilities.
- [x] Run local check and build; play headless and at360×690/1280×800 in Chromium/WebKit. Fix dull or confusing play.
- [x] Get one independent Codex review and fix verified findings.
- [ ] Signed commit with Codex trailer; merge/push; exact green CI; clean build; npx wrangler deploy; verify live page and release.json.
- [ ] Finish inherited central listing/test/label patch in HF delivery lane, signed rebased push, no central deployment; coordination ready marker and board row.
- [ ] Update STATUS/report and remove all owned worktrees and merged branches; stop owned server/browser PIDs.

## Constraints and review focus

- Conditions must change what can be agreed, rather than punish reading or force an arbitrary ask counter.
- Fast deception must have an actual saving and a risk the player can discover.
- The last signature at the displayed deadline must match the stated clock rule.
- Repeated conversation must reflect new beliefs and changed trust; no framework jargon in player text.
- A completed agreement must produce a consistent month-later scene, including the lease Ferda chose and the people who greet the player.
