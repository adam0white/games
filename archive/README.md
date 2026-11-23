# Archive

Code that is no longer built, deployed or checked. Nothing under `archive/` is served. Git history is intact, so anything here can be moved back.

| Path | What it is | Archived | Why | To revive |
| --- | --- | --- | --- | --- |
| `archive/prototypes/copper-afternoon/` | Bake-off prototype: a repair workshop afternoon with visitors and colleagues who decide for themselves. `sim.js` is the rules, `people.js` the cast, `main.js` the view, `bots.mjs` and `client-smoke.mjs` the checks. Design: `docs/design/copper-afternoon.md`. Play notes: its `NOTES.md`. | 2026-11-23 | Owner: it "has some value, but let it go for now; we'll reuse it for something else later". | `git mv archive/prototypes/copper-afternoon prototypes/copper-afternoon`; it is then served at `/proto/copper-afternoon/`. |
| `archive/prototypes/long-road/` | Bake-off prototype: a wagon trail with a small party. | 2026-11-23 | Owner: "The long road can go." | Same move, to `prototypes/long-road`. |
| `archive/games/commonstead/` | HF game: eight residents finish a storehouse before a storm. | 2026-11-23 | A new game failed to start in the iPhone browser profile (Playwright WebKit: "Saved game changed in another tab"); it had no owner verdict. | Move it back to `games/commonstead`, restore its `games.json` entry and its route in `worker-settings.mjs` and `wrangler.jsonc` from the commit before the archive, then `pnpm install`. |
| `archive/games/island/` | Not a game: a viewer for recorded runs of an HF person and a language model on one island. The same viewer is served by the HF site at `/lab/island/`. | 2026-11-23 | Never on the public list; a duplicate of the HF site copy. | Same steps as Commonstead. |
| `archive/games/hearsay/` | HF game: Hatice runs a tea garden in Istanbul and tries to open a paid workers' lunch on Day 13; what people hear changes who comes. | 2026-11-23 | Same street, cast and subject as The Stairwell; no owner verdict. Triage proposed merging it into The Stairwell. | Same steps as Commonstead. |
| `archive/games/goodhands/` | HF game: Nermin runs a placement agency in Izmir and matches workers to households. | 2026-11-23 | The largest game to maintain (about 60,000 source lines, 143,000 test lines) and it opens on tabs and notes. Owner sees potential in it. | Same steps as Commonstead. |
| `archive/games/valley/` | HF game: one six-hour harvest morning of a larger stewardship design. | 2026-11-23 | One morning of a larger design; the heading prints over the map on a phone. | Same steps as Commonstead. |
| `archive/games/child/` | HF game: Zehra chooses whose work her daughter watches across five ages. | 2026-11-23 | Reads as a worksheet: the same three choices repeat each afternoon. No owner verdict. | Same steps as Commonstead. |
| `archive/games/days/` | HF game: a short Ink story, three days of leave after a father's death, in a PixiJS room. | 2026-11-23 | Shares its story engine with His Word; choice text is hard to read over the picture. | Same steps as Commonstead. |

Archiving a registered game (done for Commonstead, Island, Hearsay, Good Hands, The Valley, What the Child Saw and Three Days): move `games/<slug>` to `archive/games/<slug>`, delete its `games.json` entry and its legacy route in `worker-settings.mjs` and `wrangler.jsonc`, run `pnpm install --lockfile-only`, and set `listed: false` on it in the HF site's `apps/site/src/games.ts`. Its URL under `play.adamwhite.work` and its old origin then stop serving. The original GitHub repository is not touched; archiving that is the owner's call.

## Ideas worth reusing

Owner, 2026-11-23: archived games "have some good ideas that should stay open to reuse/revive in a future game". Each item names what the code does and where it is. None of the five newly archived games imports from outside its own directory.

### Hearsay

- **News changes as it is repeated.** `route()` in `archive/games/hearsay/archive/hf3/src/sim/game.ts` records every retelling with its root, parent, origin and steps. A speaker with low honesty can move a claim one step along a ladder of worse traits, at most two steps, by a seeded hash. This is only in the older HF3 code under `archive/hf3/`; the current `src/` has no bend. Design: "How rumours travel" in `archive/games/hearsay/docs/design.md`.
- **Opposite-trait testimony.** `archive/games/hearsay/archive/hf3/src/sim/testimony.ts` turns a claim ("honest") into its opposite with the truth flipped, and lets a more trusted contradicting source discredit earlier testimony.
- **Claim, disprove, correct.** `contradict()` and `confrontHatice()` in the same `game.ts` cut trust and queue a confrontation. The current edition's `answerConfrontation()` in `archive/games/hearsay/src/sim/garden4-stakes.ts` lets the player own the error (an apology) or stand by it (the garden closes for a day).
- **Trust-gated booking.** `wantsLunch()` and `reserveLunch()` in `archive/games/hearsay/src/sim/garden4-stakes.ts` accept a reservation only if the person trusts the player and holds no strong doubt about three named others.

