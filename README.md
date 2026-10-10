# Repair game

Working repository name; the game's public title is undecided.

A single-player game about repairing familiar objects, teaching another person, and gradually taking responsibility for a larger business. Start with your family's things at home. Progress to friends' repairs in the parents' garage. The first prestige is an apprentice completing an entire repair without your expertise.

Longer-term ambition: the experience shifts from cozy repair to business management to an idle conglomerate, while the people, objects, methods and relationships from the beginning continue to affect play. You can return to hands-on repair. A simulated economy and an MMORPG are eventual possibilities, not MVP requirements.

## Start here

- [Vision and owner directions](docs/vision.md): the ambition and its provenance.
- [Broad roadmap](docs/roadmap.md): milestones, future ideas and stopping conditions.
- [Proposed MVP](docs/mvp.md): the small complete game to build first; awaiting owner review.
- [Human Framework boundary](docs/framework-boundary.md): what the game owns, what HF already offers, and what still needs proving.
- [Relevant games](docs/inspirations.md): researched design references, with lessons and limits.
- [Handoff](HANDOFF.md): current state and next action.

## Status

2026-10-09: neighboring local Git repository created; planning documents drafted and reviewed. No gameplay implementation, dependencies, deployment or GitHub remote yet. Repository creation and roadmap drafting are authorized. The MVP design and implementation are not yet accepted.

HF lives at `../human-framework`. This game will consume an exact released version of `@adam0white/human-framework` through its public API. It will not be an HF submodule or import its sibling's source. Framework changes belong in HF and return here as a published dependency upgrade.

The completion artifact for this planning pass is a reviewed roadmap and proposed MVP. Adam accepts the gameplay MVP by playing it; its proposed finish line is in [mvp.md](docs/mvp.md#acceptance).
