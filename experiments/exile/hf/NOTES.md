# Exile HF experiment

## Run it

```sh
scratch=$(mktemp -d)
npm install --prefix "$scratch" --no-audit --no-fund esbuild@0.28.2 @adam0white/human-framework@4.17.0
EXILE_HF_BUILD="$scratch" node experiments/exile/hf/build-hf.mjs
node experiments/exile/hf/check-hf.mjs
node experiments/exile/hf/check-hf.mjs --mutate-determinism
```

The last command intentionally exits nonzero after changing one action in an otherwise identical trace. The committed bundle is the browser artifact and includes the upstream MIT and Sun fdlibm notices.

Open `/exile/?hf=1` to load the bridge before Unity starts. The shipped Unity build still needs the separate C# and `.jslib` integration to call it. TODO for the play-record integration. `experiments/kit/lab.js:38–44` accepts `version` and writes it to `build.a`. It has no field for a boolean HF arm. Play records lack the arm tag.

## Host choices

- The run uses an empty norms catalog for secular medieval fiction. HF's exported `DEFAULT_NORMS` is available for a setting that calls for its authored rules and terminology.
- Unity owns stores, the roster, night and building counts. HF sees an offer book derived from that snapshot. Game-side wood, stone and food production stays outside the bridge. A completed meal spends one ration and reports its physiological intake to HF. An interrupted meal spends nothing. Simultaneous completions draw from the same remaining stock. A villager absent from the snapshot receives no offers and cannot start work or consume food. HF retains their person state.
- Profiles use seed and game ID for deterministic traits, values, starting condition, trust and work preferences. The bridge preserves the external ID type and uses separate HF IDs. Work choices respond to low stores and night watch demand. Homes change how much rest an offer promises. With no work history, the return-to-work suggestion uses the villager's seeded work preference.
- A rally edge closes current activities and opens a fresh HF choice with one ordinary suggestion per present villager. This applies to both edges and can cut a meal or rest short. Follow is offered while rallied. The bridge forwards HF's verdict and narration on the edge, then reports the actual action on each tick. Outside edges it forwards a new HF intention when food or rest is the strongest positive motive of an eat or rest decision. The renderer cannot supply a standalone hunger complaint when eat is unavailable and no HF event gives hunger as a reason.
- The host keeps one fine-fidelity run. Offer revisions are sent on a change in availability or incentive bands. Input changes enter one simulated millisecond before the target to allow same-tick scheduled reconsideration. Arrivals enter one millisecond earlier. Equal or very closely spaced game timestamps may advance by two to three simulated milliseconds to respect closed ingress. Input validation leaves the run available for retry. An HF failure during tick advancement requires reinitialization.

## HF 4.17.0 API findings

