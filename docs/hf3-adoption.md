# HF3 host adoption, 2026-10-25

Remaining: Adam accepts readability, game feel, canonical continuity and recording through play. Owner review target: 2026-11-03. Friends' testing and Show HN remain on hold.

The current host uses published HF **3.0.0**, engine **2.23.0**, immutable lab-client **0.4.11** and lab-kit **0.5.12**. Game **4.1.0**, save edition **4.1.0+hf3**, scenario **canonical-workshop@2** and workshop engine **small-works@5**. Older root-game editions receive the existing start-fresh refusal. The historical archive commits, evidence exports and isolated storage paths stay fixed.

The native character contract remains **canonical-workshop-2 / workshop-cast/1 / workshop-calendar/1**. This package upgrade changes neither passport fields nor role, calendar, duty or health meanings. Fresh native checkpoints and target claims identify engine 2.23.0. Local engine metadata must match the projected person's source engine. The finite historical Voice/Commonstead dialects retain their existing guards; they are not relabelled as HF3 sources.

No removed HF3 API was used by this host. The host does not change global HF tuning. Selection order, model rules and numerical difficulty are unchanged. Scripts compare nine seven-day raw before/after saves, seeds 7, 42 and 1001 with repair, exploration and mentoring policies. Only `provenance.framework`, `provenance.game` and `people.{sam,mum,nora,rafi,halil}.engine` may differ. `scripts/check-hf3-state.mjs BEFORE AFTER` compares every other raw field exactly, including RNG, `usedLines`, names, memories and ordered inputs. It does not blank prose. Generate the captures with `scripts/check-text-state.mjs OUTPUT` under each exact dependency edition and the machine-wide suite guard. Current exports replay; the HF3 continuation test compares raw saves after every resumed command.

Lesson: package/API version and simulation engine version are distinct. A package upgrade must update source claims truthfully without inventing a new passport contract. Presentation of a repaired part must describe performed work rather than expose hidden condition or imply a passed use test.

## Feedback dispositions

| Ask | Current reproduction and disposition | Regression / acceptance |
|---|---|---|
| F-137 | The People panel used one broad trust phrase for honest late return and neglected work. It now scopes confidence to promised times and separately names an honest unfinished return and any still-outstanding overdue work. No missed promise or trust state is erased. | Actual overdue/return/save-resume control in `workshop-feedback.test.ts`. Owner feel remains pending Nov 3. |
| F-138 | The widened increment authorizes the optional [busy afternoon](restart/design.md#busy-afternoon-2026-10-25): overlapping returns, conserved switches and actual Sam bench/time competition. Existing ordinary runs retain their rules. | Implemented in source; review, delivery and Adam / lab acceptance remain distinct. |
| F-247 DL-5 | Component symbols previously ignored performed cleaning and replacement. Cleaned contact surfaces and replacement-part frames now differ, and the selected part states what was done. A cleaned contact still does not fix a worn switch. | Clean/contact, failed carry, switch replacement, unverified state and save-resume control. |
| F-247 DL-22 | A response could require leaving the repair pane to find the next test. A labelled response area now includes the ordinary costed use-test button beside the response. Phone repair guidance remains visible while its pane scrolls. | Phone geometry and actual clean/test/replace/test/return checks; desktop/tablet/WebKit acceptance recorded in delivery report. |
| F-455 / F-456 | Title save paths, pinned actions, feedback path (now labelled Feedback), action-costed clock and optional remembered name retained. | Existing feedback/guide/clock regressions and ordinary browser controls. Owner retest pending Nov 3. |
| F-465 | Historical native Commonstead Nora fixture still admits with its original provenance, and its current workshop export replays. Fresh host checkpoints identify engine2.23. | Existing finite admission, obligation/refusal, pinned-opening and whole-cast tests. Owner receiving-journey acceptance pending Nov 3. |
| F-467 | The meter is a **tab**, not a button. Access instructions below specify its role. No new playtester round was started. | Keyboard tab handling and supplied access instructions. Shared lab driver owns role-aware lookup. Review Nov 3 if it still refuses a listed tab. |
| Quiet Feedback choices | The custom Feedback page selects the released client’s literal “I'm stopping” / “I'm confused” labels. Selection changes local UI only; Submit sends the chosen words through the normal note/receipt and recording boundary. | Actual transport uses mocked fetch in checks; no production note submitted. Owner / lab review Nov 3. |
| F-491 | Automatic recording linkage and privacy paths retained. No external feedback note is submitted by validation. | Existing recording/continuity tests. A saved toggle is not a server receipt; owner retest pending Nov 3. |
| F-492 / F-493 / F-494 | Plain English, canonical names/setting and readable tablet sizing retained. The contact/work explanation is plain English; no new flavour terms. | Targeted phone/desktop/tablet/WebKit verification, not independent reader or owner readiness acceptance. Owner review Nov 3. |
| Numbered generic HF requests | Current shared outcome records have no unresolved Small Works generic request. SW-1/SW-2 in the dated boundary document are historical research routing, not permission for a host-specific framework fork. | Released capability retained; future generic gaps go to HF. |

The 2026-10-20 general ranking freeze is superseded by this authorized maintenance increment. Explicit owner readiness and research/design selection remain separate.

## Access instructions

Open the game, choose **Start repairing**, then **Carry** and **Look inside**. Choose a named part using its button. Select the **repair** or **meter** control with role **tab**, in tablist **Bench tool**. Arrow keys, Home and End move between tabs. **Read meter** is a button. Select both probes and the condition before measuring. These roles apply on phone, tablet and desktop. Do not interpret a driver failing to find a listed tab as a broken game control.

## Maintenance

Direct packages were checked against the npm registry on Oct 25. Biome2.6.3, Vite8.3.5, Wrangler4.152.0 and Knip6.43.0 are adopted; remaining direct dependencies were already current. Worker compatibility date: 2026-10-25. One HF3 dependency graph is required. Full `npm test` now uses the repository's copy of the shared machine suite-lock implementation. CI retains the standard CI bypass.

Keep patched **Undici7.30.1** under current Miniflare. Miniflare5 beta requires legacy `onHeaders` / `onError421` callbacks; forcing8 skips that guard despite a passing audit/build. Owner: host maintainer; review **2026-11-03** or next Miniflare release. No unrelated transitive major is forced.

Knip uses `ignoreExportsUsedInFile`. Font packages are consumed by CSS imports; Wrangler runs through the deploy child process. Their explicit dependency exceptions preserve actual producers. Two unused component files and six unnecessary export qualifiers were removed after checking imports/dynamic producers. Obsolete unused imports were removed. Existing semantic, replay, legacy, learning and campaign tests remain. The pre-existing layered CSS specificity/important rules and historical test non-null assertions remain visible warnings, without suppression or weakening recommended lint. A CSS consolidation requires viewport-by-viewport cascade evidence; propose that separately for Nov 3. No redundant behavioral suite was deleted merely to shorten runtime.
