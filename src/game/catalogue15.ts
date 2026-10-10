/**
 * Finite fictional household repairs across school breaks, followed by two
 * supported light repairs for teaching. Physical methods are deliberately narrow:
 * accessible low-force mechanisms, not mains equipment, sealed machinery or a
 * real repair tutorial. The host owns parts, tests and outcomes; this module
 * supplies object identity, observable detail and authored voices. Inspecting a
 * thing never grants an apprentice its hidden fault or an acquired HF method.
 */
import type { StoryChoice, StoryLine } from './story15';

export type CatalogueForm = 'lamp' | 'torch' | 'timer' | 'bell' | 'box' | 'clip';
export type CatalogueFault =
  | 'battery'
  | 'contact'
  | 'cap'
  | 'jam'
  | 'striker'
  | 'hinge'
  | 'catch-offset'
  | 'spring'
  | 'gear';
export interface CatalogueItem {
  id: string;
  title: string;
  ownerId: 'mum' | 'dad' | 'nora' | 'sam' | 'player';
  owner: 'Mum' | 'Dad' | 'Nora' | 'Sam' | 'You';
  form: CatalogueForm;
  fault: CatalogueFault;
  story: string;
  inspectText: string;
  testText?: string;
  repairText: string;
  requestLines: readonly StoryLine[];
  returnLines: readonly StoryLine[];
  optionalChats?: readonly StoryChoice[];
  requiredPart?: 'holders' | 'springs' | 'gears';
}

const warm = (speaker: string, text: string): StoryLine => ({ speaker, text, tone: 'warm' });
const notice = (speaker: string, text: string): StoryLine => ({ speaker, text, tone: 'notice' });

