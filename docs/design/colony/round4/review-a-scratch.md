# Under the Rainline

## Pitch

Build an ant colony that can keep its brood dry while rain changes the ground above it. Draw a scent trail across a fallen leaf. Hundreds of workers take it. The first seed reaches the nest while you can still see the ants that picked it up. Then water lifts one end of the leaf. You can keep the crossing open long enough for the loaded ants to return, send the next wave around it, or spend the material you saved for a second nursery.

The nest and the surface occupy the same portrait view. A seed picked up above ground travels all the way to a store below ground. A newly emerged worker leaves the nursery and can join the next trip. The player controls trails, work sites, and the share of the colony available for each job. Individual ants choose their paths.

The previous build’s strongest result was the 5,000-ant sandbox. The owner stayed for 1,035 seconds, issued 81 orders, and saw 2,122 deliveries. That averages one order per 12.8 seconds and 2.05 deliveries per second. In colony play, the owner already knew to draw a trail within two or three seconds. The game then took 73 seconds to return the first food, when it returned at all. I would keep the immediate freedom to draw, put a substantial colony on screen from the start, and build the strategy around what happens **after a trail succeeds**.

| Scale | Player decision | Result |
|---|---|---|
| Seconds | Draw a route, shift its branch, reserve a passage for returning ants, or call workers home. | A visible wave turns. The player can follow its first load to its destination. |
| Minutes | Choose a nest investment and decide where to send workers as a crossing changes. | One colony gains a shorter trip. Another can move more loads through its entrance. A third can afford to abandon a flooded store. |
| Several sessions | Establish nests across a connected watershed. Choose which founding stock and supplies to send onward. | Earlier decisions change the opening position at the next site. Each occupied site remains available for free play. |

## The first five minutes

This is a reproducible opening for the first site, **Bent Grass**. The clock below describes one successful replay. Players can act earlier, ignore a prompt, take the other route, or simply watch. The scripted events are the weather, a foraging beetle, and the initial ages of the brood. Deliveries, construction, and recruitment must come from the simulation.

Start with 640 adults. There are 192 surface foragers, 192 excavators, 128 nurses, and 128 unassigned workers. These are current jobs. Any idle adult can change jobs. Twenty-four foragers are at the entrance apron, where the first brush stroke starts. Other foragers occupy the approach lanes behind them. At phone scale the player sees the apron, seed head, store, and nursery without moving the camera.

**Opening arithmetic.** One second is 20 ticks. An unloaded worker advances one cell in five ticks, or four cells per second. A loaded worker advances one cell in ten ticks, or two cells per second. The first seed head is eight cells from the apron. The store’s receiving face is two cells inside the entrance. The first worker travels eight cells in 40 ticks, picks up for 20 ticks, carries ten cells in 100 ticks, and unloads for 20 ticks. That is 180 ticks, or nine seconds from dispatch to credited food. A stroke accepted at second 2 credits food at second 11. The apron, pickup face, and store face each have 24 parallel places in this fixture. Twenty-four distinct workers can complete that trip together.

Sixteen pupae are already mature. Feeding the nursery eight loads at second 12 starts their final 200 ticks of emergence. Sixteen adults join at second 22. Later brood takes 120 seconds from egg to adult with uninterrupted nursing. The opening explicitly shows the difference. The mature pupae have darkened shells at the start. Eggs laid during play must pass through every stage.

**How to read the second-by-second score.** Each row contains ten successive one-second intervals, from left to right. The symbol in the first position applies at the printed second. `·` means the last orders continue for that second. Movement, work, and deliveries continue during those intervals. Letters mark the exact second when a command is accepted or a visible event begins. Lowercase letters belong to the later part of the opening.

