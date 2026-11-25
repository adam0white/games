# Ant biology idea bank for an original ant-colony RTS/base-builder

Date: 2026-11-25. Scope: biology that existing ant games rarely use, translated into mechanics for a 2D/2.5D browser game played with friends by link.

Confidence notes. "Source" names a page I opened in this session. "(from memory)" marks a claim I did not verify against an opened page this session. Where an opened page contradicted my prior, I say so. Search-result snippets I did not open are not cited as sources.

---

## 1. Species and colony strategies

### 1.1 Honeypot ants: repletes as living storage
**Biology.** Repletes (plerergates) are workers whose crops swell with liquid food; other workers fill them and later stroke their antennae to make them regurgitate. In one *Camponotus inflatus* colony, repletes were 46–49% of all ants, up to 191 per chamber. Indigenous Australians dig up to 2 m to reach them. Source: https://en.wikipedia.org/wiki/Honeypot_ant
**Mechanics.**
- Storage is units, not a number. A replete is a stationary unit with HP and a fill level; storage capacity = repletes alive. Raids target repletes, so storage can be stolen by carrying them off (see 1.10).
- Converting a worker into a replete is a one-way commitment: you trade a body for buffer against winter or drought.

### 1.2 Weaver ants (*Oecophylla*): silk nests built with larvae and living chains
**Biology.** Workers pull living leaves together, forming chains by gripping each other's waists when a gap exceeds one ant's reach, then hold larvae against the seam so larval silk binds it. One colony can span 100+ nests across many trees with >500,000 workers; they are territorial and used as orchard biocontrol in Asia and Australia. Source: https://en.wikipedia.org/wiki/Weaver_ant
**Mechanics.**
- Building cost is "larva-time": larvae used as glue are not maturing. Builders must carry a larva to the seam. Expansion competes directly with growth.
- Leaf-gap chains: a gap of N tiles needs N workers locked in a chain while the seam is sewn, so construction pulls labour from foraging.

### 1.3 Trap-jaw ants (*Odontomachus*)
**Biology.** Mandibles lock open at 180° and snap shut when trigger hairs are touched, closing in ~130 µs at peak 126–230 km/h. They use the snap to fling intruders away or to launch themselves backward to escape. Source: https://en.wikipedia.org/wiki/Odontomachus
**Mechanics.**
- Knockback unit: on contact, an enemy is thrown 2–3 tiles (breaks enemy lines and bridges) rather than damaged.
- "Jaw jump" escape: a once-per-cooldown dash backward that makes them good scouts.

### 1.4 Army ants (*Eciton*, *Dorylus*): bivouacs, phase cycle, raid swarms
**Biology.** Army ants have no fixed nest; workers hook legs together into a living bivouac. Colonies alternate a nomadic phase (moving and raiding daily to feed larvae) with a statary phase (pupae develop, queen lays a new batch). Raids are leaderless swarm fronts; antbirds follow raids to eat flushed insects. *Dorylus* can kill small vertebrates; *Eciton* largely cannot. Source: https://en.wikipedia.org/wiki/Army_ant
**Mechanics.**
- A playable "no-base" faction: the bivouac is built from your own workers (each one locked in it is not working). The colony clock forces you to move every N days, then sit still while the brood pupates.
- Raid fronts flush neutral critters; followers (birds) trail your swarm and pick off stragglers, a visible cost of being big.

### 1.5 Slave-making ants (*Polyergus*) and dulosis
**Biology.** Scouts find a host nest, recruit nestmates along a trail, and carry off pupae; the hosts that eclose imprint on the raiders' colony and work for it, even raiding their own species. *Polyergus* queens found colonies by usurpation: entering a host nest, killing the resident queen, and taking over its workers. In some cases enslaved workers rebel and kill many parasite offspring. Source: https://en.wikipedia.org/wiki/Slave-making_ant. Franks and Partridge showed slave-maker battles follow Lanchester's linear law because their chemical "propaganda" breaks enemy cohesion into one-on-one duels. Source: https://www.scientificamerican.com/article/ants-and-the-art-of-war/ (the Wikipedia page itself does not mention propaganda substances). Host rebellion in *Temnothorax* hosts of *Protomognathus americanus* killing parasite pupae (from memory: Achenbach and Foitzik 2009).
**Mechanics.**
- Brood is loot: stealing pupae from a friend converts them into your workers after a delay. Adopted workers keep a "birth colony" tag; a loyalty meter falls if you raid their birth colony again, and at zero they kill your pupae.
- "Propaganda" ability: spray that turns a group fight into duels (linear law), letting a few strong raiders beat many weak defenders.

