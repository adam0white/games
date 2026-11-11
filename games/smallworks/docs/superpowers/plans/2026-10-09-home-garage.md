# Home to garage playable checkpoint

Spec: ../../mvp.md plus the owner's 2026-10-09 implementation direction in ../../vision.md. The latter supersedes awaiting-approval wording in earlier drafts. Execution is delegated and autonomous through a real playtesting dependency.

## Global constraints

Minimal starting state; no tutorial checklist, future tabs, business HUD or enterprise requests. Progressive disclosure through fictional family conversation, received evidence and discovered objects. Include a visible lamp, not elaborate item art. Repair failure teaches a reason. Shelving/resumption, donor reuse, garage free play, save/restore/export/replay must actually work. Use installed HF 2.1.4, exact pin, through public APIs; no framework fork or new faculty for this taste checkpoint. No claimed learned apprentice or first prestige yet: those require the later generic learning controls.

Ruling: deliver the substantial home-to-garage checkpoint before conditional apprenticeship — the approved roadmap explicitly gates later work on the opening's feel; only Adam can supply that evidence — cost if wrong: the next faculty waits for a short playtest, but no speculative actor policy is shipped.

## Interface

src/game/types.ts is the shared contract. Engine exports createGame(seed?), transition(state, input), getView(state), serializeGame(state), restoreGame(text), exportPlaytest(state), replayPlaytest(text). Pure transitions copy JSON state; all actions validate against current availability. View never leaks faults or undiscovered objects. Serialized state includes all people via HF snapshots/restore, world state, inputs, version and fixed seeded faults. Replay validates input lengths/types and final state, rather than trusting imported object fields.

## Task 1: project and integration (controller)

Files: package.json, lockfile, tsconfig.json, vite.config.ts, biome.json, index.html, src/game/types.ts, documents. Establish npm check (lint/typecheck/real tests/build), install pinned package. Coordinate changes to interfaces rather than permit duplicate actor/world logic. Tests cover the consumer boundary, not upstream HF mechanics.

## Task 2: deterministic repair and discovery engine (engine implementer)

Files: src/game/engine.ts, src/game/content.ts, src/game/persistence.ts if useful, tests/game.test.ts. Write meaningful failing tests first, then implementation. Opening: family conversation and one lamp, inspect/test/fix/verify/return introduced when relevant. After natural completion, reveal the second missing-holder lamp; permit shelving, and a plausible family suggestion to look in the garage. Garage donor recovers one compatible part; return to personal repair; friends' requests only after conversation/discovery and demonstrated ability. Keep repeatable bounded requests from known contacts. No player-time caps. Use HF for actual person learning, effort and perceived events and record its real effects; do not invent learning claims. Validate illegitimate inputs, hidden objects, wrong fixes, conservation, persistent faults, partial saves, replay provenance and bounded malformed imports. Cap logs/retained world work if free play repeats.

## Task 3: minimal cozy interface and local persistence (UI implementer)

Files: src/main.tsx, src/App.tsx, src/styles.css, src/ui/*, tests/ui-policy.test.ts only for real behavioral utilities. Read getView only for render; never branch on hidden fault. Small natural opening; warm paper/family conversation; simple CSS/SVG lamp changing visibly; keyboard/touch accessible buttons; reduced-motion support; responsive screen; shelves and parts appear only when available. App uses engine inputs, saves after actions, restores on reload, supplies a modest journal menu for new story/playtest export/import. Imports preserve existing game on failure, and reset requires confirmation. No debug counters or HF internals in product UI. Catch storage failures and retain in-memory play. Share explicit interface questions with controller, do not edit engine/config/types.

## Task 4: independent review, integration, browser acceptance (controller and reviewers)

Game-design and technical reviewers independently inspect source/behavior. Asynchronous Gemini CLI review runs in read-only mode; capture completion/failure. Fix verified issues. Run check, play the complete path in a browser, check narrow/mobile layouts and save reload; test production build served locally. Clean installation outside sibling HF source access proves external package use. Record observations and limits in HANDOFF, commit verified build, integrate local branch, open local preview for Adam. No external publish or scheduler requested.

## Playtest stop

Adam can play from family opening through garage free play, choosing a wrong repair, shelving an object, recovering a part and returning to repair it; can reload and export the run. Ask for reaction to the experience and discovery pace, not routine technical choices. Full apprentice MVP remains unfinished and is recorded honestly.