```text
second     +0 +1 +2 +3 +4 +5 +6 +7 +8 +9
  0         A  ·  B  ·  C  D  ·  ·  ·  ·
 10         E  F  G  ·  ·  ·  ·  ·  H  ·
 20         ·  ·  I  ·  J  ·  ·  ·  ·  ·
 30         ·  ·  K  ·  ·  ·  L  ·  ·  ·
 40         ·  ·  ·  ·  M  ·  ·  ·  ·  ·
 50         N  ·  ·  ·  O  ·  ·  ·  ·  ·
 60         P  ·  ·  ·  Q  ·  ·  ·  ·  ·
 70         R  ·  ·  ·  ·  ·  S  ·  ·  ·
 80         ·  ·  T  ·  ·  ·  ·  ·  U  ·
 90         ·  ·  ·  ·  V  ·  ·  ·  ·  ·
100         W  ·  ·  ·  ·  ·  ·  ·  ·  ·
110         X  ·  ·  ·  ·  ·  ·  ·  ·  ·
120         Y  ·  ·  ·  ·  ·  Z  ·  ·  ·
130         ·  ·  ·  ·  ·  ·  a  ·  ·  ·
140         ·  ·  b  ·  ·  ·  ·  ·  ·  ·
150         c  ·  ·  ·  ·  ·  ·  ·  ·  ·
160         d  ·  ·  ·  ·  ·  ·  ·  ·  ·
170         e  ·  ·  ·  ·  ·  ·  ·  ·  ·
180         f  ·  ·  ·  ·  ·  ·  ·  ·  ·
190         ·  ·  ·  ·  ·  ·  g  ·  ·  ·
200         ·  ·  ·  ·  h  ·  ·  ·  ·  ·
210         i  ·  ·  ·  ·  ·  ·  ·  ·  ·
220         j  ·  ·  ·  ·  ·  ·  ·  ·  ·
230         k  ·  ·  ·  ·  ·  ·  ·  ·  ·
240         l  ·  ·  ·  ·  ·  ·  ·  ·  ·
250         m  ·  ·  ·  ·  ·  ·  ·  ·  ·
260         n  ·  ·  ·  ·  ·  ·  ·  ·  ·
270         o  ·  ·  ·  ·  ·  ·  ·  ·  ·
280         p  ·  ·  ·  ·  ·  ·  ·  ·  ·
290         q  ·  ·  ·  ·  ·  ·  ·  ·  ·
```

| Seconds | What the player sees and does in this replay |
|---|---|
| 0–11 | **A** opens on moving ants and a seed head shedding grain. **B** draws from apron to grain. **C** shows the first 24 ants at the pickup face. **D** turns them home carrying pale seeds. **E** starts unloading. **F** credits 24 food. The store physically fills. |
| 12–32 | **G** assigns eight food to the mature brood, leaving at least 16 available. **H** selects a second entrance site and reveals the eight cells of soil between it and the existing gallery. **I** shows 16 adults emerge. **J** commits the dig. Eight excavators reach the face together and each removes one cell of a broad soil plug in 160 ticks, or eight seconds. **K** opens the entrance. Empty workers can now leave there while loaded workers use the first entrance. |
| 36–60 | **L** reveals a beetle nosing through the grass, 28 cells from the grain trail. It advances one cell per second. **M** paints an alarm across the approach. Empty ants turn at the branch. Loaded ants already inside the alarm finish their trip if their exit is clear. **N** starts a new clutch of 24 eggs using 12 food. **O** draws a collecting trail to a dry source of plant fibre. **P** shows both routes working and the clutch in its nursery. |
| 64–94 | **Q** brings the beetle onto the old trail after 28 seconds and 28 cells. The player can see which loads the diversion saved. **R** marks an anchor site on the fallen leaf. **S** opens its work face after the assigned crew crosses 24 cells in six seconds. **T** credits the last of eight required fibre loads in this replay. **U** completes anchoring after six seconds, or 120 ticks, of crew work. **V** restores the grain branch as the beetle leaves it. |
| 100–142 | **W** shows the first runoff in the uphill groove. The anchored leaf stays usable. **X** opens the nest cutaway and shows water approaching the lower store. **Y** designates a receiving face in an existing upper chamber. **Z** switches new deposits there. **a** orders transfer of the lower stock. **b** shows the first transfer credited after a one-second pickup, eight loaded cells in four seconds, and a one-second unload. |
| 150–180 | **c** closes the lower store to incoming work. Workers already carrying stock continue upward. **d** floods its floor. Any food left there becomes unavailable until drainage. **e** shows the new clutch emerging at second 170, exactly 2,400 ticks after laying, provided its nursing allocation held. **f** assigns the newly available workers to a route serving the high bank. |
| 196–230 | **g** reveals a split seed pod on the high bank as its husk opens. **h** extends the high route to it. **i** shows water loosening the soil under the first entrance. **j** reserves the second entrance for loaded traffic. **k** recalls the last workers at the low source. The recall preview gives a count of empty workers, laden workers, and workers still beyond the branch. |
| 240–300 | **l** closes the first entrance under water. Traffic continues through the dug entrance. **m** opens a dry nursery on the upper level. **n** assigns nurses to transfer the remaining brood. **o** shows the water crest on the nest wall. **p** releases the entrance reservation as the water drops. **q** shows where the next rain would reach and lets the player inspect the nest at full speed. At **300**, the first crest is over. The report gives actual brood sheltered, stock recovered, and routes still working. Play continues from this exact state. |