/** Global request order. Exhaustion means no next item, not another identical lamp. */
export const REPAIR_CATALOGUE: readonly CatalogueItem[] = [
  {
    id: 'friend-0',
    title: 'Nora’s kettle lamp',
    ownerId: 'nora',
    owner: 'Nora',
    form: 'lamp',
    fault: 'contact',
    story:
      'A low amber lamp beside Nora’s kettle. Its little shade keeps the light off the stairs.',
    inspectText:
      'The switch moves freely. A dull patch on the flat battery contact could interrupt the light; the battery still needs testing.',
    testText:
      'The known-good battery does not stop the flicker when the lamp moves. The flat contact needs attention.',
    repairText:
      'You clean the dull patch and reseat the flat contact. The amber pool of light stops trembling.',
    requestLines: [
      warm(
        'Nora',
        'This lives by the kettle. The big light wakes everyone up when I am first down.',
      ),
      warm(
        'Nora',
        'I brought the tin back too. If you are busy, I can leave the lamp another time.',
      ),
    ],
    returnLines: [
      warm(
        'Nora',
        'Lovely. I can make my first cup without lighting the whole stairwell. Keep the tin here; I am admitting defeat.',
      ),
    ],
    optionalChats: [
      {
        id: 'kettle-shade',
        label: 'Ask about the small shade',
        lines: [
          warm(
            'Nora',
            'I cut it from the outside of a biscuit box. The old shade let light up the stairs.',
          ),
          warm(
            'Nora',
            'The picture faces the wall. Otherwise I start thinking about biscuits before breakfast.',
          ),
        ],
      },
    ],
  },
  {
    id: 'friend-1',
    title: 'Sam’s path torch',
    ownerId: 'sam',
    owner: 'Sam',
    form: 'torch',
    fault: 'cap',
    story:
      'A pocket torch with red parcel string for a strap. Sam takes it along the dog-walking path.',
    inspectText:
      'The torch flickers as you turn it in your hands. The flat contact and threaded cap are accessible; neither has been tested separately.',
    testText: 'The known-good battery does not stop the flicker as you move the torch.',
    repairText:
      'You clear the cap thread and seat it squarely. The torch shines without pressure on the end.',
    requestLines: [
      warm(
        'Sam',
        'I dropped this on the path last week, but it was unreliable before that. You should probably know both.',
      ),
      warm('Sam', 'Leave the red string on. I can find it at the bottom of my bag.'),
    ],
    returnLines: [
      warm(
        'Sam',
        'That feels properly seated now. I will not have to hold the end in while I walk.',
      ),
    ],
    optionalChats: [
      {
        id: 'sam-path',
        label: 'Ask where he walks the dog',
        lines: [
          warm(
            'Sam',
            'Along the old loading road. It is quieter there now, except when someone is sorting a returns crate.',
          ),
          warm(
            'Sam',
            'She always wants the same circuit. I am the one who keeps trying shortcuts.',
          ),
        ],
      },
    ],
  },
  {
    id: 'friend-2',
    title: 'Mum’s kitchen timer',
    ownerId: 'mum',
    owner: 'Mum',
    form: 'timer',
    fault: 'jam',
    story:
      'A mechanical kitchen timer shaped like a small pale pear. Its painted stem has worn smooth.',
    inspectText:
      'The outside dial catches at one point. A dry crumb sits in its exposed rim; the inner spring is enclosed and is not opened.',
    testText:
      'A short turn catches at the same place each time. The obstruction is visible at the rim, not a reason to force the winding mechanism.',
    repairText:
      'You clear the exposed rim without opening the spring housing. The dial turns through the sticking point and ticks again.',
    requestLines: [
      warm(
        'Mum',
        'It is sticking again. I use it for the oven, then bring it upstairs so I actually hear it.',
      ),
      warm('Mum', 'Do not force it. If it will not turn, I can watch the clock today.'),
    ],
    returnLines: [
      warm('Mum', 'There is the little ring. I can hear that from the other room. Thank you.'),
    ],
    optionalChats: [
      {
        id: 'timer-carry',
        label: 'Ask why she carries it upstairs',
        lines: [
          warm(
            'Mum',
            'I used to tell myself I would remember. Then I would start one small thing with the ironing and forget the oven.',
          ),
          warm('Mum', 'Taking this with me works better than promising to be a different person.'),
        ],
      },
    ],
  },
  {
    id: 'friend-3',
    title: 'Dad’s bicycle bell',
    ownerId: 'dad',
    owner: 'Dad',
    form: 'bell',
    fault: 'striker',
    story:
      'A steel bicycle bell from Dad’s handlebars. The underside bears the price of a different bicycle in faded ink.',
    inspectText:
      'The thumb lever moves, but its little striker stops short of the bell. The accessible bracket has slipped; the dome is intact.',
    testText:
      'A gentle lever press makes a click instead of a ring. The striker misses the intact rim.',
    repairText:
      'You align the accessible striker bracket and secure it. One lever press gives a clear ring.',
    requestLines: [
      warm('Dad', 'I moved this from the old bicycle. Now it clicks at people instead of ringing.'),
      warm(
        'Dad',
        'I should have tested it before putting the handlebars back. You can have a look while I finish the other end.',
      ),
    ],
    returnLines: [
      warm('Dad', 'That is better. I will fit it back before I put the bicycle away this time.'),
    ],
    optionalChats: [
      {
        id: 'bell-bicycle',
        label: 'Ask about the old bicycle',
        lines: [
          warm(
            'Dad',
            'The frame lasted. The wheel sizes were the trouble. The depot stopped stocking the older one.',
          ),
          warm(
            'Dad',
            'I gave the frame to a man with a matching wheel. Kept the bell. I still like its sound.',
          ),
        ],
      },
    ],
  },
  {
    id: 'friend-4',
    title: 'Nora’s sewing box',
    ownerId: 'nora',
    owner: 'Nora',
    form: 'box',
    fault: 'hinge',
    story:
      'A wooden sewing box with a stiff exterior catch. A strip of blue fabric cushions the contents.',
    inspectText:
      'The exterior catch resists opening. Its joint looks dusty, and a polished mark runs along the keeper where the catch meets it. The wood and mounting screws are sound.',
    testText:
      'With the lid held clear of the keeper, the catch still drags through its travel. The resistance is in the hinge, rather than where the catch meets the keeper.',
    repairText:
      'You clean the accessible hinge and apply the small amount of suitable lubricant Dad keeps for this joint. The catch pivots without forcing the lid.',
    requestLines: [
      warm(
        'Nora',
        'I am getting the catch open with a spoon. That cannot be doing either thing much good.',
      ),
      warm('Nora', 'The blue cloth is loose inside. Keep it with the box, please.'),
    ],
    returnLines: [
      warm(
        'Nora',
        'Now I can get at the needles without fighting the lid. The spoon can go back to being a spoon.',
      ),
    ],
    optionalChats: [
      {
        id: 'sewing-blue-cloth',
        label: 'Ask about the blue cloth',
        lines: [
          warm(
            'Nora',
            'That was the first set of curtains your mum helped me cut. We made the hems too wide and had this strip left.',
          ),
          warm(
            'Nora',
            'I cut a piece off when I need a patch. There is less of it each year, but it is still good cloth.',
          ),
        ],
      },
    ],
  },
  {
    id: 'friend-5',
    title: 'Sam’s rota holder',
    ownerId: 'sam',
    owner: 'Sam',
    form: 'clip',
    fault: 'spring',
    story:
      'A low-force desk clip for Sam’s parts-counter rota. His final school timetable is folded beneath it.',
    inspectText:
      'The clip’s short leaf spring is missing from its open slot. The hinge and jaws are intact; a matching spring is needed before it can hold paper.',
    testText:
      'The jaws move freely and stay open. Adjusting the hinge cannot replace the missing spring.',
    repairText:
      'You fit the sound, compatible recovered leaf spring into its slot. The clip closes gently around the folded rota.',
    requiredPart: 'springs',
    requestLines: [
      warm(
        'Sam',
        'This used to keep my timetable on the desk. The spring came out when I moved everything for cleaning.',
      ),
      warm(
        'Sam',
        'I looked under the desk twice. If you cannot find a matching one, I can use the folder for now.',
      ),
    ],
    returnLines: [
      warm(
        'Sam',
        'There. I can put next week’s hours in when they come. I will try not to lose the small bit again.',
      ),
    ],
    optionalChats: [
      {
        id: 'sam-school-next',
        label: 'Ask about finishing school',
        lines: [
          warm(
            'Sam',
            'I finished this year. People keep asking what I will do, as if I have already picked a place to stand.',
          ),
          warm(
            'Sam',
            'The counter can give me more hours. I would like to try actual repair work before I decide that packing is all I want.',
          ),
        ],
      },
    ],
  },
  {
    id: 'friend-6',
    title: 'Nora’s pantry lamp',
    ownerId: 'nora',
    owner: 'Nora',
    form: 'lamp',
    fault: 'battery',
    story:
      'A broad white lamp from Nora’s pantry. A tiny paper inventory is taped beneath its base.',
    inspectText:
      'The holder and flat contact are sound. The lamp fades evenly rather than flickering when moved; the battery still needs testing.',
    testText:
      'The known-good battery gives steady light. The original cell is tired; the clean contact does not need another cleaning.',
    repairText:
      'You replace the tired cell with the compatible battery Nora supplied. The paper list beneath the base is readable again.',
    requestLines: [
      warm(
        'Nora',
        'This one is from the pantry. I have brought a compatible battery; do not use up the household spare on my account.',
      ),
      warm(
        'Nora',
        'The paper underneath tells me what I meant to put on the shelves. It is not always what is actually there.',
      ),
    ],
    returnLines: [
      warm(
        'Nora',
        'Thank you. I will put it back over the middle shelf. You kept the paper on, good.',
      ),
    ],
    optionalChats: [
      {
        id: 'pantry-list',
        label: 'Ask about the list under the lamp',
        lines: [
          warm(
            'Nora',
            'I wrote it when we got the shelves. Flour, tins, spare jars. I wanted everyone to be able to find things without asking me.',
          ),
          warm(
            'Nora',
            'The jars are full of buttons now. I should update the list instead of explaining it every time.',
          ),
        ],
      },
    ],
  },
  {
    id: 'friend-7',
    title: 'Dad’s returns-crate lamp',
    ownerId: 'dad',
    owner: 'Dad',
    form: 'lamp',
    fault: 'contact',
    story:
      'A sturdy inspection lamp salvaged from a returns crate. The old depot number is crossed out rather than polished away.',
    inspectText:
      'The battery holder is intact. Dust has collected on the flat return contact; the lamp flickers when tilted.',
    testText:
      'The known-good battery still flickers on movement. The accessible flat contact needs cleaning.',
    repairText:
      'You clean the contact and seat it firmly. Light stays steady across the bench; the crossed-out depot number remains.',
    requestLines: [
      warm(
        'Dad',
        'The shade is good and the holder is sound. I took this out before the crate went for sorting.',
      ),
      warm(
        'Dad',
        'I brought the right battery as well. Do not throw it away just because the label says the depot was finished with it.',
      ),
    ],
    returnLines: [
      warm(
        'Dad',
        'Useful again. It can hang over the inspection end. That is a better place for it than another crate.',
      ),
    ],
    optionalChats: [
      {
        id: 'returns-crate',
        label: 'Ask what was in the rest of the crate',
        lines: [
          warm(
            'Dad',
            'Three shades, an unopened replacement panel, and instructions for a unit none of us have seen.',
          ),
          warm(
            'Dad',
            'Someone ordered them for a job. We should keep the numbers with the parts; somebody else might still be trying to finish it.',
          ),
        ],
      },
    ],
  },
];

