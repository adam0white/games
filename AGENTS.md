# Project instructions

Read README.md, HANDOFF.md, docs/vision.md and docs/mvp.md before resuming. This repository owns the game; ../human-framework owns the framework.

## Current authorization

The owner authorized repository creation, broad roadmap drafting, research and reviews on 2026-10-09. Gameplay implementation is not yet authorized. The proposed MVP is awaiting review. Preserve ambitions without silently activating them.

## Product direction

- Begin with family objects at home, then friends' repairs in the parents' garage. The opening should feel familiar and cozy.
- The first prestige is one apprentice handling an entire repair without the player's expertise. Responsibility changes; people and progress persist.
- Growth can change the feel of the game. Returning to hands-on repair remains valuable and available.
- Item histories, put-aside work, varying difficulty, seeded uncertainty, reuse and recycling are part of the vision. Distinguish authored facts, character knowledge and player knowledge.
- People retain agency and inner lives. Faith and spirituality may be central to people and expressed through ordinary choices. They are not employee productivity upgrades. Broader belief representation requires sourced HF work; no divine acceptance or personal spiritual worth is computed.

## Engineering boundary

- Install released HF through npm, pinned exactly. No sibling-source imports, vendored HF, or game-specific rules added to HF.
- The game owns objects, faults, parts, repairs, prices, promises made to customers, workspaces and presentation. HF owns people's perceptions, understanding, decisions, learning and development. A host bookkeeping fact is not automatically known by every person.
- The actor loop remains deterministic and independent of UI and LLMs. All randomness is seeded and saved. Match exogenous events independently of actor draw order in causal comparisons.
- Saves include world state, person snapshots, dependency/engine/scenario versions and RNG state. Every playable milestone offers an export and replay.
- Before choosing a new generic HF capability, demonstrate why the released package is insufficient. Add meaningful headless controls in HF and consume the resulting release here.
- No server, shared economy or multiplayer infrastructure in the MVP. Future large-population approximations require separate evidence and an explicit decision.

## Workflow and acceptance

- Consult personal ideas and lessons in ../pkm on this personal PC. The current project repository remains the authority on implementation state. The work-PC brain-consult path is not the personal-context source here.
- Use bounded subagents, explicitly selecting model and effort. Include a game-design expert and independent critical reviewer for substantive game work.
- Owner directions take precedence over skills. Do not turn planning into an indefinite sequence of small approval steps; complete the authorized stage and present a concrete result.
- For gameplay implementation, define one milestone's missing capability, causal check and stopping condition. Do not activate the whole roadmap.
- Adam is the MVP acceptor. The completion artifact is a playable standalone build plus its HF release if a framework change is needed, with acceptance evidence described in docs/mvp.md. This is a proposed goal until Adam accepts it.
- Validate documentation links before a documentation commit. Once code exists, establish and run the appropriate lint, typecheck, tests and build before every code commit. Do not claim tests or deployment that have not run.
- Do not publish this repository or its documents externally until repository visibility and licensing have been decided. Local commits are allowed for the authorized planning work. Do not modify or commit HF as part of this documentation pass.
