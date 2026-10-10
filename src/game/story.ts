/**
 * Authored fictional household voices and optional conversations. These lines
 * disclose memories, not hidden faults or future progression. Optional choices
 * are single-use conversation only: no practice, reward or relationship score.
 */
export interface StoryLine {
  speaker: string;
  text: string;
  tone: 'warm' | 'notice' | 'mistake';
}
export interface StoryChoice {
  id: string;
  label: string;
  lines: readonly StoryLine[];
}
export interface StoryContext {
  focusId: string | null;
  focusOwner?: string;
  chapter: string;
  unlocked: readonly string[];
}
const warm = (speaker: string, text: string): StoryLine => ({ speaker, text, tone: 'warm' });
const notice = (speaker: string, text: string): StoryLine => ({ speaker, text, tone: 'notice' });

const beats: Record<string, readonly StoryLine[]> = {
  opening: [
    warm(
      'Mum',
      'Come here a moment. This little lamp keeps flickering. I was just getting to the good bit.',
    ),
  ],
  'talk-family': [
    warm(
      'Mum',
      'It brightens when I hold it still. There’s a spare battery in the drawer, under the takeaway menus.',
    ),
  ],
  'return-family': [
    warm('Mum', 'There. Now I can read without holding the lamp like a candle. Thank you.'),
    warm(
      'Mum',
      'Your old bedside lamp is upstairs, by the way. I never quite got around to clearing that shelf.',
    ),
  ],
  'personal-hint': [
    warm(
      'Mum',
      'Dad kept some broken lamps under his garage bench. He calls them spare parts. I call them the reason the car lives outside.',
    ),
  ],
  'talk-garage': [
    warm('Dad', 'Mind the mug with the screws in it. The empty end of the bench is yours.'),
    notice(
      'You',
      'A narrow strip of bench, an old stool, and the afternoon coming through the open door.',
    ),
  ],
  'search-donor': [
    notice(
      'You',
      'A lamp with a split shade has the right holder. You take only what is sound; the damaged pieces go in the recycling box.',
    ),
    warm(
      'Dad',
      'That one used to hang over the paint tins. I kept it because the switch felt too good to throw away.',
    ),
  ],
  'return-personal': [
    notice(
      'You',
      'The old lamp lights the corner again. There is still a faint pencil mark on its shade.',
    ),
    warm('Mum', 'You can take it home this time. Or leave it here. No one’s booked your room.'),
  ],
  'talk-friends': [
    warm('Mum', 'Nora asked what you were doing out here. I said fixing our things, slowly.'),
    warm(
      'Mum',
      'She has a little kitchen lamp she can bring round. You can say there’s no room if the bench is full.',
    ),
  ],
  'request-nora': [
    warm('Nora', 'This lives by the kettle. The big light wakes everyone up when I’m first down.'),
    warm(
      'Nora',
      'If it’s a nuisance, tell me. I brought the tin back too; don’t let your mum send me home with another cake.',
    ),
  ],
  'request-sam': [
    warm(
      'Sam',
      'My pocket torch. I dropped it on the path last week, but it was unreliable before that. Probably should have mentioned both.',
    ),
    warm(
      'Sam',
      'I can come back after I’ve walked the dog. She won’t let me stand here chatting all afternoon.',
    ),
  ],
  'return-nora': [
    warm(
      'Nora',
      'Lovely. I’ll find the kettle without waking the house. Keep the tin here; I’m admitting defeat.',
    ),
  ],
  'return-sam': [
    warm('Sam', 'Right, no more borrowing my phone as a torch. Thanks for checking it properly.'),
  ],
  'return-early-nora': [
    warm(
      'Nora',
      'Thanks for having a look. I’ll use the big light for now. No need to pretend it’s fixed.',
    ),
  ],
  'return-early-sam': [
    warm('Sam', 'Fair enough. Better to know than find out halfway down the path.'),
  ],
  rest: [
    warm('Mum', 'Tea’s on the step. Come and drink it before you forget.'),
    notice('You', 'For a little while, the half-finished things can stay half finished.'),
  ],
  'rest-garage': [
    warm('Mum', 'I brought the tea out. The cups are on the garage step.'),
    notice('You', 'You leave the work on the bench and sit by the open door.'),
  ],
  'callback-nora': [
    warm('Nora', 'Me again. This one’s from the pantry; apparently I collect little lamps.'),
  ],
  'callback-sam': [
    warm('Sam', 'I found my spare torch. The dog has no opinion on spare torches, but I do.'),
  ],
};