The first trip has a fixed travel budget that makes a slow opening diagnosable. Later timings are conditional on the replay’s orders and available crews. Missing the leaf anchor should produce a different crossing. Missing the nursery feed should delay emergence. A delayed colony must never receive a scheduled success animation.

## Orders, ants, and construction

Use the existing three scent fields for **collect**, **work**, and **alarm**. Dragging from a source to a store or touching both endpoints places a collect order. Dragging from an available crew to a marked face places a work order. Painting an alarm excludes an area from new trips. Keeping one finger on a branch opens its two allocations. Slide the divider to change the share of available workers taking each branch. On desktop the same actions use the pointer. Each command also has a tap-only form.

The order preview shows the first trip in seconds, the receiving face, and the number of eligible ants. The preview updates as the endpoint moves. Release commits the order. A single undo retracts the latest order and lets already laden ants deliver. Selecting any existing route shows three counts directly on the ground: waiting to pick up, carrying, and waiting to unload. A store full of food looks different from a store with a queue outside an empty receiving face. That distinction tells the player whether to excavate storage or open another entrance.

Flow fields direct ants toward eligible destinations. Each journey reserves one load at pickup and one receiving place before the return leg. If a destination closes, the load stays with its carrier while the ant selects another reachable face. A worker with no reachable face waits on dry ground. A recalled worker carries its load if a safe return exists. Near a blocked passage, ants spread across marked waiting ground so a queue cannot occupy the only exit. Resolve equal choices by stable integer IDs.

Digging edits the nest cross-section. The player draws a gallery through soil or outlines a chamber against an existing gallery. A preview shows soil to remove, exposed faces, and the lowest elevation that admits water. Crews dig from accessible faces. Opening two ends can finish a long passage sooner, but it commits workers at both ends. A one-cell pilot hole admits water immediately. A receiving chamber starts operating as soon as its first dry face connects. Those two rules make the order of excavation consequential.

Three resources suffice. **Food** sustains brood. **Fibre** anchors crossings and reinforces wet soil. **Dry chamber space** holds stores or brood. Adults are the shared constraint. Sending nurses to rescue stock can interrupt a clutch. Sending every idle worker to a short source can increase the unload queue while a valuable distant source goes untouched. Show the last ten seconds of completed deliveries alongside the forecast before a player increases recruitment.

Eggs, larvae, and pupae occupy visible nursery places. For the standard 120-second cycle, assign 30 seconds to eggs, 60 to larvae, and 30 to pupae. Each interval is 600, 1,200, and 600 ticks respectively. Inadequate nursing pauses progress for the affected places. Carrying brood also pauses progress. Flooded brood becomes a rescue job with a visible deadline. At failure, a dry refuge takes the surviving colony onward with its actual inventory. Rebuilding starts from that population.

## Terrain, opposition, and session shape

