# V2: repair through objects in a small workshop

Research and independent design recommendation, 2026-10-10. The research below preceded implementation. The reviewed candidate now uses tool-first direct object work and an optional rotatable room; its actual controls and limits are recorded in the playtest report. This research is not owner acceptance.

## Recommendation

Make the family battery lamp the first fully interactive object, inside a rotatable cutaway garage with a workbench, parts tray and waiting shelf. Start with three meaningful object targets: housing/holder, battery and switch. The player selects the lamp in the room, focuses the bench, selects a part, and carries out a currently available inspection, test or repair through that part. Completed work changes the visible assembly and the observed light. Leaving the bench and selecting the waiting shelf makes unfinished work physically persistent.

This is a substantial change only if the model becomes the ordinary place where a repair is performed. A rotating room that merely opens the existing long action list would remain a navigation skin. Equally, replacing every action with a tiny unlabelled hotspot would make the game harder to operate without making repair deeper. Use spatial selection followed by a small contextual operation at the selected part. Keep an equivalent labelled control route available.

The lamp is stronger than starting with a new intricate machine: its existing battery/contact alternatives already require judgment, it has a clear functional payoff, and the established rules can prove that 3D interaction changes presentation rather than secretly changing diagnosis. Defer screw-by-screw disassembly, physics placement and free walking. They add motor work before establishing whether spatial repair itself feels better.

## Baseline inspected before implementation

Read `docs/vision.md`, `docs/mvp.md`, `src/ui/inspection/Inspection3D.tsx` and the beginning of `objectModel.ts`. Inspection currently offers a procedural object, rotation by drag/arrows/buttons, reset, and a known-parts layout after inspection. The model consumes `ObjectView`; its contract explicitly excludes latent fault disclosure, learning, elapsed time and repair mutations. There is no model picking/action dispatch in the inspected component. Preserve that information boundary when adding interaction; the existing renderer is useful infrastructure, not yet a repair interface.

The vision calls for small family work growing into responsibility, preserved earlier objects and progressive disclosure. The MVP already distinguishes observations, test, repair, verification and independent apprenticeship. V2 should express that existing causal sequence in space. It needs no new HF faculty solely because the input surface is 3D; continue consuming the published package and deterministic host rules.

## Primary prior art inspected