/** Optional discovered personal project. Its missing gear is not available at discovery. */
export const PERSONAL_PROJECT: CatalogueItem = {
  id: 'paper-street',
  title: 'Your paper-street model',
  ownerId: 'player',
  owner: 'You',
  form: 'box',
  fault: 'gear',
  story:
    'A small wind-up display with paper shop fronts. You replaced its blank buildings with your drawings years ago.',
  inspectText:
    'The exposed drive slot is missing one small gear. The enclosed winding spring is left alone; a measured matching gear is needed, not more winding.',
  testText:
    'The handle moves without carrying the paper street round. Forcing it will not supply the missing gear.',
  repairText:
    'With the compatible recovered gear fitted, the drive carries the paper street through one slow circuit. Its shutters open in order again.',
  requiredPart: 'gears',
  requestLines: [
    notice(
      'You',
      'The flat drawing box also holds the little paper street. Dad found the display base in an old store-room clearance; you drew new fronts for its empty buildings. A salvage-counter card tucked inside reads “Evan — display stands and clockwork bases”, with a number for asking about spare parts.',
    ),
    warm(
      'Dad',
      'I could never find the right gear for that drive. Keep your measurements with it. We can ask when we know what we need.',
    ),
  ],
  returnLines: [
    notice(
      'You',
      'The paper shops turn past in the order you drew them. The faded heading on the base still reads: A BETTER HIGH STREET.',
    ),
  ],
  optionalChats: [
    {
      id: 'paper-street-sign',
      label: 'Read the old heading on the model base',
      lines: [
        notice(
          'You',
          'A BETTER HIGH STREET. A printed plan underneath shows larger windows and a delivery yard that never appeared on the real street.',
        ),
        warm(
          'Dad',
          'It was a display for the proposed rebuilding. The base was good. You wanted doors that opened, so we kept it.',
        ),
        notice(
          'You',
          'Your drawn shop fronts have crooked windows. One says REPAIRS in the careful lettering you used then.',
        ),
      ],
    },
  ],
};

export function catalogueRequest(index: number): CatalogueItem | undefined {
  if (!Number.isInteger(index) || index < 0) return undefined;
  return REPAIR_CATALOGUE[index];
}

export function catalogueItem(id: string): CatalogueItem | undefined {
  if (id === PERSONAL_PROJECT.id) return PERSONAL_PROJECT;
  return REPAIR_CATALOGUE.find((entry) => entry.id === id);
}