### 1.6 Turtle ants (*Cephalotes*): living doors
**Biology.** Tree-dwelling turtle ants nest in cavities, and most species have soldiers with disc-shaped heads that plug the entrance like a door. Specialized-soldier species defend only by blocking; less specialized ones also fight. Workers can glide and steer falling back to the trunk. Source: https://en.wikipedia.org/wiki/Cephalotes. Nesting in abandoned beetle borings (from memory).
**Mechanics.**
- Gates are units: a soldier sits in a tunnel opening and is the door. Friendly ants pass with a key-check (nestmate odour, see 2.8); enemies must kill the soldier. Entrance diameter decides how many soldiers a door needs.
- Glide: units falling from height drift back toward their tree instead of dying.

### 1.7 Exploding ants (*Colobopsis saundersi*)
**Biology.** Workers contract the gaster until it ruptures, bursting enlarged mandibular glands and spraying a sticky, corrosive secretion; it is used when a fight is going badly, against rival ants, weaver ants and spiders. Source: https://en.wikipedia.org/wiki/Colobopsis_saundersi
**Mechanics.** Self-destruct worker that leaves a glue patch (slows and damages) rather than doing burst damage; cheap to implement as an area effect and a clear last-stand decision.

### 1.8 Bullet ants (*Paraponera clavata*)
**Biology.** Most painful sting on Schmidt's index, pain lasting up to 24 h, venom contains the neurotoxin poneratoxin. Colonies of several hundred nest at tree bases and forage in the canopy for nectar and small arthropods. Source: https://en.wikipedia.org/wiki/Paraponera_clavata
**Mechanics.** "Paralysis" status: a stung unit is frozen for a few seconds rather than killed. Good for a family mode where fights immobilise instead of kill.

### 1.9 Harvester ants: granaries and foraging by return rate
**Biology.** Harvesters store seeds in granary chambers. Foraging is regulated by returning foragers: the rate of successful returns sets how many workers go out, balancing food gained against water lost. Some seeds dropped en route germinate (diszoochory). Source: https://en.wikipedia.org/wiki/Harvester_ant
**Mechanics.**
- No "send N foragers" button: outflow rises automatically when returns are fast and drops when they slow. Players shape it by placing food, not by micromanaging.
- Seeds dropped on trails sprout into plants, so trails slowly become farms.

### 1.10 Honeypot tournaments (*Myrmecocystus mimicus*)
**Biology.** Neighbouring colonies recruit hundreds of workers to an arena and perform ritualized display fights instead of fighting. If one colony is far stronger, the contest ends fast and it raids the weaker nest, taking workers, brood and repletes; this was the first documented intraspecific slavery. Sources: https://experts.azregents.edu/en/publications/tournaments-and-slavery-in-a-desert-ant/ and https://en.wikipedia.org/wiki/Myrmecocystus. Stilt-walking and raised-gaster postures and the "head-count" assessment hypothesis (from memory: Hölldobler 1976; Lumsden and Hölldobler 1983; the PDF I fetched was a scanned image I could not read).
**Mechanics.**
- Default border conflict is a display contest: both players commit ants to an arena; nobody dies; the side with the larger committed count gains territory or a toll. Only a large ratio (for example 3:1) unlocks a real raid. This makes conflict non-lethal by default and family-safe.