- `createPerson` closes after the first step. `person.arrived` accepts the actual newcomer when first present. Arrival and the first offers use separate steps because HF admits input recipients before consuming the batch. [Admission](https://github.com/adam0white/human-framework/blob/v4.17.0/packages/human/src/run-admission.ts#L75-L86) · [Closed ingress and recipient validation](https://github.com/adam0white/human-framework/blob/v4.17.0/packages/human/src/run-admission.ts#L255-L271) · [Arrival dispatch](https://github.com/adam0white/human-framework/blob/v4.17.0/packages/human/src/run-dispatch.ts#L1994-L1996)
- Reproduced a rally assent that never started the chosen action. During an activity review HF emits the verdict and clears the queued suggestion, interrupts the current activity, then schedules a new decision one millisecond after settlement. Ending activities explicitly at rally edges preserved the suggestion until the fresh choice. The benchmark checks that every rally-on assent starts follow by the end of that tick. [Suggestion clearance and active review](https://github.com/adam0white/human-framework/blob/v4.17.0/packages/human/src/run-dispatch.ts#L1092-L1139) · [Decision scheduling](https://github.com/adam0white/human-framework/blob/v4.17.0/packages/human/src/run-dispatch.ts#L1213-L1227) · [Settlement](https://github.com/adam0white/human-framework/blob/v4.17.0/packages/human/src/run-dispatch.ts#L1552-L1560)
- HF requires at least 31 days of chronicle retention. Its decision renderer describes the strongest positive motive. The bridge uses that same motive to select food and rest lines. [Retention validation](https://github.com/adam0white/human-framework/blob/v4.17.0/packages/human/src/run-admission.ts#L77-L86) · [Decision narration](https://github.com/adam0white/human-framework/blob/v4.17.0/packages/human/src/narrate/literal.ts#L262-L275)

## Measurements

Measured on Apple M4 (darwin arm64, Node v26.12.0). The bundle is 808,527 bytes raw and 192,470 bytes gzip.
Five seeds per cast size ran 20 game minutes, sampled every 5 game seconds including both endpoints. The table pools ticks across the five seeds. Init and tick times are in milliseconds.

| Villagers | Init p50 / p95 / max | Host tick p50 / p95 / max | End-to-end tick p50 / p95 / max | Rally-edge host tick p95 |
| ---: | ---: | ---: | ---: | ---: |
| 8 | 3.522 / 5.085 / 5.085 | 27.835 / 53.188 / 104.763 | 27.845 / 53.200 / 104.790 | 66.839 |
| 16 | 5.239 / 6.269 / 6.269 | 84.878 / 331.803 / 914.208 | 84.892 / 331.839 / 914.229 | 440.250 |

Host timing includes HF stepping, settlement, narration and response assembly. End-to-end timing adds JSON encoding and decoding on both sides. The 16-villager host p95 exceeded the 4 ms target.

| Villagers | Seed | Wood | Stone | Farm | Eat | Rest | Guard | Follow | Idle | Eating | Resting |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 8 | 5 | 59 | 65 | 102 | 24 | 652 | 65 | 64 | 889 | 1.3% | 34.0% |
| 8 | 17 | 51 | 34 | 73 | 25 | 599 | 102 | 70 | 966 | 1.3% | 31.2% |
| 8 | 29 | 80 | 17 | 66 | 25 | 614 | 107 | 69 | 942 | 1.3% | 32.0% |
| 8 | 43 | 65 | 32 | 85 | 24 | 660 | 91 | 74 | 889 | 1.3% | 34.4% |
| 8 | 71 | 80 | 38 | 79 | 24 | 684 | 69 | 61 | 885 | 1.3% | 35.6% |
| 16 | 5 | 111 | 120 | 156 | 45 | 1284 | 142 | 161 | 1821 | 1.2% | 33.4% |
| 16 | 17 | 110 | 78 | 160 | 54 | 1225 | 170 | 130 | 1913 | 1.4% | 31.9% |
| 16 | 29 | 119 | 72 | 178 | 55 | 1257 | 156 | 140 | 1863 | 1.4% | 32.7% |
| 16 | 43 | 127 | 88 | 143 | 45 | 1300 | 166 | 159 | 1812 | 1.2% | 33.9% |
| 16 | 71 | 158 | 79 | 142 | 54 | 1323 | 150 | 121 | 1813 | 1.4% | 34.5% |

Action counts sample villagers at the start of each five-second interval. The final endpoint contributes latency but has no duration. Rest and eating shares estimate villager time. Two rallies per run produce four edges.

| Villagers | Assented | Deferred | Modified | Refused | Complied | Commanded |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 8 | 154 | 0 | 0 | 6 | 0 | 0 |
| 16 | 304 | 3 | 0 | 13 | 0 | 0 |

The fixture loses its rations at second 480 and withholds farm output until second 750. The second rally starts at second 600 during that shortage. Work includes wood, stone, farm and guard. The two intervals also differ in simulation time, night and rally state, so this comparison is descriptive.

| Villagers | Stocked work share | Zero-food work share | Rallied with zero food (assented / deferred / modified / refused) |
| ---: | ---: | ---: | ---: |
| 8 | 43.5% | 5.1% | 56 / 0 / 0 / 0 |
| 16 | 44.1% | 3.5% | 111 / 1 / 0 / 0 |

Food first reached zero between seconds 195 and 310. The 8- and 16-villager runs spent 855–970 and 880–935 seconds respectively with no food at tick ingress. They consumed 123 and 243 rations in total without overdrawing stock. Work fell sharply and persisted in some intervals. At the depleted rally onset, the only non-assent was a deferral. HF narrated it as “This time, I put off acting on the advice. I need to rest first.” Sampled refusals cited physical capacity. The fixture supplies no water outcome and HF still models thirst, so the work shares do not identify a hunger effect in isolation.

Seed 5 repeated exactly at both cast sizes for actions, verdicts, lines and food debits. See `hf-measures.json` for per-seed init and tick times, follow counts at each edge, sampled food levels, depleted durations and HF narration.

A separate 25-minute, 16-villager replay of seed 43 completed under the Node CPU profiler. HF step was on stack for 90.0% of samples and its advance functions for 68.3%. The largest self-time source files were memory validation and bookkeeping (20.1%), body span integration (11.4%) and canonical JSON work (10.8%). Garbage collection was 8.4%. Scope and timings come from the unprofiled runs above. [Step probes](https://github.com/adam0white/human-framework/blob/v4.17.0/packages/human/src/run-step.ts#L247-L293) · [Per-person physiology](https://github.com/adam0white/human-framework/blob/v4.17.0/packages/human/src/run-advance.ts#L310-L355)

The benchmark, intentional determinism mutation and repository lane checks passed. A Node module smoke test loaded the actual bundle from the page script, verified the query gate, and observed bridge registration before the stubbed Unity start. The sandbox denied the phone test's localhost bind, so WebGL and the real browser integration remain unverified.
