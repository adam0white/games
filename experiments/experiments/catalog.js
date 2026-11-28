// The one list of what the lab page (/lab/) and the experiments page (/experiments/) show. Small games have their
// own list (experiments/small/catalog.js); the story games are listed on the Human Framework site.
// One entry per game: [address, title, one line]. scripts/lab-catalog.test.mjs fails when a folder in experiments/
// or experiments/lab/ is on neither list, so a new game cannot be left off the lab page.
// When a game is archived or folded, take its line out. When an experiment graduates to the small games, move it
// to experiments/small/catalog.js.

// The bigger games, linked straight from the lab page.
export const MAIN = [
  ['/lantern/', 'Lantern', 'Carry the light down the river to dawn. Spark, Tide, Duet and Race modes.'],
  ['/ant-promotion/', 'Ant Promotion', 'Start as an ant, eat what is weaker than you, and pick what you become next.'],
  ['/kitchen/', 'Sky Kitchen', 'Catch falling ingredients, cook them, serve guests and grow a food cart into a restaurant.'],
  ['/cinderhill/', 'Cinderhill', 'Ant colony strategy: dig a nest, raise castes, hold trails and outlast a rival colony. Missions, a tree to grow, rooms with a friend.'],
  ['/exile/', 'Exile', 'A banished heir founds his own kingdom in a forest camp. Third person, made in Unity, best on a computer.'],
  ['/crumbwar/', 'Crumbwar', 'Ant colonies against other players online. Classic, Feast and Rush.'],
];

// Stand-alone experiments, each waiting for a play and a decision: fold into a bigger game, move to small games, or drop.
export const EXPERIMENTS = [
  ['/alibi/', 'Alibi', 'A wordless whodunit. Scrub the clock and catch the alibi that does not match.'],
  ['/borrowed/', 'Borrowed Time', 'Live borrowed lives and name who lies before the candle runs out.'],
  ['/grapevine/', 'Grapevine', 'Route the news through villagers who each change it, so it arrives right.'],
  ['/fixit/', 'Fix-It Stall', 'Mend toys, doors and zips at a market stall before the customer gives up.'],
  ['/ducklings/', 'Follow Me', 'Lead a mother duck home. Each duckling swims exactly where she swam.'],
  ['/nightshift/', 'Tiptoe Museum', 'Freeze runaway exhibits with your torch until they return to their plinths.'],
  ['/vine/', 'Night Vine', 'Grow a vine in a glasshouse with a lamp and a pruning flick.'],
  ['/boat/', 'Paper Boat', 'You never steer the boat. You move the water.'],
  ['/flock/', 'Night Flock', 'Bring the sheep into the fold over twenty evenings in the valley.'],
  ['/harvest/', 'Harvest Morning', 'Cut the wheat and get it to the cart before the storm reaches the field.'],
  ['/breath/', 'Hold Your Breath', 'Run a smoky building floor by floor, breathing only where the air is clean.'],
  ['/matchmaker/', 'Good Match', 'Match each helper on the street to the home that needs them.'],
  ['/sling/', 'Seed Sling', 'Sling seeds from flower to flower until every patch blooms.'],
  ['/duel/', 'Thumb Duel', 'Two players, one phone, nine kinds of quick duels. Or play the bot.'],
];

// Trial pages for a bigger game (experiments/lab/<name>/, notes in experiments/lab/NOTES.md). Fourth item: the game it is for.
export const TRIALS = [
  ['/lab/flame-a/', 'Pass the Flame A', 'A friend’s link hands you a flame. Carry it one leg down the river and pass it on.', 'Lantern'],
  ['/lab/flame-b/', 'Pass the Flame B', 'The same relay, with the camera running back down the lights of everyone before you.', 'Lantern'],
  ['/lab/cinderhill-battle/', 'Cinderhill battle', 'Two colonies meet head-on. Compare a held Alarm with a rally flag.', 'Cinderhill'],
  ['/lab/cinderhill-tournament/', 'Cinderhill tournament', 'Pace your waves in a border ring against three neighbours. Ninety seconds.', 'Cinderhill'],
];

// Other pages the lab page links to as one card each.
export const SMALL_HOME = '/small/';
export const EXPERIMENTS_HOME = '/experiments/';
export const STORY_HOME = 'https://human.adamwhite.work/games/';
