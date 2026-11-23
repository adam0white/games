# Experiment lane notes

Notes that are about the lane as a whole, not one experiment.

## 2026-11-22: where the work goes (tester t1, note #33)

The lab asked "Which game should we put the most work into?". Tester t1, a second owner of the games, answered: Lantern and Ant Promotion are the best current games; put most of the time and effort into those two and drop The Long Road and Copper Afternoon.

### Left as a proposal (2026-11-22)

Focus new work on Lantern and Ant Promotion. Stop new work on The Long Road and Copper Afternoon. Removing them from the site is a separate decision; nothing has been deleted, and both stay playable at `/proto/long-road/` and `/proto/copper-afternoon/`.

## 2026-11-23: the owner's decision

The owner dropped The Long Road and Copper Afternoon. Both moved to `archive/prototypes/` and are no longer served. Copper Afternoon is kept intact there for reuse; see `archive/README.md`.

## 2026-11-23: shared code (owner)

The owner asked for the live games to be kept on shared code as a standing practice. The shared code is `experiments/kit/`; its `README.md` holds the rules and lists what is deliberately not shared yet. `experiments/kit/check/phone.mjs` runs every live experiment in two phone profiles with saves seeded in the formats players already have.