### Good Hands

- **Says, heard and seen cards with crossed-out doubt.** `addNote()` and `synthesize()` in `archive/games/goodhands/src/sim/index.ts` weight each note by its source, derive a yes, maybe or no reading, and cross out older notes that disagree. Types: `Note` and `Source` in `archive/games/goodhands/src/sim/types.ts`. `readingBasis()` in `archive/games/goodhands/src/ui/render.ts` says in words why a reading stands. Rationale: "Show, don't count" in `archive/games/goodhands/docs/design.md`.
- **Interview answers and reference calls that can mislead.** `answerFromReadings()` in `archive/games/goodhands/src/sim/voices.ts` makes a low-honesty candidate claim the ideal and a quiet one undersell. `referenceReply()` in `archive/games/goodhands/src/sim/references.ts` bends a former employer's account by bias and honesty.
- **Two-sided placement negotiation.** `archive/games/goodhands/src/sim/negotiation.ts`: wage, hours, day off, trial days and fee; each side accepts, counters or refuses with a spoken reply; the placement is confirmed only when both accept.
- **Outcomes and review.** `trialResults()` and `placementDay()` in `archive/games/goodhands/src/sim/index.ts` and `archive/games/goodhands/src/sim/arrangements.ts` test whether agreed terms hold; the `Review` type in `types.ts` shows each person's truth beside the player's notes.

The owner's own reason for seeing potential is not recorded in the game's files; the only source is `docs/triage-2026-11-23.md`.

### The Valley

- **Paid help request.** `archive/games/valley/src/sim/terms.ts` (`TERMS`, `applyTerms`, `recordHelpWork`): the player sets grain aside for an hour-based offer; the person agrees or declines; delivery follows later; stopping early still pays what was earned.
- **Replies that carry the person's own reason.** `archive/games/valley/src/sim/hf.ts`, `archive/games/valley/src/sim/dialogue.ts` and the rules in `archive/games/valley/docs/design.md`: no generic line where it would be wrong, and the steward's read of a person is an approximate hunch that a visit refreshes.
- **Gifts held in escrow.** `giftEscrow` in `archive/games/valley/src/sim/brokering.ts` holds a bridal gift; an unused gift returns to the granary while provisions and time stay spent. Meals consume grain in `archive/games/valley/src/sim/steward.ts`.
- **The larger design.** `archive/games/valley/docs/design.md` describes seasons, years, the elders' gathering in the third winter and losing by missing the due twice. `archive/games/valley/src/sim/game.ts` still has the year-end and gathering code, which the morning episode does not run.

### What the Child Saw

- **Choosing whose work the child watches.** `preparationChoices` in `archive/games/child/src/choices.ts` builds one choice per available teacher, each with a stated cost to the household, plus a no-lesson option.
- **Learning from what was watched.** `archive/games/child/src/model.ts` (`resolve`) and `archive/games/child/src/hf.ts` (`heldMethods`, `conditionalMethodEvidence`): the method watched most often and most recently decides what she does in a crisis.
- **Host facts across time skips.** `hostState`, `nextChapter` and `chapterMonthAt` in `archive/games/child/src/model.ts` and `publish` in `archive/games/child/src/hf.ts` carry food, well, water reserve and recorded deaths across jumps from age 3 to 18.
- **A crisis the player observes but does not choose.** `decide` in `archive/games/child/src/hf.ts` returns the child's choice, and the game narrates it with its cost.

### Three Days

- **Ink runner with a clock that choices spend.** `choose()`, `spend()` and `choiceCost` in `archive/games/days/src/engine.ts` check each clicked choice against its Ink `action:` tag, apply a host consequence and spend free hours; an unaffordable choice is refused with a note. Story source: `archive/games/days/src/story.ink` (compiled `src/story.json`; `pnpm story` recompiles).
- **PixiJS room that is optional.** `mountRoom(element)` in `archive/games/days/src/room.ts` returns `update(view)` and `destroy()`, avoids the unsafe-eval path, hides the canvas from assistive tech and honors reduced motion; the DOM controls work without it.
- **Continuity bridge.** `archive/games/days/src/continuity.ts` (with `archive/games/days/test/carryover.test.ts`) runs a shared cast through the shelf with recorded opening inputs and claim receipts, so replay never reads the shelf.

The triage says Three Days shares its Ink engine with His Word; that was not checked against His Word's code.

The bake-off ended on 2026-11-23 with Lantern and Ant Promotion as the two games that get the work.
