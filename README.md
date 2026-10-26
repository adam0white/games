# Small Works

A single-player repair strategy game. Investigate familiar electrical and mechanical objects at a home bench. Choose measurements, compare results, repair actual components and check the object under its owner's use. Time, stock and cash limit what the workshop can promise.

The current source pins `@adam0white/human-framework` to exactly **3.0.0**. The source game version is 4.1.0; HF uses engine 2.23.0. Check the live [release manifest](https://repair.adamwhite.work/release.json) for the deployed commit and versions. [HF3 adoption](docs/hf3-adoption.md) records replay checks, maintenance and remaining feedback. Adam accepts readability and game feel through play.

## How to play

Open [Small Works](https://repair.adamwhite.work). Begin with the family lantern. The optional first-repair guide shows one next action at a time. Choose **Explore freely** when you want to work without the guide.

1. Try the object under the condition that causes trouble. A lantern that lights on the table may fail when carried.
2. Open the cover and select a component. Use the meter to compare connections under the relevant condition. Read the result before choosing a repair.
3. Clean or replace a part when the evidence supports it. Work takes time. Replacement parts come from limited stock, purchases or another object used for spare parts.
4. Test again after each repair. Return the object after checking the use its owner needs, or return it honestly unfinished.

Later, use the workboard to accept repair requests and keep track of their return times. Repairs share the workshop day, stock and cash. Sam can watch actual work and later try work himself. His attendance and what he has learned matter; asking him to watch does not give him the answer.

For an optional busy afternoon, return the family lantern after a successful use check, then open **Board** → **Try a busy afternoon** → **Wait for the afternoon visitors**. Choose it by 13:30, before taking other work or buying or recovering switches. Waiting advances workshop time to the 13:30 visit. Nora’s path lantern, Rafi’s filter fan and Nora’s work light request returns at 14:30, 15:00 and 15:30. They share one new switch; the supplier gets more next morning. Recovering a switch costs time and its donor object. New and recovered parts remain separate within total stock, and you choose which to fit. Sam keeps his HF decisions and afternoon plans. Existing workshops keep their ordinary rules and saved state unless you choose this option.

The game saves on this device. Workshop time stops while you are away. Open **Menu** for **Resume**, **New game**, **Feedback** and the **Recording** switch. Starting a new game replaces the saved workshop after confirmation.

Feedback offers **I'm stopping** and **I'm confused**. Choosing one changes only the local selection and sends nothing. **Submit** sends the literal choice, any verdict and your edited note through the ordinary feedback path. A note receipt confirms the note was stored; it does not prove optional run chunks arrived.

## What Human Framework contributes

[Human Framework](https://human.adamwhite.work/) supplies the people simulation through its published package. Small Works uses HF for people's perceptions, learned methods, decisions, activities, fatigue, social responses and saved person state. Sam learns conditional methods from work he actually attends. Those methods can affect later choices when the conditions match. Rest and commitments can compete with repair work.

Small Works supplies the objects, hidden faults, physical measurements, parts, stock, prices, workshop clock, customer promises and interface. The actor simulation uses seeded randomness and public HF APIs. It does not use LLMs or sibling-source imports. Saves retain the workshop and HF person state together. These checks can show learning under specific conditions; they do not establish general human realism or enjoyment. See [the narration adoption checks](docs/hf-plain-narration.md) and [HF3 adoption](docs/hf3-adoption.md).

There is no in-game About or Credits page in the current source. This README explains the framework's contribution.

## Canonical cast adoption

Small Works has a bounded four-person canonical cast and browser-life integration using published HF 3.0.0. [The cast scope](docs/canonical-cast.md) defines the new edition, playable disclosures and archive boundary. Technical delivery and owner acceptance remain separate.

## Direction recorded on 2026-10-16

Adam requested a new direction on 2026-10-16. The workshop is preserved rather than extended by default. [Open-source host research](docs/research/open-source-hosts-2026-10-16.md) compares existing games and living-agent simulations. It includes an Astra consultation, independent reviews and recovered original ideas. No new host is selected. [The later autonomous-coding assessment](docs/research/autonomous-coding-fit-2026-10-16.md) re-ranks the full list for executable tests, integration burden and bounded HF evidence; Concordia is the research lead and Wesnoth is the first game harness to validate.

[Earlier experiments](https://repair.adamwhite.work/experiments/) preserves Small Works and the earlier home/garage campaign at separate paths. Their exact source snapshots are also private archive branches. Autosaves are isolated from the main game and each other; import a compatible export to carry historical progress into its archive. See [archive delivery](docs/research/archives-2026-10-16.md).

## Historical Small Works delivery notes

The following paragraphs describe earlier editions and their verification. Their build hashes, test counts and compatibility rules are historical. Use the live release manifest above for the deployed version and [HF3 adoption](docs/hf3-adoption.md) for current source checks.

The 2026-10-14 restart replaces the earlier campaign and interface. The working candidate includes a diagnostic bench, shared workshop clock, retained paper theatre, customer promises, parts recovery and purchases, and Sam's attended learning through published Human Framework APIs. A community gathering offers three timed formats; preparation time permits at most two. The first-week account offers an ending and a choice to continue.

The focused first-repair UX renewal is delivered locally and publicly. The integrated local candidate passed lint, types, **241 tests across 25 files** and production build. Lint reported 151 CSS warnings; the build reported a chunk-size warning. [First-visitor play](docs/restart/playtest-9.md) supports the guided opening, with disclosed setup resets and remaining confusion. Source-unread desktop and mobile play completed the guided repair. The clean public build is `39793cd`; desktop, mobile and exact replay checks pass. Independent diagnosis remains unproven. The earlier published build remains historical evidence. [HANDOFF.md](HANDOFF.md) records current limits. Adam accepts feel through play.

The historical October19 game was `3.1.0-alpha.3`, with schema and engine `small-works@5` and strict HF 2.8.0 provenance. Autosaves use `small-works-save-v5`; an engine-4 autosave under `small-works-save-v4`, or an imported engine-4 export, continues under engine 5 with the switch point recorded. Tests replay real engine-4 exports exactly under engine-4 rules. Earlier campaign saves and Small Works engine-1, engine-2 and engine-3 candidate exports are intentionally incompatible. Their evidence remains pinned to its original behavior version. The earlier implementation remains in Git; dated campaign documents describe history, not the active work queue. Repository source remains private. Static public deployment is authorized at [repair.adamwhite.work](https://repair.adamwhite.work); see [HANDOFF](HANDOFF.md) for the verified live manifest.

## Run locally

Use Node 24 or newer.

```sh
npm ci
npm run dev
```

Open the address printed by the development server. `npm run check` runs lint, types, tests and the production build. Run `npm run check:lane` before each commit. In this repository it currently runs the full check. `npm test` uses the shared machine suite lock.

### Save and replay tools

Add `?lab=1` to the game URL to show diagnostic and replay controls. In **Menu**, choose **Download this run** to export the saved workshop. Choose **Lab tools** for **Import a workshop**, **Verify the recorded replay** and a starting-number control. Export the run before reporting a problem. Keep the original file so a replay can be checked against its recorded actions.

Current-version exports must replay exactly. Older editions may be refused with a start-fresh message. The historical compatibility notes above describe their own editions. [HF3 adoption](docs/hf3-adoption.md) records the current replay checks.

## Project authority

- [Current design](docs/restart/design.md): selected restart and completion conditions.
- [Run ledger](docs/restart/ledger.md): decisions, evidence and remaining verification.
- [MVP checks](docs/mvp.md): gameplay and causal acceptance.
- [Vision](docs/vision.md): owner direction and its history.
- [Historical general play](docs/restart/playtest-7.md): actual source-unread play and limitations.
- [Mentoring and public follow-up](docs/restart/playtest-8.md): attended learning, courier work and revised teaching instructions.
- [External reviews](docs/restart/external-reviews.md): returned consultations and selected corrections.