| Source | Observed basis | Borrow | Avoid copying |
| --- | --- | --- | --- |
| [ustwo: Assemble with Care](https://ustwogames.co.uk/our-games/assemble-with-care/) | The studio describes restoring possessions through Maria's perspective and linking objects to their owners. The page includes a visual gallery. | Give each repair a person, remembered use and concrete restored function. Let physical work carry the scene. | Its characters, objects, artwork, narrative structure and an assumed universal emotional cure through repair. The promotional page does not establish its exact gesture implementation. |
| [Mechanical Pencil: Pilot G2](https://mechanical-pencil.com/products/pen) | The inspected article moves from operating the plunger to removing the upper barrel, inspecting it, choosing barrel/plunger/cam, switching 3D/2D views and stepping through the mechanism. It notes extra desktop content. | Whole object → relevant part → mechanism → whole object functioning again. Keep part names attached to an understandable assembly. | Branded models, images and text; presenting a whole explanatory cutaway before the player has examined the object. This is an illustrated explainer, not evidence of a repair-game simulation. |
| [Mechanical Pencil: pull-back car](https://mechanical-pencil.com/products/car) | The article shows operation, opening, named parts, a spring-focused explanation, drive/wind comparisons and separated gears to clarify function. It explicitly describes a desktop-only animation. | Separate parts only when their relationship is hard to read; show cause and effect in an inspectable sequence. | Its many-part complexity as the first playable. Mobile must retain the same repair knowledge and operations. |
| [Fireproof: The Room](https://www.fireproofgames.com/games/the-room) and [studio account](https://www.fireproofgames.com/about) | The developer describes one-touch navigation, transforming mechanisms, and camera controls developed with touch controls. | Bound the camera around a selected object and make a mechanism's changed state clear after input. | Hidden-pixel searching, occult framing, or a puzzle-box assumption that every visible feature must be manipulated. |

Mechanical Pencil was inspected through its live article content, including the pen and car interaction labels and explanatory sequence. This research did not run its animations or play either commercial game; claims about actual animation timing, control feel and accessibility are therefore unverified. The site's own [about section](https://mechanical-pencil.com/) says its author disassembles products, models them in CAD, illustrates views and animates them. Its value here is carefully selected explanation, not a requirement to reproduce its production pipeline.

## Interaction contract for the first slice

1. **Room selection:** tapping the lamp focuses its bench view. Tapping shelf or tray selects that station. Selection costs no simulated time and performs no repair. Undiscovered objects do not appear as labelled selectable jobs.
2. **Camera:** drag empty space or an object to orbit after a movement threshold. A drag must suppress the ensuing tap. Pointer cancellation, a second finger or release outside the canvas must never dispatch a work action. Room and close inspection have separate bounded angles and an obvious return/reset control.
3. **Part selection:** a tap highlights a known, exposed target and names it. Selecting the switch is not equivalent to testing it. Selecting the housing is not equivalent to examining its interior. The contextual operation names the consequence before execution, including elapsed work time where applicable.
4. **Doing work:** choose an offered operation through the selected part. The engine validates the existing action ID against current offers, then commits once. The model reacts to the resulting public view. A selected battery plus a known-good battery in the tray can stage the test, but actual resource/time effects belong to the committed test action.
5. **Evidence:** show the new observation near the affected part and in an accessible text announcement. An observed steady lamp is a payoff; it does not automatically imply the required verification has completed. Retain explicit verification and premature-return consequences.
6. **Put aside and resume:** choose the waiting shelf as destination and explicitly perform the existing shelving operation. Camera movement cannot shelve work. Reopening the object restores the actual repair stage and known observations.

Use a presentation adapter mapping visible target IDs to current offered action IDs. Both 3D and labelled controls use that adapter and the same dispatcher. Neither renderer nor hit testing receives hidden faults, fault-specific mesh names, diagnostic certainty or unrevealed parts. Two objects with identical player knowledge must have identical targets and tooltips even if their latent faults differ. If exposing a cover should consume time or reveal evidence, add an explicit deterministic host action instead of treating an animation as that evidence.

Do not invent invisible mechanical stages to make an animation look busy. In the first slice, part separation may depict the existing committed inspection/repair; if future removal order becomes a meaningful constraint, represent and persist it in the host state, version it, and include it in replay.

## Affordances and mobile equivalents

Use a gentle outline plus a name on focus/tap; no hover-only knowledge and no green 'fault here' glow. A brief first-use hint explains tap to select and drag to turn. Offer a labelled list of reachable parts/stations, with the same observations and actions, for keyboard, screen reader and WebGL failure. It is a complete alternative interface, not a hidden list of answers. Keep dialogue and people choices in readable text; they gain little from tiny character hotspots.

Prefer roughly 44–48 CSS-pixel interactive regions as a project design target, while testing actual projected size and separation. Do not confuse a large invisible hit sphere with usable targeting: adjacent spheres overlap, foreground parts occlude rear parts, and a finger covers the selected screw. Expand the selected assembly or show separated labelled targets when ambiguity remains. Never choose between overlapping candidates using hidden fault likelihood. Test narrow portrait and landscape views, browser chrome, text enlargement and actual touch input; desktop mouse emulation is insufficient evidence.

[W3C's dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) requires a single-pointer alternative for nonessential dragging and explains that keyboard support alone does not provide it. Keep visible turn/zoom/reset controls and tap-to-select then tap-to-place equivalents. [Xbox input guidance](https://learn.microsoft.com/en-in/gaming/accessibility/xbox-accessibility-guidelines/107) recommends alternative input methods and mobile-native accessibility support. Apply reduced motion to camera transitions and part animations; retain the immediate final state and text evidence. Do not auto-orbit or let motion delay the next necessary action.

## Acceptance and rejection checks

- A new player can complete the existing opening lamp diagnosis, repair and verification mainly through its model; they can identify what each interaction did before spending time or a part.
- The same action sequence through labelled controls produces the same rule state and replay result. Camera/selection-only interaction produces no rule-state changes, RNG draws, teaching or elapsed time.
- Drag, cancelled drag, rapid repeated taps and resizing during a gesture cannot double-dispatch or perform an unintended operation. Occluded/unknown parts cannot be activated through the shell.
- Equal known views with different hidden faults expose equal meshes, targets and labels. Revealed evidence can legitimately change those views only after the host commits the observation.
- A shelved object is recognisable in the room; save/load and resume preserve its real state. WebGL loss midway leaves the full control route usable.
- One novice mobile tester and one keyboard-only pass complete the same repair. Record confusion about selection versus action, camera clashes and missed targets. Adam decides whether the workshop and repair feel good; passing parity tests does not claim that acceptance.

Reject the slice as insufficient if it only supplies a showroom plus the old action panel. Reject it as overbuilt if the player must rotate around the room to discover essential navigation, repeatedly remove cosmetic screws, or fight precision gestures to express a decision already made. The desired gain is spatial understanding and a satisfying visible consequence for meaningful work.

## Shadow experiment reference,21:26 UTC

For the selected personal-table scene, [Triada Studio’s official Shadowmatic page](https://www.triadastudiogames.com/shadowmatic) describes rotating abstract objects in a spotlight to discover recognizable silhouettes, with unexpected silhouettes along the way. This primary promotional description was read; the game itself was not played. The useful principle is an immediately visible transformation that encourages another experiment. Our scene uses the actual retained paper street and available light, with no hidden correct silhouette, abstract replacement object, copied art, or puzzle solution taken from that game. A still street remains playable without supplying a missing drive part.
