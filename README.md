# Small Works

A single-player repair strategy game. Investigate familiar electrical and mechanical objects at a home bench. Choose measurements, compare results, repair actual components and check the object under its owner's use. Time, stock and cash limit what the workshop can promise.

## Current status

The 2026-10-14 restart replaces the earlier campaign and interface. The working candidate includes a diagnostic bench, shared workshop clock, retained paper theatre, customer promises, parts recovery and purchases, and Sam's attended learning through published Human Framework APIs. A community gathering offers three timed formats; preparation time permits at most two. The first-week account offers an ending and a choice to continue.

The focused first-repair UX renewal is in progress. The integrated local candidate passed lint, types, **241 tests across 25 files** and production build. Lint reported 151 CSS warnings; the build reported a chunk-size warning. [First-visitor play](docs/restart/playtest-9.md) supports the guided opening, with disclosed setup resets and remaining confusion. Fresh mobile play and renewed public verification remain pending. The prior published engine-4 build remains historical delivery evidence. [HANDOFF.md](HANDOFF.md) records current limits. Adam accepts feel through play.

The current local candidate is `3.0.0-alpha.4`, with schema and engine `small-works@4` and strict HF 2.2.1 provenance. Autosaves use `small-works-save-v4`, leaving the earlier key untouched. Earlier campaign saves and Small Works engine-1, engine-2 and engine-3 candidate exports are intentionally incompatible. Their evidence remains pinned to its original behavior version. The earlier implementation remains in Git; dated campaign documents describe history, not the active work queue. Repository source remains private. Static public deployment is authorized; the existing address is [repair.adamwhite.work](https://repair.adamwhite.work), whose exact engine-4 manifest and basic UI checks are verified.

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

The dependency is exactly `@adam0white/human-framework` 2.2.1. The game owns physics, stock, prices, promises and presentation. HF owns people's acquired conditional methods, decisions, activities and snapshots. The simulation uses public package APIs, without sibling-source imports or LLMs. Bounded controls can establish conditional transfer; they cannot establish general human realism or enjoyment.