export function storyBeat(id: string): readonly StoryLine[] {
  return beats[id] ?? [];
}
export function itemStory(id: string, owner?: string): string {
  if (id === 'family') return 'Mum’s lamp, tucked beside the chair with her book folded open.';
  if (id === 'personal')
    return 'The lamp from your old room. A faint pencil mark remains on the shade.';
  if (owner === 'Nora')
    return 'A small light by Nora’s kettle, used before the rest of the house wakes.';
  if (owner === 'Sam')
    return 'Sam’s battered pocket torch. A loop of red string replaces its missing strap.';
  return 'An object someone has kept using, until now.';
}

export function optionalStoryChoices(context: StoryContext): StoryChoice[] {
  const choices: StoryChoice[] = [];
  const add = (id: string, label: string, lines: readonly StoryLine[]) => {
    if (!context.unlocked.includes(`story:${id}`)) choices.push({ id, label, lines });
  };
  // The opening remains one action. Conversation becomes optional after arrival.
  if (context.chapter === 'family') return choices;
  if (context.focusId === 'family') {
    add('ask-family-lamp', 'Ask how long she’s had it', [
      warm('Mum', 'Since the winter the kitchen was being redone. We ate in here for weeks.'),
      warm('Mum', 'Your dad swore it would take three days. He still avoids saying which three.'),
    ]);
    add('tease-book', '“You always say it’s the good bit.”', [
      warm('Mum', 'It usually is. You just happen to interrupt at exceptionally good moments.'),
    ]);
  }
  if (context.focusId === 'personal') {
    add('remember-pencil', 'Look at the pencil mark', [
      notice(
        'You',
        'A short line and an uneven date. You used to mark things when you decided they were yours.',
      ),
      warm('Mum', 'You did the same to the stool. That one was harder to put in your suitcase.'),
    ]);
    add('ask-old-room', 'Ask what she uses the room for now', [
      warm('Mum', 'Mostly ironing. Sometimes I sit in there when the front room gets too warm.'),
      warm(
        'Mum',
        'I moved the chair. I hope you don’t mind. The afternoon light is better on the other side.',
      ),
    ]);
  }
  if (context.focusOwner === 'Nora') {
    add('ask-nora-morning', 'Ask about the early mornings', [
      warm(
        'Nora',
        'I like the ten minutes before everyone needs something. Even the kettle sounds quieter.',
      ),
    ]);
  }
  if (context.focusOwner === 'Sam') {
    add('ask-sam-string', 'Ask about the red string', [
      warm('Sam', 'Parcel string. I meant to buy a proper strap, but this one hasn’t let go yet.'),
      warm('Sam', 'Leave it on, will you? I can find red in the bottom of a bag.'),
    ]);
  }
  if (context.chapter === 'garage') {
    add('ask-dad-bench', 'Ask about the marks on the bench', [
      warm(
        'Dad',
        'That round one was a plant pot. The long one was me learning not to clamp over wet glue.',
      ),
      warm('Dad', 'Make your own marks. Just don’t drill through the good mug.'),
    ]);
    if (context.focusOwner === 'Sam') {
      add('observer-invite', 'Ask Sam to stay and watch sometime', [
        warm('You', 'You can pull up the other stool next time, if you’re curious.'),
        warm(
          'Sam',
          'I am, actually. I’d like to know what you look for before you start taking things apart.',
        ),
        warm('Sam', 'Today I promised the dog a walk. Another afternoon?'),
      ]);
    }
  }
  return choices;
}
