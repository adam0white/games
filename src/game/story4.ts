/**
 * Authored fictional household voices and optional conversations. These lines
 * disclose memories, not hidden faults or future progression. Optional choices
 * are single-use conversation only. The host owns elapsed time and HF responses;
 * these authored memories never grant practice or disclose hidden faults.
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
      'I brought it over before the dog’s walk. If you need longer, keep it here; I have the spare at home.',
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
/** Request ordinals refer to the global intake sequence, beginning at zero. */
export function requestStoryBeat(
  owner: string,
  index: number,
  returning = false,
  early = false,
): readonly StoryLine[] {
  if (early) return storyBeat(`return-early-${owner.toLowerCase()}`);
  if (index < 2) return storyBeat(`${returning ? 'return' : 'request'}-${owner.toLowerCase()}`);
  if (returning) {
    return owner === 'Nora'
      ? [
          warm(
            'Nora',
            'Thank you. I will put it back where it belongs and let you know how it holds up.',
          ),
        ]
      : [
          warm(
            'Sam',
            'That is one less thing to work around. Thanks for taking the time to check it.',
          ),
        ];
  }
  if (index < 4) return storyBeat(`callback-${owner.toLowerCase()}`);
  return owner === 'Nora'
    ? [
        warm(
          'Nora',
          'I have another small light for you to look at. Let me tell you where we use this one before you start.',
        ),
        warm('Nora', 'No rush promised. Tell me when you have room for it.'),
      ]
    : [
        warm(
          'Sam',
          'I brought a different torch this time. I have kept the unreliable one separate so we do not confuse them.',
        ),
        warm('Sam', 'If you are full up, I can take it home and bring it another day.'),
      ];
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
  const heard = (id: string) => context.unlocked.includes(`story:${id}`);
  if (context.focusId === 'family' && heard('ask-family-lamp')) {
    add('kitchen-winter', 'Ask about that winter in the front room', [
      warm(
        'Mum',
        'We put the kettle on the sideboard. Nora lent us a camping stove; your dad cooked eggs outside in his coat.',
      ),
      warm(
        'Mum',
        'The kitchen did get finished. We kept eating here on Fridays for a while. It was pleasant having everyone close enough to pass things.',
      ),
    ]);
  }
  if (context.focusId === 'personal' && heard('remember-pencil')) {
    add('lamp-drawing', 'Remember what the pencil line measured', [
      notice(
        'You',
        'You drew beneath this lamp with paper taped to the desk. The line marked how low the shade could go without touching your model roofs.',
      ),
      warm(
        'Mum',
        'There is a flat box of those drawings under the bed. I saved the ones you asked me to save, not every scrap.',
      ),
    ]);
  }
  if (context.focusOwner === 'Nora' && heard('ask-nora-morning')) {
    if (heard('kitchen-winter'))
      add('nora-stove', 'Ask about the borrowed camping stove', [
        warm(
          'Nora',
          'We used it on holidays before the children refused to sleep in a tent. Your mum brought it back cleaner than it left.',
        ),
        warm(
          'Nora',
          'She helped me with curtains that same year. We never kept a list of who owed whom.',
        ),
      ]);
    add('nora-boundary', 'Ask whether other people need repairs', [
      warm(
        'Nora',
        'Probably. But I will ask you before giving anyone your name. Doing me a favour is different from taking everybody’s things.',
      ),
      warm(
        'Nora',
        'If you decide to charge, tell me the price before I leave an object. I would rather pay properly than make you avoid answering the door.',
      ),
    ]);
  }
  if (context.focusOwner === 'Sam' && heard('ask-sam-string')) {
    add('sam-work', 'Ask what Sam likes making', [
      warm(
        'Sam',
        'I mend the dog’s lead and tighten things when they rattle. At work I mostly pack other people’s orders. I like seeing a job through to the person who uses it.',
      ),
      warm(
        'Sam',
        'My shifts change. An afternoon here would need arranging, but I could make time for it.',
      ),
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
    if (heard('ask-dad-bench')) {
      add('dad-cabinet', 'Ask about the unfinished cabinet', [
        warm(
          'Dad',
          'Those two doors against the wall are for the kitchen. The cabinet is usable without them. That made it very easy to stop.',
        ),
        warm(
          'Dad',
          'I drew the hinges in this notebook. We can finish it together sometime, if you fancy work that does not fit in a parts tray.',
        ),
      ]);
      add('garage-shared', 'Talk about keeping a place at the bench', [
        warm(
          'Dad',
          'Use this end. Leave the vice clear and tell me when something is waiting for a part. I will not tidy a half-finished job into the bin.',
        ),
        warm(
          'Dad',
          'If it becomes regular work, we will need somewhere for people to leave things. The garage is still where I make things too.',
        ),
      ]);
    }
    if (heard('ask-old-room')) {
      add('mum-own-time', 'Ask what Mum is reading', [
        warm(
          'Mum',
          'A novel from Nora. She has already asked whether I am past chapter twelve. I asked her not to explain why.',
        ),
        warm(
          'Mum',
          'I like having you here. I also like finishing a chapter. Those can both be true.',
        ),
      ]);
      add('quiet-practice', 'Ask about the quiet room', [
        warm(
          'Mum',
          'I sometimes pray in there as well. I move the ironing board aside and shut the door for a little while.',
        ),
        warm('Mum', 'Then I put it back. The shirts do still need doing.'),
      ]);
    }
    if (context.focusOwner === 'Sam') {
      add('observer-invite', 'Ask Sam to stay and watch sometime', [
        warm('You', 'You can pull up the other stool next time, if you’re curious.'),
        warm(
          'Sam',
          'I am, actually. I’d like to know what you look for before you start taking things apart.',
        ),
        warm(
          'Sam',
          'I promised the dog a walk now. I will be back in about fifty minutes. We can arrange another afternoon to learn properly.',
        ),
      ]);
    }
  }
  return choices;
}