### 1.11 Fungus-growing ants (leafcutters)
**Biology.** Leaf material is substrate for a cultivated fungus that feeds the larvae. *Pseudonocardia* bacteria produce antibiotics that suppress the garden parasite *Escovopsis*. Four worker sizes; minims ride on leaf fragments to fend off phorid flies; waste workers haul spent substrate to a refuse heap. A founding queen keeps a pellet of fungus in a mouth pocket; only ~2.5% of queens found long-lived colonies. Source: https://en.wikipedia.org/wiki/Leafcutter_ant
**Mechanics.**
- Two-step economy: leaves -> garden -> food, with garden disease (*Escovopsis*) that spreads if waste is not removed and is cured by an antibiotic resource.
- Waste dump placement matters: too close to the garden raises disease chance.
- Hitchhiker escort: a small unit riding a carrier blocks parasitoid attacks on it.

### 1.12 Trophobiosis: herding aphids and scale insects
**Biology.** Ants tend sap-feeding hemipterans for honeydew, protect them, build shelters for them, and some move them daily between plants and underground chambers or take them along when relocating. *Acropyga* queens carry a "seed" mealybug on the mating flight. Source: https://en.wikipedia.org/wiki/Trophobiosis. Ants stroking aphids to trigger honeydew release, chemically suppressing aphid wing development, and *Lasius* overwintering aphid eggs in the nest (from memory).
**Mechanics.**
- Herds as livestock: aphid flocks on plants produce honeydew only while tended; untended herds are eaten by ladybirds or fly away. Players move herds between plants (pasture rotation).
- New-colony starter kit: a founding queen can carry one aphid, enabling a farming opener.

### 1.13 Ant-plant mutualism (*Vachellia cornigera* and *Pseudomyrmex*)
**Biology.** The bullhorn acacia's hollow thorns house the ants; the tree feeds them with protein-lipid Beltian bodies and extrafloral nectar. Ants swarm herbivores (including leafcutters and livestock) with alarm pheromone and clear competing seedlings around the tree. Source: https://en.wikipedia.org/wiki/Vachellia_cornigera
**Mechanics.** Partner tree: a plant you can garrison. It pays food per tick while you keep it clear of vines and herbivores; neglect it and it shrinks. A clean co-op and non-violent loop.

