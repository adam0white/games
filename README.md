# Small Works

A single-player repair strategy game. Investigate familiar electrical and mechanical objects at a home bench. Choose measurements, compare results, repair actual components and check the object under its owner's use. Time, stock and cash limit what the workshop can promise.

## Canonical cast adoption

Small Works now has a bounded four-person canonical cast and browser-life integration candidate using published HF 2.21.0. [The cast scope](docs/canonical-cast.md) defines the new edition, playable disclosures and archive boundary. Technical delivery and owner acceptance remain separate.

## Current direction

Adam requested a new direction on 2026-10-16. The workshop is preserved rather than extended by default. [Open-source host research](docs/research/open-source-hosts-2026-10-16.md) compares existing games and living-agent simulations. It includes an Astra consultation, independent reviews and recovered original ideas. No new host is selected. [The later autonomous-coding assessment](docs/research/autonomous-coding-fit-2026-10-16.md) re-ranks the full list for executable tests, integration burden and bounded HF evidence; Concordia is the research lead and Wesnoth is the first game harness to validate.

[Earlier experiments](https://repair.adamwhite.work/experiments/) preserves Small Works and the earlier home/garage campaign at separate paths. Their exact source snapshots are also private archive branches. Autosaves are isolated from the main game and each other; import a compatible export to carry historical progress into its archive. See [archive delivery](docs/research/archives-2026-10-16.md).

## Preserved Small Works status

The 2026-10-14 restart replaces the earlier campaign and interface. The working candidate includes a diagnostic bench, shared workshop clock, retained paper theatre, customer promises, parts recovery and purchases, and Sam's attended learning through published Human Framework APIs. A community gathering offers three timed formats; preparation time permits at most two. The first-week account offers an ending and a choice to continue.

The focused first-repair UX renewal is delivered locally and publicly. The integrated local candidate passed lint, types, **241 tests across 25 files** and production build. Lint reported 151 CSS warnings; the build reported a chunk-size warning. [First-visitor play](docs/restart/playtest-9.md) supports the guided opening, with disclosed setup resets and remaining confusion. Source-unread desktop and mobile play completed the guided repair. The clean public build is `39793cd`; desktop, mobile and exact replay checks pass. Independent diagnosis remains unproven. The earlier published build remains historical evidence. [HANDOFF.md](HANDOFF.md) records current limits. Adam accepts feel through play.

The current game is `3.1.0-alpha.3`, with schema and engine `small-works@5` and strict HF 2.8.0 provenance. Autosaves use `small-works-save-v5`; an engine-4 autosave under `small-works-save-v4`, or an imported engine-4 export, continues under engine 5 with the switch point recorded. Tests replay real engine-4 exports exactly under engine-4 rules. Earlier campaign saves and Small Works engine-1, engine-2 and engine-3 candidate exports are intentionally incompatible. Their evidence remains pinned to its original behavior version. The earlier implementation remains in Git; dated campaign documents describe history, not the active work queue. Repository source remains private. Static public deployment is authorized at [repair.adamwhite.work](https://repair.adamwhite.work); see [HANDOFF](HANDOFF.md) for the verified live manifest.

## Run locally

Use Node 24 or newer.

```sh
npm ci
npm run dev
```

Open the address printed by the development server. Browser saves retain workshop and HF person state. Export a save before reporting a playtest. `npm run check` runs lint, types, tests and the production build.

## Project authority

- [Current design](docs/restart/design.md): selected restart and completion conditions.
- [Run ledger](docs/restart/ledger.md): decisions, evidence and remaining verification.
- [MVP checks](docs/mvp.md): gameplay and causal acceptance.
- [Vision](docs/vision.md): owner direction and its history.
- [Latest general play](docs/restart/playtest-7.md): actual source-unread play and limitations.
- [Mentoring and public follow-up](docs/restart/playtest-8.md): attended learning, courier work and revised teaching instructions.
- [External reviews](docs/restart/external-reviews.md): returned consultations and selected corrections.

The current dependency is exactly `@adam0white/human-framework` 2.21.0. Fresh people use persisted plain narration; pinned replay openings preserve their saved choice. See [the adoption regression and lesson](docs/hf-plain-narration.md). The game owns physics, stock, prices, promises and presentation. HF owns people's acquired conditional methods, decisions, activities and snapshots. The simulation uses public package APIs, without sibling-source imports or LLMs. Bounded controls can establish conditional transfer; they cannot establish general human realism or enjoyment.
