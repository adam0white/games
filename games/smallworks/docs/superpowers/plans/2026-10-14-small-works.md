# Small Works Implementation Plan

**Goal:** A deliberate repair strategy game whose physical evidence, finite capacity and HF learning create useful decisions.

**Architecture:** Independent physical models and an HF adapter feed a deterministic job/time engine. React renders the engine and sends explicit commands. Use a new save schema. Historical campaign imports are intentionally unsupported.

**Tech Stack:** TypeScript, React, original SVG/CSS, Vite, Vitest, exact released HF 2.2.0.

**Spec:** [design](../../restart/design.md).

## Global constraints

- Published HF 2.2.0 only; no sibling source.
- Source private; static deployment authorized.
- Show costs before acting. Advance simulation only through commands.
- No hidden truth presented as player evidence.
- Save physical state, acquired person state and seeded world state.

## Review focus

- Resource races: parallel work cannot consume one spare twice.
- Repeated clicks: invalid or duplicate commands cannot create money/knowledge.
- Information boundary: only attended outcomes teach methods.
- Day endings: jobs and decisions persist; expired promises produce truthful consequences.
- Device/access: diagram interaction remains accessible without precise mouse input.

## Tasks

1. **Physical puzzle model.** Worker owns model.ts and model.test.ts. Build seeded electrical and mechanical models; measurements, interventions and three use checks. Test competing faults, wrong repairs, no rerolls and retained damage.
2. **People adapter.** Worker owns people.ts and people.test.ts. Create actual HF people, attended method teaching, all-candidate choice and rest/commitment controls. Test taught/untaught, absent teaching and fatigue.
3. **Strategy engine.** Root owns engine.ts/types.ts and engine.test.ts. Shared clock, offers/promises, part conservation, delivery, salvage, purchases, parallel delegation, weekly outcome and continuation. Test transaction costs, save/resume and blind-click policy.
4. **Playable UI.** Worker owns App.tsx, styles.css and components. Bench-first diagram, meter selection, evidence, workboard, people and parts. Root verifies keyboard/narrow screen and real play.
5. **Review and play.** Independent source review and source-unread playtests. Consult Astra on first playable and final game structure. Fix observed problems and retest. Record real durations and outcomes.
6. **Delivery.** Run lint, typecheck, tests and build. Verify local browser play, private Git hosting and the static release. Update README/HANDOFF to fresh authority. Continue useful iteration until deadline.

## Current verification status, 10:58 UTC

The latest 117-test run passed before subsequent source-review findings. Review found that multiple pending interventions could all receive success credit from one passing check, and stale ready status could permit delivery after a failed check. The engine worker is correcting both; no resolution is claimed yet. Model review also found a generated governor condition/setting mismatch and contradictions in owner reports. Those fixes are underway.

Comparison and direct probe controls are integrated. Browser checks at widths 1440 and 390 found no overflow. A source-unread 20–30-minute handoff playtest and an external Opus lifecycle review are underway. Final integrated checks and deployment remain outstanding.

## Completed technical stage, 2026-10-14

The initial plan's HF 2.2.0 dependency is historical; current exact published dependency is HF 2.2.1. Local/public alpha.4 engine 4 is reviewed and checked with 233 tests. Main is integrated; published UI is `0e80d89`, with gameplay core `38cbae0`. Actual play and replay-based presentation evidence are in [the current handoff](../../../HANDOFF.md). Adam's feel acceptance remains. Earlier pending status in this plan describes intermediate checkpoints, not an active implementation queue.
