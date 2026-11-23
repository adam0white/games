# Ant Promotion notes

## 2026-11-22: first playable version

The owner passed on a spoken design for a new game. This is the first build of it: one static page, no server, no paid assets. All art is drawn in code (`art.js`).

You start as an ant in a walled meadow, eat weaker animals to fill a bar, and pick one of three new animals each time the bar fills. There are 18 levels and 55 animals (3 food bugs, the ant, and 3 choices at each of 17 promotions).

### Rules taken as written

| The animal is | It has noticed you | Its speed against yours | What happens |
| --- | --- | --- | --- |
| weaker | no | any | you eat it on touch (the sneak-up) |
| weaker | yes | slower | you eat it on touch |
| weaker | yes | faster | you cannot eat it; it runs and a touch does nothing |
| stronger | yes | faster | it chases you and catches you |
| stronger | yes | slower | it chases you; you can outrun it |

- A power number sits over every animal and over the player.
- Death shows "Died to a X as a Y", takes one level, and returns you to the animal you were before. You may start again as an ant instead.
- Every promotion offers 3 animals. No animal appears twice in the tree. Fire Ant is one of the ant's three choices. Level 17 has no dragon.
- The menu has ant skins: 9 colours and 4 patterns.

### Choices made where the design was open

1. **A weaker animal that is faster and has noticed you does not kill you.** The sentence "notices you and is faster, it eats you" is read as being about stronger animals.
2. **Touching a stronger animal kills you even if it has not noticed you.**
3. **Same speed counts as "not faster".** You can eat a weaker animal of your own speed, and a stronger one of your own speed never closes the gap.
4. **Same power: nothing happens.** The two bump.
5. **Noticing is sight.** Each animal sees a wedge in front of it (about 65 degrees each side). Behind it you are unseen, which is the sneak-up. It stays alert until you are well out of range for 1.5 s.
6. **The three choices at each level are fixed, one of each kind:** strong and slow, fast and weaker, or medium and hard to notice (animals see it from 60% of the distance). The path you took does not change later choices.
7. **Three speeds only** (slow, medium, fast), so "faster than you" is a clear mark (`»`) and not a hidden number.
8. **Level 18 is the top.** Filling the bar there shows a win card; you can keep roaming or start again.
9. **Dying as an ant** keeps you an ant and empties the bar.
10. **Animals do not eat each other.** Only the player eats and is eaten.
11. **Skins colour the ant only.** Later animals keep their own colours and wear a ring in the skin colour.
12. **Progress is saved on the device** (animal path, bar, skin, sound).
13. Quality of life added: pause (button, P, Escape, or leaving the page), 2.5 s of safety after a death, red arrows at the screen edge for hunters you cannot see, a how-to-play page, sound on/off.

### Checks

`node bots.mjs [seeds] [minutes]` runs:

- the contact rule, 9 cells, including the known cases above;
- the tree (3 choices per level, unique names, Fire Ant offered, no dragon at 17);
- food: every playable animal starts in a world with prey it can catch (fewest seen: 31 of 64 animals); a world seeded with only stronger animals must report 0;
- two bots for 12 simulated minutes over 10 seeds. The careful bot reaches a median level of 14 to 18 with 0 deaths; the reckless bot reaches 6 to 9 with 30 to 45 deaths.

A WebKit run at phone size (390 by 844, touch) loaded the page, changed the skin, steered by drag, took a promotion, died, and went back one level with no script errors.

### Not verified

- Feel, speed and sound on a real phone. Nobody has played it by hand.
- Whether it is fun, or the right difficulty for a person. Bots only show that careful play is rewarded.
- The 55 drawings were checked on one contact sheet at one size. Some are plain (Dog, Lynx, Bear) and all are placeholders for the owner's taste.

## 2026-11-22: tester t1's answers and requests (notes #30, #33, #34)

- First impression: "not bad" (#30).
- Tester t1 named Ant Promotion one of the two best games, with Lantern (#33). See `prototypes/NOTES.md`.

### Left as a proposal (2026-11-22, note #34)

- More detailed animal drawings: "too plain for modern games". The look is a taste decision, so it goes through look variants first.
- Sound effects and eat and death effects are a small change, handled in a separate pull request.