### 1.14 Matabele ants (*Megaponera analis*): rescue and medicine
**Biology.** They raid termite sites in columns. Injured ants release mandibular-gland pheromone that summons nestmates to carry them home; ants missing 1–2 legs are rescued, those missing 3+ are not (they do not cooperate). In the nest, nestmates lick wounds, mostly within the first hour; untreated injured ants have ~80% mortality. Infected wounds are signalled by changed cuticular hydrocarbons and treated with antimicrobial metapleural-gland secretions. Source: https://en.wikipedia.org/wiki/Megaponera_analis
**Mechanics.**
- Wounded state instead of death: downed ants emit a call; any friendly unit (including a friend's in co-op) can carry them home, where a medic station treats them within a time window. Very cheap: one state, one timer.
- Triage rule: severely wounded units cannot be saved, making rescue a judgment call.

### 1.15 Raft-forming fire ants (*Solenopsis invicta*)
**Biology.** When water rises, workers link into a floating raft with the queen at the centre and brood on the top; rafts can stay afloat up to 12 days. Monogyne colonies are aggressive to neighbours; polygyne colonies have many queens. Source: https://en.wikipedia.org/wiki/Red_imported_fire_ant
**Mechanics.** Flood event: colonies that raft in time survive and can drift to a new site; rafts of two friendly players can merge.

### 1.16 Ant mills
**Biology.** Army ants separated from the main column lose the pheromone trail and follow each other in a circle; Beebe saw one 370 m round with a 2.5 h lap time; ants may die of exhaustion. Source: https://en.wikipedia.org/wiki/Ant_mill
**Mechanics.** A failure state of the trail system (see 2.2): a closed loop of strong pheromone with no food traps units. Players break it by dropping a "scent breaker" or food. It also makes trail-hijacking a trick: lay a loop to trap enemy foragers.

### 1.17 Supercolonies (Argentine ants)
**Biology.** Introduced populations form supercolonies spanning hundreds to thousands of km with little aggression between nests, tied to genetic uniformity and shared hydrocarbon cues; at borders between supercolonies (San Diego) about 30 million ants die per year. Supercolonies displace native ants. Source: https://en.wikipedia.org/wiki/Argentine_ant. Brandt et al. 2009 synthesized seven methyl-branched hydrocarbons; ants coated with them were attacked by their own nestmates. Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC2775022/
**Mechanics.**
- Alliance by scent: players who share food long enough converge on one colony odour and become one supercolony (shared vision, no friendly fire). An enemy can break the alliance by spraying an odour that makes allies attack each other.

### 1.18 Polydomy
**Biology.** A colony spread across multiple nest sites (Source: https://en.wikipedia.org/wiki/Polydomy, definition only). Sharing workers and brood between nests and spreading risk (from memory).
**Mechanics.** Satellite nests that pool storage but each hold their own brood: losing one nest is not losing the game.

### 1.19 Nuptial flights and colony founding
**Biology.** Winged queens and males leave the nest in flights synchronized across colonies by temperature, humidity and wind; synchronized emergence may swamp predators. After mating queens shed wings, dig a chamber and lay eggs; most fail. Source: https://en.wikipedia.org/wiki/Nuptial_flight. Claustral founding fuelled by histolysis of wing muscles and pleometrosis (co-founding queens, often reduced to one later) (from memory).
**Mechanics.**
- Win condition or prestige loop: the endgame is producing alates and launching a flight on a good-weather day. Each queen that lands founds a new colony in the next round (roguelite carry-over).
- Co-founding: two players' queens can start one nest together; later one must become the sole queen (a co-op tension moment).

### 1.20 Gamergates and queen succession
**Biology.** In ~1% of species (100–200, mostly poneromorphs such as *Diacamma*, *Harpegnathos*, *Dinoponera*), mated workers lay fertilized eggs. Physical contests set a dominance hierarchy; chemical signals inhibit others, and subordinates police; when a gamergate dies a subordinate mates and takes over. Source: https://en.wikipedia.org/wiki/Gamergate_(ant)
**Mechanics.** Queen death is not game over: a succession contest among top workers picks a new layer after a pause. Players can prepare heirs; enemies can try to kill the heir pool.

### 1.21 Social parasites and the large blue butterfly (*Phengaris arion*)
**Biology.** Caterpillars drop to the ground, are found by *Myrmica* foragers, and chemically mimic ant larvae so they are carried into the nest. "Cuckoo" caterpillars imitate queen sounds and are fed ahead of ant brood; "predator" caterpillars eat ant pupae. The cuckoo strategy yields ~6x more butterflies per nest. Source: https://en.wikipedia.org/wiki/Phengaris_arion
**Mechanics.** Neutral infiltrator that a careless colony adopts as "brood"; it eats food (cuckoo) or brood (predator). Detection requires an inspector role. In PvP, a player can seed caterpillars near a rival.

---

## 2. Collective behaviour science as mechanics

### 2.1 Stigmergy
**Biology.** Indirect coordination through marks left in the environment; coined by Grassé in 1959 for termites; ant pheromone trails are the canonical example and inspired ant colony optimization. Source: https://en.wikipedia.org/wiki/Stigmergy
**Mechanic.** Players never command individuals. They paint scent (food, build, alarm) on the map; ants react to local marks. Building is "drop a pebble where pebbles are" (positive feedback).

### 2.2 Trail reinforcement and evaporation
**Biology.** Returning successful foragers lay trail; trails decay; shorter paths get reinforced faster (from memory: Deneubourg double-bridge experiments, 1990). Source for the general mechanism: https://en.wikipedia.org/wiki/Stigmergy
**Mechanic.** A per-tile pheromone grid with deposit and decay is the core engine: about 50 lines of code. Rain wipes it (see 3.1). Enemies can follow your trail to your food.

### 2.3 Recruitment types: tandem, group, mass
**Biology.** In tandem running a leader guides one follower who taps it with antennae; the leader continues only when tapped and runs ~4x slower; Franks and Richardson (2006) called this teaching. Source: https://en.wikipedia.org/wiki/Tandem_running. Mass recruitment by trail and group recruitment (from memory).
**Mechanic.** Three unlockable recruitment tiers: tandem (1 follower, slow, works with no trail, follower learns the route permanently), group (leader + 5), mass (trail, many, but needs a strong trail and is visible to enemies).

### 2.4 Lanchester laws in ant combat
**Biology.** Under the square law, strength scales with numbers squared when many fight at once; under the linear law, fights are one-on-one and individual quality matters. Army and marauder ant fights fit the square law; slave-makers use propaganda to force the linear law; in marauder raids cheap minors take the front line and majors kill. Sources: https://www.scientificamerican.com/article/ants-and-the-art-of-war/ and https://en.wikipedia.org/wiki/Lanchester%27s_laws (meat ants and Argentine ants supported square law; a fire ant study did not).
**Mechanic.** Terrain decides the law: open ground = square law (swarm wins), narrow tunnel = linear law (one champion holds). This gives meaning to soldier castes and choke points without extra code beyond "how many enemies can each unit touch".

### 2.5 Response-threshold task allocation
**Biology.** Each worker has a threshold per task stimulus; probability of engaging rises steeply once stimulus passes threshold. In the reinforcement version, doing a task lowers the threshold, so specialists emerge from identical workers. Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC1688885 (Theraulaz, Bonabeau, Deneubourg 1998).
**Mechanic.** Workers are not assigned; players raise stimuli (hungry larvae, dirty chambers, alarm). Ants that repeat a job become visibly specialized (and faster). Killing a colony's foragers temporarily cripples foraging until others re-specialize. Whether *Pheidole* majors take over minor tasks when minors are lost is contested: *P. pallidula* majors did not compensate across 10–90% major ratios (Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC3014662/), so a game claim of flexibility should be framed as a design choice, not fact.

### 2.6 Age polyethism
**Biology.** Older workers take riskier, outside tasks; in honey bees juvenile hormone shifts task. Source: https://en.wikipedia.org/wiki/Polyethism. Nurse -> nest work -> forager sequence in ants (from memory).
**Mechanic.** Each ant ages through roles automatically (nurse, builder, forager, guard); losses of foragers are real losses of experienced old ants, and a colony whose young die has no future foragers. Cheap: one age counter.

### 2.7 Quorum sensing in nest choice (*Temnothorax*)
**Biology.** Scouts assess candidate sites and recruit by slow tandem runs; once a site's population passes a quorum, recruiters switch to carrying nestmates and brood, which is faster. Quorum was ~5.7 ants in forced (urgent) emigrations vs ~12.7 in unforced; urgent moves were faster but less accurate (~65% vs ~90% chose the good nest). Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC1635101 (Pratt and Sumpter 2006, PNAS).
**Mechanic.** Relocation as a group vote: in co-op, each player's scouts "vote" by standing at candidate sites; when a quorum is reached, everyone moves. A slider trades speed against accuracy (lower quorum = faster but riskier choice). Same mechanic for choosing where to build.

### 2.8 Self-assembled bridges and chains
**Biology.** *Eciton* ants build living bridges that lengthen, widen and shift with traffic; the placement balances the shortcut gained against workers removed from foraging, with no leader (Reid et al. 2015, PNAS; Princeton release returned 403, from search snippets). Source available: weaver-ant chains, https://en.wikipedia.org/wiki/Weaver_ant; bivouacs, https://en.wikipedia.org/wiki/Army_ant
**Mechanic.** Gaps are crossed by spending ants as bridge tiles; heavy traffic keeps them; light traffic dissolves them. Enemy trap-jaws can knock a bridge loose.

### 2.9 Traffic lanes on trails
**Biology.** In *Eciton burchelli*, returning (laden) ants take the centre lane and outbound ants the two outer lanes, emerging from differing turning rules on collision (Couzin and Franks 2003, Proc R Soc B; Princeton release returned 403). Army ant page confirms lane separation by direction: https://en.wikipedia.org/wiki/Army_ant
**Mechanic.** Trail throughput upgrade: a widened trail gets lanes and stops jamming; congested trails slow carriers. Visual payoff for little code.

### 2.10 Nestmate recognition by cuticular hydrocarbons: chemical disguise
**Biology.** Colonies share an odour of cuticular hydrocarbons, partly from diet; ants coated with recognition compounds are attacked by nestmates (Brandt et al. 2009). Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC2775022/ and https://en.wikipedia.org/wiki/Argentine_ant. Social parasites use chemical insignificance or mimicry (from memory: Lenoir et al. reviews). Wound infection is signalled by CHC change: https://en.wikipedia.org/wiki/Megaponera_analis
**Mechanic.** Each colony has a colour-coded scent. A unit rolled in enemy refuse or a killed enemy temporarily wears that scent and passes enemy doors and guards (spy). Guards with an "inspect" action reveal disguises. Diet shifts scent, so trading food with a friend gradually unifies scents (see 1.17).

### 2.11 Myrmecophiles
**Biology.** Beetles, mites, spiders, aphids, hoverflies and even a snail live with ants; some spiders copy ant chemistry to enter nests and eat stores or ants. Guests that harm too much are more likely detected, keeping their numbers low. Source: https://en.wikipedia.org/wiki/Myrmecophily. Large blue caterpillars: section 1.21.
**Mechanic.** A guest ecosystem in your nest: some guests clean (eat mould), some steal food, some eat brood. A "guest book" collection for families, plus a pest-control loop.

---

## 3. Ecology events for a living world

### 3.1 Rain and floods
Rain disrupts flying insects and nuptial flights (https://en.wikipedia.org/wiki/Nuptial_flight); fire ants raft (1.15). Rain erasing surface pheromone trails (from memory, plausible but not verified).
**Mechanic.** Rain wipes the pheromone grid and floods low tunnels; a raft opportunity and a "re-find your food" phase after each storm.

### 3.2 Seasons and diapause
Temperate insects use photoperiod as the main seasonal cue; temperature can trigger diapause or modulate the photoperiod response. Source: https://en.wikipedia.org/wiki/Diapause (no ant specifics on the page). Temperate ants overwinter with brood in diapause (from memory).
**Mechanic.** Winter: no foraging, colony lives on stores (repletes, granaries, aphid eggs). The size of the stockpile, not the army, decides spring.

### 3.3 Predators and parasites
- **Antlions:** larvae dig spiral pits at the angle of repose and flick sand at climbing prey. Source: https://en.wikipedia.org/wiki/Antlion. Mechanic: map hazard tiles; units entering a pit slide in unless pulled out by a chain.
- **Anteaters:** stay about a minute per nest to avoid stings; visit up to 200 nests a day. Source: https://en.wikipedia.org/wiki/Anteater. Mechanic: a roaming boss that drains surface chambers for a short time; deep nests are safe.
- **Birds:** antbirds follow army ant raids (https://en.wikipedia.org/wiki/Army_ant). Mechanic: big surface swarms attract birds.
- **Phorid flies (*Pseudacteon*):** inject an egg; larva moves into the head; the ant leaves the nest and its head falls off ~2 weeks later; introduced in the US against fire ants. Source: https://en.wikipedia.org/wiki/Pseudacteon. One fly can halt foraging of hundreds of fire ant workers, opening food to competitors. Source: https://www.ars.usda.gov/southeast-area/gainesville-fl/cmave/imported-fire-ant-and-household-insects-research/docs/phorid-flies-as-biocontrol-agents/. Mechanic: a "fly overhead" event freezes foraging on open trails; escorts (minims on leaves) counter it.
- **Ophiocordyceps (zombie fungus):** infected *Camponotus* leave the nest, climb ~25 cm and bite a leaf vein (synchronised to solar noon in Thailand); a fruiting body grows from the head and rains spores on the floor; nestmates groom and remove infected ants, and colonies avoid "graveyards". Source: https://en.wikipedia.org/wiki/Ophiocordyceps_unilateralis. Mechanic: infection spreads from graveyard zones; infected units walk away and become spore towers if not carried out of range; hygiene choices.

### 3.4 Day/night and temperature windows
Harvester foraging depends on humidity and water loss (https://en.wikipedia.org/wiki/Harvester_ant). Species-specific thermal foraging windows and thermophilic desert ants such as *Cataglyphis* (from memory).
**Mechanic.** Each species has a temperature band; the map has a day curve. Midday heat closes the surface to some species and opens it to others, so friends playing different species share the map in shifts rather than collide.

---

## 4. Non-violent and co-op angles for families

- **Farming:** aphid ranching (1.12), fungus gardens (1.11), partner trees (1.13), granaries that sprout (1.9).
- **Rescue:** Matabele wounded/carry/treat loop (1.14); rafts in floods (1.15); breaking ant mills (1.16).
- **Contest without death:** honeypot tournaments (1.10) as the default conflict; bullet-ant paralysis (1.8) instead of kills.
- **Trade with other insects:** honeydew for protection with aphids; Beltian bodies from acacias; caterpillar guests as a risky deal.
- **Co-op decisions:** quorum voting on a new home (2.7); co-founding queens (1.19); supercolony merge by shared food (1.17).
- **Collection:** a myrmecophile "guest book" (2.11) and a species field guide unlocked by play.

---

## 5. Top 15 ranked

Score = originality in genre (1–5) x fun as mechanic (1–5) x cheapness in 2D/2.5D web (1–5); max 125. Scores are my judgment, not measured.

| # | Idea | O | F | C | Score | Why |
|---|---|---|---|---|---|---|
| 1 | Honeypot tournaments as default conflict (1.10) | 5 | 5 | 5 | 125 | Non-lethal, family-safe PvP decided by committed counts; one comparison and a raid threshold. |
| 2 | Matabele rescue and wound treatment (1.14) | 5 | 5 | 4 | 100 | A downed state plus carry-home timer turns losses into co-op play. |
| 3 | Pheromone grid with reinforcement/evaporation as the only command (2.1, 2.2) | 4 | 5 | 5 | 100 | Signature control scheme; tiny grid code; touch-friendly painting. |
| 4 | Chemical disguise and scent identity (2.10) | 5 | 5 | 4 | 100 | Spies and odour-locked doors from one colour tag per unit. |
| 5 | Repletes as living, stealable storage (1.1) | 5 | 4 | 5 | 100 | Storage you can see, protect and lose; a sprite with a fill level. |
| 6 | Turtle-ant soldier doors (1.6) | 5 | 4 | 5 | 100 | Defence as a unit in a tile; pairs naturally with scent keys. |
| 7 | Quorum voting for relocation (2.7) | 5 | 4 | 4 | 80 | Real science of group decision becomes a co-op vote with a speed/accuracy slider. |
| 8 | Lanchester law by terrain (2.4) | 4 | 5 | 4 | 80 | Open ground favours swarms, tunnels favour champions; gives choke points meaning. |
| 9 | Aphid ranching and pasture rotation (1.12) | 3 | 5 | 5 | 75 | Calm farming loop for families; herds as moving resources. |
| 10 | Rain wipes trails, floods and rafts (3.1, 1.15) | 4 | 4 | 4 | 64 | World event that resets the map's memory and creates a rescue moment. |
| 11 | Zombie fungus and phorid fly hazards (3.3) | 4 | 4 | 4 | 64 | Distinctive real horrors; hygiene and escort counters; tone down for kids. |
| 12 | Nuptial flight as endgame and carry-over (1.19) | 4 | 4 | 4 | 64 | Defines "winning" as reproduction; feeds a next-round founding. |
| 13 | Living bridges and chains (2.8, 1.2) | 4 | 5 | 3 | 60 | Spending ants as terrain is striking; needs pathfinding over dynamic tiles. |
| 14 | Brood theft with loyalty and rebellion (1.5) | 5 | 4 | 3 | 60 | PvP with memory: adopted workers remember home; needs per-unit tags. |
| 15 | Response-threshold workers that specialize (2.5) | 4 | 3 | 5 | 60 | Players steer stimuli not units; specialists emerge; few lines of code. |

Ties at 60 beat close alternatives (army-ant nomadic faction, leafcutter garden disease, partner acacia tree, ant-mill traps) because they add verbs no other entry covers.

Runners-up: army-ant no-base faction with phase clock (1.4), leafcutter garden with *Escovopsis* and waste dumps (1.11), acacia partner tree (1.13), ant-mill trail traps (1.16), gamergate succession (1.20), supercolony merging (1.17), large blue caterpillar infiltrator (1.21), temperature-shifted species (3.4), exploding glue workers (1.7), trap-jaw knockback (1.3).

---

## 6. Material gaps

- Not verified this session: Couzin and Franks 2003 lane details and Reid et al. 2015 bridge details (Princeton pages returned 403; details from search snippets only); Myrmecocystus display postures and head-count assessment (scanned PDF unreadable); aphid wing suppression and stroking; *Temnothorax* slave rebellion specifics; rain erasing trails; claustral founding and pleometrosis.
- Contested: *Pheidole* major flexibility (species-dependent; *P. pallidula* showed none). Lanchester square law fits some species but not fire ants.

## Sources (opened this session)

- https://en.wikipedia.org/wiki/Honeypot_ant
- https://en.wikipedia.org/wiki/Weaver_ant
- https://en.wikipedia.org/wiki/Army_ant
- https://en.wikipedia.org/wiki/Slave-making_ant
- https://en.wikipedia.org/wiki/Cephalotes
- https://en.wikipedia.org/wiki/Colobopsis_saundersi
- https://en.wikipedia.org/wiki/Odontomachus
- https://en.wikipedia.org/wiki/Megaponera_analis
- https://en.wikipedia.org/wiki/Myrmecocystus
- https://experts.azregents.edu/en/publications/tournaments-and-slavery-in-a-desert-ant/
- https://en.wikipedia.org/wiki/Ant_mill
- https://en.wikipedia.org/wiki/Red_imported_fire_ant
- https://en.wikipedia.org/wiki/Argentine_ant
- https://pmc.ncbi.nlm.nih.gov/articles/PMC2775022/ (Brandt et al. 2009, BMC Biology)
- https://en.wikipedia.org/wiki/Gamergate_(ant)
- https://en.wikipedia.org/wiki/Harvester_ant
- https://en.wikipedia.org/wiki/Vachellia_cornigera
- https://en.wikipedia.org/wiki/Phengaris_arion
- https://en.wikipedia.org/wiki/Paraponera_clavata
- https://en.wikipedia.org/wiki/Stigmergy
- https://en.wikipedia.org/wiki/Tandem_running
- https://en.wikipedia.org/wiki/Temnothorax_albipennis
- https://pmc.ncbi.nlm.nih.gov/articles/PMC1635101 (Pratt and Sumpter 2006, PNAS)
- https://en.wikipedia.org/wiki/Lanchester%27s_laws
- https://www.scientificamerican.com/article/ants-and-the-art-of-war/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC1688885 (Theraulaz, Bonabeau, Deneubourg 1998)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC3014662/ (Pheidole pallidula caste ratio)
- https://en.wikipedia.org/wiki/Trophobiosis
- https://en.wikipedia.org/wiki/Leafcutter_ant
- https://en.wikipedia.org/wiki/Nuptial_flight
- https://en.wikipedia.org/wiki/Myrmecophily
- https://en.wikipedia.org/wiki/Polyethism
- https://en.wikipedia.org/wiki/Polydomy
- https://en.wikipedia.org/wiki/Diapause
- https://en.wikipedia.org/wiki/Ophiocordyceps_unilateralis
- https://en.wikipedia.org/wiki/Pseudacteon
- https://www.ars.usda.gov/southeast-area/gainesville-fl/cmave/imported-fire-ant-and-household-insects-research/docs/phorid-flies-as-biocontrol-agents/
- https://en.wikipedia.org/wiki/Antlion
- https://en.wikipedia.org/wiki/Anteater

Attempted but not readable: Princeton news releases on bridges (2015) and lanes (2003) returned 403; AntWiki *Myrmecocystus mimicus* returned 403; Lumsden and Hölldobler 1983 PDF was a scanned image.
