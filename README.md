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

V1 release candidate content reaches a persistent first-week ending and keeps the bench playable. V2 adds saved physical access to the primary 3D object surface: open the lamp enclosure, threaded torch cap or bell dome, work on exposed internals, and refit before checking. Opening cancels a previous check; ordinary cap refitting cannot fix a cap fault. Sam prepares the object physically before using his learned methods. Known waiting objects retain their own forms in the room, and a chosen illustrated alternative persists across objects and reload. To work, select a currently offered tool and touch the examined part or assembly to do the actual work. A small original room locates the bench, known waiting items and family project. Illustration, keyboard controls and WebGL fallback provide the same repair decisions. See [prior-art research](docs/research/3d-interaction-prior-art-2026-10-10.md) and [the current design](docs/superpowers/specs/2026-10-10-v2-physical-workshop-design.md).

The playable story begins at fourteen with a family conversation and a flickering lamp. Distinct household repairs and unfinished personal work carry across explicit school years. After graduation, the player can agree a shared workspace, let Sam learn from work he actually watches, and delegate unfamiliar supported repairs. Sam can refuse, stop for help and preserve his own commitments. Genuine independent completion excludes player-assisted work.

The current V2 candidate adds physical cabinet alignment with Dad, Sam's loaded display stand, Nora's afternoon window and a family-table scene where the retained paper street casts real changing shadows. An optional walk to the gate introduces Sam as a friend beside his later apprenticeship. The same small objects can matter years later without requiring a business. These scenes are under independent play review; HANDOFF.md identifies the deployed version separately.

The canonical backstory unfolds through objects and people in a slightly dystopic, repair-dependent world. The Journal keeps conversations and notes, with export and import beside its heading. New school holidays begin on a fresh morning; Dad’s cabinet work can have an actual agreed time instead of repeated availability guesses. The interface follows the system's light/dark setting; original optional 3D inspection complements distinct illustrations and a text fallback. Growth remains voluntary and personal projects remain worthwhile. New customer work puts existing player work safely aside; older stranded bench objects remain reachable after import. Routine notices identify when the activity actually happened.

Helping Sam through an unfamiliar step does not erase the chance to practice later. A stopped job can be reconsidered as supervised work, and one additional household request keeps a rescued training route open. Only a later genuinely unassisted fresh repair earns the handoff. Finished family work changes subsequent recollections rather than reappearing as unfinished.

The owner-playtest increment adds an optional way to close a school holiday without completing every repair, remembered household availability, childhood measuring and label work that remains useful later, and distinct graduation/first-payment presentation. The path torch asks for a controlled diagnosis rather than naming its fault, and both it and the bell require actual attended handling checks. When Sam needs a missing contact method, offering to demonstrate is only preparation: the player performs the repair while Sam actually watches. Discussion is optional; an invitation or later explanation cannot replace missed observation. Five bounded player stereotypes report repeated-choice candidates alongside independent human-style playthroughs; see [their scope](docs/player-archetypes.md).

Run locally with Node 24 or newer:

```sh
npm ci
npm run dev
```

Open the local address printed by the development server. Progress saves in the browser. The Journal exports a replayable story (seed, inputs and person/object state) and opens an exported story. `npm run check` runs lint, types, behavioral tests and the production build.

The first service week offers real collection agreements, separately agreed paid help, a personal model and a returning sewing box with a different cause. Growth is optional: a private bench or occasional favours can also finish the week. See HANDOFF.md for verified extent and remaining work. The public static game is at https://repair.adamwhite.work; repository source publication and the final public title remain undecided. The working screen title is **A little light**.

The game consumes published `@adam0white/human-framework` 2.2.0 through its public API. HF owns people, acquired conditional methods, cognition, perceptions, body, skills, relationships and memory. The host owns object physics, material compatibility, prices and business bookkeeping. Matched learning controls distinguish supported transfer from scalar skill or an authored repair policy; this does not claim universal planning or calibrated human realism.

Adam accepts game feel by playing it. The first independent handoff and its checks remain documented in [the MVP target](docs/mvp.md#acceptance).