Water follows authored elevations and integer spill thresholds. The player can inspect the next three elevations water will reach. Ripples, dark soil, and debris indicate the direction in the ordinary view. A contour overlay gives the precise answer. Rain can open a route by floating a leaf against a bank, then close it when the stem slips. An anchor preserves the crossing until its marked upstream attachment floods. A drainage gallery protects a chamber only if its outlet stays below the chamber and above downstream water. Show both elevations before the dig.

Creatures compete for space, food, or passage. A beetle consumes exposed grain. A woodlouse rolling through loose soil temporarily collapses an unsupported face. A rival colony can occupy an abandoned food route. Alarm redirects workers. Concentrated defenders can hold a junction while other ants pass. Encounters end in retreat, displacement, or loss of access. Give each animal a readable approach, an interval in which the player can act, and a visible reason to leave.

Bent Grass teaches one crest. A later site places two colonies on opposite sides of a basin. One has dry chambers and long food trips. The other has a productive seed bank below the next high-water mark. Another site has almost no spare soil above water, so the player must decide which existing chamber to convert. Reuse the same rules across these sites. Difficulty comes from the joint demands on workers, space, and travel time.

A player can finish a single crest, continue through a sequence of crests, or remove objectives and stay in the same colony. Solo play saves at each accepted order and at periodic simulation checkpoints. Closing the tab freezes solo time. Reopening restores the colony, the camera, and the selected route. The report offers three concrete recollections: the busiest crossing, the first stock lost or rescued, and the excavation that carried the most traffic. Selecting one replays that interval.

Keep **Field** and **Ember** selectable from the first screen. Field uses sunlit grass and pale cargo against darker soil. Ember shows glowing ants with discrete marks for cargo, brood, and alarm. Preserve the owner’s long sandbox session as a first-class use case. The opening screen also offers an established 5,000-ant colony with an editable nest, continuous supplies, and optional weather. It should take one tap to enter and one stroke to give an order.

## Friends by link

A shared room starts with one colony and two independently useful views. One friend may follow a source while another watches the nest. Both can issue any order. A small portrait beside a selected branch shows who is editing it. Commands carry an order revision. If two players change the same revision, the room applies the first accepted command and shows the other player the resulting branch so they can revise it. Separate branches remain independently editable.

The Durable Object sequences accepted commands by tick and sequence number. A joining client receives the existing 60 KB snapshot plus commands after its snapshot tick. Reconnecting clients resend unacknowledged commands under their original IDs. The room deduplicates them. A friend who joins during a flood should see the same stranded loads and the same remaining rescue time as the host. Leaving hands control to the remaining player. The last departure freezes the room. The room link resumes it without an account.

Once shared-colony play works, add neighboring colonies on one watershed. Players can designate a shared crossing, accept food at a transfer face, or build complementary drains. A friend can observe before joining. The host can disable editing for a link. Solo sites use the same simulation and remain fully playable without a room.

## Replay acceptance targets

Record command acceptance, recruitment, pickups, unloads, chamber changes, brood stages, route closures, and state hashes. Measure outcomes from those events. A prompt appearing establishes only that the prompt appeared.

| Bot check | Passing result |
|---|---|
| Opening payoff | On Bent Grass, issue the initial stroke at tick 40. At least one visibly redirected forager moves within five ticks. Exactly 24 first-wave loads credit at tick 220. Withhold the stroke in a control replay. Those 24 loads must never credit from that source. |
| First birth and first pressure | Feed at tick 240. Sixteen new adults appear at tick 440. In the unfed control, none of those pupae emerge. The beetle becomes visible at tick 720 and reaches the trail at tick 1,280. |
| Consequential choices | Across the five-minute fixture, record at least four decisions for which a paired replay changing only that order produces a different resource total, brood count, or reachable route by the crest. Count each decision once. |
| Quiet intervals | During the first 120 seconds of the active reference replay, allow no rolling 15-second window without a delivery, brood transition, newly usable construction face, or newly visible terrain or creature change. Test a watch-only replay separately. |
| Large-colony pace | In the stocked 5,000-ant sandbox, a fixed competent route plan sustains at least two credited loads per second over 120 seconds, or 240 loads. Log order frequency for comparison with the owner’s session. Do not require repeated orders to maintain a functioning route. |
| Simulation and recovery | Replay 6,000 ticks for the opening and a congested 5,000-ant crest. Compare hashes across supported browsers and after snapshot restore. Preserve the existing under-10-ms simulation tick target at 5,000 ants. Measure input latency and rendered frames separately on a physical portrait phone. |

