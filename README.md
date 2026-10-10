# Repair game

Working repository name; the game's public title is undecided.

A single-player game about repairing familiar objects, teaching another person, and gradually taking responsibility for a larger business. Start with your family's things at home. Progress to friends' repairs in the parents' garage. The first prestige is an apprentice completing an entire repair without your expertise.

Longer-term ambition: the experience shifts from cozy repair to business management to an idle conglomerate, while the people, objects, methods and relationships from the beginning continue to affect play. You can return to hands-on repair. A simulated economy and an MMORPG are eventual possibilities, not MVP requirements.

## Start here

- [Vision and owner directions](docs/vision.md): the ambition and its provenance.
- [Broad roadmap](docs/roadmap.md): milestones, future ideas and stopping conditions.
- [MVP target](docs/mvp.md): the complete first handoff and its acceptance checks.
- [Human Framework boundary](docs/framework-boundary.md): what the game owns, what HF already offers, and what still needs proving.
- [Relevant games](docs/inspirations.md): researched design references, with lessons and limits.
- [Handoff](HANDOFF.md): current state and next action.

## Status

The playable family-and-garage chapter starts with a family conversation and a flickering battery lamp. Optional memories reveal the household gradually. Diagnosis, failed attempts, longer checks, shelving and recovered parts emerge through play. Family friends bring small repairs, including a torch with a different contact mechanism. Objects have distinctive appearances; nearby consequence cues and a brief, reduced-motion-aware reveal help changes stay noticeable.

A longer check runs while you wait, share tea or work on something else. You can honestly hand something back before checking; its owner may request that check later. The Journal retains story and consequential repair conversations.

Run locally with Node 24 or newer:

```sh
npm ci
npm run dev
```

Open the local address printed by the development server. Progress saves in the browser. The Journal exports a replayable story (seed, inputs and person/object state) and opens an exported story. `npm run check` runs lint, types, behavioral tests and the production build.

This is the enriched chapter after the first playtest, before apprenticeship. There is no remote or deployment yet. The working screen title is **A little light**; the public title is undecided.

The game consumes released `@adam0white/human-framework` 2.1.4 through its public API. HF owns person skills, effort, perceptions, relationships and memory. Shared tea changes HF social state, which affects Mum's choice between helping and returning to her book. It does not buy cooperation. Matched elapsed-time tests exercise that bounded consequence. Manual repair outcomes still follow host diagnosis/action matching; independent apprentice learning is not implemented. Framework changes belong in HF and return here as a published dependency upgrade.

Adam accepts the opening's feel by playing it. The larger MVP finish line remains [the first independent handoff](docs/mvp.md#acceptance).