## Scope and milestone order

1. **Prove the trip.** Ship the portrait view, two input methods, cargo, receiving faces, and the 24-load fixture together. Follow one seed from pickup to credit on a phone. The acceptance gate is the nine-second trip through the actual nest.
2. **Prove the colony.** Add job allocation, excavation, brood, capacity, and rerouting. Run Bent Grass through emergence of the player-laid clutch. Remove the second entrance in a comparison replay and verify that traffic changes when the first entrance floods.
3. **Prove the landscape.** Complete the beetle, spill thresholds, anchors, drainage, rescue, and the first crest. Require two viable openings with different costs. Keep the resulting nest playable after the report.
4. **Build the full solo game.** Ship a watershed with six authored sites, founding transfers, repeatable weather seeds, both visual looks, and the established-colony sandbox. Each site must reward an excavation or allocation that performs poorly on at least one other site.
5. **Complete shared play.** Ship shared colonies, spectators, neighboring colonies, room recovery, and conflicting-edit handling. Verify a live join and reconnect during a crest.
6. **Accept on the target devices.** Exercise touch, mouse, tap-only orders, interrupted sessions, dense traffic, and both looks. Use matched replays to compare simulation state. Give the owner a fresh phone opening and a free-play colony to judge pace and depth.

## Five largest risks

| Risk | Test that could reject the design |
|---|---|
| Fast food still feels slow because the player misses its arrival. | Give a first-time phone player the seed route without coaching. After the first trip, ask them to touch the receiving face and say what changed. Compare their answer with the replay. A correct ledger with an unnoticed delivery fails. |
| Every site yields to one dominant route plan. | Run short-route, dry-storage, and early-excavation policies on every site. Reject layouts where one policy wins on sheltered brood, food, and fibre across all starting conditions. Inspect the losing replays for an actionable cause. |
| Thousands of ants hide the decision the player needs to make. | On a physical phone, show matched congested scenes with either a blocked pickup or a blocked unload face. Ask players to relieve the queue in Field and Ember. Verify the selected intervention increases completed trips. |
| Weather feels arbitrary or depends on a scripted rescue. | Start paired replays one tick before a spill threshold. Change only the outlet or anchor. Verify the water follows the displayed elevations and the loss matches stranded inventory. Have a player predict the affected chamber before advancing. |
| Shared edits or restored games duplicate workers or loads. | Interrupt a room during pickup, unloading, brood transfer, and a simultaneous branch edit. Duplicate and reorder client submissions. Rejoin from snapshot and compare the hash and full inventory with uninterrupted authoritative play. |

## Four calls for the owner

| Taste call | Options | My choice for this design |
|---|---|---|
| What should the first screen feel like? | Sunlit **Field** with visible seed traffic; dark **Ember** with glowing workers; local dawn or dusk selecting the initial look | Field. A pale seed crossing the dark store threshold makes the first delivery easy to see. |
| What should a successful crest celebrate? | Brood sheltered; a rich surviving colony; the reach of its working trail network | Brood sheltered. It gives the player a reason to care where they dug. |
| How much loss should persist after a failed crest? | Continue with survivors in a refuge; rewind to the rain warning; let the player choose after seeing the loss | Continue with survivors. The damaged nest gives the next decision a specific purpose. |
| What should a friend see on arrival? | The host’s current view; the busiest crossing; the underground nursery | The host’s view. Both players can point to the same problem before dividing the work. |

The opening timings, site count, brood economy, and replay thresholds are proposed design decisions. The supplied evidence establishes the prior play results and the existing engine capabilities. The new game’s pace, phone readability, and strategic depth still require play acceptance.